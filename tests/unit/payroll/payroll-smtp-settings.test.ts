import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_KEY = Buffer.alloc(32, 3).toString('base64');

vi.mock('@/lib/prisma', () => ({
  prisma: {
    payrollSmtpSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  getPayrollSmtpPublicSettings,
  upsertPayrollSmtpSettings,
} from '@/modules/payroll/application/payroll-smtp-settings-service';

describe('payroll smtp settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PAYROLL_SECRETS_KEY', TEST_KEY);
  });

  it('GET public settings never includes password plaintext', async () => {
    vi.mocked(prisma.payrollSmtpSettings.findUnique).mockResolvedValue({
      id: 's1',
      organizationId: 'org-1',
      host: 'smtp.office365.com',
      port: 587,
      username: 'user@cni.hn',
      passwordEncrypted: 'iv.tag.data',
      senderName: 'Servicios Online',
      fromAddress: 'notificaciones@cni.hn',
      replyTo: null,
      updatedById: 'u1',
      updatedAt: new Date(),
    } as never);

    const publicSettings = await getPayrollSmtpPublicSettings('org-1');
    expect(publicSettings).not.toHaveProperty('password');
    expect(publicSettings).not.toHaveProperty('passwordEncrypted');
    expect(publicSettings.passwordConfigured).toBe(true);
    expect(publicSettings.username).toBe('user@cni.hn');
  });

  it('preserves encrypted password when PUT sends empty password', async () => {
    const existingCipher = 'keep.me.stored';
    vi.mocked(prisma.payrollSmtpSettings.findUnique).mockResolvedValue({
      id: 's1',
      organizationId: 'org-1',
      host: 'smtp.office365.com',
      port: 587,
      username: 'user@cni.hn',
      passwordEncrypted: existingCipher,
      senderName: 'Servicios Online',
      fromAddress: 'notificaciones@cni.hn',
      replyTo: null,
      updatedById: 'u1',
      updatedAt: new Date(),
    } as never);
    vi.mocked(prisma.payrollSmtpSettings.update).mockResolvedValue({
      id: 's1',
      organizationId: 'org-1',
      host: 'smtp.office365.com',
      port: 587,
      username: 'user@cni.hn',
      passwordEncrypted: existingCipher,
      senderName: 'Servicios Online',
      fromAddress: 'notificaciones@cni.hn',
      replyTo: null,
      updatedById: 'u1',
      updatedAt: new Date(),
    } as never);

    await upsertPayrollSmtpSettings('org-1', 'u1', {
      host: 'smtp.office365.com',
      port: 587,
      username: 'user@cni.hn',
      password: '   ',
      senderName: 'Servicios Online',
      fromAddress: 'notificaciones@cni.hn',
    });

    expect(prisma.payrollSmtpSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordEncrypted: existingCipher }),
      }),
    );
  });
});
