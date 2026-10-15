import { test, expect } from './helpers/fixtures';

test.skip(!process.env.E2E_ADMIN_EMAIL, 'E2E_ADMIN credentials are required');

test.describe('Administración → Roles y permisos', () => {
  test('admin can open role list and role detail matrix', async ({ page, adminContext }) => {
    void adminContext;
    await page.goto('/settings/roles', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /roles y permisos/i })).toBeVisible({
      timeout: 15_000,
    });

    const editLink = page.getByRole('link', { name: /editar permisos/i }).first();
    await expect(editLink).toBeVisible({ timeout: 10_000 });
    await editLink.click();

    await expect(page.getByRole('heading', { name: /permisos:/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /guardar|restaurar valores oficiales/i }).first()).toBeVisible();
    await expect(page.getByText(/módulo/i).first()).toBeVisible();
  });
});
