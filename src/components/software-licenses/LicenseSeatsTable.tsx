'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/utils/api';
import { STATUS_LABEL } from '@/components/software-licenses/labels';
import { DeleteLicenseConfirmDialog } from '@/components/software-licenses/DeleteLicenseConfirmDialog';
import { EditSeatEmailDialog } from '@/components/software-licenses/EditSeatEmailDialog';
import { SeatAssignEmployeeDialog } from '@/components/software-licenses/AssignLicenseDialog';
import { LicenseSeatRowActionsMenu } from '@/components/software-licenses/LicenseSeatRowActionsMenu';

type Assignment = {
  id: string;
  unassignedAt: string | null;
  employee: { id: string; fullName: string; isActive: boolean };
};

export type LicenseSeatRow = {
  id: string;
  accountEmail: string | null;
  seatType: 'INDIVIDUAL' | 'SHARED' | 'DEVICE';
  effectiveStatus: string;
  status: string;
  licenseKey?: string | null;
  licenseKeyPresent?: boolean;
  equipment?: { inventoryCode: string; brand: string; model: string } | null;
  assignments: Assignment[];
};

type Props = {
  seats: LicenseSeatRow[];
  canUpdate: boolean;
  canManage?: boolean;
  onChange: () => Promise<void>;
};

type AssignDialogState = {
  seatId: string;
  seatLabel: string;
  mode: 'assign' | 'reassign';
  replaceAssignmentId?: string;
};

function accountCellLabel(
  seat: LicenseSeatRow,
  revealedKey: string | undefined,
): { kind: 'text'; value: string } | { kind: 'missing-email' } | { kind: 'missing-key' } {
  if (seat.seatType === 'DEVICE') {
    if (revealedKey) return { kind: 'text', value: revealedKey };
    if (seat.licenseKey) return { kind: 'text', value: seat.licenseKey };
    if (seat.licenseKeyPresent) return { kind: 'text', value: '•••••' };
    return { kind: 'missing-key' };
  }
  if (seat.accountEmail?.trim()) return { kind: 'text', value: seat.accountEmail.trim() };
  return { kind: 'missing-email' };
}

export function LicenseSeatsTable({ seats, canUpdate, canManage = false, onChange }: Props) {
  const [reveal, setReveal] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [assignDialog, setAssignDialog] = useState<AssignDialogState | null>(null);
  const [editEmailSeat, setEditEmailSeat] = useState<LicenseSeatRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LicenseSeatRow | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const showEquipmentColumn = useMemo(() => seats.some((seat) => seat.seatType === 'DEVICE'), [seats]);
  const showActionsColumn = canUpdate || canManage;

  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      await onChange();
    } catch (reason) {
      const message = (reason as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        ?.message;
      setError(message ?? 'La operación no se completó.');
    }
  }

  async function revealKey(seatId: string) {
    const response = await api.post(`/api/software-licenses/seats/${seatId}/reveal-key`);
    setReveal((prev) => ({ ...prev, [seatId]: response.data.data.licenseKey as string }));
  }

  async function confirmDeleteSeat() {
    if (!deleteTarget) return;
    setDeletePending(true);
    try {
      await api.delete(`/api/software-licenses/seats/${deleteTarget.id}`);
      setDeleteTarget(null);
      await onChange();
    } catch (reason) {
      const message = (reason as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        ?.message;
      setError(message ?? 'No se pudo eliminar la licencia.');
    } finally {
      setDeletePending(false);
    }
  }

  function seatLabel(seat: LicenseSeatRow) {
    if (seat.seatType === 'DEVICE') {
      return seat.equipment
        ? `${seat.equipment.inventoryCode} · ${seat.equipment.brand} ${seat.equipment.model}`
        : 'Licencia de equipo';
    }
    return seat.accountEmail ?? STATUS_LABEL[seat.seatType] ?? seat.seatType;
  }

  return (
    <div className="space-y-3" data-testid="license-seats-table">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Correo / Cuenta</TableHead>
              <TableHead>Usada por</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              {showEquipmentColumn ? <TableHead>Equipo</TableHead> : null}
              {showActionsColumn ? <TableHead className="w-12 text-right"> </TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {seats.map((seat) => {
              const active = seat.assignments.filter((a) => !a.unassignedAt);
              const account = accountCellLabel(seat, reveal[seat.id]);
              const usedBy =
                seat.seatType === 'DEVICE'
                  ? '—'
                  : active.length > 0
                    ? active.map((a) => a.employee.fullName).join(', ')
                    : '—';

              return (
                <TableRow key={seat.id} className="h-12">
                  <TableCell className="max-w-[240px] truncate align-middle">
                    {account.kind === 'text' ? (
                      <span className="font-mono text-xs">{account.value}</span>
                    ) : account.kind === 'missing-email' ? (
                      canUpdate ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setEditEmailSeat(seat)}
                        >
                          Sin correo — completar
                        </Button>
                      ) : (
                        <Badge variant="outline">Sin correo — completar</Badge>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin clave</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate align-middle text-sm">{usedBy}</TableCell>
                  <TableCell className="whitespace-nowrap align-middle text-sm">
                    {STATUS_LABEL[seat.seatType] ?? seat.seatType}
                  </TableCell>
                  <TableCell className="whitespace-nowrap align-middle">
                    <Badge variant="outline">{STATUS_LABEL[seat.effectiveStatus] ?? seat.effectiveStatus}</Badge>
                  </TableCell>
                  {showEquipmentColumn ? (
                    <TableCell className="max-w-[200px] truncate align-middle text-sm text-muted-foreground">
                      {seat.seatType === 'DEVICE' && seat.equipment
                        ? `${seat.equipment.inventoryCode} · ${seat.equipment.brand} ${seat.equipment.model}`
                        : '—'}
                    </TableCell>
                  ) : null}
                  {showActionsColumn ? (
                    <TableCell className="text-right align-middle">
                      <LicenseSeatRowActionsMenu
                        seat={seat}
                        active={active}
                        canUpdate={canUpdate}
                        canManage={canManage}
                        onAssign={() =>
                          setAssignDialog({
                            seatId: seat.id,
                            seatLabel: seatLabel(seat),
                            mode: 'assign',
                          })
                        }
                        onReassign={(assignmentId) =>
                          setAssignDialog({
                            seatId: seat.id,
                            seatLabel: seatLabel(seat),
                            mode: 'reassign',
                            replaceAssignmentId: assignmentId,
                          })
                        }
                        onUnassign={(assignmentId) =>
                          run(() => api.post(`/api/software-licenses/assignments/${assignmentId}/unassign`))
                        }
                        onEditEmail={() => setEditEmailSeat(seat)}
                        onRevealKey={() => void revealKey(seat.id)}
                        onSuspendToggle={() =>
                          run(() =>
                            api.patch(`/api/software-licenses/seats/${seat.id}`, {
                              status: seat.effectiveStatus === 'SUSPENDED' ? 'AVAILABLE' : 'SUSPENDED',
                            }),
                          )
                        }
                        onDelete={() => setDeleteTarget(seat)}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {assignDialog ? (
        <SeatAssignEmployeeDialog
          open
          onOpenChange={(open) => {
            if (!open) setAssignDialog(null);
          }}
          seatId={assignDialog.seatId}
          seatLabel={assignDialog.seatLabel}
          mode={assignDialog.mode}
          replaceAssignmentId={assignDialog.replaceAssignmentId}
          onAssigned={() => void onChange()}
        />
      ) : null}

      <EditSeatEmailDialog
        open={editEmailSeat !== null}
        onOpenChange={(open) => {
          if (!open) setEditEmailSeat(null);
        }}
        seatId={editEmailSeat?.id ?? null}
        initialEmail={editEmailSeat?.accountEmail ?? null}
        onSaved={onChange}
      />

      <DeleteLicenseConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Eliminar licencia"
        entityLabel={deleteTarget ? seatLabel(deleteTarget) : ''}
        hasHistory={Boolean(deleteTarget && deleteTarget.assignments.length > 0)}
        pending={deletePending}
        onConfirm={confirmDeleteSeat}
      />
    </div>
  );
}
