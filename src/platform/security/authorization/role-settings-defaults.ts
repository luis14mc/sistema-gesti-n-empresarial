import type { OrganizationRole } from '@prisma/client';
import { ORGANIZATION_ROLES } from '@/platform/security/authorization/permissions';
import { ORGANIZATION_ROLE_LABELS, PROMOTED_ORGANIZATION_ROLES } from '@/platform/security/authorization/roles';

export type RoleSettingDefaults = {
  displayName: string;
  assignable: boolean;
  description: string | null;
};

/** Seed / fallback defaults per organization role (does not mutate ORGANIZATION_ROLE_LABELS). */
export const ROLE_SETTING_DEFAULTS: Record<OrganizationRole, RoleSettingDefaults> =
  Object.fromEntries(
    ORGANIZATION_ROLES.map((role) => {
      const promoted = (PROMOTED_ORGANIZATION_ROLES as readonly string[]).includes(role);
      const legacyCleanNames: Partial<Record<OrganizationRole, string>> = {
        OWNER: 'Propietario',
        IT_TECHNICIAN: 'Técnico TI',
        PROCUREMENT: 'Compras',
        HR: 'Recursos Humanos',
        AUDITOR: 'Auditor',
        USER: 'Usuario',
        DIRECTOR: 'Director',
      };
      const displayName =
        legacyCleanNames[role] ?? ORGANIZATION_ROLE_LABELS[role].replace(/\s*\(legado\)\s*$/i, '');
      return [
        role,
        {
          displayName,
          assignable: promoted,
          description: null,
        },
      ];
    }),
  ) as Record<OrganizationRole, RoleSettingDefaults>;

export function defaultRoleSetting(role: OrganizationRole): RoleSettingDefaults {
  return ROLE_SETTING_DEFAULTS[role];
}
