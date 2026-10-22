import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUser } from '@/modules/users/application/users-collection-service';
import { adminResetUserPassword } from '@/modules/users/application/user-password-admin-service';
import { putRolePermissionsUseCase } from '@/modules/users/application/role-permissions-service';
import {
  LockedPermissionsMissingError,
  UserEmailAlreadyRegisteredError,
  CannotResetOwnerPasswordError,
} from '@/modules/users/domain/errors';

vi.mock('@/platform/security/audit/audit-record', () => ({
  createAuditRecord: vi.fn(async () => undefined),
}));

vi.mock('@/platform/security/authorization/role-catalog-service', () => ({
  isOrganizationRoleAssignable: vi.fn(async () => true),
}));

const findUserByEmail = vi.fn();
const createUserWithMembership = vi.fn();
const findActiveMembership = vi.fn();
const updatePasswordAndBumpAccess = vi.fn();

vi.mock('@/modules/users/infrastructure/user-repository', () => ({
  findUserByEmail: (...args: unknown[]) => findUserByEmail(...args),
  createUserWithMembership: (...args: unknown[]) => createUserWithMembership(...args),
  findActiveMembership: (...args: unknown[]) => findActiveMembership(...args),
  updatePasswordAndBumpAccess: (...args: unknown[]) => updatePasswordAndBumpAccess(...args),
}));

const replaceRolePermissions = vi.fn();

vi.mock('@/modules/users/infrastructure/role-repository', () => ({
  replaceRolePermissions: (...args: unknown[]) => replaceRolePermissions(...args),
}));

vi.mock('@/platform/security/authorization/role-permission-locks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/security/authorization/role-permission-locks')>();
  return {
    ...actual,
    findMissingLockedPermissions: vi.fn((role: string) =>
      role === 'OWNER' ? ['users.read'] : [],
    ),
    applyLockedPermissions: vi.fn((_role: string, set: Set<string>) => {
      set.add('users.read');
    }),
  };
});

vi.mock('@/platform/security/authorization/role-permission-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/security/authorization/role-permission-service')>();
  return {
    ...actual,
    loadOrganizationRolePermissionMap: vi.fn(async () => new Map()),
    loadOrganizationRolePermissionMapUncached: vi.fn(async () => new Map()),
  };
});

describe('users application · createUser', () => {
  beforeEach(() => {
    findUserByEmail.mockReset();
    createUserWithMembership.mockReset();
  });

  it('rechaza email duplicado', async () => {
    findUserByEmail.mockResolvedValueOnce({ id: 'existing' });
    await expect(
      createUser({
        organizationId: 'org-1',
        actorUserId: 'admin-1',
        input: {
          firstName: 'Ana',
          lastName: 'Test',
          email: 'a@test.com',
          password: 'ValidPass1!',
          role: 'USER',
          employeeNumber: 'E-1',
          mustChangePassword: true,
        },
        hashPassword: async () => 'hash',
      }),
    ).rejects.toBeInstanceOf(UserEmailAlreadyRegisteredError);
  });

  it('crea usuario cuando el email está libre', async () => {
    findUserByEmail.mockResolvedValueOnce(null);
    createUserWithMembership.mockResolvedValueOnce({
      id: 'u-1',
      firstName: 'Ana',
      lastName: 'Test',
      email: 'a@test.com',
      employeeNumber: 'E-1',
      phone: null,
      role: 'USER',
      isActive: true,
      departmentId: null,
      positionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await createUser({
      organizationId: 'org-1',
      actorUserId: 'admin-1',
      input: {
        firstName: 'Ana',
        lastName: 'Test',
        email: 'a@test.com',
        password: 'ValidPass1!',
        role: 'USER',
        employeeNumber: 'E-1',
        mustChangePassword: true,
      },
      hashPassword: async () => 'hash',
    });
    expect(result.user.id).toBe('u-1');
    expect(createUserWithMembership).toHaveBeenCalled();
  });
});

describe('users application · adminResetUserPassword', () => {
  beforeEach(() => {
    findActiveMembership.mockReset();
    updatePasswordAndBumpAccess.mockReset();
  });

  it('no permite resetear OWNER si el actor no es OWNER', async () => {
    findActiveMembership.mockResolvedValueOnce({
      id: 'm-1',
      role: 'OWNER',
      user: { email: 'o@test.com', firstName: 'O', lastName: 'W', role: 'ADMIN', isActive: true },
    });
    await expect(
      adminResetUserPassword({
        organizationId: 'org-1',
        actorUserId: 'admin-1',
        actorRole: 'ADMIN',
        targetUserId: 'owner-1',
        input: { newPassword: 'ValidPass1!', mustChangePassword: true },
        hashPassword: async () => 'hash',
      }),
    ).rejects.toBeInstanceOf(CannotResetOwnerPasswordError);
  });

  it('bump de accessVersion vía repositorio al resetear', async () => {
    findActiveMembership.mockResolvedValueOnce({
      id: 'm-2',
      role: 'USER',
      user: { email: 'u@test.com', firstName: 'U', lastName: 'S', role: 'USER', isActive: true },
    });
    updatePasswordAndBumpAccess.mockResolvedValueOnce(undefined);
    await adminResetUserPassword({
      organizationId: 'org-1',
      actorUserId: 'admin-1',
      actorRole: 'ADMIN',
      targetUserId: 'user-1',
      input: { newPassword: 'ValidPass1!', mustChangePassword: true },
      hashPassword: async () => 'hash',
    });
    expect(updatePasswordAndBumpAccess).toHaveBeenCalledWith(
      expect.objectContaining({ membershipId: 'm-2', mustChangePassword: true }),
    );
  });
});

describe('users application · putRolePermissionsUseCase', () => {
  beforeEach(() => {
    replaceRolePermissions.mockReset();
  });

  it('no permite quitar permisos bloqueados en OWNER', async () => {
    await expect(
      putRolePermissionsUseCase({
        organizationId: 'org-1',
        actorUserId: 'admin-1',
        role: 'OWNER',
        body: {
          rows: [
            {
              module: 'users',
              canRead: false,
              canCreate: false,
              canUpdate: false,
              canDelete: false,
              extras: [],
            },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(LockedPermissionsMissingError);
    expect(replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('reemplaza el set completo de permisos del rol', async () => {
    replaceRolePermissions.mockResolvedValueOnce(undefined);
    const result = await putRolePermissionsUseCase({
      organizationId: 'org-1',
      actorUserId: 'admin-1',
      role: 'USER',
      body: {
        rows: [
          {
            module: 'users',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            extras: [],
          },
        ],
      },
    });
    expect(result.ok).toBe(true);
    expect(replaceRolePermissions).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        role: 'USER',
        permissions: expect.arrayContaining(['users.read']),
      }),
    );
  });
});
