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
import type { EquipmentAssignment } from '@/types';
import { actaDownloadUrl } from '@/components/equipment/assignments/utils';

type Props = {
  assignment: EquipmentAssignment;
  canCreate: boolean;
  canUpdate: boolean;
  onViewDetail: () => void;
  onReturn: () => void;
  onSwap: () => void;
  onRegenerateActa: (type: 'delivery' | 'return') => void;
  regenerating?: boolean;
};

export function AssignmentRowActionsMenu({
  assignment,
  canCreate,
  canUpdate,
  onViewDetail,
  onReturn,
  onSwap,
  onRegenerateActa,
  regenerating,
}: Props) {
  const isActive = assignment.status === 'ACTIVE';
  const hasReturnActa = Boolean(assignment.returnDocumentUrl || assignment.status === 'RETURNED');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Acciones"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuItem onSelect={onViewDetail}>Ver detalle</DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={actaDownloadUrl(assignment.id, 'delivery')} target="_blank" rel="noreferrer">
            Descargar acta de entrega
          </a>
        </DropdownMenuItem>
        {hasReturnActa ? (
          <DropdownMenuItem asChild>
            <a href={actaDownloadUrl(assignment.id, 'return')} target="_blank" rel="noreferrer">
              Descargar acta de devolución
            </a>
          </DropdownMenuItem>
        ) : null}
        {canUpdate ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={regenerating} onSelect={() => onRegenerateActa('delivery')}>
              Regenerar acta de entrega
            </DropdownMenuItem>
            {hasReturnActa ? (
              <DropdownMenuItem disabled={regenerating} onSelect={() => onRegenerateActa('return')}>
                Regenerar acta de devolución
              </DropdownMenuItem>
            ) : null}
          </>
        ) : null}
        {isActive && canCreate ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onReturn}>Registrar devolución</DropdownMenuItem>
            <DropdownMenuItem onSelect={onSwap}>Cambio de equipo</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
