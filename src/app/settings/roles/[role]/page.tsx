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

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Permisos: {label}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure Ver / Crear / Editar / Eliminar y permisos especiales para este rol.
        </p>
      </div>
      <RolePermissionsEditor role={role} />
    </div>
  );
}
