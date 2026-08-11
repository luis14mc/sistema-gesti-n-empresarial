import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { appendSecurityEvent } from '@/platform/security/audit/security-events';
import { appendOutboxEvent } from '@/platform/events/outbox';

describe('Phase 3A event foundations', () => {
  it('appends immutable audit data through the caller transaction', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'audit-1' });
    const tx = { systemAuditEvent: { create } } as unknown as Prisma.TransactionClient;
    await appendSecurityEvent(tx, {
      organizationId: 'org-1', userId: 'user-1', eventType: 'purchase_order.created', outcome: 'SUCCESS', module: 'PURCHASE_ORDERS', entityType: 'PurchaseOrder', entityId: 'order-1', action: 'CREATED', requestId: 'req-1',
      attributes: { password: 'not-for-logs', nested: { sessionToken: 'also-secret', safe: 'retained' } },
    });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      eventType: 'purchase_order.created',
      attributes: { password: '[REDACTED]', nested: { sessionToken: '[REDACTED]', safe: 'retained' } },
    }) });
  });

  it('writes outbox events with aggregate version idempotency data', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'event-1' });
    const tx = { domainEventOutbox: { create } } as unknown as Prisma.TransactionClient;
    await appendOutboxEvent(tx, {
      organizationId: 'org-1', eventType: 'PURCHASE_ORDER_CREATED', aggregateType: 'PurchaseOrder', aggregateId: 'order-1', aggregateVersion: 1, payload: { orderId: 'order-1' },
    });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ aggregateVersion: 1, eventType: 'PURCHASE_ORDER_CREATED' }) });
  });
});
