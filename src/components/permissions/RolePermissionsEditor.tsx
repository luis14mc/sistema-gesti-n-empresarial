'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OrganizationRole } from '@prisma/client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MODULE_IDS, type ModuleAccessRow, type ModuleId } from '@/platform/security/modules';
import type { RoleModuleMatrix } from '@/platform/security/role-permission-matrix';
import { ModulePermissionMatrix } from '@/components/permissions/ModulePermissionMatrix';
import { ORGANIZATION_ROLE_LABELS } from '@/platform/security/authorization/roles';
import { swalConfirm } from '@/lib/swal';
import { sileo } from 'sileo';
import { Loader2 } from 'lucide-react';

type Props = {
  role: OrganizationRole;
};

function matrixToRows(matrix: RoleModuleMatrix): ModuleAccessRow[] {
  return MODULE_IDS.map((id) => {
    const row = matrix[id];
    return {
      module: id,
      canRead: row.canRead,
      canCreate: row.canCreate,
      canUpdate: row.canUpdate,
      canDelete: row.canDelete,
      extras: row.extras,
    };
  });
}

export function RolePermissionsEditor({ role }: Props) {
  const [rows, setRows] = useState<ModuleAccessRow[]>([]);
  const [origins, setOrigins] = useState<Partial<Record<ModuleId, 'official' | 'modified'>>>({});
  const [memberCount, setMemberCount] = useState(0);
  const [modified, setModified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/roles/${role}/permissions`);
    if (!res.ok) throw new Error('No se pudieron cargar permisos del rol');
    const data = await res.json();
    setMemberCount(data.memberCount ?? 0);
    setModified(Boolean(data.modified));
    const matrix = data.moduleAccess as RoleModuleMatrix;
    setRows(matrixToRows(matrix));
    setOrigins(
      Object.fromEntries(
        MODULE_IDS.map((id) => [id, matrix[id].origin]),
      ) as Partial<Record<ModuleId, 'official' | 'modified'>>,
    );
    setLoading(false);
  }, [role]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const label = useMemo(() => ORGANIZATION_ROLE_LABELS[role], [role]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${role}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Error al guardar');
      }
      await fetch('/api/auth/refresh-session', { method: 'POST' });
      sileo.success({ title: 'Permisos del rol guardados' });
      await load();
    } catch (e) {
      sileo.error({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Error al guardar',
      });
    } finally {
      setSaving(false);
    }
  };

  const resetOfficial = async () => {
    const ok = await swalConfirm(
      'Restaurar valores oficiales',
      `¿Restablecer el rol ${label} a la plantilla oficial?`,
    );
    if (!ok.isConfirmed) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${role}/reset`, { method: 'POST' });
      if (!res.ok) throw new Error('No se pudo restablecer');
      await fetch('/api/auth/refresh-session', { method: 'POST' });
      sileo.success({ title: 'Rol restablecido' });
      await load();
    } catch (e) {
      sileo.error({ title: 'Error', description: e instanceof Error ? e.message : 'Error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          {memberCount} usuario(s) activos con este rol
          {modified ? ' · Matriz modificada' : ' · Plantilla oficial'}
        </span>
        <Link href="/settings/roles" className="text-primary underline-offset-4 hover:underline">
          Volver a roles
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={resetOfficial} disabled={saving}>
          Restaurar valores oficiales
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
      <ModulePermissionMatrix
        mode="role"
        orgRole={role}
        rows={rows}
        onRowsChange={setRows}
        moduleOrigins={origins}
        memberCount={memberCount}
        disabled={saving}
      />
    </div>
  );
}
