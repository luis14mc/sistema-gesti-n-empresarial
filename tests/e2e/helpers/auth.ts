// Phase 10D — E2E shared helpers for authentication, organization
// selection, and request-context bootstrapping.
import { type APIRequestContext, type Page, expect } from '@playwright/test';

export type E2ERole = 'E2E_ADMIN' | 'E2E_USER' | 'E2E_AUDITOR' | 'E2E_PROCUREMENT' | 'E2E_PLATFORM_ADMIN';

export type E2ECredentials = Readonly<{
  email: string;
  password: string;
  organizationId: string;
  userId: string;
}>;

function readCredentials(role: E2ERole): E2ECredentials {
  const env = (key: string): string | undefined => process.env[key];
  const email = env(`${role}_EMAIL`);
  const password = env(`${role}_PASSWORD`);
  const organizationId = env(`${role}_ORG`);
  const userId = env(`${role}_USER`);
  if (!email || !password || !organizationId || !userId) {
    throw new Error(
      `E2E credentials for ${role} are not configured. Set ${role}_EMAIL, ${role}_PASSWORD, ${role}_ORG, ${role}_USER.`,
    );
  }
  return { email, password, organizationId, userId };
}

export async function login(page: Page, role: E2ERole = 'E2E_ADMIN'): Promise<E2ECredentials> {
  const credentials = readCredentials(role);
  await page.goto('/login');
  await page.getByLabel(/correo|email/i).fill(credentials.email);
  await page.getByLabel(/contraseña|password/i).fill(credentials.password);
  await page.getByRole('button', { name: /iniciar sesi[oó]n|sign in|entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  return credentials;
}

export async function logout(page: Page): Promise<void> {
  await page.request.post('/api/auth/logout').catch(() => undefined);
  await page.context().clearCookies();
}

export async function selectOrganization(page: Page, organizationId: string): Promise<void> {
  await page.context().addCookies([
    {
      name: 'organizationId',
      value: organizationId,
      path: '/',
      sameSite: 'Lax',
      httpOnly: false,
      secure: false,
    },
  ]);
}

export async function authenticatedRequest(
  request: APIRequestContext,
  role: E2ERole = 'E2E_ADMIN',
): Promise<E2ECredentials> {
  const credentials = readCredentials(role);
  const response = await request.post('/api/auth/login', {
    data: { email: credentials.email, password: credentials.password },
    headers: { 'content-type': 'application/json' },
  });
  expect(response.ok()).toBe(true);
  return credentials;
}
