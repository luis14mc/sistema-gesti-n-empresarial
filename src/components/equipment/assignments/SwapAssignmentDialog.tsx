'use client';

import { useState } from 'react';
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
import { AvailableEquipmentCombobox } from '@/components/equipment/AvailableEquipmentCombobox';
import { EquipmentSelectedSummary } from '@/components/equipment/EquipmentSelectedSummary';
import { RETURN_CONDITIONS } from '@/components/equipment/assignments/constants';
import type { Equipment, EquipmentAssignment, SwapEquipmentData } from '@/types';
import { getAssigneeName } from '@/components/equipment/assignments/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeAssignments: EquipmentAssignment[];
  initialAssignmentId?: string;
  onSubmit: (data: SwapEquipmentData) => Promise<void>;
  isSubmitting: boolean;
};

export function SwapAssignmentDialog({
  open,
  onOpenChange,
  activeAssignments,
  initialAssignmentId,
  onSubmit,
  isSubmitting,
}: Props) {
  const [oldAssignmentId, setOldAssignmentId] = useState(initialAssignmentId ?? '');
  const [newEquipment, setNewEquipment] = useState<Equipment | null>(null);
  const [returnCondition, setReturnCondition] = useState('BUENO');
  const [assignmentNotes, setAssignmentNotes] = useState('');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setOldAssignmentId('');
          setNewEquipment(null);
        } else if (initialAssignmentId) {
          setOldAssignmentId(initialAssignmentId);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cambio de equipo</DialogTitle>
          <DialogDescription>Devuelve el equipo anterior y asigna uno disponible al mismo empleado.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!newEquipment || !oldAssignmentId) return;
            await onSubmit({
              oldAssignmentId,
              newEquipmentId: newEquipment.id,
              returnReason: 'Cambio de equipo',
              returnCondition,
              assignmentNotes,
              deliveryReason: 'Cambio de equipo',
            });
          }}
        >
          <div className="space-y-2">
            <Label>Asignación activa</Label>
            <Select value={oldAssignmentId} onValueChange={setOldAssignmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {activeAssignments.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.equipment?.inventoryCode ?? row.equipment?.code} — {getAssigneeName(row)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AvailableEquipmentCombobox
            label="Equipo nuevo"
            value={newEquipment}
            onChange={setNewEquipment}
            enabled={open}
          />
          {newEquipment ? <EquipmentSelectedSummary equipment={newEquipment} /> : null}
          <div className="space-y-2">
            <Label>Estado del equipo anterior</Label>
            <Select value={returnCondition} onValueChange={setReturnCondition}>
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
            <Label>Observaciones</Label>
            <Input value={assignmentNotes} onChange={(event) => setAssignmentNotes(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !oldAssignmentId || !newEquipment}>
              {isSubmitting ? 'Procesando…' : 'Confirmar cambio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
