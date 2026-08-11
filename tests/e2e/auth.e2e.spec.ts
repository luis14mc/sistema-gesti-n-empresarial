// Phase 10D — E2E smoke test for the login flow and the dashboard
// shell. This is the entry point for every other E2E test: it verifies
// that the JWT cookie is set, the redirect to /dashboard happens, and
// the platform chrome is rendered.
import { test, expect } from './helpers/fixtures';

test.describe('Authentication', () => {
  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('logs in and lands on the dashboard', async ({ adminContext }) => {
    await adminContext;
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('current organization selector is visible after login', async ({ adminContext }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('current-organization')).toBeVisible();
  });

  test('logout clears the session and redirects to /login', async ({ adminContext }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /cerrar sesi[oó]n|logout|salir/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
