import { test, expect } from './helpers/fixtures';

const routes = [
  { requested: '/equipment', final: '/equipment' },
  { requested: '/compras/solicitudes', final: '/compras/solicitudes' },
  { requested: '/oficios/internos', final: '/oficios/internos' },
  { requested: '/employees', final: '/employees' },
  { requested: '/users', final: '/users' },
  { requested: '/audits', final: '/audits' },
] as const;

test.skip(!process.env.E2E_ADMIN_EMAIL, 'E2E_ADMIN credentials are required');

test.describe('authenticated navigation stability', () => {
  test('ADMIN remains on each active module after navigation and refresh', async ({ page, adminContext }) => {
    const redirects: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 300 && response.status() < 400) {
        redirects.push(`${response.status()} ${response.url()} -> ${response.headers().location ?? ''}`);
      }
    });

    for (const route of routes) {
      await page.goto(route.requested, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${route.final.replaceAll('/', '\\/')}$`));
      await page.waitForLoadState('networkidle');
      expect(page.url()).not.toContain('/dashboard');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${route.final.replaceAll('/', '\\/')}$`));
      expect(page.url()).not.toContain('/dashboard');
    }

    expect(redirects.filter((entry) => entry.includes('/dashboard'))).toEqual([]);
    void adminContext;
  });
});
