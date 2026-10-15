'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OrganizationRole } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MODULE_IDS, type ModuleAccessRow, type ModuleId } from '@/platform/security/modules';
import type { RoleModuleMatrix } from '@/platform/security/role-permission-matrix';
import { ModulePermissionMatrix } from '@/components/permissions/ModulePermissionMatrix';
import { swalConfirm } from '@/lib/swal';
import { sileo } from 'sileo';

type Props = {
  role: OrganizationRole;
  roleLabel: string;
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

function countUnsavedChanges(current: ModuleAccessRow[], baseline: ModuleAccessRow[]): number {
  let changes = 0;
  for (const id of MODULE_IDS) {
    const a = current.find((r) => r.module === id)!;
    const b = baseline.find((r) => r.module === id)!;
    if (a.canRead !== b.canRead) changes++;
    if (a.canCreate !== b.canCreate) changes++;
    if (a.canUpdate !== b.canUpdate) changes++;
    if (a.canDelete !== b.canDelete) changes++;
    const extrasA = [...a.extras].sort().join(',');
    const extrasB = [...b.extras].sort().join(',');
    if (extrasA !== extrasB) changes++;
  }
  return changes;
}

export function RolePermissionsEditor({ role, roleLabel }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<ModuleAccessRow[]>([]);
  const [baselineRows, setBaselineRows] = useState<ModuleAccessRow[]>([]);
  const [origins, setOrigins] = useState<Partial<Record<ModuleId, 'official' | 'modified'>>>({});
  const [memberCount, setMemberCount] = useState(0);
  const [modified, setModified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const loadVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/roles/${role}/permissions`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'No se pudieron cargar permisos del rol');
      }
      const data = await res.json();
      if (version !== loadVersion.current) return;
      setMemberCount(data.memberCount ?? 0);
      setModified(Boolean(data.modified));
      const matrix = data.moduleAccess as RoleModuleMatrix;
      const nextRows = matrixToRows(matrix);
      setRows(nextRows);
      setBaselineRows(nextRows);
      setOrigins(
        Object.fromEntries(
          MODULE_IDS.map((id) => [id, matrix[id].origin]),
        ) as Partial<Record<ModuleId, 'official' | 'modified'>>,
      );
    } catch (e) {
      if (version !== loadVersion.current) return;
      setError(e instanceof Error ? e.message : 'Error al cargar permisos del rol');
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  const unsavedCount = useMemo(
    () => (loading ? 0 : countUnsavedChanges(rows, baselineRows)),
    [loading, rows, baselineRows],
  );
  const isDirty = unsavedCount > 0;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const confirmLeave = async () => {
    if (!isDirty) return true;
    const ok = await swalConfirm(
      'Cambios sin guardar',
      'Tiene cambios sin guardar. ¿Salir sin guardar?',
    );
    return ok.isConfirmed;
  };

  const goBack = async () => {
    if (!(await confirmLeave())) return;
    router.push('/settings/roles');
  };

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
      `¿Restablecer el rol ${roleLabel} a la plantilla oficial?`,
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

  const statusLabel = modified ? 'Modificado' : 'Plantilla oficial';

  const headerMeta = (
    <p className="text-sm text-muted-foreground">
      {memberCount} {memberCount === 1 ? 'usuario' : 'usuarios'} con este rol · {statusLabel}
    </p>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={`Permisos: ${roleLabel}`}
          description="Configure Ver, Crear, Editar, Eliminar y permisos especiales para este rol."
          breadcrumbs={[
            { label: 'Administración', href: '/settings' },
            { label: 'Roles y permisos', href: '/settings/roles' },
            { label: roleLabel },
          ]}
          secondaryActions={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => void goBack()}>
                <ChevronLeft className="mr-1 size-4" aria-hidden="true" />
                Volver
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetOfficial}
                disabled={saving || loading}
              >
                Restaurar valores oficiales
              </Button>
            </>
          }
          primaryAction={
            <Button type="button" size="sm" onClick={save} disabled={saving || loading || !isDirty}>
              {saving
                ? 'Guardando…'
                : isDirty
                  ? `Guardar (${unsavedCount} ${unsavedCount === 1 ? 'cambio' : 'cambios'} sin guardar)`
                  : 'Guardar'}
            </Button>
          }
        >
          {!loading && !error ? headerMeta : null}
        </PageHeader>

        {loading ? (
          <Card>
            <CardContent className="space-y-3 pt-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo cargar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <ModulePermissionMatrix
                mode="role"
                orgRole={role}
                rows={rows}
                onRowsChange={setRows}
                moduleOrigins={origins}
                memberCount={memberCount}
                disabled={saving}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
