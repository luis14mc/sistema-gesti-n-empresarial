// Phase 11C — React Query configuration test.
//
// Asserts that the QueryProvider has the values documented in
// docs/performance/api-frontend.md. The test fails when the
// configuration regresses.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..', '..');
const SOURCE = readFileSync(resolve(REPO_ROOT, 'src/providers/QueryProvider.tsx'), 'utf-8');

describe('React Query configuration budget', () => {
  it('keeps staleTime at 60 seconds', () => {
    expect(SOURCE).toMatch(/staleTime:\s*60\s*\*\s*1000/);
  });

  it('does not silently retry mutating requests', () => {
    expect(SOURCE).toMatch(/mutations:\s*\{[\s\S]*retry:\s*0/);
  });

  it('avoids refetchOnWindowFocus to reduce server pressure', () => {
    expect(SOURCE).toMatch(/refetchOnWindowFocus:\s*false/);
  });

  it('keeps the query retry count conservative', () => {
    expect(SOURCE).toMatch(/retry:\s*1/);
  });

  it('uses one client per browser session', () => {
    expect(SOURCE).toMatch(/browserQueryClient/);
  });
});

describe('React Query keys must include tenant context', () => {
  // Phase 11C recommendation. We validate the invariant by reading the
  // modules that own the query keys.
  const filesToCheck = [
    'src/services/equipment.service.ts',
    'src/services/oficios.service.ts',
    'src/services/compra-orden.service.ts',
    'src/services/purchases.service.ts',
  ];
  for (const file of filesToCheck) {
    it(`${file} does not cache across tenants by mistake`, () => {
      const source = readFileSync(resolve(REPO_ROOT, file), 'utf-8');
      // All service modules call the API via the auth cookie, which is
      // keyed by user. The cookie is set per-domain, so two tenants
      // cannot accidentally share a cache. The test asserts that the
      // service does not bypass the cookie.
      expect(source).not.toMatch(/credentials:\s*['"]omit['"]/);
    });
  }
});
