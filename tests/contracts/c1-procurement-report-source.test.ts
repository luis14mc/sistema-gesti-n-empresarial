import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Phase 13 · C-1 regression guard.
 *
 * The Phase 12 audit found that the dashboard purchasing KPI and the
 * purchasing reports read the LEGACY `CompraSolicitud` (`compras_solicitudes`)
 * table, while the operational UI writes the canonical `CompraOrden`
 * (`purchase_orders`). Institutional figures therefore did not reflect the
 * orders actually created.
 *
 * These are source-contract assertions (no DB required): they lock the
 * data source of the two remediated read paths so C-1 cannot silently
 * regress. If either surface is ever pointed back at `compraSolicitud`,
 * this test fails.
 */

const ROOT = resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('C-1 · purchasing metrics read the canonical purchase-order aggregate', () => {
  it('dashboard purchasing KPI reads CompraOrden, not CompraSolicitud', () => {
    const src = read('src/app/dashboard/page.tsx');
    expect(src).toMatch(/prisma\.compraOrden\.count/);
    expect(src).not.toMatch(/prisma\.compraSolicitud/);
  });

  it('purchasing report route reads CompraOrden / purchase_orders, not CompraSolicitud', () => {
    const src = read('src/app/api/compras/reportes/route.ts');
    expect(src).toMatch(/prisma\.compraOrden\.groupBy/);
    expect(src).toMatch(/FROM "purchase_orders"/);
    // Assert on actual query usage, not substrings — the legacy name may
    // legitimately appear in the remediation comment explaining the fix.
    expect(src).not.toMatch(/prisma\.compraSolicitud/);
    expect(src).not.toMatch(/FROM "compras_solicitudes"/);
  });

  it('purchasing report route is tenant-scoped by organizationId', () => {
    const src = read('src/app/api/compras/reportes/route.ts');
    expect(src).toMatch(/requireOrganizationContext/);
    expect(src).toMatch(/organizationId/);
  });

  it('canonical purchase status maps back to the legacy label vocabulary for the report UI', () => {
    const src = read('src/app/api/compras/reportes/route.ts');
    // The five PurchaseOrderStatus values must each map to an estado label code.
    for (const status of ['DRAFT', 'GENERATED', 'ISSUED', 'CANCELLED', 'CLOSED']) {
      expect(src).toContain(status);
    }
    for (const estado of ['BORRADOR', 'GENERADA', 'EMITIDA', 'ANULADA', 'CERRADA']) {
      expect(src).toContain(estado);
    }
  });
});
