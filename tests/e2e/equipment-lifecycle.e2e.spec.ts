// Phase 10D — E2E test for the equipment lifecycle journey.
import { test, expect } from './helpers/fixtures';

test.describe('Equipment lifecycle', () => {
  test('admin can create, assign, and start maintenance for an equipment', async ({ adminContext, page }) => {
    await adminContext;
    await page.goto('/equipos/nuevo');
    await page.getByLabel(/descripci[oó]n/i).fill('Laptop E2E');
    await page.getByLabel(/serial/i).fill(`SN-${Date.now()}`);
    await page.getByRole('button', { name: /crear|save/i }).click();

    await expect(page.getByText(/Equipo creado|created/i)).toBeVisible();

    await page.getByRole('button', { name: /asignar|assign/i }).click();
    await page.getByLabel(/usuario|user/i).fill('user-e2e');
    await page.getByRole('button', { name: /asignar|assign/i }).click();
    await expect(page.getByText(/asignado|assigned/i)).toBeVisible();

    await page.getByRole('button', { name: /mantenimiento|maintenance/i }).click();
    await page.getByLabel(/descripci[oó]n/i).fill('Mantenimiento preventivo');
    await page.getByRole('button', { name: /iniciar|start/i }).click();
    await expect(page.getByText(/mantenimiento iniciado|maintenance started/i)).toBeVisible();
  });
});
