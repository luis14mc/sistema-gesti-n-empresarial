import { describe, expect, it } from 'vitest';
import { ORGANIZATION_PERMISSIONS, ORGANIZATION_ROLES } from '@/platform/security/authorization/permissions';
import officialMatrixFixture from './__fixtures__/official-matrix.json';
import { buildOfficialMatrix } from './_helpers';

describe('RBAC golden — matriz oficial por rol', () => {
  it('congela officialGranted y locked para cada OrganizationRole × permiso del catálogo', () => {
    const matrix = buildOfficialMatrix();
    expect(matrix).toEqual(officialMatrixFixture);
  });

  it('dimensiones esperadas del snapshot', () => {
    const matrix = buildOfficialMatrix();
    const roles = new Set(matrix.map((r) => r.role));
    const perms = new Set(matrix.map((r) => r.permission));
    expect(roles.size).toBe(ORGANIZATION_ROLES.length);
    expect(perms.size).toBe(ORGANIZATION_PERMISSIONS.length);
    expect(matrix.length).toBe(ORGANIZATION_ROLES.length * ORGANIZATION_PERMISSIONS.length);
  });
});
