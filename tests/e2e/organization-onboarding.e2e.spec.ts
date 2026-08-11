// Phase 10D — E2E test for the organization onboarding journey.
import { test, expect } from './helpers/fixtures';

test.describe('Organization onboarding', () => {
  test('a platform admin can create and activate a new organization', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/correo|email/i).fill(process.env.E2E_PLATFORM_ADMIN_EMAIL ?? '');
    await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_PLATFORM_ADMIN_PASSWORD ?? '');
    await page.getByRole('button', { name: /iniciar sesi[oó]n|sign in|entrar/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));

    await page.goto('/platform/organizaciones');
    await page.getByRole('button', { name: /nueva organizaci[oó]n|create organization/i }).click();
    await page.getByLabel(/nombre/i).fill(`E2E Org ${Date.now()}`);
    await page.getByLabel(/slug/i).fill(`e2e-${Date.now()}`);
    await page.getByRole('button', { name: /crear|create/i }).click();

    await expect(page.getByText(/organizaci[oó]n creada|created/i)).toBeVisible();
    await page.getByRole('button', { name: /activar|activate/i }).click();
    await expect(page.getByText(/activo|active/i)).toBeVisible();
  });
});
