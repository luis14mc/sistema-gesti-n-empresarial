// Phase 10D — E2E test fixtures for organization context isolation.
import { test as base, expect } from '@playwright/test';
import { type E2ECredentials, login, logout, selectOrganization } from './auth';

export type E2EFixtures = {
  adminContext: E2ECredentials;
  procurementContext: E2ECredentials;
  auditorContext: E2ECredentials;
  crossTenantContext: {
    organizationA: E2ECredentials;
    organizationB: E2ECredentials;
  };
};

export const test = base.extend<E2EFixtures>({
  adminContext: async ({ page }, use) => {
    const credentials = await login(page, 'E2E_ADMIN');
    await use(credentials);
    await logout(page);
  },
  procurementContext: async ({ page }, use) => {
    const credentials = await login(page, 'E2E_PROCUREMENT');
    await use(credentials);
    await logout(page);
  },
  auditorContext: async ({ page }, use) => {
    const credentials = await login(page, 'E2E_AUDITOR');
    await use(credentials);
    await logout(page);
  },
  crossTenantContext: async ({ page }, use) => {
    const organizationA = await login(page, 'E2E_ADMIN');
    await selectOrganization(page, organizationA.organizationId);
    await page.goto('/dashboard');
    await logout(page);
    const organizationB = await login(page, 'E2E_USER');
    await selectOrganization(page, organizationB.organizationId);
    await use({ organizationA, organizationB });
    await logout(page);
  },
});

export { expect };
