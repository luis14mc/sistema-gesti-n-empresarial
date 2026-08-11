import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '@/lib/middleware';

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  recordSecurityEventBestEffort: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findFirst: mocks.findUser },
  },
}));
vi.mock('@/platform/security/audit/security-events', () => ({
  recordSecurityEventBestEffort: mocks.recordSecurityEventBestEffort,
}));

import { requirePlatformContext, PlatformAuthenticationRequiredError, PlatformPermissionRequiredError } from '@/modules/organizations/application/platform-context';

function request(): AuthenticatedRequest {
  return {
    user: { userId: 'user-1', email: 'admin@example.com', role: 'ADMIN' },
    headers: new Headers(),
    cookies: { get: () => undefined },
  } as unknown as AuthenticatedRequest;
}

describe('requirePlatformContext', () => {
  beforeEach(() => {
    mocks.findUser.mockReset();
    mocks.recordSecurityEventBestEffort.mockReset().mockResolvedValue(undefined);
  });

  it('returns a PLATFORM_ADMIN context for users with the platform role', async () => {
    mocks.findUser.mockResolvedValue({ id: 'user-1', email: 'admin@example.com', platformRole: 'PLATFORM_ADMIN' });
    const context = await requirePlatformContext(request(), 'req-1');
    expect(context.role).toBe('PLATFORM_ADMIN');
    expect(context.authorizationScope).toBe('platform');
  });

  it('rejects users without a platform role and audits the denial', async () => {
    mocks.findUser.mockResolvedValue({ id: 'user-1', email: 'admin@example.com', platformRole: null });
    await expect(requirePlatformContext(request(), 'req-2')).rejects.toBeInstanceOf(PlatformAuthenticationRequiredError);
    expect(mocks.recordSecurityEventBestEffort).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'platform.context.denied',
      outcome: 'DENIED',
    }));
  });

  it('rejects users whose platform role is not in the allow-list', async () => {
    mocks.findUser.mockResolvedValue({ id: 'user-1', email: 'admin@example.com', platformRole: 'SUPPORT_ADMIN' });
    await expect(
      requirePlatformContext(request(), 'req-3', ['PLATFORM_ADMIN']),
    ).rejects.toBeInstanceOf(PlatformPermissionRequiredError);
    expect(mocks.recordSecurityEventBestEffort).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'platform.context.denied',
      reasonCode: 'PLATFORM_ROLE_NOT_ALLOWED',
    }));
  });
});
