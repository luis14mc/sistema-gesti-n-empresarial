import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import apiGuardsFixture from './__fixtures__/api-guards.json';

const REPO = process.cwd();

function readRouteSource(relativePath: string): string {
  return readFileSync(join(REPO, relativePath), 'utf-8');
}

function extractAuthorizePermissions(source: string): string[] {
  const re = /authorizeOrganization\s*\(\s*[^,]+,\s*[^,]+,\s*(?:[^,]+,\s*)?'([^']+)'/g;
  const perms: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) perms.push(m[1]);
  return perms;
}

describe('oficios golden — guardas API (14 rutas baseline)', () => {
  it('fixture api-guards.json coincide con permisos en route.ts', () => {
    for (const entry of apiGuardsFixture as {
      file: string;
      method: string;
      permission: string;
      permissionKind: string;
    }[]) {
      const source = readRouteSource(entry.file);
      expect(source).toContain(`export const ${entry.method}`);
      if (entry.permissionKind === 'authorizeOrganization') {
        const declared = extractAuthorizePermissions(source);
        if (declared.length > 0) {
          expect(declared).toContain(entry.permission);
        } else {
          expect(source).toContain(`'${entry.permission}'`);
        }
      }
    }
  });

  it('GET signers permite oficios.read como fallback', () => {
    const source = readRouteSource('src/app/api/oficios/signers/route.ts');
    expect(source).toMatch(/oficios\.configure/);
    expect(source).toMatch(/oficios\.read/);
  });

  it('PUT numbering permite oficios.create como fallback', () => {
    const source = readRouteSource('src/app/api/oficios/numbering/route.ts');
    expect(source).toMatch(/oficios\.configure/);
    expect(source).toMatch(/oficios\.create/);
  });
});
