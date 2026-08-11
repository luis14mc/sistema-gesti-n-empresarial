import { describe, expect, it, vi } from 'vitest';
import { buildIdempotencyKey } from '@/modules/notifications/application/idempotency';

describe('buildIdempotencyKey', () => {
  it('produces a deterministic key for the same inputs', () => {
    const a = buildIdempotencyKey({
      organizationId: 'org-1',
      eventType: 'organization.lifecycle.suspended',
      aggregateId: 'org-1',
      recipientId: 'user-1',
      channel: 'IN_APP',
      eventId: 'evt-1',
    });
    const b = buildIdempotencyKey({
      organizationId: 'org-1',
      eventType: 'organization.lifecycle.suspended',
      aggregateId: 'org-1',
      recipientId: 'user-1',
      channel: 'IN_APP',
      eventId: 'evt-1',
    });
    expect(a).toEqual(b);
  });

  it('changes when the recipient changes', () => {
    const base = {
      organizationId: 'org-1',
      eventType: 'organization.lifecycle.suspended' as const,
      aggregateId: 'org-1',
      channel: 'IN_APP' as const,
      eventId: 'evt-1',
    };
    const a = buildIdempotencyKey({ ...base, recipientId: 'user-1' });
    const b = buildIdempotencyKey({ ...base, recipientId: 'user-2' });
    expect(a).not.toEqual(b);
  });

  it('changes when the channel changes', () => {
    const base = {
      organizationId: 'org-1',
      eventType: 'organization.lifecycle.suspended' as const,
      aggregateId: 'org-1',
      recipientId: 'user-1',
      eventId: 'evt-1',
    };
    const a = buildIdempotencyKey({ ...base, channel: 'IN_APP' });
    const b = buildIdempotencyKey({ ...base, channel: 'EMAIL' });
    expect(a).not.toEqual(b);
  });

  it('produces different keys for different aggregates', () => {
    const a = buildIdempotencyKey({
      organizationId: 'org-1',
      eventType: 'organization.lifecycle.suspended',
      aggregateId: 'org-1',
      recipientId: 'user-1',
      channel: 'IN_APP',
    });
    const b = buildIdempotencyKey({
      organizationId: 'org-1',
      eventType: 'organization.lifecycle.suspended',
      aggregateId: 'org-2',
      recipientId: 'user-1',
      channel: 'IN_APP',
    });
    expect(a).not.toEqual(b);
  });
});
