'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrganizationRole } from '@prisma/client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MODULE_IDS, type ModuleAccessRow, type ModuleId } from '@/platform/security/modules';
import type { EffectiveModuleAccess } from '@/platform/security/module-effective';
import { ModulePermissionMatrix } from '@/components/permissions/ModulePermissionMatrix';
import { swalConfirm } from '@/lib/swal';
import { sileo } from 'sileo';
import { Loader2 } from 'lucide-react';

type Props = {
  userId: string;
};

export function UserPermissionsMatrix({ userId }: Props) {
  const [orgRole, setOrgRole] = useState<OrganizationRole | null>(null);
  const [rows, setRows] = useState<ModuleAccessRow[]>([]);
  const [roleDefaultRows, setRoleDefaultRows] = useState<Record<ModuleId, ModuleAccessRow> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/users/${userId}/permissions`);
    if (!res.ok) throw new Error('No se pudieron cargar permisos');
    const data = await res.json();
    setOrgRole(data.role);
    const roleMatrix = data.roleModuleAccess as EffectiveModuleAccess;
    setRoleDefaultRows(roleMatrix);
    setRows(
      MODULE_IDS.map((id) => data.moduleAccess[id] ?? {
        module: id,
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        extras: [],
      }),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Error al guardar');
      }
      await fetch('/api/auth/refresh-session', { method: 'POST' });
      sileo.success({ title: 'Permisos guardados' });
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

  const clearOverrides = async () => {
    const ok = await swalConfirm('Quitar excepciones', '¿Restablecer todos los permisos al rol base?');
    if (!ok.isConfirmed) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}/permissions`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo restablecer');
      await fetch('/api/auth/refresh-session', { method: 'POST' });
      sileo.success({ title: 'Excepciones eliminadas' });
      await load();
    } catch (e) {
      sileo.error({ title: 'Error', description: e instanceof Error ? e.message : 'Error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !orgRole) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Los permisos marcados como heredados provienen del rol{' '}
        <strong>{orgRole}</strong>.{' '}
        <Link
          href={`/settings/roles/${orgRole}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          Editar rol
        </Link>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clearOverrides} disabled={saving}>
          Quitar excepciones
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar permisos'}
        </Button>
      </div>
      <ModulePermissionMatrix
        mode="user"
        orgRole={orgRole}
        rows={rows}
        onRowsChange={setRows}
        roleDefaultRows={roleDefaultRows ?? undefined}
        disabled={saving}
      />
    </div>
  );
}
