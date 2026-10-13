import { Resend } from 'resend';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export interface UserCredentialsEmailParams {
  email: string;
  fullName: string;
  rawPassword: string;
  role: string;
  businessName?: string | null;
  loginUrl?: string;
  mustChangePassword?: boolean;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export class EmailService {
  private resend: Resend | null = null;
  private isConfigured: boolean = false;

  constructor() {
    if (env.RESEND_API_KEY && env.RESEND_API_KEY.trim() !== '') {
      this.resend = new Resend(env.RESEND_API_KEY.trim());
      this.isConfigured = true;
      logger.info('📧 Resend Email Service initialized with API key.');
    } else {
      logger.info('📧 Resend Email Service running in mock mode (RESEND_API_KEY not set).');
    }
  }

  /**
   * Format technical role identifiers into human-readable titles
   */
  private formatRole(role: string): string {
    const normalized = (role || '').toUpperCase();
    switch (normalized) {
      case 'SUPER_ADMIN':
        return 'Platform Super Administrator';
      case 'ADMIN':
      case 'CLUB_ADMIN':
      case 'TENANT_ADMIN':
        return 'Business Administrator';
      case 'MANAGER':
        return 'Venue Operations Manager';
      case 'WAITER':
        return 'Service Staff / Waiter';
      default:
        return role;
    }
  }

  /**
   * Determine the appropriate login portal URL based on user role.
   * Business Admin (Owner), Manager, and Waiter all log into the unified Staff Portal.
   * Only Platform Super Admin uses the dedicated Admin Portal.
   */
  private resolvePortalUrl(role: string, email?: string): { url: string; portalName: string } {
    const normalized = (role || '').toUpperCase();

    if (normalized === 'SUPER_ADMIN') {
      return {
        url: env.ADMIN_PORTAL_URL,
        portalName: 'Platform Super Admin Portal',
      };
    }

    const baseStaffUrl = (env.STAFF_PORTAL_URL || 'https://order-up-staffportal.vercel.app').replace(/\/+$/, '');
    const emailParam = email ? `&email=${encodeURIComponent(email)}` : '';

    if (normalized === 'ADMIN' || normalized === 'CLUB_ADMIN' || normalized === 'TENANT_ADMIN') {
      return {
        url: `${baseStaffUrl}?role=admin${emailParam}`,
        portalName: 'Staff Portal (Admin)',
      };
    }

    if (normalized === 'MANAGER') {
      return {
        url: `${baseStaffUrl}?role=manager${emailParam}`,
        portalName: 'Staff Portal (Manager)',
      };
    }

    return {
      url: `${baseStaffUrl}?role=waiter${emailParam}`,
      portalName: 'Staff Portal (Waiter)',
    };
  }

  /**
   * General-purpose email sender
   */
  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const fromAddress = options.from || env.EMAIL_FROM || 'OrderUp <devops@sabacloud.co.ke>';

    if (!this.isConfigured || !this.resend) {
      logger.info(
        `[MOCK EMAIL] From: ${fromAddress} | To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to} | Subject: "${options.subject}"`,
      );
      return true;
    }

    try {
      const response = await this.resend.emails.send({
        from: fromAddress,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (response.error) {
        logger.error(`Failed to send email via Resend to ${options.to}:`, response.error);
        return false;
      }

      logger.info(`Email sent successfully via Resend (ID: ${response.data?.id}) to ${options.to}`);
      return true;
    } catch (error) {
      logger.error(`Exception while sending email via Resend to ${options.to}:`, error);
      return false;
    }
  }

  /**
   * Dispatches a branded welcome & credentials email to newly created users
   */
  async sendUserCredentialsEmail(params: UserCredentialsEmailParams): Promise<boolean> {
    if (!params || !params.email || !params.rawPassword) {
      return false;
    }
    const cleanEmail = (params.email || '').trim().toLowerCase();
    const cleanName = (params.fullName || '').trim() || 'Team Member';
    const readableRole = this.formatRole(params.role);
    const { url: defaultUrl, portalName } = this.resolvePortalUrl(params.role, cleanEmail);
    const portalUrl = params.loginUrl || defaultUrl;
    const businessLabel = params.businessName ? params.businessName.trim() : null;

    const subject = businessLabel
      ? `Welcome to ${businessLabel} — Your OrderUp Login Credentials`
      : `Welcome to OrderUp — Your Login Credentials`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: #0f172a;
      padding: 32px 24px;
      text-align: center;
      border-bottom: 3px solid #2563eb;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 6px 0 0;
      color: #94a3b8;
      font-size: 13px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .content {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 12px;
    }
    .intro {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .card {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 28px;
    }
    .card-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #64748b;
      margin-bottom: 16px;
    }
    .credential-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .credential-row:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    .credential-label {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
    }
    .credential-value {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background: #ffffff;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      display: inline-block;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      color: #1e40af;
      background: #dbeafe;
      border-radius: 9999px;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0 20px;
    }
    .btn {
      background: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      font-size: 15px;
      font-weight: 700;
      border-radius: 10px;
      display: inline-block;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
    }
    .notice {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      color: #92400e;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .footer {
      background: #f8fafc;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>OrderUp Kenya</h1>
      <p>Hospitality Operations Platform</p>
    </div>

    <div class="content">
      <div class="greeting">Hello ${cleanName},</div>
      <p class="intro">
        Your OrderUp account has been successfully created. You have been assigned to
        <strong>${businessLabel ? businessLabel : 'the platform'}</strong> as a
        <span class="badge">${readableRole}</span>.
      </p>

      <div class="card">
        <div class="card-title">Your Login Credentials</div>

        <div style="margin-bottom: 12px;">
          <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 4px;">Login Email / Username:</div>
          <div class="credential-value" style="width: calc(100% - 22px);">${cleanEmail}</div>
        </div>

        <div style="margin-bottom: 12px;">
          <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 4px;">Temporary Password:</div>
          <div class="credential-value" style="width: calc(100% - 22px); color: #2563eb;">${params.rawPassword}</div>
        </div>

        <div>
          <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 4px;">Portal:</div>
          <div style="font-size: 13px; font-weight: 600; color: #334155;">${portalName}</div>
        </div>
      </div>

      ${
        params.mustChangePassword
          ? `
      <div class="notice">
        <strong>Security Notice:</strong> You will be prompted to update your temporary password to a secure permanent password upon your first sign-in.
      </div>`
          : ''
      }

      <div class="btn-container">
        <a href="${portalUrl}" class="btn" target="_blank" rel="noopener noreferrer">
          Sign In to ${portalName} &rarr;
        </a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 20px;">
        Direct link: <a href="${portalUrl}" style="color: #2563eb; word-break: break-all;">${portalUrl}</a>
      </p>
    </div>

    <div class="footer">
      <p>This automated message was sent from <strong>devops@sabacloud.co.ke</strong>.</p>
      <p>Please do not share your temporary credentials with anyone.</p>
      <p>&copy; ${new Date().getFullYear()} OrderUp Kenya. Powered by SabaCloud.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const text = `
Hello ${cleanName},

Your OrderUp account has been successfully created.
${businessLabel ? `Venue: ${businessLabel}\n` : ''}Role: ${readableRole}

--- YOUR LOGIN CREDENTIALS ---
Email: ${cleanEmail}
Temporary Password: ${params.rawPassword}
Portal: ${portalName} (${portalUrl})
------------------------------

${params.mustChangePassword ? 'Security Note: Please change your temporary password upon first login.\n' : ''}
Log in now at: ${portalUrl}

Sent by OrderUp Kenya (devops@sabacloud.co.ke). Powered by SabaCloud.
    `.trim();

    return this.sendEmail({
      to: cleanEmail,
      subject,
      html,
      text,
    });
  }
}

export const emailService = new EmailService();
