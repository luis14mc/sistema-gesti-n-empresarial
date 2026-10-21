import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expectGolden, readSource, REPO } from './_helpers';

/**
 * Guardas de todas las rutas que la fase 5 adelgaza. Se compara contra el
 * fixture: mismos métodos exportados, mismos roles de withAuth, y cada
 * permiso / guarda que existía sigue declarado en el mismo archivo.
 */
const ROUTES = [
  'src/actions/auth.ts',
  'src/app/api/audits/[id]/checklist/route.ts',
  'src/app/api/audits/[id]/findings/route.ts',
  'src/app/api/audits/[id]/route.ts',
  'src/app/api/audits/route.ts',
  'src/app/api/auth/login/route.ts',
  'src/app/api/auth/register/route.ts',
  'src/app/api/corrective-actions/[id]/route.ts',
  'src/app/api/corrective-actions/route.ts',
  'src/app/api/departments/route.ts',
  'src/app/api/employees/[id]/route.ts',
  'src/app/api/employees/route.ts',
  'src/app/api/equipment-disposal/route.ts',
  'src/app/api/equipment-disposal/[id]/route.ts',
  'src/app/api/equipment-disposal/[id]/approve/route.ts',
  'src/app/api/equipment-disposal/[id]/cancel/route.ts',
  'src/app/api/equipment-disposal/[id]/reject/route.ts',
  'src/app/api/equipment-disposal/[id]/submit/route.ts',
  'src/app/api/equipment-disposal/[id]/documents/[documentId]/route.ts',
  'src/app/api/equipment-disposal/[id]/documents/[documentId]/view/route.ts',
  'src/app/api/equipment-disposal/[id]/documents/route.ts',
  'src/app/api/equipment-disposal/[id]/pdf/route.ts',
  'src/app/api/organizations/current/route.ts',
  'src/app/api/organizations/current/integrations/route.ts',
  'src/app/api/organizations/current/integrations/[id]/route.ts',
  'src/app/api/organizations/current/integrations/[id]/disable/route.ts',
  'src/app/api/organizations/current/integrations/[id]/enable/route.ts',
  'src/app/api/organizations/current/integrations/[id]/executions/route.ts',
  'src/app/api/organizations/current/integrations/[id]/rotate-credentials/route.ts',
  'src/app/api/organizations/current/integrations/[id]/test/route.ts',
  'src/app/api/planilla/configuracion/smtp/probar/route.ts',
  'src/app/api/reports/catalog/route.ts',
  'src/app/api/reports/[code]/export/route.ts',
  'src/app/api/software-licenses/route.ts',
  'src/app/api/software-licenses/[id]/route.ts',
  'src/app/api/software-licenses/[id]/seats/route.ts',
  'src/app/api/software-licenses/assignments/[assignmentId]/unassign/route.ts',
  'src/app/api/software-licenses/dashboard/route.ts',
  'src/app/api/software-licenses/export/route.ts',
  'src/app/api/software-licenses/import/route.ts',
  'src/app/api/software-licenses/seats/[seatId]/route.ts',
  'src/app/api/software-licenses/seats/[seatId]/assignments/route.ts',
  'src/app/dashboard/page.tsx',
] as const;

const GUARD_MARKERS = [
  'withAuth(',
  'authorizeOrganization(',
  'requireOrganizationPermission(',
  'requireSession(',
  'requireRole(',
  'requirePlatformAdmin(',
  'requirePermission(',
  'canOrdenAction(',
] as const;

type GuardEntry = {
  methods: string[];
  withAuthRoles: string[][];
  permissions: string[];
  markers: string[];
};

function analyze(source: string): GuardEntry {
  const methods = new Set<string>();
  for (const m of source.matchAll(/export\s+(?:const|async\s+function|function)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) {
    methods.add(m[1]);
  }
  for (const m of source.matchAll(/export\s+async\s+function\s+(\w+Action)\b/g)) methods.add(m[1]);
  if (/export\s+default\s+async\s+function/.test(source)) methods.add('default');

  const withAuthRoles = [...source.matchAll(/withAuth\(\s*[\w.]+\s*,\s*\[([^\]]*)\]/g)].map((m) =>
    [...m[1].matchAll(/'([^']+)'/g)].map((r) => r[1]),
  );
  const permissions = [...new Set([...source.matchAll(/'([a-z][a-z-]*\.[a-z][a-z-]*)'/g)].map((m) => m[1]))].sort();
  const markers = GUARD_MARKERS.filter((marker) => source.includes(marker));
  return { methods: [...methods].sort(), withAuthRoles, permissions, markers: [...markers] };
}

describe('platform golden — guardas API', () => {
  it('todas las rutas existen', () => {
    for (const route of ROUTES) expect(existsSync(join(REPO, route)), route).toBe(true);
  });

  it('coinciden con el fixture', () => {
    const current: Record<string, GuardEntry> = {};
    for (const route of ROUTES) current[route] = analyze(readSource(route));

    expectGolden('api-guards', 'routes', current, (actual, fixture) => {
      const a = actual as Record<string, GuardEntry>;
      const f = fixture as Record<string, GuardEntry>;
      expect(Object.keys(a).sort()).toEqual(Object.keys(f).sort());
      for (const route of Object.keys(f)) {
        expect(a[route].methods, `${route} métodos`).toEqual(f[route].methods);
        expect(a[route].withAuthRoles, `${route} roles withAuth`).toEqual(f[route].withAuthRoles);
        for (const permission of f[route].permissions) {
          expect(a[route].permissions, `${route} permiso ${permission}`).toContain(permission);
        }
        for (const marker of f[route].markers) {
          expect(a[route].markers, `${route} guarda ${marker}`).toContain(marker);
        }
      }
    });
  });
});
