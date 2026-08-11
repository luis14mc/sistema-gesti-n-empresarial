// Phase 10D — E2E test for the oficios workflow.
import { test, expect } from './helpers/fixtures';

test.describe('Oficios workflow', () => {
  test('admin can create an incoming office, receive it, complete, and archive', async ({ adminContext, page }) => {
    await adminContext;
    await page.goto('/oficios/cni');
    await page.getByRole('button', { name: /nuevo oficio|new office/i }).click();
    await page.getByLabel(/asunto|subject/i).fill('Oficio E2E');
    await page.getByLabel(/instituci[oó]n/i).fill('Institución E2E');
    await page.getByRole('button', { name: /crear|save/i }).click();

    await page.getByRole('button', { name: /recibir|receive/i }).click();
    await expect(page.getByText(/recibido|received/i)).toBeVisible();

    await page.getByRole('button', { name: /completar|complete/i }).click();
    await expect(page.getByText(/completado|completed/i)).toBeVisible();

    await page.getByRole('button', { name: /archivar|archive/i }).click();
    await expect(page.getByText(/archivado|archived/i)).toBeVisible();
  });
});
