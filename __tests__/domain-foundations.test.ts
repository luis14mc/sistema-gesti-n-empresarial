import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { createTransitionPolicy } from '@/platform/domain/transitions';
import { ConcurrentModificationError, InvalidStatusTransitionError } from '@/platform/domain/errors';
import { assertOptimisticUpdate } from '@/platform/domain/concurrency';
import { createCommandContext } from '@/platform/domain/command-context';
import { withTransactionRetry } from '@/platform/database/transaction-retry';
import { allocateDocumentSequence } from '@/platform/sequences/document-sequence';

describe('Phase 3A domain foundations', () => {
  it('allows only transitions declared by the domain', () => {
    type Status = 'DRAFT' | 'APPROVED' | 'CANCELLED';
    const policy = createTransitionPolicy<Status>({
      DRAFT: ['APPROVED', 'CANCELLED'],
      APPROVED: [],
      CANCELLED: [],
    });
    expect(policy.canTransition('DRAFT', 'APPROVED')).toBe(true);
    expect(() => policy.assertAllowed('APPROVED', 'DRAFT')).toThrow(InvalidStatusTransitionError);
  });

  it('rejects stale optimistic updates', () => {
    expect(() => assertOptimisticUpdate({ count: 0 }, { expectedVersion: 2 })).toThrow(ConcurrentModificationError);
    expect(() => assertOptimisticUpdate({ count: 1 })).not.toThrow();
  });

  it('preserves tenant membership identity in command context', () => {
    const context = createCommandContext({
      authorizationScope: 'organization', userId: 'user-1', organizationId: 'org-1', organizationSlug: 'cni', timezone: 'America/Tegucigalpa', membershipId: 'member-1', role: 'ADMIN',
    }, 'req-1');
    expect(context).toMatchObject({ organizationId: 'org-1', membershipId: 'member-1', role: 'ADMIN', requestId: 'req-1' });
  });

  it('retries only transient Prisma transaction conflicts', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockResolvedValue('committed');
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(withTransactionRetry(operation, { sleep, baseDelayMs: 10 })).resolves.toBe('committed');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 10);
    expect(sleep).toHaveBeenNthCalledWith(2, 20);
  });

  it('does not retry domain or other non-transaction errors', async () => {
    const error = new InvalidStatusTransitionError('DRAFT', 'DRAFT');
    const operation = vi.fn().mockRejectedValue(error);
    await expect(withTransactionRetry(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledOnce();
  });

  it('allocates tenant-scoped sequences with a database-side increment', async () => {
    const upsert = vi.fn().mockResolvedValue({ lastValue: 7 });
    const tx = { documentSequence: { upsert } } as unknown as Prisma.TransactionClient;
    await expect(allocateDocumentSequence(tx, { organizationId: 'org-1', documentType: 'PURCHASE_ORDER', year: 2026 })).resolves.toBe(7);
    expect(upsert).toHaveBeenCalledWith({
      where: { organizationId_documentType_year: { organizationId: 'org-1', documentType: 'PURCHASE_ORDER', year: 2026 } },
      create: { organizationId: 'org-1', documentType: 'PURCHASE_ORDER', year: 2026, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
      select: { lastValue: true },
    });
  });
});
