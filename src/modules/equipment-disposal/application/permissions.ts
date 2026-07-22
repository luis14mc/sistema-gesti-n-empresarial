import type { OrganizationRole } from '@prisma/client';

export const EQUIPMENT_DISPOSAL_PERMISSIONS = [
  'equipment-disposal.read',
  'equipment-disposal.create',
  'equipment-disposal.update',
  'equipment-disposal.submit',
  'equipment-disposal.approve',
  'equipment-disposal.reject',
  'equipment-disposal.cancel',
  'equipment-disposal.configure',
  'equipment-disposal.download',
] as const;

export type EquipmentDisposalPermission = (typeof EQUIPMENT_DISPOSAL_PERMISSIONS)[number];

const ALL = EQUIPMENT_DISPOSAL_PERMISSIONS;
const READ_DOWNLOAD: readonly EquipmentDisposalPermission[] = [
  'equipment-disposal.read',
  'equipment-disposal.download',
];

const PERMISSIONS_BY_ROLE: Record<OrganizationRole, readonly EquipmentDisposalPermission[]> = {
  OWNER: ALL,
  ADMIN: ALL,
  IT_MANAGER: [
    ...READ_DOWNLOAD,
    'equipment-disposal.create',
    'equipment-disposal.update',
    'equipment-disposal.submit',
    'equipment-disposal.approve',
    'equipment-disposal.reject',
    'equipment-disposal.cancel',
  ],
  IT_TECHNICIAN: [
    ...READ_DOWNLOAD,
    'equipment-disposal.create',
    'equipment-disposal.update',
    'equipment-disposal.submit',
  ],
  AUDITOR: READ_DOWNLOAD,
  HR: READ_DOWNLOAD,
  PROCUREMENT: READ_DOWNLOAD,
  USER: ['equipment-disposal.read'],
};

export function can(role: OrganizationRole, permission: EquipmentDisposalPermission): boolean {
  return PERMISSIONS_BY_ROLE[role].includes(permission);
}

export class DisposalPermissionError extends Error {
  constructor(readonly permission: EquipmentDisposalPermission) {
    super('FORBIDDEN');
    this.name = 'DisposalPermissionError';
  }
}

export function requirePermission(role: OrganizationRole, permission: EquipmentDisposalPermission): void {
  if (!can(role, permission)) throw new DisposalPermissionError(permission);
}
