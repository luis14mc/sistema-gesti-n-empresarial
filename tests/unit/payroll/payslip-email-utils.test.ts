import { describe, expect, it } from 'vitest';
import { isValidEmployeeEmail } from '@/modules/payroll/application/payslip-email-service';
import { truncateDeliveryError } from '@/modules/payroll/application/payslip-delivery-error';
import { getPublicSmtpStatus } from '@/platform/email/smtp-config';

describe('payslip email helpers', () => {
  it('validates employee email addresses', () => {
    expect(isValidEmployeeEmail('empleado@cni.hn')).toBe(true);
    expect(isValidEmployeeEmail('')).toBe(false);
    expect(isValidEmployeeEmail('not-an-email')).toBe(false);
  });

  it('never exposes SMTP password in public status', () => {
    const secret = 'smtp-test-password-xyz';
    const status = getPublicSmtpStatus({
      EMAIL_TRANSPORT: 'smtp',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'user@cni.hn',
      SMTP_PASSWORD: secret,
      SMTP_FROM: 'RRHH <rrhh@cni.hn>',
    });
    expect(JSON.stringify(status)).not.toContain(secret);
    expect(status.passwordConfigured).toBe(true);
  });

  it('redacts password-like fragments from delivery errors', () => {
    const secret = 'super-secret-smtp-pass-12345';
    const truncated = truncateDeliveryError(`SMTP_PASSWORD=${secret} failed auth password=abc`, {
      SMTP_PASSWORD: secret,
    });
    expect(truncated).not.toContain(secret);
    expect(truncated.length).toBeLessThanOrEqual(500);
  });
});
