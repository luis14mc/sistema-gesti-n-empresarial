import { test, expect } from './helpers/fixtures';

test.skip(!process.env.E2E_ADMIN_EMAIL, 'E2E_ADMIN credentials are required');

test.describe('Users → Permisos tab', () => {
  test('admin can open permissions matrix for a user', async ({ page, adminContext }) => {
    void adminContext;
    await page.goto('/users', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /usuarios/i })).toBeVisible({ timeout: 15_000 });

    const firstDetail = page.getByRole('link', { name: /ver|detalle|editar/i }).first();
    if (await firstDetail.count()) {
      await firstDetail.click();
    } else {
      await page.locator('table tbody tr').first().click();
    }

    await page.getByRole('tab', { name: /permisos/i }).click();
    await expect(page.getByText(/heredado del rol|módulo/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /quitar excepciones|guardar/i }).first()).toBeVisible();
  });
});
