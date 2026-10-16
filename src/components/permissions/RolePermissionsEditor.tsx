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
import {
  RoleSettingsFields,
  type RoleSettingsFormState,
} from '@/components/permissions/RoleSettingsFields';
import { countUnsavedPermissionChanges } from '@/components/permissions/role-editor-unsaved';
import { formatRolesApiErrorMessage, readApiErrorFromResponse } from '@/lib/api-error-message';
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

export function RolePermissionsEditor({ role, roleLabel }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<ModuleAccessRow[]>([]);
  const [baselineRows, setBaselineRows] = useState<ModuleAccessRow[]>([]);
  const [origins, setOrigins] = useState<Partial<Record<ModuleId, 'official' | 'modified'>>>({});
  const [memberCount, setMemberCount] = useState(0);
  const [modified, setModified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baselineLoaded, setBaselineLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settings, setSettings] = useState<RoleSettingsFormState>({
    displayName: roleLabel,
    description: '',
    assignable: false,
  });
  const [settingsBaseline, setSettingsBaseline] = useState<RoleSettingsFormState | null>(null);
  const [adminLocked, setAdminLocked] = useState(false);
  const loadVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    setBaselineLoaded(false);
    try {
      const [permRes, settingsRes] = await Promise.all([
        fetch(`/api/roles/${role}/permissions`),
        fetch(`/api/roles/${role}/settings`),
      ]);

      const failures: string[] = [];
      if (!permRes.ok) {
        failures.push(
          `Permisos: ${await readApiErrorFromResponse(permRes, 'No se pudieron cargar permisos del rol', { rolesContext: true })}`,
        );
      }
      if (!settingsRes.ok) {
        failures.push(
          `Configuración: ${await readApiErrorFromResponse(settingsRes, 'No se pudo cargar la configuración del rol', { rolesContext: true })}`,
        );
      }
      if (failures.length > 0) {
        throw new Error(failures.join(' · '));
      }

      const data = await permRes.json();
      const settingsData = await settingsRes.json();
      if (version !== loadVersion.current) return;

      setMemberCount(data.memberCount ?? settingsData.memberCount ?? 0);
      setAdminLocked(Boolean(settingsData.adminLocked));
      const nextSettings: RoleSettingsFormState = {
        displayName: settingsData.displayName ?? roleLabel,
        description: settingsData.description ?? '',
        assignable: Boolean(settingsData.assignable),
      };
      setSettings(nextSettings);
      setSettingsBaseline(nextSettings);
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
      setBaselineLoaded(true);
    } catch (e) {
      if (version !== loadVersion.current) return;
      setRows([]);
      setBaselineRows([]);
      setSettingsBaseline(null);
      setBaselineLoaded(false);
      setError(e instanceof Error ? e.message : 'Error al cargar permisos del rol');
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [role, roleLabel]);

  useEffect(() => {
    void load();
  }, [load]);

  const unsavedCount = useMemo(() => {
    if (!baselineLoaded) return 0;
    return countUnsavedPermissionChanges(rows, baselineRows);
  }, [baselineLoaded, rows, baselineRows]);

  const isDirty = baselineLoaded && unsavedCount > 0;

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
        const body = await res.json().catch(() => null);
        throw new Error(
          formatRolesApiErrorMessage(res.status, body, 'Error al guardar permisos'),
        );
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

  const saveSettings = async () => {
    if (!settingsBaseline) return;
    let confirmRetainMembers = false;
    if (
      settingsBaseline.assignable &&
      !settings.assignable &&
      memberCount > 0
    ) {
      const ok = await swalConfirm(
        'Dejar de asignar este rol',
        `${memberCount} usuario(s) conservan este rol, pero no se podrá asignar a nuevos.`,
      );
      if (!ok.isConfirmed) return;
      confirmRetainMembers = true;
    }
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/roles/${role}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: settings.displayName,
          description: settings.description || null,
          assignable: settings.assignable,
          confirmRetainMembers,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && body.error === 'CONFIRM_RETAIN_MEMBERS') {
        const ok = await swalConfirm('Confirmar', body.message as string);
        if (!ok.isConfirmed) return;
        const retry = await fetch(`/api/roles/${role}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: settings.displayName,
            description: settings.description || null,
            assignable: settings.assignable,
            confirmRetainMembers: true,
          }),
        });
        if (!retry.ok) {
          const retryBody = await retry.json().catch(() => null);
          throw new Error(
            formatRolesApiErrorMessage(retry.status, retryBody, 'Error al guardar configuración'),
          );
        }
      } else if (!res.ok) {
        throw new Error(
          formatRolesApiErrorMessage(res.status, body, 'Error al guardar configuración'),
        );
      }
      sileo.success({ title: 'Configuración del rol guardada' });
      await load();
    } catch (e) {
      sileo.error({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Error al guardar configuración',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const resetOfficial = async () => {
    const ok = await swalConfirm(
      'Restaurar valores oficiales',
      `¿Restablecer el rol ${settings.displayName || roleLabel} a la plantilla oficial?`,
    );
    if (!ok.isConfirmed) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${role}/reset`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          formatRolesApiErrorMessage(res.status, body, 'No se pudo restablecer'),
        );
      }
      await fetch('/api/auth/refresh-session', { method: 'POST' });
      sileo.success({ title: 'Rol restablecido' });
      await load();
    } catch (e) {
      sileo.error({ title: 'Error', description: e instanceof Error ? e.message : 'Error' });
    } finally {
      setSaving(false);
    }
  };

  const settingsDirty =
    settingsBaseline !== null &&
    (settings.displayName !== settingsBaseline.displayName ||
      settings.description !== settingsBaseline.description ||
      settings.assignable !== settingsBaseline.assignable);

  const statusLabel = modified ? 'Modificado' : 'Plantilla oficial';
  const visibleTitle = settings.displayName || roleLabel;
  const actionsDisabled = loading || Boolean(error) || !baselineLoaded;

  const headerMeta = (
    <p className="text-sm text-muted-foreground">
      {memberCount} {memberCount === 1 ? 'usuario' : 'usuarios'} con este rol · {statusLabel}
    </p>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={`Permisos: ${visibleTitle}`}
          description="Configure Ver, Crear, Editar, Eliminar y permisos especiales para este rol."
          breadcrumbs={[
            { label: 'Administración', href: '/settings' },
            { label: 'Roles y permisos', href: '/settings/roles' },
            { label: visibleTitle },
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
                disabled={saving || actionsDisabled}
              >
                Restaurar valores oficiales
              </Button>
            </>
          }
          primaryAction={
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={saving || actionsDisabled || !isDirty}
            >
              {saving
                ? 'Guardando…'
                : isDirty
                  ? `Guardar (${unsavedCount} ${unsavedCount === 1 ? 'cambio' : 'cambios'} sin guardar)`
                  : 'Guardar'}
            </Button>
          }
        >
          {!loading && !error && baselineLoaded ? headerMeta : null}
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
            <AlertDescription className="space-y-3">
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Catálogo de asignación</h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={saveSettings}
                    disabled={savingSettings || !settingsDirty}
                  >
                    {savingSettings ? 'Guardando…' : 'Guardar configuración'}
                  </Button>
                </div>
                <RoleSettingsFields
                  value={settings}
                  onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
                  adminLocked={adminLocked}
                  memberCount={memberCount}
                  disabled={savingSettings}
                />
              </CardContent>
            </Card>
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
          </>
        )}
      </div>
    </MainLayout>
  );
}
