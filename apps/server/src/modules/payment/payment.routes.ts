import { Router } from 'express';
import { PaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { validateRequest } from '../../common/middlewares/validate.middleware';
import { authenticate, authorize } from '../../common/middlewares/auth.middleware';
import { UserRole } from '@orderup/shared';
import {
  initiateMpesaSchema,
  processCardPaymentSchema,
  processCashPaymentSchema,
  updatePaymentStatusSchema,
  getPaymentStatusSchema,
} from './payment.schema';

const paymentRepository = new PaymentRepository();
const paymentService = new PaymentService(paymentRepository);
const paymentController = new PaymentController(paymentService);

export const paymentRouter = Router();

paymentRouter.get(
  '/',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN]),
  paymentController.getPayments,
);

/**
 * @openapi
 * /payments/mpesa/stkpush:
 *   post:
 *     summary: Trigger Safaricom M-Pesa STK Push prompt to customer phone
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clubUuid, orderUuid, phoneNumber, amount, accountReference]
 *             properties:
 *               clubUuid: { type: string }
 *               orderUuid: { type: string }
 *               phoneNumber: { type: string }
 *               amount: { type: number }
 *               accountReference: { type: string }
 *     responses:
 *       200:
 *         description: STK push prompt dispatched (status PROCESSING)
 */
paymentRouter.post('/mpesa/stkpush', validateRequest(initiateMpesaSchema), paymentController.initiateMpesa);

/**
 * @openapi
 * /payments/mpesa/callback:
 *   post:
 *     summary: Safaricom C2B/STK Push Callback Webhook Listener
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Callback processed and status updated to PAID or FAILED
 */
paymentRouter.post('/mpesa/callback', paymentController.handleMpesaCallback);

/**
 * @openapi
 * /payments/card:
 *   post:
 *     summary: Request Card POS Machine payment
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clubUuid, orderUuid, amount]
 *             properties:
 *               clubUuid: { type: string }
 *               orderUuid: { type: string }
 *               amount: { type: number }
 *               tableNumber: { type: number }
 *     responses:
 *       200:
 *         description: Status set to PENDING and waiter notified to bring POS machine
 */
paymentRouter.post('/card', validateRequest(processCardPaymentSchema), paymentController.processCard);

/**
 * @openapi
 * /payments/cash:
 *   post:
 *     summary: Process Cash payment with exact cash or change calculation
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clubUuid, orderUuid, amount, exactCash]
 *             properties:
 *               clubUuid: { type: string }
 *               orderUuid: { type: string }
 *               amount: { type: number }
 *               tableNumber: { type: number }
 *               exactCash: { type: boolean }
 *               customerCashAmount: { type: number }
 *     responses:
 *       200:
 *         description: Status set to PENDING and change calculated for waiter notification
 */
paymentRouter.post('/cash', validateRequest(processCashPaymentSchema), paymentController.processCash);

/**
 * @openapi
 * /payments/{paymentUuid}/status:
 *   patch:
 *     summary: Update payment status (PENDING, PROCESSING, PAID, FAILED, REFUNDED, CANCELLED)
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: paymentUuid
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payment status updated
 */
paymentRouter.patch(
  '/:paymentUuid/status',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER]),
  validateRequest(updatePaymentStatusSchema),
  paymentController.updateStatus,
);

/**
 * @openapi
 * /payments/{paymentUuid}/status:
 *   get:
 *     summary: Check payment status for polling from customer checkout screen
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: paymentUuid
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Current payment status (PROCESSING, PAID, FAILED, etc.)
 */
paymentRouter.get(
  '/:paymentUuid/status',
  validateRequest(getPaymentStatusSchema),
  paymentController.getStatus,
);

paymentRouter.post(
  '/:paymentUuid/simulate-success',
  validateRequest(getPaymentStatusSchema),
  paymentController.simulateSuccess,
);

