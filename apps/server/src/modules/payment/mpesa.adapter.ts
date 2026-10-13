import axios from 'axios';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export interface StkPushParams {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
}

export interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
  isSimulated?: boolean;
  simulationReason?: string;
}

export class MpesaAdapter {
  private get baseUrl(): string {
    return env.MPESA_ENVIRONMENT === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  private maskPhone(phone: string): string {
    if (phone.length >= 8) {
      return `${phone.slice(0, 5)}****${phone.slice(-3)}`;
    }
    return phone;
  }

  private async getOAuthToken(): Promise<{ token: string; simulated: boolean }> {
    const consumerKey = env.MPESA_CONSUMER_KEY;
    const consumerSecret = env.MPESA_CONSUMER_SECRET;
    const isProduction = env.MPESA_ENVIRONMENT === 'production';

    const isMissingConfig =
      !consumerKey ||
      !consumerSecret ||
      consumerKey.startsWith('your_') ||
      consumerKey === 'sandbox_key';

    if (isMissingConfig) {
      if (isProduction) {
        const errorMsg = 'MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET must be configured for production Daraja.';
        logger.error(`[M-Pesa Production] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      logger.warn('[M-Pesa Sandbox] MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET not configured. Using simulated mode.');
      return { token: 'simulated_access_token_12345', simulated: true };
    }

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    try {
      logger.info(`[M-Pesa OAuth] Requesting token from ${this.baseUrl} (${isProduction ? 'PRODUCTION' : 'SANDBOX'})...`);
      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
          timeout: 12000,
        },
      );
      return { token: response.data.access_token, simulated: false };
    } catch (error: any) {
      const errMsg = error.response?.data?.errorMessage || error.response?.data?.error || error.message;
      if (isProduction) {
        logger.error(`[M-Pesa OAuth Error] Production authentication failed: ${errMsg}`);
        throw new Error(`Safaricom M-Pesa OAuth authentication failed: ${errMsg}`);
      }
      logger.warn(`[M-Pesa OAuth Warning] Failed to fetch token: ${errMsg}. Falling back to simulated mode.`);
      return { token: 'simulated_access_token_12345', simulated: true };
    }
  }

  public async initiateStkPush(params: StkPushParams): Promise<StkPushResponse> {
    const isProduction = env.MPESA_ENVIRONMENT === 'production';
    const { token, simulated } = await this.getOAuthToken();

    // Production credential validation
    if (isProduction) {
      if (!env.MPESA_SHORTCODE) {
        throw new Error('MPESA_SHORTCODE (Paybill or Till Number) is required in production.');
      }
      if (!env.MPESA_PASSKEY) {
        throw new Error('MPESA_PASSKEY is required in production. Obtain this from Safaricom Daraja portal.');
      }
      if (!env.MPESA_CALLBACK_URL || env.MPESA_CALLBACK_URL.includes('localhost') || env.MPESA_CALLBACK_URL.includes('127.0.0.1')) {
        throw new Error('MPESA_CALLBACK_URL in production must be a public HTTPS endpoint accessible by Safaricom.');
      }
    }

    const shortcode = env.MPESA_SHORTCODE || '174379';
    const passkey = env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
    const callbackUrl = env.MPESA_CALLBACK_URL || '';

    // Format timestamp in Africa/Nairobi (EAT = UTC+3) YYYYMMDDHHmmss
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const eatDate = new Date(now.getTime() + (3 * 60 + now.getTimezoneOffset()) * 60000);
    const timestamp = `${eatDate.getFullYear()}${pad(eatDate.getMonth() + 1)}${pad(eatDate.getDate())}${pad(eatDate.getHours())}${pad(eatDate.getMinutes())}${pad(eatDate.getSeconds())}`;

    // Passkey password hash
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    // Phone format: 254XXXXXXXXX (12 digits)
    let formattedPhone = params.phoneNumber.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1);
    } else if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.slice(1);
    } else if (formattedPhone.length === 9) {
      formattedPhone = '254' + formattedPhone;
    }

    // Sanitize AccountReference (alphanumeric, max 12 chars per Safaricom spec)
    const cleanAccountRef = (params.accountReference || 'OrderUp')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 12) || 'OrderUp';

    // Sanitize TransactionDesc (max 13 chars)
    const cleanDesc = (params.transactionDesc || 'Order')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .slice(0, 13) || 'Order';

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: env.MPESA_TRANSACTION_TYPE,
      Amount: Math.max(1, Math.ceil(params.amount)),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: cleanAccountRef,
      TransactionDesc: cleanDesc,
    };

    if (simulated) {
      logger.info(`[M-Pesa STK Push] SIMULATED for ${this.maskPhone(formattedPhone)} - Amount: KES ${params.amount}`);
      return {
        MerchantRequestID: `29115-${Date.now()}`,
        CheckoutRequestID: `ws_CO_${Date.now()}`,
        ResponseCode: '0',
        ResponseDescription: 'Simulation Mode: Live Safaricom credentials not provided.',
        CustomerMessage: 'Simulation: Check on-screen prompt to enter test PIN.',
        isSimulated: true,
        simulationReason: 'Daraja API credentials not configured in sandbox mode.',
      };
    }

    try {
      logger.info(
        `[M-Pesa STK Push] Dispatching to Safaricom (${isProduction ? 'PRODUCTION' : 'SANDBOX'}) | Shortcode: ${shortcode} | Phone: ${this.maskPhone(formattedPhone)} | Amount: KES ${payload.Amount}`
      );

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      );

      logger.info(
        `[M-Pesa STK Push] Safaricom Response: ${response.data.ResponseDescription || 'Success'} (CheckoutRequestID: ${response.data.CheckoutRequestID})`
      );

      return {
        ...response.data,
        isSimulated: false,
      };
    } catch (error: any) {
      const errMsg =
        error.response?.data?.errorMessage ||
        error.response?.data?.ResponseDescription ||
        error.response?.data?.error ||
        error.message;

      if (isProduction) {
        logger.error(`[M-Pesa STK Push Error] Production Daraja request failed: ${errMsg}`, error.response?.data);
        throw new Error(`Safaricom M-Pesa error: ${errMsg}`);
      }

      logger.warn(`[M-Pesa STK Push] Safaricom Daraja request failed: ${errMsg}. Falling back to simulated prompt for sandbox.`);
      return {
        MerchantRequestID: `29115-${Date.now()}`,
        CheckoutRequestID: `ws_CO_${Date.now()}`,
        ResponseCode: '0',
        ResponseDescription: `Simulated (Safaricom returned: ${errMsg})`,
        CustomerMessage: 'Simulation: Check on-screen prompt to enter test PIN.',
        isSimulated: true,
        simulationReason: errMsg,
      };
    }
  }
}
