import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');

describe('employee API authorization contract', () => {
  it('does not use legacy JWT role allowlists', () => {
    const list = readFileSync(resolve(ROOT, 'src/app/api/employees/route.ts'), 'utf8');
    const item = readFileSync(resolve(ROOT, 'src/app/api/employees/[id]/route.ts'), 'utf8');
    expect(list).not.toMatch(/withAuth\([^,]+,\s*\['ADMIN'/);
    expect(item).not.toMatch(/withAuth\([^,]+,\s*\['ADMIN'/);
    expect(list).toMatch(/employees\.read/);
    expect(list).toMatch(/employees\.create/);
    expect(item).toMatch(/employees\.read/);
    expect(item).toMatch(/employees\.update|employees\.deactivate/);
  });

  it('scopes queries to the session organization and returns 403 on PermissionDeniedError', () => {
    const list = readFileSync(resolve(ROOT, 'src/app/api/employees/route.ts'), 'utf8');
    const item = readFileSync(resolve(ROOT, 'src/app/api/employees/[id]/route.ts'), 'utf8');

    expect(list).toMatch(/authorizeOrganization\(req, requestId, 'employees\.read'\)/);
    expect(list).toMatch(/const where: Prisma\.EmployeeWhereInput = \{ organizationId \}/);
    expect(list).not.toMatch(/body\.organizationId/);
    expect(list).toMatch(/PermissionDeniedError/);
    expect(list).toMatch(/status: 403/);

    expect(item).toMatch(/where: \{ id, organizationId \}/);
    expect(item).toMatch(/PermissionDeniedError/);
    expect(item).toMatch(/status: 403/);
  });
});
