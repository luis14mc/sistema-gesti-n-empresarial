import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APPLICATION_LAYER_BASELINE,
  PRISMA_IN_PRESENTATION_BASELINE,
  PRISMA_OUTSIDE_INFRASTRUCTURE_BASELINE,
} from '../../eslint.architecture-baseline.mjs';

// ADR 003 — docs/adr/003-arquitectura-monolito-modular.md
const ROOT = resolve(__dirname, '../..');

/** Contenido de src/lib al congelarlo (2026-10-21). Solo puede reducirse. */
const LIB_FROZEN_ENTRIES = [
  'api-error-message.ts',
  'api-error.ts',
  'audit.ts',
  'auth.ts',
  'brand.ts',
  'compras',
  'deprecated-api.ts',
  'deprecated-frontend-paths.ts',
  'employees.ts',
  'form-errors.ts',
  'idor.ts',
  'jwt-config.ts',
  'middleware.ts',
  'oficios-attachments.ts',
  'oficios-numbering.ts',
  'oficios-status-transitions.ts',
  'oficios-storage.ts',
  'organization-page-context.ts',
  'permissions.ts',
  'prisma.ts',
  'raster-image-validation.ts',
  'rate-limit.ts',
  'reportes',
  'session-roles.ts',
  'session-token.ts',
  'session-validity.ts',
  'session.ts',
  'software-licenses',
  'storage',
  'swal.ts',
  'utils.ts',
  'zod-schemas.ts',
];

const BASELINE_MAX = 31;
const APPLICATION_BASELINE_MAX = APPLICATION_LAYER_BASELINE.length;

describe('ADR 003 · src/lib congelado', () => {
  it('no se agregan archivos ni carpetas nuevas en src/lib', () => {
    const current = readdirSync(join(ROOT, 'src/lib')).sort();
    const added = current.filter((entry) => !LIB_FROZEN_ENTRIES.includes(entry));
    expect(added, 'Código nuevo va en src/modules/<módulo>/ o src/platform/ (ADR 003)').toEqual([]);
  });
});

describe('ADR 003 · lista de excepciones de application (Next/Prisma)', () => {
  it('solo puede reducirse', () => {
    expect(APPLICATION_LAYER_BASELINE.length).toBeLessThanOrEqual(APPLICATION_BASELINE_MAX);
  });

  it('no contiene archivos que ya no existen (quítalos al migrar)', () => {
    const missing = APPLICATION_LAYER_BASELINE.filter((file) => !existsSync(join(ROOT, file)));
    expect(missing).toEqual([]);
  });

  it('no tiene duplicados', () => {
    expect(new Set(APPLICATION_LAYER_BASELINE).size).toBe(APPLICATION_LAYER_BASELINE.length);
  });

  it('users/application no está en la lista de excepciones', () => {
    const usersViolations = APPLICATION_LAYER_BASELINE.filter((file) =>
      file.includes('src/modules/users/application/'),
    );
    expect(usersViolations).toEqual([]);
  });

  it('la regla está activa en eslint.config.mjs', () => {
    const config = readFileSync(join(ROOT, 'eslint.config.mjs'), 'utf8');
    expect(config).toMatch(/APPLICATION_LAYER_BASELINE/);
  });
});

function walkModuleSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      walkModuleSourceFiles(full, acc);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      acc.push(full);
    }
  }
  return acc;
}

describe('ADR 003 · Prisma solo en infrastructure (módulos)', () => {
  const PRISMA_OUTSIDE_INFRA_MAX = PRISMA_OUTSIDE_INFRASTRUCTURE_BASELINE.length;

  it('src/modules/oficios no importa @/lib/prisma fuera de infrastructure', () => {
    const moduleDir = join(ROOT, 'src/modules/oficios');
    const allowedOficiosLegacy = new Set(
      PRISMA_OUTSIDE_INFRASTRUCTURE_BASELINE.filter((file) =>
        file.startsWith('src/modules/oficios/'),
      ),
    );
    const violations: string[] = [];
    for (const file of walkModuleSourceFiles(moduleDir)) {
      const rel = file.replace(`${ROOT}/`, '');
      if (rel.includes('/infrastructure/')) continue;
      const content = readFileSync(file, 'utf8');
      if (/\bfrom ['"]@\/lib\/prisma['"]/.test(content)) {
        if (!allowedOficiosLegacy.has(rel)) violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  it('lista de excepciones Prisma fuera de infrastructure solo puede reducirse', () => {
    const modulesRoot = join(ROOT, 'src/modules');
    const current: string[] = [];

    for (const moduleName of readdirSync(modulesRoot)) {
      const moduleDir = join(modulesRoot, moduleName);
      for (const file of walkModuleSourceFiles(moduleDir)) {
        const rel = file.replace(`${ROOT}/`, '');
        if (rel.includes('/infrastructure/')) continue;
        const content = readFileSync(file, 'utf8');
        if (/\bfrom ['"]@\/lib\/prisma['"]/.test(content)) {
          current.push(rel);
        }
      }
    }

    current.sort();
    const baseline = [...PRISMA_OUTSIDE_INFRASTRUCTURE_BASELINE].sort();
    expect(baseline.length).toBeLessThanOrEqual(PRISMA_OUTSIDE_INFRA_MAX);
    const unexpected = current.filter((file) => !baseline.includes(file));
    expect(unexpected, 'Nuevo import de Prisma fuera de infrastructure').toEqual([]);
    const missing = baseline.filter((file) => !existsSync(join(ROOT, file)));
    expect(missing, 'Quita entradas del baseline al migrar').toEqual([]);
  });

  it('infrastructure no reexporta el cliente Prisma', () => {
    const modulesRoot = join(ROOT, 'src/modules');
    const violations: string[] = [];
    const prismaReexportPatterns = [
      /export\s*\{\s*prisma\b/,
      /export\s+\*\s+from\s+['"]@\/lib\/prisma['"]/,
      /export\s+const\s+\w+\s*=\s*prisma\b/,
      /export\s+default\s+prisma\b/,
      /export\s+(const|function)\s+oficiosDb\b/,
    ];

    for (const moduleName of readdirSync(modulesRoot)) {
      const infraDir = join(modulesRoot, moduleName, 'infrastructure');
      if (!existsSync(infraDir)) continue;
      const files = walkModuleSourceFiles(infraDir);
      for (const file of files) {
        const rel = file.replace(`${ROOT}/`, '');
        const content = readFileSync(file, 'utf8');
        for (const pattern of prismaReexportPatterns) {
          if (pattern.test(content)) {
            violations.push(`${rel} (${pattern})`);
            break;
          }
        }
        if (/prisma-client/.test(content) && !rel.endsWith('prisma-client.ts')) {
          violations.push(`${rel} (imports prisma-client re-export)`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

describe('ADR 003 · lista de excepciones de Prisma en presentación', () => {
  it('solo puede reducirse', () => {
    expect(PRISMA_IN_PRESENTATION_BASELINE.length).toBeLessThanOrEqual(BASELINE_MAX);
  });

  it('no contiene archivos que ya no existen (quítalos al migrar)', () => {
    const missing = PRISMA_IN_PRESENTATION_BASELINE.filter((file) => !existsSync(join(ROOT, file)));
    expect(missing).toEqual([]);
  });

  it('no tiene duplicados', () => {
    expect(new Set(PRISMA_IN_PRESENTATION_BASELINE).size).toBe(PRISMA_IN_PRESENTATION_BASELINE.length);
  });

  it('la regla está activa en eslint.config.mjs', () => {
    const config = readFileSync(join(ROOT, 'eslint.config.mjs'), 'utf8');
    expect(config).toMatch(/PRISMA_IN_PRESENTATION_BASELINE/);
    expect(config).toMatch(/@typescript-eslint\/no-restricted-imports/);
  });
});
