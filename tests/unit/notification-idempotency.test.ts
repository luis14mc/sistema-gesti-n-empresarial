// Phase 10B — domain unit tests for the notification idempotency key.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildIdempotencyKey } from '@/modules/notifications/application/idempotency';

function expectedHash(input: {
  organizationId: string;
  eventType: string;
  aggregateId: string;
  recipientId: string | null;
  channel: string;
  eventId?: string | null;
}): string {
  const parts = [
    input.organizationId,
    input.eventType,
    input.aggregateId,
    input.recipientId ?? '*',
    input.channel,
    input.eventId ?? '',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

describe('buildIdempotencyKey', () => {
  const base = {
    organizationId: 'org-1',
    eventType: 'organization.lifecycle.suspended' as const,
    aggregateId: 'org-1',
    recipientId: 'user-1',
    channel: 'IN_APP' as const,
    eventId: 'evt-1',
  };

  it('returns a deterministic hash for the same inputs', () => {
    expect(buildIdempotencyKey(base)).toBe(buildIdempotencyKey(base));
  });

  it('produces a key shaped "<eventType>:<channel>:<sha256-prefix>"', () => {
    const key = buildIdempotencyKey(base);
    expect(key).toMatch(/^organization\.lifecycle\.suspended:IN_APP:[a-f0-9]{32}$/);
  });

  it('matches the manually computed sha256 prefix', () => {
    const key = buildIdempotencyKey(base);
    expect(key.endsWith(expectedHash(base))).toBe(true);
  });

  it('changes when the recipient changes', () => {
    const a = buildIdempotencyKey({ ...base, recipientId: 'user-1' });
    const b = buildIdempotencyKey({ ...base, recipientId: 'user-2' });
    expect(a).not.toBe(b);
  });

  it('changes when the channel changes', () => {
    const a = buildIdempotencyKey({ ...base, channel: 'IN_APP' });
    const b = buildIdempotencyKey({ ...base, channel: 'EMAIL' });
    expect(a).not.toBe(b);
  });

  it('handles a null recipient using the wildcard sentinel', () => {
    const key = buildIdempotencyKey({ ...base, recipientId: null });
    expect(key).toContain('organization.lifecycle.suspended:IN_APP:');
    expect(key.endsWith(expectedHash({ ...base, recipientId: null }))).toBe(true);
  });

  it('does not depend on eventId when both inputs omit it', () => {
    const a = buildIdempotencyKey({ ...base, eventId: undefined });
    const b = buildIdempotencyKey({ ...base, eventId: null });
    expect(a).toBe(b);
  });
});
