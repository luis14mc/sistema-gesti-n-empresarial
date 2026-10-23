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
  equipos: string[];
  licencias: string[];
  onGenerateDischarge: () => void;
  onClose: () => void;
};

export function DeactivateEmployeeDialog({
  open,
  onOpenChange,
  equipos,
  licencias,
  onGenerateDischarge,
  onClose,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>No se puede desactivar</DialogTitle>
          <DialogDescription>
            Devuelva sus equipos y libere sus licencias antes de desactivarlo.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {equipos.map((item) => (
            <li key={`eq-${item}`}>Equipo: {item}</li>
          ))}
          {licencias.map((item) => (
            <li key={`lic-${item}`}>Licencia: {item}</li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="button" onClick={onGenerateDischarge}>
            Generar acta de descargo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
