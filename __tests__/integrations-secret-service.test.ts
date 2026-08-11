import { beforeEach, describe, expect, it, vi } from 'vitest';

const inMemoryStoreMock = vi.hoisted(() => ({
  read: vi.fn(),
  rotate: vi.fn(),
  delete: vi.fn(),
  listReferences: vi.fn(),
}));

const recordEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/platform/security/audit/security-events', () => ({
  recordSecurityEvent: recordEventMock,
}));
vi.mock('@/platform/integrations/infrastructure/secrets/in-memory-store', () => ({
  inMemorySecretStore: inMemoryStoreMock,
  resetInMemorySecretStore: vi.fn(),
}));

import { secretService, setSecretStore } from '@/platform/integrations/application/secret-service';

describe('secretService', () => {
  beforeEach(() => {
    inMemoryStoreMock.read.mockReset();
    inMemoryStoreMock.rotate.mockReset();
    inMemoryStoreMock.delete.mockReset();
    inMemoryStoreMock.listReferences.mockReset();
    recordEventMock.mockReset();
    setSecretStore(inMemoryStoreMock);
  });

  it('builds a deterministic per-organization integration reference', () => {
    expect(secretService.buildReference('org-1', 'int-1')).toBe('secret:prod:org-org-1-int-int-1');
    expect(secretService.buildReference('org-2', 'int-1')).not.toBe(secretService.buildReference('org-1', 'int-1'));
  });

  it('stores secret material via the configured store and audits without leaking the payload', async () => {
    inMemoryStoreMock.rotate.mockResolvedValueOnce(undefined);
    const result = await secretService.storeForIntegration({
      organizationId: 'org-1',
      integrationId: 'int-1',
      actorUserId: 'admin-1',
      requestId: 'req-1',
      payload: { clientId: 'value-1', clientSecret: 'value-2' },
    });
    expect(result.reference).toBe('secret:prod:org-org-1-int-int-1');
    expect(inMemoryStoreMock.rotate).toHaveBeenCalledWith(result.reference, {
      clientId: 'value-1',
      clientSecret: 'value-2',
    });
    expect(recordEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'integration.secret.stored',
      outcome: 'SUCCESS',
      attributes: expect.objectContaining({ reference: result.reference }),
    }));
    const callArgs = recordEventMock.mock.calls[0][0];
    expect(JSON.stringify(callArgs)).not.toContain('value-1');
    expect(JSON.stringify(callArgs)).not.toContain('value-2');
  });

  it('rejects malformed secret references', () => {
    expect(() => secretService.normalizeReference('not-a-reference')).toThrow();
    expect(() => secretService.normalizeReference('')).toThrow();
  });
});
