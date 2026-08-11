// Phase 10D — E2E test for the purchase order journey.
import { test, expect } from './helpers/fixtures';

test.describe('Purchase order journey', () => {
  test('PROCUREMENT can create a draft, add items, generate, and download the PDF', async ({ procurementContext, page }) => {
    await procurementContext;
    await page.goto('/compras/nueva');
    await page.getByLabel(/proveedor/i).fill('Proveedor E2E');
    await page.getByLabel(/rtn/i).fill('08011999123456');
    await page.getByLabel(/justificaci[oó]n/i).fill('Compra necesaria para operaciones.');
    await page.getByRole('button', { name: /crear borrador|create draft/i }).click();

    await expect(page.getByText(/borrador|draft/i)).toBeVisible();

    await page.getByRole('button', { name: /agregar item|add item/i }).click();
    await page.getByLabel(/descripci[oó]n/i).fill('Laptop E2E');
    await page.getByLabel(/cantidad/i).fill('1');
    await page.getByLabel(/precio unitario/i).fill('1500');
    await page.getByRole('button', { name: /guardar|save/i }).click();

    await page.getByRole('button', { name: /generar|generate/i }).click();
    await expect(page.getByText(/orden generada|order generated/i)).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: /descargar pdf|download pdf/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
