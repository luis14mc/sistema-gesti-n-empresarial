import { describe, expect, it } from 'vitest';
import routeMapFixture from './__fixtures__/route-map.json';
import { buildRouteMap } from './_helpers';

describe('RBAC golden — mapeo ruta → módulo y acceso (lib vs platform)', () => {
  it('congela pathname, módulos, requiredSpecial, mismatch y canAccessRoute por SessionRole', () => {
    const map = buildRouteMap();
    expect(map).toEqual(routeMapFixture);
  });

  it('documenta INCONSISTENCIAS libModule !== platformModule', () => {
    const mismatches = buildRouteMap().filter((r) => r.mismatch);
    expect(mismatches.length).toBeGreaterThan(0);
    const paths = mismatches.map((m) => m.pathname).sort();
    // INCONSISTENCIA: platform define rutas que lib/permissions.ts no incluye en ROUTE_PATH_TO_MODULE.
    expect(paths).toContain('/settings/cambiar-contrasena');
    expect(paths).toContain('/settings/permisos');
  });
});
