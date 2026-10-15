'use client';

import { useMemo } from 'react';
import type { OrganizationRole } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
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
  type ModuleAccessRow,
  type ModuleAction,
  type ModuleId,
} from '@/platform/security/modules';
import { cellState, normalizeDesiredRow, specialCellState } from '@/platform/security/module-effective';
import { lockedPermissionsForRole } from '@/platform/security/authorization/role-permission-locks';
import type { Permission } from '@/platform/security/authorization/permissions';
import { swalConfirm } from '@/lib/swal';
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

export type MatrixMode = 'user' | 'role';

type Props = {
  mode: MatrixMode;
  orgRole: OrganizationRole;
  rows: ModuleAccessRow[];
  onRowsChange: (rows: ModuleAccessRow[]) => void;
  roleDefaultRows?: Record<ModuleId, ModuleAccessRow>;
  moduleOrigins?: Partial<Record<ModuleId, 'official' | 'modified'>>;
  memberCount?: number;
  disabled?: boolean;
};

function originClass(origin: 'inherited' | 'allow' | 'deny' | 'official' | 'modified') {
  if (origin === 'allow' || origin === 'modified') return 'ring-2 ring-green-500/60 bg-green-500/5';
  if (origin === 'deny') return 'ring-2 ring-red-500/60 bg-red-500/5';
  return 'opacity-80';
}

function originLabel(
  mode: MatrixMode,
  origin: 'inherited' | 'allow' | 'deny' | 'official' | 'modified',
) {
  if (mode === 'role') {
    return origin === 'modified' ? 'Distinto a plantilla oficial' : 'Plantilla oficial';
  }
  if (origin === 'allow') return 'Otorgado al usuario (ALLOW)';
  if (origin === 'deny') return 'Denegado al usuario (DENY)';
  return 'Heredado del rol';
}

function permissionsForModuleAction(moduleId: ModuleId, action: ModuleAction): Permission[] {
  return [...(MODULE_CATALOG[moduleId].permissionMap[action] ?? [])] as Permission[];
}

function isLockedRoleCell(role: OrganizationRole, moduleId: ModuleId, action: ModuleAction): boolean {
  const locked = new Set(lockedPermissionsForRole(role));
  if (!locked.size) return false;
  return permissionsForModuleAction(moduleId, action).some((permission) => locked.has(permission));
}

export function ModulePermissionMatrix({
  mode,
  orgRole,
  rows,
  onRowsChange,
  roleDefaultRows,
  moduleOrigins,
  memberCount = 0,
  disabled = false,
}: Props) {
  const grouped = useMemo(() => NAV_GROUP_ORDER, []);
  const lockedSet = useMemo(() => new Set(lockedPermissionsForRole(orgRole)), [orgRole]);

  const updateRow = (moduleId: ModuleId, patch: Partial<ModuleAccessRow>) => {
    onRowsChange(
      rows.map((r) =>
        r.module === moduleId ? normalizeDesiredRow({ ...r, ...patch, module: moduleId }) : r,
      ),
    );
  };

  const confirmSensitive = async (moduleId: ModuleId, val: boolean) => {
    if (mode !== 'role' || !val || !MODULE_CATALOG[moduleId].sensitive) return true;
    const message =
      memberCount > 0
        ? `Esto da acceso a ${memberCount} usuario(s) con este rol.`
        : 'Este módulo contiene datos sensibles.';
    const ok = await swalConfirm('Confirmar acceso', message);
    return ok.isConfirmed;
  };

  return (
    <div className="space-y-4">
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
                const moduleOrigin = moduleOrigins?.[moduleId];
                return (
                  <TableRow key={moduleId}>
                    <TableCell className="font-medium">
                      {def.label}
                      {def.sensitive ? (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Datos sensibles
                        </Badge>
                      ) : null}
                      {mode === 'role' && moduleOrigin === 'modified' ? (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Modificado
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
                      const locked = mode === 'role' && isLockedRoleCell(orgRole, moduleId, action);
                      let origin: 'inherited' | 'allow' | 'deny' | 'official' | 'modified' = 'inherited';
                      if (mode === 'role') {
                        origin = moduleOrigin ?? 'official';
                      } else {
                        const roleDefault =
                          roleDefaultRows?.[moduleId]?.[key]
                          ?? cellState(orgRole, moduleId, action, []).roleDefault;
                        origin = row[key] === roleDefault ? 'inherited' : row[key] ? 'allow' : 'deny';
                      }
                      return (
                        <TableCell key={action} className="text-center">
                          <div
                            className={cn('inline-flex rounded-md p-1', originClass(origin))}
                            title={
                              locked
                                ? 'Permiso obligatorio para este rol'
                                : originLabel(mode, origin)
                            }
                          >
                            <Switch
                              disabled={disabled || !enabled || locked}
                              checked={row[key]}
                              onCheckedChange={(val: boolean) => {
                                void (async () => {
                                  if (!(await confirmSensitive(moduleId, val))) return;
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
                                })();
                              }}
                            />
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {def.specials.map((sp) => {
                          const locked = mode === 'role' && lockedSet.has(sp.id);
                          let origin: 'inherited' | 'allow' | 'deny' | 'official' | 'modified' =
                            'inherited';
                          const checked = row.extras.includes(sp.id);
                          if (mode === 'role') {
                            origin = moduleOrigin ?? 'official';
                          } else {
                            const roleDefault =
                              roleDefaultRows?.[moduleId]?.extras.includes(sp.id)
                              ?? specialCellState(orgRole, moduleId, sp.id, []).roleDefault;
                            origin =
                              checked === roleDefault ? 'inherited' : checked ? 'allow' : 'deny';
                          }
                          return (
                            <label
                              key={sp.id}
                              className={cn(
                                'flex items-center gap-2 text-xs rounded-md p-1',
                                originClass(origin),
                              )}
                              title={
                                locked
                                  ? 'Permiso obligatorio para este rol'
                                  : originLabel(mode, origin)
                              }
                            >
                              <Switch
                                disabled={disabled || !row.canRead || locked}
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
