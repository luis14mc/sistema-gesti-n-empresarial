import { describe, expect, it, vi, beforeEach } from 'vitest';
import { truncateDeliveryError } from '@/modules/payroll/application/payslip-delivery-error';

const SMTP_PASSWORD = 'unit-test-smtp-password-9xYz';
const SMTP_USER = 'smtp-user@cni.hn';

describe('payslip email secret redaction', () => {
  it('strips real SMTP_PASSWORD and SMTP_USER values from error text', () => {
    const raw = `Auth failed for ${SMTP_USER} with secret ${SMTP_PASSWORD}`;
    const sanitized = truncateDeliveryError(raw, { SMTP_PASSWORD, SMTP_USER });
    expect(sanitized).not.toContain(SMTP_PASSWORD);
    expect(sanitized).not.toContain(SMTP_USER);
    expect(sanitized).toContain('[redacted]');
  });
});

describe('sendPayslipEmails failure paths', () => {
  const createAuditRecord = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SMTP_PASSWORD = SMTP_PASSWORD;
    process.env.SMTP_USER = SMTP_USER;
  });

  it('does not persist SMTP secrets in lastError, emailError, audit, or API-shaped message', async () => {
    const delivery = {
      id: 'del-1',
      payslipId: 'ps-1',
      status: 'QUEUED',
      claimedAt: null,
      attempts: 0,
      lastError: null as string | null,
    };
    let payslipEmailError: string | null = null;

    vi.doMock('@/lib/prisma', () => ({
      prisma: {
        payslip: {
          findMany: vi.fn(async () => [
            {
              id: 'ps-1',
              employeeId: 'emp-1',
              year: 2026,
              month: 9,
              periodStart: new Date('2026-08-20'),
              periodEnd: new Date('2026-09-20'),
              neto: { toString: () => '1000' },
              emailStatus: 'NONE',
              employee: { fullName: 'Ana', email: 'ana@cni.hn' },
            },
          ]),
          update: vi.fn(async ({ data }: { data: { emailError?: string | null } }) => {
            payslipEmailError = data.emailError ?? null;
          }),
        },
        payslipEmailDelivery: {
          findFirst: vi.fn(async (args: { where?: { status?: string | { in?: string[] } } }) => {
            if (args.where?.status === 'SENT' || args.where?.status === 'FAILED') return null;
            if (args.where?.status && typeof args.where.status === 'object') return delivery;
            return null;
          }),
          updateMany: vi.fn(async () => {
            delivery.status = 'SENDING';
            return { count: 1 };
          }),
          update: vi.fn(async ({ data }: { data: { lastError?: string | null; status?: string } }) => {
            if (data.lastError !== undefined) delivery.lastError = data.lastError;
            if (data.status) delivery.status = data.status;
          }),
        },
        $transaction: vi.fn(async (ops: unknown[]) => {
          for (const op of ops) await op;
        }),
        payrollSmtpSettings: {
          findUnique: vi.fn(async () => null),
        },
      },
    }));

    vi.doMock('@/platform/security/audit/audit-record', () => ({ createAuditRecord }));
    vi.doMock('@/modules/payroll/application/payroll-service', () => ({
      getPayslipPdfBuffer: vi.fn(async () => ({ buffer: Buffer.from('pdf'), filename: 'x.pdf' })),
    }));
    vi.doMock('@/platform/email/smtp-config', () => ({
      getSmtpRuntimeConfig: vi.fn(() => ({
        EMAIL_TRANSPORT: 'smtp',
        SMTP_HOST: 'smtp.test',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_USER: SMTP_USER,
        SMTP_PASSWORD: SMTP_PASSWORD,
        SMTP_FROM: 'Test <test@test>',
      })),
      getPublicSmtpStatus: vi.fn(() => ({
        replyTo: null,
        passwordConfigured: true,
        from: 'Test <test@test>',
        configured: true,
        host: 'smtp.test',
        port: 587,
        secure: false,
        user: SMTP_USER,
        transport: 'smtp',
      })),
    }));
    vi.doMock('@/platform/email/factory', () => ({
      createEmailTransportForOrganization: vi.fn(),
    }));

    const transport = {
      send: vi.fn(async () => {
        throw new Error(`535 Invalid login ${SMTP_USER} / ${SMTP_PASSWORD}`);
      }),
    };

    const { sendPayslipEmails, truncateDeliveryError: truncateFromService } = await import(
      '@/modules/payroll/application/payslip-email-service'
    );

    await sendPayslipEmails({
      organizationId: 'org-1',
      userId: 'u-1',
      year: 2026,
      month: 9,
      transport,
      timeBudgetMs: 60_000,
    });

    const apiMessage = truncateFromService(`535 Invalid login ${SMTP_USER} / ${SMTP_PASSWORD}`);

    expect(delivery.lastError).not.toContain(SMTP_PASSWORD);
    expect(delivery.lastError).not.toContain(SMTP_USER);
    expect(payslipEmailError).not.toContain(SMTP_PASSWORD);
    expect(createAuditRecord).toHaveBeenCalled();
    const auditCalls = vi.mocked(createAuditRecord).mock.calls as unknown[][];
    expect(JSON.stringify(auditCalls[0]?.[0] ?? {})).not.toContain(SMTP_PASSWORD);
    expect(apiMessage).not.toContain(SMTP_PASSWORD);
    expect(apiMessage).not.toContain(SMTP_USER);
  });
});
