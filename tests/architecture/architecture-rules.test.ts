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

/** Contenido final de src/lib tras la fase 5 (ADR 003). Solo puede reducirse. */
const LIB_FROZEN_ENTRIES = [
  'api-error-message.ts',
  'brand.ts',
  'form-errors.ts',
  'organization-page-context.ts',
  'prisma.ts',
  'swal.ts',
  'utils.ts',
  'zod-schemas.ts',
];

describe('ADR 003 · src/lib congelado', () => {
  it('no se agregan archivos ni carpetas nuevas en src/lib', () => {
    const current = readdirSync(join(ROOT, 'src/lib')).sort();
    const added = current.filter((entry) => !LIB_FROZEN_ENTRIES.includes(entry));
    expect(added, 'Código nuevo va en src/modules/<módulo>/ o src/platform/ (ADR 003)').toEqual([]);
  });
});

describe('ADR 003 · listas de excepciones en cero', () => {
  it('las tres listas están vacías', () => {
    expect(PRISMA_IN_PRESENTATION_BASELINE).toEqual([]);
    expect(PRISMA_OUTSIDE_INFRASTRUCTURE_BASELINE).toEqual([]);
    expect(APPLICATION_LAYER_BASELINE).toEqual([]);
  });

  it('eslint.config.mjs aplica las reglas sin excepciones por archivo', () => {
    const config = readFileSync(join(ROOT, 'eslint.config.mjs'), 'utf8');
    expect(config).toMatch(/@typescript-eslint\/no-restricted-imports/);
    expect(config).not.toMatch(/BASELINE/);
    expect(config).not.toMatch(/'@typescript-eslint\/no-restricted-imports': 'off'/);
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

function walkSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walkSourceFiles(full, acc);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const PRISMA_IMPORT_RE = /\bfrom ['"]@\/lib\/prisma['"]|import\(\s*['"]@\/lib\/prisma['"]\s*\)/;
const PRISMA_ALLOWED_RE = /^src\/(modules\/[^/]+\/infrastructure\/|platform\/)/;

describe('ADR 003 · @/lib/prisma solo en infrastructure y platform', () => {
  it('ningún archivo fuera de src/modules/*/infrastructure/** o src/platform/** importa @/lib/prisma', () => {
    const violations = walkSourceFiles(join(ROOT, 'src'))
      .map((file) => file.replace(`${ROOT}/`, ''))
      .filter((rel) => rel !== 'src/lib/prisma.ts' && !PRISMA_ALLOWED_RE.test(rel))
      .filter((rel) => !/\.test\.tsx?$/.test(rel) && !rel.includes('/__tests__/'))
      .filter((rel) => PRISMA_IMPORT_RE.test(readFileSync(join(ROOT, rel), 'utf8')));
    expect(violations).toEqual([]);
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
