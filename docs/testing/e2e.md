# Phase 10D — E2E testing

The E2E suite is implemented with Playwright. The configuration lives
in `playwright.config.ts` and the test files under `tests/e2e/`. The
suite targets local development and staging; production is exercised
only by read-only smoke tests.

## Structure

```
playwright.config.ts           ← projects, retries, web server
tests/e2e/
  helpers/
    auth.ts                    ← login, logout, selectOrganization
    fixtures.ts                ← adminContext, procurementContext, auditorContext, crossTenantContext
  auth.e2e.spec.ts             ← login, logout, current org
  organization-onboarding.e2e.spec.ts
  purchase-order.e2e.spec.ts
  equipment-lifecycle.e2e.spec.ts
  oficios.e2e.spec.ts
  notifications.e2e.spec.ts
  reports.e2e.spec.ts
  integrations.e2e.spec.ts
```

## Authentication strategy

E2E credentials live in environment variables — never in source.
Required variables:

```
E2E_ADMIN_EMAIL
E2E_ADMIN_PASSWORD
E2E_ADMIN_ORG
E2E_ADMIN_USER
E2E_PROCUREMENT_EMAIL
E2E_PROCUREMENT_PASSWORD
E2E_PROCUREMENT_ORG
E2E_PROCUREMENT_USER
E2E_AUDITOR_EMAIL
E2E_AUDITOR_PASSWORD
E2E_AUDITOR_ORG
E2E_AUDITOR_USER
E2E_USER_EMAIL
E2E_USER_PASSWORD
E2E_USER_ORG
E2E_USER_USER
E2E_PLATFORM_ADMIN_EMAIL
E2E_PLATFORM_ADMIN_PASSWORD
E2E_PLATFORM_ADMIN_ORG
E2E_PLATFORM_ADMIN_USER
```

The `login()` helper fails fast if any of the required variables are
missing. CI must define them in the GitHub Actions secret store.

## Browser matrix

Chromium, Firefox, and WebKit are configured as parallel projects.
Every critical journey runs in all three. Unsupported features
(discovered during nightly runs) are documented in
`docs/testing/release-quality-gates.md`.

## Data isolation

Each E2E run uses a dedicated test organization (`E2E_ADMIN_ORG`).
Cleanup is handled by the `cleanupTestTenant()` helper which deletes
all rows in the test org after the run. Destructive flows are never
run against production.

## Running locally

```bash
# Required once
pnpm dev
pnpm browser:install

# Test the login E2E
pnpm exec playwright test tests/e2e/auth.e2e.spec.ts

# Run only Chromium
pnpm exec playwright test --project=chromium
```

## Reporting

The CI upload path is `reports/playwright-junit.xml`,
`reports/playwright-html/`. The HTML report is opened with
`pnpm exec playwright show-report reports/playwright-html`.
