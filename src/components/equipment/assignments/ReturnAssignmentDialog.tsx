'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RETURN_CONDITIONS,
  RETURN_REASON_SELECT_VALUES,
} from '@/components/equipment/assignments/constants';
import type { EquipmentAssignment, ReturnAssignmentData } from '@/types';
import { getAssigneeName, getEquipmentBrandModel, getInventoryCode } from '@/components/equipment/assignments/utils';

type ReturnForm = {
  returnCondition: string;
  returnReason: string;
  returnReasonOther: string;
  notes: string;
  accessoriesReturned: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: EquipmentAssignment | null;
  form: ReturnForm;
  onFormChange: (patch: Partial<ReturnForm>) => void;
  onSubmit: (data: ReturnAssignmentData) => void;
  isSubmitting: boolean;
};

export function ReturnAssignmentDialog({
  open,
  onOpenChange,
  assignment,
  form,
  onFormChange,
  onSubmit,
  isSubmitting,
}: Props) {
  const conditionMeta = RETURN_CONDITIONS.find((c) => c.value === form.returnCondition);
  const resolvedReason =
    form.returnReason === 'Otro' ? form.returnReasonOther.trim() || 'Otro' : form.returnReason;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar devolución</DialogTitle>
          {assignment ? (
            <DialogDescription asChild>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">{getEquipmentBrandModel(assignment)}</strong> ·{' '}
                  <span className="font-mono">{getInventoryCode(assignment)}</span>
                </p>
                <p>Empleado: {getAssigneeName(assignment)}</p>
              </div>
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              returnCondition: form.returnCondition,
              returnReason: resolvedReason || undefined,
              returnNotes: form.notes || undefined,
              accessoriesReturned: form.accessoriesReturned || undefined,
              equipmentStatusAfter: conditionMeta?.statusAfter,
            });
          }}
        >
          <div className="space-y-2">
            <Label>Motivo de devolución</Label>
            <Select value={form.returnReason} onValueChange={(v) => onFormChange({ returnReason: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona motivo" />
              </SelectTrigger>
              <SelectContent>
                {RETURN_REASON_SELECT_VALUES.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.returnReason === 'Otro' ? (
              <Input
                placeholder="Describe el motivo"
                value={form.returnReasonOther}
                onChange={(event) => onFormChange({ returnReasonOther: event.target.value })}
              />
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Estado al recibir</Label>
            <Select value={form.returnCondition} onValueChange={(v) => onFormChange({ returnCondition: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETURN_CONDITIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Accesorios devueltos</Label>
            <Input
              value={form.accessoriesReturned}
              onChange={(event) => onFormChange({ accessoriesReturned: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Input value={form.notes} onChange={(event) => onFormChange({ notes: event.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Procesando…' : 'Confirmar devolución'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
