import { notFound } from 'next/navigation';
import { ORGANIZATION_ROLES } from '@/platform/security/authorization/permissions';
import type { OrganizationRole } from '@/platform/security/authorization/permissions';
import { ORGANIZATION_ROLE_LABELS } from '@/platform/security/authorization/roles';
import { RolePermissionsEditor } from '@/components/permissions/RolePermissionsEditor';

type Props = {
  params: Promise<{ role: string }>;
};

export default async function RolePermissionsPage({ params }: Props) {
  const { role: roleRaw } = await params;
  if (!ORGANIZATION_ROLES.includes(roleRaw as OrganizationRole)) {
    notFound();
  }
  const role = roleRaw as OrganizationRole;
  const label = ORGANIZATION_ROLE_LABELS[role];

  return <RolePermissionsEditor role={role} roleLabel={label} />;
}
