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
import type { Employee } from '@/types';

type Props = {
  employee: Employee;
  canUpdate: boolean;
  canDelete: boolean;
  canDischargeActa: boolean;
  onView: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDischargeActa: () => void;
  onDelete: () => void;
};

export function EmployeeRowActionsMenu({
  employee,
  canUpdate,
  canDelete,
  canDischargeActa,
  onView,
  onEdit,
  onToggleActive,
  onDischargeActa,
  onDelete,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Acciones"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={onView}>Ver ficha</DropdownMenuItem>
        {canUpdate ? <DropdownMenuItem onSelect={onEdit}>Editar</DropdownMenuItem> : null}
        {canUpdate ? (
          <DropdownMenuItem onSelect={onToggleActive}>
            {employee.isActive ? 'Desactivar' : 'Reactivar'}
          </DropdownMenuItem>
        ) : null}
        {canDischargeActa ? (
          <DropdownMenuItem onSelect={onDischargeActa}>Acta de descargo</DropdownMenuItem>
        ) : null}
        {canDelete ? (
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
