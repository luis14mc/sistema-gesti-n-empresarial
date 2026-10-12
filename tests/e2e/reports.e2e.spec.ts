// Phase HU-02 — export API smoke (UI arrives in part 2).
import { test, expect } from './helpers/fixtures';

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
