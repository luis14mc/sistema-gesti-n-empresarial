import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import apiGuardsRestFixture from './__fixtures__/api-guards-rest.json';

const REPO = process.cwd();

function readRouteSource(relativePath: string): string {
  return readFileSync(join(REPO, relativePath), 'utf-8');
}

function extractAuthorizePermissions(source: string): string[] {
  const re = /authorizeOrganization\s*\(\s*[^,]+,\s*[^,]+,\s*'([^']+)'/g;
  const perms: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) perms.push(m[1]);
  return perms;
}

describe('purchases golden — guardas API (8 rutas restantes)', () => {
  it('fixture api-guards-rest.json coincide con permisos en route.ts', () => {
    for (const entry of apiGuardsRestFixture as {
      file: string;
      method: string;
      permission: string | null;
      permissionKind: string;
    }[]) {
      const source = readRouteSource(entry.file);
      expect(source).toContain(`export const ${entry.method}`);

      if (entry.permissionKind === 'authorizeOrganization' && entry.permission) {
        const declared = extractAuthorizePermissions(source);
        if (declared.length > 0) {
          expect(declared).toContain(entry.permission);
        } else {
          expect(source).toContain(`'${entry.permission}'`);
        }
      }
    }
  });

  it('cubre exactamente las 8 rutas operativas restantes', () => {
    const files = new Set(
      (apiGuardsRestFixture as { file: string }[]).map((e) => e.file),
    );
    expect(files.size).toBe(8);
  });
});
