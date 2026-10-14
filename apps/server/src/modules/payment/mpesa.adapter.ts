import axios from 'axios';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export interface VenueMpesaConfig {
  consumerKey?: string | null;
  consumerSecret?: string | null;
  shortcode?: string | null;
  passkey?: string | null;
  transactionType?: string | null;
  environment?: 'sandbox' | 'production' | null;
}

export interface StkPushParams {
  phoneNumber: string;
  amount: number;
  accountReference?: string;
  transactionDesc?: string;
  venueConfig?: VenueMpesaConfig;
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

  public async getOAuthToken(venueConfig?: VenueMpesaConfig): Promise<{ token: string; simulated: boolean }> {
    const isProduction = venueConfig?.environment
      ? venueConfig.environment === 'production'
      : env.MPESA_ENVIRONMENT === 'production';
    const activeBaseUrl = isProduction
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

    const consumerKey = venueConfig?.consumerKey?.trim() || env.MPESA_CONSUMER_KEY;
    const consumerSecret = venueConfig?.consumerSecret?.trim() || env.MPESA_CONSUMER_SECRET;

    const isMissingConfig =
      !consumerKey ||
      !consumerSecret ||
      consumerKey.startsWith('your_') ||
      consumerKey === 'sandbox_key';

    if (isMissingConfig) {
      if (isProduction) {
        const errorMsg = 'M-Pesa Consumer Key and Secret must be configured for production Daraja.';
        logger.error(`[M-Pesa Production] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      logger.warn('[M-Pesa Sandbox] M-Pesa Consumer Key or Secret not configured. Using simulated mode.');
      return { token: 'simulated_access_token_12345', simulated: true };
    }

    const auth = Buffer.from(`${consumerKey.trim()}:${consumerSecret.trim()}`).toString('base64');

    try {
      logger.info(`[M-Pesa OAuth] Requesting token from ${activeBaseUrl} (${isProduction ? 'PRODUCTION' : 'SANDBOX'})...`);
      const response = await axios.get(
        `${activeBaseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
          timeout: 15000,
        },
      );
      return { token: response.data.access_token, simulated: false };
    } catch (error: any) {
      const errMsg =
        error.response?.data?.errorMessage ||
        error.response?.data?.error ||
        error.message;
      logger.error(`[M-Pesa OAuth Error] Authentication failed on ${activeBaseUrl}: ${errMsg}`, error.response?.data);
      throw new Error(
        `Safaricom M-Pesa OAuth authentication failed (${isProduction ? 'Production' : 'Sandbox'}): ${errMsg}. Please verify your M-Pesa Consumer Key and Secret.`
      );
    }
  }

  public async initiateStkPush(params: StkPushParams): Promise<StkPushResponse> {
    const isProduction = params.venueConfig?.environment
      ? params.venueConfig.environment === 'production'
      : env.MPESA_ENVIRONMENT === 'production';
    const activeBaseUrl = isProduction
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

    const { token, simulated } = await this.getOAuthToken(params.venueConfig);

    let shortcode = params.venueConfig?.shortcode?.trim() || env.MPESA_SHORTCODE || '174379';
    let passkey = params.venueConfig?.passkey?.trim() || env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
    let transactionType = params.venueConfig?.transactionType || env.MPESA_TRANSACTION_TYPE;
    
    // Fallback callback URL if not explicitly set
    const callbackUrl = (env.MPESA_CALLBACK_URL || '').trim() || 'https://orderup-ke.onrender.com/api/v1/payments/mpesa/callback';

    // In Sandbox: Safaricom Sandbox ONLY supports shortcode 174379
    if (!isProduction) {
      if (params.venueConfig?.shortcode && params.venueConfig.shortcode !== '174379') {
        logger.warn(
          `[M-Pesa Sandbox Notice] Venue custom shortcode ${params.venueConfig.shortcode} detected, but Safaricom Sandbox only routes test shortcode 174379. Routing through 174379 for Sandbox.`
        );
        shortcode = '174379';
        passkey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
        transactionType = 'CustomerPayBillOnline';
      }
    }

    // Production credential validation
    if (isProduction) {
      if (!shortcode || shortcode === '174379') {
        throw new Error('A valid M-Pesa Shortcode (Paybill or Till Number) is required in production.');
      }
      if (!passkey || passkey.includes('bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919')) {
        throw new Error('A valid M-Pesa Passkey is required in production. Obtain this from Safaricom Daraja portal.');
      }
      if (!callbackUrl || callbackUrl.includes('localhost') || callbackUrl.includes('127.0.0.1')) {
        throw new Error('MPESA_CALLBACK_URL in production must be a public HTTPS endpoint accessible by Safaricom.');
      }
    }

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
      TransactionType: transactionType,
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
        `${activeBaseUrl}/mpesa/stkpush/v1/processrequest`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 25000,
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

      logger.error(`[M-Pesa STK Push Error] Safaricom request failed: ${errMsg}`, error.response?.data);
      throw new Error(`Safaricom M-Pesa error: ${errMsg}`);
    }
  }

  public async checkDiagnostics(): Promise<{
    environment: 'sandbox' | 'production';
    baseUrl: string;
    hasConsumerKey: boolean;
    hasConsumerSecret: boolean;
    hasPasskey: boolean;
    hasShortcode: boolean;
    callbackUrl: string;
    oauthSuccess: boolean;
    oauthError?: string;
  }> {
    const consumerKey = env.MPESA_CONSUMER_KEY;
    const consumerSecret = env.MPESA_CONSUMER_SECRET;
    const hasConsumerKey = !!(consumerKey && !consumerKey.startsWith('your_') && consumerKey !== 'sandbox_key');
    const hasConsumerSecret = !!(consumerSecret && !consumerSecret.startsWith('your_'));

    let oauthSuccess = false;
    let oauthError: string | undefined;

    if (hasConsumerKey && hasConsumerSecret) {
      try {
        const auth = Buffer.from(`${consumerKey.trim()}:${consumerSecret.trim()}`).toString('base64');
        const res = await axios.get(
          `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
          {
            headers: { Authorization: `Basic ${auth}` },
            timeout: 10000,
          }
        );
        oauthSuccess = !!res.data?.access_token;
      } catch (err: any) {
        oauthError = err.response?.data?.errorMessage || err.response?.data?.error || err.message;
      }
    } else {
      oauthError = 'MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET not provided';
    }

    return {
      environment: env.MPESA_ENVIRONMENT,
      baseUrl: this.baseUrl,
      hasConsumerKey,
      hasConsumerSecret,
      hasPasskey: !!env.MPESA_PASSKEY,
      hasShortcode: !!env.MPESA_SHORTCODE,
      callbackUrl: env.MPESA_CALLBACK_URL || '',
      oauthSuccess,
      oauthError,
    };
  }
}
