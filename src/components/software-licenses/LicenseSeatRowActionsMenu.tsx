'use client';

import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { LicenseSeatRow } from '@/components/software-licenses/LicenseSeatsTable';

type ActiveAssignment = LicenseSeatRow['assignments'][number];

type Props = {
  seat: LicenseSeatRow;
  active: ActiveAssignment[];
  canUpdate: boolean;
  canManage: boolean;
  onAssign: () => void;
  onReassign: (assignmentId: string) => void;
  onUnassign: (assignmentId: string) => void;
  onEditEmail: () => void;
  onRevealKey: () => void;
  onSuspendToggle: () => void;
  onDelete: () => void;
};

export function LicenseSeatRowActionsMenu({
  seat,
  active,
  canUpdate,
  canManage,
  onAssign,
  onReassign,
  onUnassign,
  onEditEmail,
  onRevealKey,
  onSuspendToggle,
  onDelete,
}: Props) {
  if (!canUpdate && !canManage) return null;

  const isIndividual = seat.seatType === 'INDIVIDUAL';
  const isShared = seat.seatType === 'SHARED';
  const canAssignEmployee = canUpdate && (isIndividual || isShared) && seat.status !== 'CANCELLED';
  const showAssign =
    canAssignEmployee && (isShared || (isIndividual && active.length === 0));
  const showReassign = canAssignEmployee && isIndividual && active.length === 1;
  const suspended = seat.effectiveStatus === 'SUSPENDED' || seat.status === 'SUSPENDED';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Acciones">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {showAssign ? <DropdownMenuItem onSelect={onAssign}>Asignar</DropdownMenuItem> : null}
        {showReassign ? (
          <DropdownMenuItem onSelect={() => onReassign(active[0]!.id)}>Reasignar</DropdownMenuItem>
        ) : null}
        {canUpdate && isShared && active.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            {active.map((assignment) => (
              <DropdownMenuItem key={assignment.id} onSelect={() => onUnassign(assignment.id)}>
                Quitar a {assignment.employee.fullName}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
        {canUpdate && isIndividual && active.length === 1 ? (
          <DropdownMenuItem onSelect={() => onUnassign(active[0]!.id)}>Quitar usuario</DropdownMenuItem>
        ) : null}
        {canUpdate && seat.seatType !== 'DEVICE' ? (
          <DropdownMenuItem onSelect={onEditEmail}>Editar correo</DropdownMenuItem>
        ) : null}
        {canUpdate && seat.licenseKeyPresent ? (
          <DropdownMenuItem onSelect={onRevealKey}>Mostrar clave</DropdownMenuItem>
        ) : null}
        {canUpdate && seat.status !== 'CANCELLED' ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSuspendToggle}>
              {suspended ? 'Reactivar' : 'Suspender'}
            </DropdownMenuItem>
          </>
        ) : null}
        {canManage && seat.status !== 'CANCELLED' && active.length === 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
              Eliminar
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
