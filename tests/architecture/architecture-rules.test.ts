import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRISMA_IN_PRESENTATION_BASELINE } from '../../eslint.architecture-baseline.mjs';

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

const BASELINE_MAX = 56;

describe('ADR 003 · src/lib congelado', () => {
  it('no se agregan archivos ni carpetas nuevas en src/lib', () => {
    const current = readdirSync(join(ROOT, 'src/lib')).sort();
    const added = current.filter((entry) => !LIB_FROZEN_ENTRIES.includes(entry));
    expect(added, 'Código nuevo va en src/modules/<módulo>/ o src/platform/ (ADR 003)').toEqual([]);
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
