// Phase 10D — E2E test for the integrations registry.
import { test, expect } from './helpers/fixtures';

test.describe('Integrations', () => {
  test('admin can create, test, and disable an integration', async ({ adminContext, page }) => {
    await adminContext;
    await page.goto('/integraciones');
    await page.getByRole('button', { name: /nueva integraci[oó]n|new integration/i }).click();
    await page.getByLabel(/nombre/i).fill('SMTP Test E2E');
    await page.getByLabel(/proveedor|provider/i).selectOption('SMTP');
    await page.getByRole('button', { name: /crear|save/i }).click();
    await expect(page.getByText(/creada|created/i)).toBeVisible();

    await page.getByRole('button', { name: /probar conexi[oó]n|test connection/i }).click();
    await expect(page.getByText(/conexi[oó]n (probada|exitosa)/i)).toBeVisible();

    await page.getByRole('button', { name: /deshabilitar|disable/i }).click();
    await expect(page.getByText(/deshabilitada|disabled/i)).toBeVisible();
  });
});
