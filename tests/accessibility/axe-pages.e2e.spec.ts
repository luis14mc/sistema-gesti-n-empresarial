// Phase 10E — Accessibility E2E tests using axe-core + Playwright.
import { test, expect } from '../e2e/helpers/fixtures';
import { expectNoCriticalViolations, expectNoSeriousViolations, runAxe } from './axe-harness';

const ROUTES = [
  '/login',
  '/dashboard',
  '/oficios/cni',
  '/equipos',
  '/compras',
  '/notificaciones',
  '/ajustes/organizacion',
];

for (const route of ROUTES) {
  test(`critical accessibility at ${route}`, async ({ page }, testInfo) => {
    await page.goto(route);
    const summary = await runAxe(page, testInfo);
    await expectNoCriticalViolations(summary);
  });

  test(`serious accessibility at ${route}`, async ({ page }, testInfo) => {
    await page.goto(route);
    const summary = await runAxe(page, testInfo);
    await expectNoSeriousViolations(summary);
  });
}
