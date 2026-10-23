import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../..');

describe('GET /api/employees list params', () => {
  it('supports pagination, status default and sort', () => {
    const source = readFileSync(resolve(ROOT, 'src/app/api/employees/route.ts'), 'utf8');
    expect(source).toMatch(/resolveEmployeeListOrderBy/);
    expect(source).toMatch(/status === 'inactive'/);
    expect(source).toMatch(/where\.isActive = true/);
    expect(source).toMatch(/organizationId/);
    expect(source).toMatch(/limitParam/);
  });
});
