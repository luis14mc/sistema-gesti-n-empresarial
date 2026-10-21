import { describe, expect, it } from 'vitest';
import routeMapFixture from './__fixtures__/route-map.json';
import { buildRouteMap } from './_helpers';

describe('RBAC golden — mapeo ruta → módulo y acceso (lib vs platform)', () => {
  it('congela pathname, módulos, requiredSpecial, mismatch y canAccessRoute por SessionRole', () => {
    const map = buildRouteMap();
    expect(map).toEqual(routeMapFixture);
  });

  it('lib y platform comparten el mismo ROUTE_PATH_TO_MODULE (0 mismatches)', () => {
    const mismatches = buildRouteMap().filter((r) => r.mismatch);
    expect(mismatches).toEqual([]);
  });
});
