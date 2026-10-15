import { test, expect } from './helpers/fixtures';

test.describe('Compras — vistas separadas', () => {
  test('legacy /compras/solicitudes redirige a órdenes generadas', async ({ page, adminContext }) => {
    void adminContext;
    const response = await page.goto('/compras/solicitudes', { waitUntil: 'commit' });
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/compras\/ordenes\/?$/);
  });

  test('legacy solicitudes con estado borrador redirige a /compras/borradores', async ({
    page,
    adminContext,
  }) => {
    void adminContext;
    await page.goto('/compras/solicitudes?estado=DRAFT', { waitUntil: 'commit' });
    await expect(page).toHaveURL(/\/compras\/borradores\/?$/);
  });
});

test.describe('Compras — flujo borrador → generada', () => {
  test.skip(!process.env.E2E_PROCUREMENT_EMAIL, 'E2E procurement credentials required');

  test('borrador visible en lista y acciones PDF en órdenes generadas', async ({
    page,
    procurementContext,
  }) => {
    await procurementContext;
    await page.goto('/compras/nueva');
    await page.getByLabel(/proveedor/i).fill('Proveedor vistas split');
    await page.getByLabel(/rtn/i).fill('08011999123456');
    await page.getByLabel(/justificaci[oó]n/i).fill('Prueba vistas compras.');
    await page.getByRole('button', { name: /crear borrador|create draft/i }).click();

    await page.goto('/compras/borradores');
    await expect(page.getByRole('heading', { name: /borradores/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Proveedor vistas split')).toBeVisible();

    await page.getByRole('link', { name: /continuar editando/i }).first().click();
    await page.getByRole('button', { name: /agregar item|add item/i }).click();
    await page.getByLabel(/descripci[oó]n/i).fill('Item prueba vistas');
    await page.getByLabel(/cantidad/i).fill('1');
    await page.getByLabel(/precio unitario/i).fill('100');
    await page.getByRole('button', { name: /guardar|save/i }).click();
    await page.getByRole('button', { name: /generar|generate/i }).click();
    await expect(page.getByTestId('download-purchase-order-pdf')).toBeVisible({ timeout: 30_000 });

    await page.goto('/compras/borradores');
    await expect(page.getByText('Proveedor vistas split')).not.toBeVisible({ timeout: 10_000 });

    await page.goto('/compras/ordenes');
    await expect(page.getByText('Proveedor vistas split')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('download-purchase-order-pdf').first()).toBeVisible();
    await expect(page.getByTestId('print-purchase-order-pdf-row').first()).toBeVisible();
  });
});
