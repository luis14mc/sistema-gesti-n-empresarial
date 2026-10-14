'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OrganizationRole } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  MODULE_CATALOG,
  MODULE_IDS,
  type ModuleAccessRow,
  type ModuleAction,
  type ModuleId,
} from '@/platform/security/modules';
import { cellState, normalizeDesiredRow, specialCellState } from '@/platform/security/module-effective';
import { swalConfirm } from '@/lib/swal';
import { sileo } from 'sileo';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_GROUP_ORDER: { label: string; modules: ModuleId[] }[] = [
  { label: 'Inicio', modules: ['dashboard'] },
  { label: 'Correspondencia', modules: ['oficios'] },
  { label: 'Activos', modules: ['equipment', 'assignments', 'software-licenses'] },
  { label: 'Compras', modules: ['purchases'] },
  { label: 'Personas', modules: ['employees', 'users'] },
  { label: 'Planilla', modules: ['payroll'] },
  { label: 'Control', modules: ['reports', 'audits', 'audit-records'] },
  { label: 'Administración', modules: ['settings'] },
];

type Props = {
  userId: string;
};

function originClass(origin: 'inherited' | 'allow' | 'deny') {
  if (origin === 'allow') return 'ring-2 ring-green-500/60 bg-green-500/5';
  if (origin === 'deny') return 'ring-2 ring-red-500/60 bg-red-500/5';
  return 'opacity-80';
}

function originLabel(origin: 'inherited' | 'allow' | 'deny') {
  if (origin === 'allow') return 'Otorgado al usuario (ALLOW)';
  if (origin === 'deny') return 'Denegado al usuario (DENY)';
  return 'Heredado del rol';
}

export function UserPermissionsMatrix({ userId }: Props) {
  const [orgRole, setOrgRole] = useState<OrganizationRole | null>(null);
  const [rows, setRows] = useState<ModuleAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/users/${userId}/permissions`);
    if (!res.ok) throw new Error('No se pudieron cargar permisos');
    const data = await res.json();
    setOrgRole(data.role);
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

  const grouped = useMemo(() => NAV_GROUP_ORDER, []);

  const updateRow = (moduleId: ModuleId, patch: Partial<ModuleAccessRow>) => {
    setRows((prev) =>
      prev.map((r) =>
        r.module === moduleId ? normalizeDesiredRow({ ...r, ...patch, module: moduleId }) : r,
      ),
    );
  };

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
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clearOverrides} disabled={saving}>
          Quitar excepciones
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar permisos'}
        </Button>
      </div>

      {grouped.map((group) => (
        <div key={group.label} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{group.label}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead className="w-16 text-center">Ver</TableHead>
                <TableHead className="w-16 text-center">Crear</TableHead>
                <TableHead className="w-16 text-center">Editar</TableHead>
                <TableHead className="w-16 text-center">Eliminar</TableHead>
                <TableHead>Especiales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.modules.map((moduleId) => {
                const row = rows.find((r) => r.module === moduleId)!;
                const def = MODULE_CATALOG[moduleId];
                return (
                  <TableRow key={moduleId}>
                    <TableCell className="font-medium">
                      {def.label}
                      {def.sensitive ? (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Datos sensibles
                        </Badge>
                      ) : null}
                    </TableCell>
                    {(['read', 'create', 'update', 'delete'] as const).map((action) => {
                      const key =
                        action === 'read'
                          ? 'canRead'
                          : action === 'create'
                            ? 'canCreate'
                            : action === 'update'
                              ? 'canUpdate'
                              : 'canDelete';
                      const enabled = def.crud[action];
                      const roleDefault = cellState(orgRole, moduleId, action as ModuleAction, []).roleDefault;
                      const origin =
                        row[key] === roleDefault ? 'inherited' : row[key] ? 'allow' : 'deny';
                      return (
                        <TableCell key={action} className="text-center">
                          <div
                            className={cn('inline-flex rounded-md p-1', originClass(origin))}
                            title={originLabel(origin)}
                          >
                            <Switch
                              disabled={!enabled}
                              checked={row[key]}
                              onCheckedChange={(val: boolean) => {
                                if (moduleId === 'payroll' && val && def.sensitive) {
                                  void swalConfirm('Datos sensibles', '¿Confirmar acceso a Planilla?').then(
                                    (ok) => {
                                      if (ok.isConfirmed) updateRow(moduleId, { [key]: val });
                                    },
                                  );
                                  return;
                                }
                                if (key === 'canRead' && !val) {
                                  updateRow(moduleId, {
                                    canRead: false,
                                    canCreate: false,
                                    canUpdate: false,
                                    canDelete: false,
                                    extras: [],
                                  });
                                  return;
                                }
                                updateRow(moduleId, { [key]: val });
                              }}
                            />
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {def.specials.map((sp) => {
                          const roleDefault = specialCellState(orgRole, moduleId, sp.id, []).roleDefault;
                          const checked = row.extras.includes(sp.id);
                          const origin =
                            checked === roleDefault ? 'inherited' : checked ? 'allow' : 'deny';
                          return (
                            <label
                              key={sp.id}
                              className={cn('flex items-center gap-2 text-xs rounded-md p-1', originClass(origin))}
                              title={originLabel(origin)}
                            >
                              <Switch
                                disabled={!row.canRead}
                                checked={checked}
                                onCheckedChange={(val: boolean) => {
                                  const set = new Set(row.extras);
                                  if (val) set.add(sp.id);
                                  else set.delete(sp.id);
                                  updateRow(moduleId, { extras: [...set] });
                                }}
                              />
                              {sp.label}
                            </label>
                          );
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
