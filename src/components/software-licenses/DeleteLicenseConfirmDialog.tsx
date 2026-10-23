'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  hasHistory: boolean;
  entityLabel: string;
  onConfirm: () => Promise<void>;
  pending?: boolean;
};

export function DeleteLicenseConfirmDialog({
  open,
  onOpenChange,
  title,
  hasHistory,
  entityLabel,
  onConfirm,
  pending = false,
}: Props) {
  const consequence = hasHistory
    ? 'Tiene historial: se dará de baja y se conservará el historial.'
    : 'Se eliminará definitivamente.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {entityLabel}. {consequence}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => void onConfirm()}
          >
            {pending ? 'Procesando…' : 'Eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
