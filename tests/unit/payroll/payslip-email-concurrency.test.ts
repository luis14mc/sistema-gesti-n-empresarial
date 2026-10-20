import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { EmailTransport } from '@/platform/email/types';

const createAuditRecord = vi.fn(async () => undefined);
const getPayslipPdfBuffer = vi.fn(async () => ({
  buffer: Buffer.from('%PDF'),
  filename: 'boleta.pdf',
}));

type DeliveryRow = {
  id: string;
  payslipId: string;
  status: string;
  claimedAt: Date | null;
  attempts: number;
  lastError: string | null;
};

const delivery: DeliveryRow = {
  id: 'del-1',
  payslipId: 'ps-1',
  status: 'QUEUED',
  claimedAt: null,
  attempts: 0,
  lastError: null,
};

const prismaMock = {
  payslip: {
    findMany: vi.fn(async () => [
      {
        id: 'ps-1',
        employeeId: 'emp-1',
        year: 2026,
        month: 9,
        periodStart: new Date('2026-08-20'),
        periodEnd: new Date('2026-09-20'),
        neto: { toString: () => '25937.06' },
        emailStatus: 'NONE',
        employee: { id: 'emp-1', fullName: 'Ana', email: ' ana@cni.hn ' },
      },
    ]),
    update: vi.fn(async () => ({})),
  },
  payslipEmailDelivery: {
    findFirst: vi.fn(async (args: { where?: { status?: string | { in?: string[] } } }) => {
      const status = args.where?.status;
      if (status === 'SENT') return null;
      return delivery;
    }),
    create: vi.fn(),
    update: vi.fn(async ({ data }: { data: Partial<DeliveryRow> }) => ({ ...delivery, ...data })),
    updateMany: vi.fn(async ({ where, data }: { where: { id: string; status: string }; data: Partial<DeliveryRow> }) => {
      if (delivery.id !== where.id || delivery.status !== where.status) {
        return { count: 0 };
      }
      delivery.status = data.status ?? delivery.status;
      delivery.claimedAt = data.claimedAt ?? delivery.claimedAt;
      delivery.attempts += 1;
      return { count: 1 };
    }),
  },
  $transaction: vi.fn(async (ops: unknown[]) => {
    for (const op of ops) await op;
  }),
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/audit', () => ({ createAuditRecord }));
vi.mock('@/modules/payroll/application/payroll-service', () => ({ getPayslipPdfBuffer }));
vi.mock('@/platform/email/smtp-config', () => ({
  getSmtpRuntimeConfig: vi.fn(),
  getPublicSmtpStatus: vi.fn(() => ({ replyTo: null })),
}));

class CountingTransport implements EmailTransport {
  sends = 0;
  async send() {
    this.sends += 1;
    return { messageId: 'msg-1' };
  }
}

describe('sendPayslipEmails concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delivery.status = 'QUEUED';
    delivery.claimedAt = null;
    delivery.attempts = 0;
    delivery.lastError = null;
  });

  it('sends each payslip exactly once when two batches run concurrently', async () => {
    const transport = new CountingTransport();
    const { sendPayslipEmails } = await import('@/modules/payroll/application/payslip-email-service');
    await Promise.all([
      sendPayslipEmails({
        organizationId: 'org-1',
        userId: 'u-1',
        year: 2026,
        month: 9,
        transport,
        timeBudgetMs: 60_000,
      }),
      sendPayslipEmails({
        organizationId: 'org-1',
        userId: 'u-1',
        year: 2026,
        month: 9,
        transport,
        timeBudgetMs: 60_000,
      }),
    ]);
    expect(transport.sends).toBe(1);
  });
});
