import { IPaymentRepository } from './payment.interface';
import { MpesaAdapter } from './mpesa.adapter';
import { getIO } from '../../config/socket';
import { logger } from '../../config/logger';
import { BadRequestError } from '../../common/errors/app-error';
import { prisma } from '../../config/prisma';

export class PaymentService {
  private mpesaAdapter: MpesaAdapter;

  constructor(private paymentRepository: IPaymentRepository) {
    this.mpesaAdapter = new MpesaAdapter();
  }

  // WORKFLOW 1: M-PESA STK PUSH
  async initiateMpesaStkPush(params: {
    businessUuid?: string;
    clubUuid?: string; // backward compat
    orderUuid: string;
    phoneNumber: string;
    amount: number;
    accountReference: string;
  }) {
    let businessUuid = params.businessUuid || params.clubUuid;
    if (!businessUuid && params.orderUuid) {
      const order = await prisma.order.findUnique({
        where: { orderUuid: params.orderUuid },
        select: { businessUuid: true },
      });
      if (order?.businessUuid) {
        businessUuid = order.businessUuid;
      }
    }
    if (!businessUuid) {
      throw new BadRequestError('Could not resolve businessUuid for order payment');
    }

    // Model A: Look up the specific venue's M-Pesa Shortcode & Passkey
    const business = await prisma.business.findUnique({
      where: { businessUuid },
      select: {
        name: true,
        mpesaShortcode: true,
        mpesaPasskey: true,
        mpesaTransactionType: true,
        isMpesaActive: true,
      },
    });

    const isVenueMpesaConfigured = !!(
      business?.isMpesaActive &&
      business?.mpesaShortcode &&
      business?.mpesaPasskey
    );

    const venueConfig = isVenueMpesaConfigured
      ? {
          shortcode: business.mpesaShortcode,
          passkey: business.mpesaPasskey,
          transactionType: business.mpesaTransactionType || 'CustomerPayBillOnline',
        }
      : undefined;

    const stkResponse = await this.mpesaAdapter.initiateStkPush({
      phoneNumber: params.phoneNumber,
      amount: params.amount,
      accountReference: params.accountReference || business?.name?.slice(0, 12) || 'OrderUp',
      transactionDesc: `Order ${params.accountReference || 'Payment'}`.slice(0, 13),
      venueConfig,
    });

    const payment = await this.paymentRepository.createPayment({
      businessUuid,
      orderUuid: params.orderUuid,
      amount: params.amount,
      paymentMethod: 'MPESA_STK',
      paymentStatus: 'PROCESSING',
      phoneNumber: params.phoneNumber,
      merchantRequestId: stkResponse.MerchantRequestID,
      checkoutRequestId: stkResponse.CheckoutRequestID,
    });

    // Audit: payment initiated
    prisma?.auditLog?.create?.({
      data: {
        businessUuid: businessUuid || null,
        action: 'PAYMENT_INITIATED',
        entityType: 'PAYMENT',
        entityUuid: payment.paymentUuid,
        newValues: { orderUuid: params.orderUuid, amount: params.amount, method: 'MPESA_STK' },
      },
    })?.catch?.(() => {/* non-fatal */});

    return {
      paymentUuid: payment.paymentUuid,
      checkoutRequestId: stkResponse.CheckoutRequestID,
      customerMessage: stkResponse.CustomerMessage,
      status: 'PROCESSING',
      isSimulated: stkResponse.isSimulated ?? false,
      simulationReason: stkResponse.simulationReason,
    };
  }

  async handleMpesaCallback(body: any) {
    logger.info('M-Pesa STK Callback Received:', JSON.stringify(body));

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) return;

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;

    const payment = await this.paymentRepository.findByCheckoutRequestId(checkoutRequestId);
    if (!payment) {
      logger.warn(`No payment record found for CheckoutRequestID: ${checkoutRequestId}`);
      return;
    }

    if (resultCode === 0) {
      // Payment Successful -> Status: PAID
      let receiptNumber = 'RGA_UNKNOWN';
      const items = stkCallback.CallbackMetadata?.Item || [];
      for (const item of items) {
        if (item.Name === 'MpesaReceiptNumber') {
          receiptNumber = item.Value;
        }
      }

      await this.paymentRepository.updateStatus(payment.paymentUuid, 'PAID', receiptNumber);

      // Notify Waiters & Kitchen via Socket.IO
      try {
        const io = getIO();
        const tenantRoom = (payment as any).businessUuid || (payment as any).clubUuid;
        io.to(`tenant:${tenantRoom}`).emit('payment_notification', {
          type: 'MPESA_SUCCESS',
          paymentUuid: payment.paymentUuid,
          orderUuid: payment.orderUuid,
          amount: payment.amount,
          receiptNumber,
          message: `M-Pesa payment of KSh ${payment.amount} received (Receipt: ${receiptNumber}).`,
        });
      } catch (_e) {
        logger.warn('Socket.IO instance not ready to dispatch payment alert.');
      }

      // Audit: payment completed
      prisma?.auditLog?.create?.({
        data: {
          businessUuid: (payment as any).businessUuid || null,
          action: 'PAYMENT_COMPLETED',
          entityType: 'PAYMENT',
          entityUuid: payment.paymentUuid,
          newValues: { amount: payment.amount, receiptNumber, method: 'MPESA_STK' },
        },
      })?.catch?.(() => {/* non-fatal */});
    } else {
      // Payment Failed
      await this.paymentRepository.updateStatus(payment.paymentUuid, 'FAILED');

      // Audit: payment failed
      prisma?.auditLog?.create?.({
        data: {
          businessUuid: (payment as any).businessUuid || null,
          action: 'PAYMENT_FAILED',
          entityType: 'PAYMENT',
          entityUuid: payment.paymentUuid,
          newValues: { resultCode, method: 'MPESA_STK' },
        },
      })?.catch?.(() => {/* non-fatal */});
    }
  }

  // WORKFLOW 2: CREDIT / DEBIT CARD (POS MACHINE)
  async processCardPayment(params: {
    businessUuid: string;
    clubUuid?: string; // backward compat
    orderUuid: string;
    amount: number;
    tableNumber?: number;
  }) {
    const businessUuid = params.businessUuid || params.clubUuid!;
    const paymentNotes = `Bring POS Machine to Table #${params.tableNumber || 'N/A'}`;

    const payment = await this.paymentRepository.createPayment({
      businessUuid,
      orderUuid: params.orderUuid,
      amount: params.amount,
      paymentMethod: 'CARD',
      paymentStatus: 'PENDING',
      paymentNotes,
    });

    const notificationMessage = `Bring POS Machine to Table #${params.tableNumber || 'N/A'} for Order KSh ${params.amount.toLocaleString()}.`;

    // Notify Waiters via Socket.IO
    try {
      const io = getIO();
      io.to(`tenant:${businessUuid}`).emit('waiter_notification', {
        type: 'CARD_POS_REQUEST',
        paymentUuid: payment.paymentUuid,
        orderUuid: params.orderUuid,
        tableNumber: params.tableNumber,
        message: notificationMessage,
      });
    } catch (_e) {
      logger.warn('Socket.IO not initialized to notify waiters.');
    }

    // Audit: Card POS Request
    prisma?.auditLog?.create?.({
      data: {
        businessUuid: businessUuid || null,
        userUuid: (params as any).actorUserUuid || null,
        action: 'PAYMENT_CARD_REQUESTED',
        entityType: 'PAYMENT',
        entityUuid: payment.paymentUuid,
        newValues: { orderUuid: params.orderUuid, amount: params.amount, tableNumber: params.tableNumber },
      },
    })?.catch?.(() => {/* non-fatal */});

    return {
      paymentUuid: payment.paymentUuid,
      status: 'PENDING',
      message: 'Waiter notified: Bring POS Machine.',
    };
  }

  // WORKFLOW 3: CASH PAYMENT (EXACT CASH OR CHANGE CALCULATION)
  async processCashPayment(params: {
    businessUuid: string;
    clubUuid?: string; // backward compat
    orderUuid: string;
    amount: number;
    tableNumber?: number;
    exactCash: boolean;
    customerCashAmount?: number;
    actorUserUuid?: string;
  }) {
    const businessUuid = params.businessUuid || params.clubUuid!;
    let customerCashAmount = params.amount;
    let changeDue = 0;
    let notificationMessage = '';
    let paymentNotes = '';

    if (params.exactCash) {
      customerCashAmount = params.amount;
      changeDue = 0;
      paymentNotes = 'Customer has exact cash.';
      notificationMessage = `Customer at Table #${params.tableNumber || 'N/A'} has exact cash KSh ${params.amount.toLocaleString()}.`;
    } else {
      if (!params.customerCashAmount || params.customerCashAmount < params.amount) {
        throw new BadRequestError(
          `Customer cash amount (KSh ${params.customerCashAmount}) must be greater than order total (KSh ${params.amount})`,
        );
      }
      customerCashAmount = params.customerCashAmount;
      changeDue = customerCashAmount - params.amount;
      paymentNotes = `Customer paying KSh ${customerCashAmount.toLocaleString()}. Bring KSh ${changeDue.toLocaleString()} change.`;
      notificationMessage = `Customer at Table #${params.tableNumber || 'N/A'} paying KSh ${customerCashAmount.toLocaleString()}. Bring KSh ${changeDue.toLocaleString()} change.`;
    }

    const payment = await this.paymentRepository.createPayment({
      businessUuid,
      orderUuid: params.orderUuid,
      amount: params.amount,
      paymentMethod: 'CASH',
      paymentStatus: 'PENDING',
      exactCash: params.exactCash,
      customerCashAmount,
      changeDue,
      paymentNotes,
    });

    // Notify Waiters via Socket.IO
    try {
      const io = getIO();
      io.to(`tenant:${businessUuid}`).emit('waiter_notification', {
        type: 'CASH_PAYMENT_REQUEST',
        paymentUuid: payment.paymentUuid,
        orderUuid: params.orderUuid,
        tableNumber: params.tableNumber,
        exactCash: params.exactCash,
        customerCashAmount,
        changeDue,
        message: notificationMessage,
      });
    } catch (_e) {
      logger.warn('Socket.IO not initialized to notify waiters.');
    }

    // Audit: Cash Request
    prisma?.auditLog?.create?.({
      data: {
        businessUuid: businessUuid || null,
        userUuid: params.actorUserUuid || null,
        action: 'PAYMENT_CASH_REQUESTED',
        entityType: 'PAYMENT',
        entityUuid: payment.paymentUuid,
        newValues: {
          orderUuid: params.orderUuid,
          amount: params.amount,
          tableNumber: params.tableNumber,
          exactCash: params.exactCash,
          customerCashAmount,
          changeDue,
        },
      },
    })?.catch?.(() => {/* non-fatal */});

    return {
      paymentUuid: payment.paymentUuid,
      status: 'PENDING',
      exactCash: params.exactCash,
      customerCashAmount,
      changeDue,
      message: notificationMessage,
    };
  }

  async updateStatus(paymentUuid: string, status: any, actorUserUuid?: string) {
    const payment = await this.paymentRepository.findById(paymentUuid);
    if (!payment) throw new BadRequestError('Payment record not found');
    const updated = await this.paymentRepository.updateStatus(paymentUuid, status);

    // Audit: payment status updated
    prisma?.auditLog?.create?.({
      data: {
        businessUuid: (payment as any).businessUuid || null,
        userUuid: actorUserUuid || null,
        action: 'PAYMENT_STATUS_UPDATED',
        entityType: 'PAYMENT',
        entityUuid: paymentUuid,
        oldValues: { status: (payment as any).paymentStatus },
        newValues: { status },
      },
    })?.catch?.(() => {/* non-fatal */});

    return updated;
  }

  async getPaymentsForBusiness(options: {
    businessUuid: string;
    paymentMethod?: string;
    paymentStatus?: any;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    return this.paymentRepository.findPaymentsForBusiness(options);
  }

  async getPaymentById(paymentUuid: string) {
    return this.paymentRepository.findById(paymentUuid);
  }

  async simulateMpesaPinEntry(paymentUuid: string, _pin?: string) {
    const payment = await this.paymentRepository.findById(paymentUuid);
    if (!payment) throw new BadRequestError('Payment record not found');

    const receiptNumber = 'QA' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const updated = await this.paymentRepository.updateStatus(paymentUuid, 'PAID', receiptNumber);

    // Notify Waiters & Kitchen via Socket.IO
    try {
      const io = getIO();
      const tenantRoom = (payment as any).businessUuid || (payment as any).clubUuid;
      io.to(`tenant:${tenantRoom}`).emit('payment_notification', {
        type: 'MPESA_SUCCESS',
        paymentUuid: payment.paymentUuid,
        orderUuid: payment.orderUuid,
        amount: payment.amount,
        receiptNumber,
        message: `M-Pesa payment of KSh ${payment.amount} confirmed (Receipt: ${receiptNumber}).`,
      });
    } catch (_e) {
      logger.warn('Socket.IO not ready to dispatch payment alert.');
    }

    return {
      paymentUuid: updated.paymentUuid,
      paymentStatus: updated.paymentStatus,
      amount: updated.amount,
      mpesaReceiptNumber: receiptNumber,
      orderUuid: updated.orderUuid,
    };
  }
}
