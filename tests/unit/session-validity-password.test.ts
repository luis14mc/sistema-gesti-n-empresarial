import { describe, expect, it, vi, beforeEach } from 'vitest';

const prismaMock = {
  user: { findUnique: vi.fn() },
  organizationMembership: { findUnique: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/platform/security/organization-scope', () => ({
  canonicalOrganizationId: () => 'org-default',
}));

describe('assertTokenSessionStillValid (password rotation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({
      isActive: true,
      passwordChangedAt: new Date('2026-01-01T12:00:00.000Z'),
    });
    prismaMock.organizationMembership.findUnique.mockResolvedValue({
      accessVersion: 2,
      status: 'ACTIVE',
    });
  });

  it('rejects tokens issued before passwordChangedAt', async () => {
    const { assertTokenSessionStillValid } = await import('@/lib/session-validity');
    const iatSeconds = Math.floor(new Date('2026-01-01T11:00:00.000Z').getTime() / 1000);
    const ok = await assertTokenSessionStillValid({
      userId: 'u1',
      email: 'u@test',
      role: 'ADMIN',
      accessVersion: 2,
      iat: iatSeconds,
      pwdChangedAtMs: new Date('2026-01-01T11:00:00.000Z').getTime(),
    });
    expect(ok).toBe(false);
  });

  it('accepts a token whose accessVersion is stale (permissions changed, not revoked)', async () => {
    const { assertTokenSessionStillValid } = await import('@/lib/session-validity');
    const ok = await assertTokenSessionStillValid({
      userId: 'u1',
      email: 'u@test',
      role: 'ADMIN',
      accessVersion: 1,
      iat: Math.floor(Date.now() / 1000),
      pwdChangedAtMs: new Date('2026-01-01T12:00:00.000Z').getTime(),
    });
    expect(ok).toBe(true);
  });

  it('accepts the token issued in the same second as the password change', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      isActive: true,
      passwordChangedAt: new Date('2026-01-01T12:00:00.750Z'),
    });
    const { assertTokenSessionStillValid } = await import('@/lib/session-validity');
    const ok = await assertTokenSessionStillValid({
      userId: 'u1',
      email: 'u@test',
      role: 'ADMIN',
      accessVersion: 2,
      iat: Math.floor(new Date('2026-01-01T12:00:00.900Z').getTime() / 1000),
      pwdChangedAtMs: new Date('2026-01-01T12:00:00.750Z').getTime(),
    });
    expect(ok).toBe(true);
  });

  it('rejects when the user was deactivated', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: false, passwordChangedAt: null });
    const { assertTokenSessionStillValid } = await import('@/lib/session-validity');
    const ok = await assertTokenSessionStillValid({
      userId: 'u1',
      email: 'u@test',
      role: 'ADMIN',
      accessVersion: 2,
      iat: Math.floor(Date.now() / 1000),
    });
    expect(ok).toBe(false);
  });
});
