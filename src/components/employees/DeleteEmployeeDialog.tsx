'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  onConfirm: () => Promise<void>;
  onDeactivateInstead?: () => void;
  historyMessage?: string | null;
  pending?: boolean;
};

export function DeleteEmployeeDialog({
  open,
  onOpenChange,
  employeeName,
  onConfirm,
  onDeactivateInstead,
  historyMessage,
  pending = false,
}: Props) {
  const [confirmName, setConfirmName] = useState('');

  const matches = confirmName.trim() === employeeName.trim();
  const blockedByHistory = Boolean(historyMessage);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmName('');
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar empleado</DialogTitle>
          <DialogDescription>
            {blockedByHistory
              ? historyMessage
              : 'Esta acción no se puede deshacer. Escriba el nombre completo del empleado para confirmar.'}
          </DialogDescription>
        </DialogHeader>
        {!blockedByHistory ? (
          <div className="space-y-2">
            <Label htmlFor="delete-employee-confirm">Nombre: {employeeName}</Label>
            <Input
              id="delete-employee-confirm"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
            />
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          {blockedByHistory && onDeactivateInstead ? (
            <Button type="button" variant="secondary" onClick={onDeactivateInstead}>
              Desactivar
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          {!blockedByHistory ? (
            <Button
              type="button"
              variant="destructive"
              disabled={!matches || pending}
              onClick={() => void onConfirm()}
            >
              {pending ? 'Eliminando…' : 'Eliminar'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
