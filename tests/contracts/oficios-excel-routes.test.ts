import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('oficios Excel route security contracts', () => {
  const templateRoute = read('src/app/api/oficios/import/template/route.ts');
  const previewRoute = read('src/app/api/oficios/import/preview/route.ts');
  const commitRoute = read('src/app/api/oficios/import/commit/route.ts');

  it('requires authentication and oficios.import permission', () => {
    for (const route of [templateRoute, previewRoute, commitRoute]) {
      expect(route).toMatch(/withAuth\(/);
      expect(route).toMatch(/'oficios\.import'/);
      expect(route).toMatch(/authorizeOrganization/);
    }
  });

  it('enforces xlsx size limits on preview and commit', () => {
    expect(previewRoute).toMatch(/OFICIO_IMPORT_MAX_BYTES/);
    expect(commitRoute).toMatch(/OFICIO_IMPORT_MAX_BYTES/);
  });
});
