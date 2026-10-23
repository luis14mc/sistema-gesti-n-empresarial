'use client';

import { useEffect, useState } from 'react';
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
import { ActiveEmployeeCombobox } from '@/components/equipment/assignments/ActiveEmployeeCombobox';
import { DELIVERY_REASONS } from '@/components/equipment/assignments/constants';
import { useAssignments } from '@/hooks/useAssignments';
import type { CreateAssignmentData, Equipment } from '@/types';
import { getAssigneeName, getInventoryCode } from '@/components/equipment/assignments/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateAssignmentData) => void;
  isSubmitting: boolean;
};

export function NewAssignmentDialog({ open, onOpenChange, onSubmit, isSubmitting }: Props) {
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [deliveryReason, setDeliveryReason] = useState('');
  const [condition, setCondition] = useState('');
  const [accessories, setAccessories] = useState('');
  const [notes, setNotes] = useState('');

  const { assignments: employeeAssignments } = useAssignments(
    employeeId ? { employeeId, tab: 'active', pageSize: 8 } : undefined,
    { enabled: Boolean(employeeId) },
  );

  useEffect(() => {
    if (equipment?.includedAccessories && !accessories) {
      setAccessories(equipment.includedAccessories);
    }
  }, [equipment, accessories]);

  useEffect(() => {
    if (!open) {
      setEquipment(null);
      setEmployeeId('');
      setDeliveryReason('');
      setCondition('');
      setAccessories('');
      setNotes('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva asignación</DialogTitle>
          <DialogDescription>Entregue un equipo disponible a un empleado activo.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!equipment) return;
            onSubmit({
              equipmentId: equipment.id,
              employeeId,
              deliveryReason: deliveryReason || undefined,
              condition: condition || undefined,
              accessories: accessories || undefined,
              assignmentNotes: notes || undefined,
            });
          }}
        >
          <AvailableEquipmentCombobox
            value={equipment}
            onChange={setEquipment}
            enabled={open}
          />
          {equipment ? <EquipmentSelectedSummary equipment={equipment} /> : null}
          <ActiveEmployeeCombobox value={employeeId} onChange={setEmployeeId} disabled={isSubmitting} />
          {employeeId && employeeAssignments.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50/80 p-2 text-xs dark:border-amber-900 dark:bg-amber-950/30">
              <p className="font-medium">Ya tiene: {employeeAssignments.length} equipo(s)</p>
              <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                {employeeAssignments.slice(0, 4).map((row) => (
                  <li key={row.id}>
                    {getInventoryCode(row)} · {getAssigneeName(row)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Motivo de entrega</Label>
            <Select value={deliveryReason} onValueChange={setDeliveryReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona motivo" />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Condición del equipo</Label>
            <Input value={condition} onChange={(event) => setCondition(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Accesorios entregados</Label>
            <Input value={accessories} onChange={(event) => setAccessories(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !equipment || !employeeId}>
              {isSubmitting ? 'Asignando…' : 'Crear asignación'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
