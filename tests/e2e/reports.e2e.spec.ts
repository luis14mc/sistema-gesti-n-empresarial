// Phase 10D — E2E test for reports: filters, generate, export.
import { test, expect } from './helpers/fixtures';

test.describe('Reports', () => {
  test('admin can apply filters and export a CSV report', async ({ adminContext, page }) => {
    await adminContext;
    await page.goto('/reportes');
    await page.getByLabel(/fecha desde|from/i).fill('2026-01-01');
    await page.getByLabel(/fecha hasta|to/i).fill('2026-12-31');
    await page.getByRole('button', { name: /generar|generate/i }).click();
    await expect(page.getByTestId('report-preview')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /exportar csv|export csv/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });
});
