// Payroll — RRHH generates and downloads a payslip (requires E2E_HR_* env).
import { test, expect } from '@playwright/test';
import { login, logout, selectOrganization } from './helpers/auth';

const hrConfigured =
  Boolean(process.env.E2E_HR_EMAIL)
  && Boolean(process.env.E2E_HR_PASSWORD)
  && Boolean(process.env.E2E_HR_ORG)
  && Boolean(process.env.E2E_HR_USER);

test.describe('Payroll E2E', () => {
  test.skip(!hrConfigured, 'Set E2E_HR_EMAIL, E2E_HR_PASSWORD, E2E_HR_ORG, E2E_HR_USER');

  test('HR user opens planilla and can reach payroll API', async ({ page }) => {
    const email = process.env.E2E_HR_EMAIL!;
    const password = process.env.E2E_HR_PASSWORD!;
    const organizationId = process.env.E2E_HR_ORG!;

    await page.goto('/login');
    await page.getByLabel(/correo|email/i).fill(email);
    await page.getByLabel(/contraseña|password/i).fill(password);
    await page.getByRole('button', { name: /iniciar sesi[oó]n|sign in|entrar/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
    await selectOrganization(page, organizationId);

    await page.goto('/planilla');
    await expect(page.getByRole('heading', { name: 'Planilla', level: 1 })).toBeVisible();

    const employeesRes = await page.request.get('/api/payroll/employees?payrollEnabled=true');
    expect(employeesRes.status()).toBe(200);

    const list = await employeesRes.json();
    const first = list?.data?.employees?.[0];
    if (first?.id) {
      const previewRes = await page.request.post('/api/payroll/preview', {
        data: { employeeId: first.id, payMonth: '2026-03' },
      });
      expect(previewRes.status()).toBe(200);
      const previewBody = await previewRes.json();
      expect(previewBody.data.previewHtml).toContain('Recibo de planilla');
      expect(previewBody.data.neto).toBeGreaterThan(0);

      await page.getByRole('button', { name: /vista previa/i }).click();
      await expect(page.getByTitle('Vista previa de boleta')).toBeVisible({
        timeout: 15_000,
      });

      const generateRes = await page.request.post('/api/payroll/payslips', {
        data: { employeeId: first.id, payMonth: '2026-03' },
      });
      expect(generateRes.status()).toBe(200);
      const payslipId = (await generateRes.json()).data?.id;
      if (payslipId) {
        const pdfRes = await page.request.get(`/api/payroll/payslips/${payslipId}/pdf`);
        expect(pdfRes.status()).toBe(200);
        expect(pdfRes.headers()['content-type']).toContain('pdf');
      }
    }

    await page.goto('/planilla/historico');
    await expect(page.getByRole('heading', { name: /histórico/i, level: 1 })).toBeVisible();
    const historicoRes = await page.request.get('/api/payroll/payslips?search=&page=1&pageSize=5');
    expect(historicoRes.status()).toBe(200);
    const historicoBody = await historicoRes.json();
    expect(historicoBody.data.summary).toBeDefined();

    await logout(page);
  });
});
