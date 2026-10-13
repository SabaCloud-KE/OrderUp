import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from './email.service';

vi.mock('../../config/env', () => ({
  env: {
    RESEND_API_KEY: 're_test_key_123',
    EMAIL_FROM: 'OrderUp <devops@sabacloud.co.ke>',
    STAFF_PORTAL_URL: 'https://orderup-staff.vercel.app',
    ADMIN_PORTAL_URL: 'https://orderup-admin.vercel.app',
  },
}));

vi.mock('../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    emailService = new EmailService();
  });

  it('should initialize and have sendUserCredentialsEmail method', () => {
    expect(emailService).toBeDefined();
    expect(typeof emailService.sendUserCredentialsEmail).toBe('function');
  });

  it('should correctly format roles and route portals in credentials email', async () => {
    const sendSpy = vi.spyOn(emailService, 'sendEmail').mockResolvedValue(true);

    const success = await emailService.sendUserCredentialsEmail({
      email: 'waiter@test.co.ke',
      fullName: 'John Waiter',
      rawPassword: 'TempPass123!',
      role: 'WAITER',
      businessName: 'Java House',
      mustChangePassword: true,
    });

    expect(success).toBe(true);
    expect(sendSpy).toHaveBeenCalledTimes(1);

    const callArgs = sendSpy.mock.calls[0][0];
    expect(callArgs.to).toBe('waiter@test.co.ke');
    expect(callArgs.subject).toContain('Welcome to Java House');
    expect(callArgs.html).toContain('John Waiter');
    expect(callArgs.html).toContain('TempPass123!');
    expect(callArgs.html).toContain('role=waiter');
    expect(callArgs.html).toContain('email=waiter%40test.co.ke');
    expect(callArgs.html).toContain('Staff Portal');
    expect(callArgs.html).toContain('Security Notice');
  });

  it('should direct business admin roles to Staff Portal with role=admin', async () => {
    const sendSpy = vi.spyOn(emailService, 'sendEmail').mockResolvedValue(true);

    await emailService.sendUserCredentialsEmail({
      email: 'admin@test.co.ke',
      fullName: 'Alice Admin',
      rawPassword: 'AdminPass456!',
      role: 'ADMIN',
      businessName: 'Serena Hotel',
    });

    const callArgs = sendSpy.mock.calls[0][0];
    expect(callArgs.html).toContain('role=admin');
    expect(callArgs.html).toContain('email=admin%40test.co.ke');
    expect(callArgs.html).toContain('Staff Portal (Admin)');
    expect(callArgs.html).toContain('Business Administrator');
  });

  it('should direct super admin role to Admin Portal', async () => {
    const sendSpy = vi.spyOn(emailService, 'sendEmail').mockResolvedValue(true);

    await emailService.sendUserCredentialsEmail({
      email: 'superadmin@test.co.ke',
      fullName: 'Platform Super Admin',
      rawPassword: 'SuperPass789!',
      role: 'SUPER_ADMIN',
    });

    const callArgs = sendSpy.mock.calls[0][0];
    expect(callArgs.html).toContain('https://orderup-admin.vercel.app');
    expect(callArgs.html).toContain('Super Admin Portal');
    expect(callArgs.html).toContain('Platform Super Administrator');
  });

  it('should support mock mode gracefully when RESEND_API_KEY is not set', async () => {
    // Instantiate with mock mode
    const mockEmailService = new EmailService();
    // @ts-ignore
    mockEmailService.isConfigured = false;
    // @ts-ignore
    mockEmailService.resend = null;

    const result = await mockEmailService.sendEmail({
      to: 'nobody@example.com',
      subject: 'Test Mock',
      html: '<p>Test</p>',
    });

    expect(result).toBe(true);
  });
});
