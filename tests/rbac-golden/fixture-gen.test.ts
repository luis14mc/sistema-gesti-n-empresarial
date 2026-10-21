import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { buildOfficialMatrix, buildRouteMap } from './_helpers';

const FIXTURES = join(import.meta.dirname, '__fixtures__');

/** Ejecutar una vez: pnpm vitest run tests/rbac-golden/fixture-gen.test.ts */
describe.skip('GENERATE rbac-golden fixtures (manual)', () => {
  it('escribe official-matrix.json y route-map.json', () => {
    writeFileSync(
      join(FIXTURES, 'official-matrix.json'),
      `${JSON.stringify(buildOfficialMatrix(), null, 2)}\n`,
    );
    writeFileSync(join(FIXTURES, 'route-map.json'), `${JSON.stringify(buildRouteMap(), null, 2)}\n`);
  });
});
