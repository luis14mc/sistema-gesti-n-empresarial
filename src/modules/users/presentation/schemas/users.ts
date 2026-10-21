import { z } from 'zod';
import { passwordPolicySchema } from '@/platform/security/password-policy';
import { MODULE_IDS, type ModuleId } from '@/platform/security/modules';
import { ORGANIZATION_ROLES, type OrganizationRole } from '@/platform/security/authorization/permissions';

export const createUserBodySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: passwordPolicySchema,
  role: z.string(),
  employeeNumber: z.string().min(1),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  mustChangePassword: z.boolean().optional().default(true),
});

export const adminPasswordResetSchema = z.object({
  newPassword: passwordPolicySchema,
  mustChangePassword: z.boolean().default(true),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: passwordPolicySchema,
});

export const roleParamSchema = z.enum(
  ORGANIZATION_ROLES as unknown as [OrganizationRole, ...OrganizationRole[]],
);

const permissionRowSchema = z.object({
  module: z.enum(MODULE_IDS as [ModuleId, ...ModuleId[]]),
  canRead: z.boolean(),
  canCreate: z.boolean(),
  canUpdate: z.boolean(),
  canDelete: z.boolean(),
  extras: z.array(z.string()).default([]),
});

export const rolePermissionsPutSchema = z.object({
  rows: z.array(permissionRowSchema),
});

export const userPermissionOverridesPutSchema = z.object({
  rows: z.array(permissionRowSchema),
});

export const roleSettingsPutSchema = z.object({
  displayName: z.string().trim().min(1, 'Nombre visible requerido').max(80),
  description: z.string().trim().max(500).nullable().optional(),
  assignable: z.boolean(),
  confirmRetainMembers: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserBodySchema>;
export type RolePermissionsPutInput = z.infer<typeof rolePermissionsPutSchema>;
export type UserPermissionOverridesPutInput = z.infer<typeof userPermissionOverridesPutSchema>;
export type RoleSettingsPutInput = z.infer<typeof roleSettingsPutSchema>;
