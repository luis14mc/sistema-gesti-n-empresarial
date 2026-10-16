'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RoleSettingsFields,
  type RoleSettingsFormState,
} from '@/components/permissions/RoleSettingsFields';
import { swalConfirm } from '@/lib/swal';
import { sileo } from 'sileo';
import { formatRolesApiErrorMessage, readApiErrorFromResponse } from '@/lib/api-error-message';

type RoleRow = {
  role: string;
  displayName: string;
  label: string;
  assignable: boolean;
  memberCount: number;
  modified: boolean;
  description: string | null;
};

export default function RolesSettingsPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsRole, setSettingsRole] = useState<RoleRow | null>(null);
  const [settingsForm, setSettingsForm] = useState<RoleSettingsFormState | null>(null);
  const [adminLocked, setAdminLocked] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/roles');
      if (!res.ok) {
        throw new Error(
          await readApiErrorFromResponse(res, 'No autorizado', { rolesContext: true }),
        );
      }
      const data = await res.json();
      setRoles(data.roles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openSettings = async (row: RoleRow) => {
    setSettingsRole(row);
    setSettingsForm({
      displayName: row.displayName,
      description: row.description ?? '',
      assignable: row.assignable,
    });
    setAdminLocked(row.role === 'ADMIN');
    try {
      const res = await fetch(`/api/roles/${row.role}/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettingsForm({
          displayName: data.displayName,
          description: data.description ?? '',
          assignable: data.assignable,
        });
        setAdminLocked(Boolean(data.adminLocked));
      }
    } catch {
      // keep row defaults
    }
  };

  const saveSettings = async () => {
    if (!settingsRole || !settingsForm) return;
    let confirmRetainMembers = false;
    if (
      settingsRole.assignable &&
      !settingsForm.assignable &&
      settingsRole.memberCount > 0
    ) {
      const ok = await swalConfirm(
        'Dejar de asignar este rol',
        `${settingsRole.memberCount} usuario(s) conservan este rol, pero no se podrá asignar a nuevos.`,
      );
      if (!ok.isConfirmed) return;
      confirmRetainMembers = true;
    }
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/roles/${settingsRole.role}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settingsForm,
          description: settingsForm.description || null,
          confirmRetainMembers,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(formatRolesApiErrorMessage(res.status, body, 'Error al guardar'));
      }
      sileo.success({ title: 'Configuración guardada' });
      setSettingsRole(null);
      await load();
    } catch (e) {
      sileo.error({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo guardar',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Roles y permisos"
          description="Matriz rol × módulo configurable. Los usuarios heredan el rol y pueden tener excepciones individuales."
          breadcrumbs={[
            { label: 'Administración', href: '/settings' },
            { label: 'Roles y permisos' },
          ]}
        />

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertTitle>Error al cargar</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rol</TableHead>
                    <TableHead className="text-right">Usuarios asignados</TableHead>
                    <TableHead>Asignación</TableHead>
                    <TableHead>Estado permisos</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((row) => (
                    <TableRow key={row.role}>
                      <TableCell className="font-medium">{row.displayName}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.memberCount}</TableCell>
                      <TableCell>
                        {row.assignable ? (
                          <Badge variant="outline">Disponible</Badge>
                        ) : (
                          <Badge variant="secondary">Solo existentes</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.modified ? (
                          <Badge variant="secondary">Modificado</Badge>
                        ) : (
                          <Badge variant="outline">Plantilla oficial</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => void openSettings(row)}>
                          Ajustes
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/settings/roles/${row.role}`}>Editar permisos</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(settingsRole)} onOpenChange={(open) => !open && setSettingsRole(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Configurar rol</DialogTitle>
            </DialogHeader>
            {settingsForm ? (
              <RoleSettingsFields
                value={settingsForm}
                onChange={(patch) => setSettingsForm((prev) => (prev ? { ...prev, ...patch } : prev))}
                adminLocked={adminLocked}
                memberCount={settingsRole?.memberCount ?? 0}
                disabled={savingSettings}
              />
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSettingsRole(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void saveSettings()} disabled={savingSettings}>
                {savingSettings ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
