// Phase HU-02 — report export API + institutional reports UI.
import { test, expect } from './helpers/fixtures';
import { login, logout, selectOrganization } from './helpers/auth';
import { resolveDatePreset } from '@/modules/reporting/presentation/report-ui';

test.describe('Reports export API', () => {
  test('procurement can download PURCHASE_ORDER_SUMMARY as CSV', async ({ procurementContext, page }) => {
    await procurementContext;
    const response = await page.request.get(
      '/api/reports/PURCHASE_ORDER_SUMMARY/export?format=csv&from=2026-01-01&to=2026-01-31',
    );
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/csv');
  });
});

test.describe('Reports UI', () => {
  test('ADMIN downloads equipment inventory as XLSX from the reports center', async ({ adminContext, page }) => {
    await adminContext;
    await page.goto('/reportes');

    await expect(page.getByRole('heading', { name: 'Reportes', level: 1 })).toBeVisible();
    const card = page.getByTestId('report-card-EQUIPMENT_INVENTORY');
    await expect(card).toBeVisible();

    await card.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inventario de equipos' })).toBeVisible();

    const range = resolveDatePreset('this_year');
    await page.locator('#report-from').fill(range.from);
    await page.locator('#report-to').fill(range.to);
    await page.getByRole('button', { name: 'XLSX', exact: true }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(
      new RegExp(`^equipment_inventory_${range.from}_${range.to}\\.xlsx$`, 'i'),
    );
  });

  test('USER without report permission does not see equipment inventory report', async ({ page }) => {
    const credentials = await login(page, 'E2E_USER');
    await selectOrganization(page, credentials.organizationId);

    await page.goto('/reportes');
    await expect(page.getByText('Inventario de equipos')).toHaveCount(0);

    const catalog = await page.request.get('/api/reports/catalog');
    expect(catalog.ok()).toBe(true);
    const body = (await catalog.json()) as { data: { reports: { code: string }[] } };
    const codes = body.data.reports.map((r) => r.code);
    expect(codes).not.toContain('EQUIPMENT_INVENTORY');

    await logout(page);
  });
});
