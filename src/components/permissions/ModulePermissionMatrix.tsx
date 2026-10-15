'use client';

import { useMemo, type ReactNode } from 'react';
import type { OrganizationRole } from '@prisma/client';
import { Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  return '';
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

function isLockedSpecial(role: OrganizationRole, specialId: Permission): boolean {
  return lockedPermissionsForRole(role).includes(specialId);
}

const LOCK_TOOLTIP = 'Requerido para administrar el sistema';

function NotApplicableCell() {
  return (
    <span className="text-sm text-muted-foreground" aria-hidden="true">
      —
    </span>
  );
}

function LockedCheckbox() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center justify-center gap-1">
          <Checkbox checked disabled aria-label={LOCK_TOOLTIP} />
          <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{LOCK_TOOLTIP}</TooltipContent>
    </Tooltip>
  );
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
    <TooltipProvider>
      <CardScroll>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 top-0 z-20 min-w-[10rem] bg-background shadow-[1px_0_0_0_hsl(var(--border))]">
                Módulo
              </TableHead>
              <TableHead className="sticky top-0 z-10 w-16 bg-background text-center">Ver</TableHead>
              <TableHead className="sticky top-0 z-10 w-16 bg-background text-center">Crear</TableHead>
              <TableHead className="sticky top-0 z-10 w-16 bg-background text-center">Editar</TableHead>
              <TableHead className="sticky top-0 z-10 w-16 bg-background text-center">Eliminar</TableHead>
              <TableHead className="sticky top-0 z-10 min-w-[8rem] bg-background">Especiales</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.flatMap((group) => {
              const section: ReactNode[] = [
                <TableRow key={`group-${group.label}`} className="bg-muted/40 hover:bg-muted/40">
                  <TableCell
                    colSpan={6}
                    className="sticky left-0 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {group.label}
                  </TableCell>
                </TableRow>,
              ];
              for (const moduleId of group.modules) {
                  const row = rows.find((r) => r.module === moduleId)!;
                  const def = MODULE_CATALOG[moduleId];
                  const moduleOrigin = moduleOrigins?.[moduleId];
                section.push(
                    <TableRow key={moduleId}>
                      <TableCell className="sticky left-0 z-[5] min-w-[10rem] bg-background font-medium shadow-[1px_0_0_0_hsl(var(--border))]">
                        <span className="flex flex-wrap items-center gap-2">
                          {def.label}
                          {def.sensitive ? (
                            <Badge variant="outline" className="text-xs font-normal">
                              Datos sensibles
                            </Badge>
                          ) : null}
                          {mode === 'role' && moduleOrigin === 'modified' ? (
                            <Badge variant="secondary" className="text-xs font-normal">
                              Modificado
                            </Badge>
                          ) : null}
                        </span>
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
                        let origin: 'inherited' | 'allow' | 'deny' | 'official' | 'modified' =
                          'inherited';
                        if (mode === 'role') {
                          origin = moduleOrigin ?? 'official';
                        } else {
                          const roleDefault =
                            roleDefaultRows?.[moduleId]?.[key]
                            ?? cellState(orgRole, moduleId, action, []).roleDefault;
                          origin = row[key] === roleDefault ? 'inherited' : row[key] ? 'allow' : 'deny';
                        }
                        return (
                          <TableCell key={action} className="text-center align-middle">
                            {!enabled ? (
                              <NotApplicableCell />
                            ) : locked ? (
                              <LockedCheckbox />
                            ) : (
                              <div
                                className={cn(
                                  'inline-flex justify-center rounded-md p-1',
                                  originClass(origin),
                                )}
                                title={originLabel(mode, origin)}
                              >
                                <Checkbox
                                  disabled={disabled}
                                  checked={row[key]}
                                  aria-label={`${def.label} — ${action}`}
                                  onCheckedChange={(val) => {
                                    const checked = val === true;
                                    void (async () => {
                                      if (!(await confirmSensitive(moduleId, checked))) return;
                                      if (key === 'canRead' && !checked) {
                                        updateRow(moduleId, {
                                          canRead: false,
                                          canCreate: false,
                                          canUpdate: false,
                                          canDelete: false,
                                          extras: [],
                                        });
                                        return;
                                      }
                                      updateRow(moduleId, { [key]: checked });
                                    })();
                                  }}
                                />
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="align-top">
                        {def.specials.length === 0 ? (
                          <NotApplicableCell />
                        ) : (
                          <div className="flex flex-col items-start gap-3">
                            {def.specials.map((sp) => {
                              const lockedSpecial =
                                mode === 'role' &&
                                (lockedSet.has(sp.id) || isLockedSpecial(orgRole, sp.id));
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
                                <div
                                  key={sp.id}
                                  className={cn(
                                    'flex flex-col items-start gap-1 rounded-md p-1',
                                    originClass(origin),
                                  )}
                                  title={
                                    lockedSpecial ? LOCK_TOOLTIP : originLabel(mode, origin)
                                  }
                                >
                                  {lockedSpecial ? (
                                    <LockedCheckbox />
                                  ) : (
                                    <Checkbox
                                      disabled={disabled || !row.canRead}
                                      checked={checked}
                                      aria-label={sp.label}
                                      onCheckedChange={(val) => {
                                        const on = val === true;
                                        const set = new Set(row.extras);
                                        if (on) set.add(sp.id);
                                        else set.delete(sp.id);
                                        updateRow(moduleId, { extras: [...set] });
                                      }}
                                    />
                                  )}
                                  <span className="max-w-[12rem] text-left text-xs text-muted-foreground">
                                    {sp.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>,
                );
              }
              return section;
            })}
          </TableBody>
        </Table>
      </CardScroll>
    </TooltipProvider>
  );
}

function CardScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1">
      <div className="min-w-[640px]">{children}</div>
    </div>
  );
}
