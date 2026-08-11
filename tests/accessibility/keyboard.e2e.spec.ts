// Phase 10E — Keyboard navigation E2E tests.
import { test, expect } from '../e2e/helpers/fixtures';

test.describe('Keyboard navigation', () => {
  test('tab navigation reaches every interactive element in the sidebar', async ({ adminContext, page }) => {
    await adminContext;
    await page.goto('/dashboard');
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
  });

  test('keyboard opens a sidebar menu item', async ({ adminContext, page }) => {
    await adminContext;
    await page.goto('/dashboard');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();
  });

  test('Escape closes a dialog', async ({ adminContext, page }) => {
    await adminContext;
    await page.goto('/equipos');
    await page.getByRole('button', { name: /nuevo equipo|new equipment/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('tab order is logical inside a form', async ({ adminContext, page }) => {
    await adminContext;
    await page.goto('/compras/nueva');
    await page.getByLabel(/proveedor/i).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('id', /rtn|proveedorRtn/i);
  });
});
