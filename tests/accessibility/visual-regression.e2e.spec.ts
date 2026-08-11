// Phase 10E — Visual regression baseline tests using Playwright snapshots.
//
// Screenshots are captured at four responsive breakpoints and a small
// number of critical pages. Baselines are reviewed when the UI changes.
import { test, expect } from '../e2e/helpers/fixtures';

const BREAKPOINTS = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
] as const;

const PAGES = [
  '/dashboard',
  '/oficios/cni',
  '/equipos',
  '/compras',
  '/notificaciones',
  '/ajustes/organizacion',
] as const;

for (const breakpoint of BREAKPOINTS) {
  test.describe(`Visual regression — ${breakpoint.name}`, () => {
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } });

    for (const route of PAGES) {
      test(`matches the baseline at ${route}`, async ({ adminContext, page }) => {
        await adminContext;
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveScreenshot(`visual-${breakpoint.name}${route.replaceAll('/', '-')}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  });
}
