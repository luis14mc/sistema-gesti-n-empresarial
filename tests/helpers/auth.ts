import type { AuthenticatedRequest } from '@/lib/middleware';
import { generateToken } from '@/lib/auth';

const DEFAULT_JWT_SECRET = 'test-secret-key-for-vitest-only-00000000';

export function ensureJwtSecret(): string {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = DEFAULT_JWT_SECRET;
  }
  return process.env.JWT_SECRET;
}

export type TestUserRole =
  | 'ADMIN'
  | 'IT'
  | 'RRHH'
  | 'USER'
  | 'AUDITOR'
  | 'PROCUREMENT';

export type TestUser = Readonly<{
  userId: string;
  email: string;
  role: TestUserRole;
}>;

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const id = overrides.userId ?? `user-${Math.random().toString(36).slice(2, 10)}`;
  return {
    userId: id,
    email: overrides.email ?? `${id}@example.test`,
    role: overrides.role ?? 'ADMIN',
  };
}

export function createAuthenticatedRequest(
  user: TestUser = createTestUser(),
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {},
): AuthenticatedRequest {
  ensureJwtSecret();
  const token = generateToken({ userId: user.userId, email: user.email, role: user.role });
  const cookieStore = new Map<string, { value: string }>();
  cookieStore.set('token', { value: token });
  for (const [key, value] of Object.entries(cookies)) {
    cookieStore.set(key, { value });
  }
  return {
    user: { userId: user.userId, email: user.email, role: user.role },
    headers: new Headers({ ...headers, authorization: `Bearer ${token}` }),
    cookies: {
      get: (name: string) => cookieStore.get(name),
    },
  } as unknown as AuthenticatedRequest;
}

export function createOrganizationSelectionCookie(organizationId: string): Record<string, string> {
  return { organizationId };
}

/**
 * Phase 10A — build a fully populated AuthenticatedRequest that includes
 * the user, the JWT, the cookie, and the tenant-selection cookie. Use
 * this helper whenever a test needs to exercise an endpoint as a real
 * logged-in user operating inside a specific organization.
 */
export type AuthenticatedContext = Readonly<{
  user: TestUser;
  token: string;
  request: AuthenticatedRequest;
  organizationId: string | null;
}>;

export function createAuthenticatedContext(input: {
  user?: Partial<TestUser>;
  organizationId?: string | null;
  extraCookies?: Record<string, string>;
  extraHeaders?: Record<string, string>;
} = {}): AuthenticatedContext {
  const user = createTestUser(input.user ?? {});
  const cookies: Record<string, string> = { ...(input.extraCookies ?? {}) };
  if (input.organizationId) {
    cookies.organizationId = input.organizationId;
  }
  const request = createAuthenticatedRequest(user, cookies, input.extraHeaders ?? {});
  ensureJwtSecret();
  const token = generateToken({ userId: user.userId, email: user.email, role: user.role });
  return {
    user,
    token,
    request,
    organizationId: input.organizationId ?? null,
  };
}

/**
 * Phase 10A — build a side-by-side AuthenticatedContext for two distinct
 * users in two distinct organizations. The default pair is
 * organizationA / userA / role OWNER and organizationB / userB / role OWNER.
 */
export function createCrossTenantContexts(): {
  contextA: AuthenticatedContext;
  contextB: AuthenticatedContext;
} {
  return {
    contextA: createAuthenticatedContext({
      user: { userId: 'user-a', email: 'user-a@example.test', role: 'ADMIN' },
      organizationId: 'org-a',
    }),
    contextB: createAuthenticatedContext({
      user: { userId: 'user-b', email: 'user-b@example.test', role: 'ADMIN' },
      organizationId: 'org-b',
    }),
  };
}
