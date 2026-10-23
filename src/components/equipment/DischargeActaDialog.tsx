'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiHelpers } from '@/utils/api';
import { sileo } from 'sileo';

type PrefillResponse = {
  employee: { id: string; fullName: string; dni: string; position: string };
  equipmentRows: Array<{ item: string; brandModel: string; serial: string; notes: string }>;
  accessorySuggestions: string[];
  licenseRows: Array<{ software: string; licenseNumber: string; notes: string }>;
};

type DischargeActaDialogProps = {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: () => void;
};

export function DischargeActaDialog({ employeeId, open, onOpenChange, onGenerated }: DischargeActaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [terminationDate, setTerminationDate] = useState('');
  const [dni, setDni] = useState('');
  const [position, setPosition] = useState('');
  const [closeAll, setCloseAll] = useState(true);
  const [equipmentRows, setEquipmentRows] = useState<PrefillResponse['equipmentRows']>([]);
  const [licenseRows, setLicenseRows] = useState<PrefillResponse['licenseRows']>([]);
  const [accessoryRows, setAccessoryRows] = useState<Array<{ item: string; quantity: string; state: string; notes: string }>>([]);
  const [accessRows, setAccessRows] = useState<Array<{ system: string; status: string; notes: string }>>([]);
  const [miscRows, setMiscRows] = useState<Array<{ item: string; state: string; notes: string }>>([]);

  useEffect(() => {
    if (!open || !employeeId) return;
    setLoading(true);
    void apiHelpers
      .get<PrefillResponse>(`/api/employees/${employeeId}/discharge-acta`)
      .then((res) => {
        setDni(res.data.employee.dni);
        setPosition(res.data.employee.position);
        setEquipmentRows(res.data.equipmentRows);
        setLicenseRows(res.data.licenseRows);
        setAccessoryRows(
          res.data.accessorySuggestions.slice(0, 5).map((item) => ({
            item,
            quantity: '1',
            state: 'Bueno',
            notes: '',
          })),
        );
      })
      .catch(() => sileo.error({ title: 'Error', description: 'No se pudo cargar datos del empleado' }))
      .finally(() => setLoading(false));
  }, [open, employeeId]);

  const handleSubmit = async () => {
    if (!employeeId || !terminationDate) {
      sileo.error({ title: 'Datos incompletos', description: 'Indica la fecha efectiva de terminación' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiHelpers.post<{
        url: string;
        warnings?: Array<{ assignmentId: string; mensaje: string }>;
      }>(`/api/employees/${employeeId}/discharge-acta`, {
        terminationDate,
        dni,
        position,
        closeAssignmentsAndLicenses: closeAll,
        equipmentRows,
        accessoryRows,
        licenseRows,
        accessRows,
        miscRows,
      });
      const warningCount = res.data.warnings?.length ?? 0;
      if (warningCount > 0) {
        sileo.warning({
          title: 'Acta de descargo generada con advertencias',
          description: res.data.warnings!.map((w) => w.mensaje).join(' '),
        });
      } else {
        sileo.success({ title: 'Acta generada', description: 'El PDF de descargo está listo' });
      }
      if (res.data.url) window.open(res.data.url, '_blank', 'noopener,noreferrer');
      onGenerated?.();
      onOpenChange(false);
    } catch {
      sileo.error({ title: 'Error', description: 'No se pudo generar el acta de descargo' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Acta de descargo por terminación laboral</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando inventario del empleado…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fecha efectiva de terminación</Label>
                <Input type="date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>N.º de identidad</Label>
                <Input value={dni} onChange={(e) => setDni(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Cargo desempeñado</Label>
                <Input value={position} onChange={(e) => setPosition(e.target.value)} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Equipo precargado: {equipmentRows.length} · Licencias: {licenseRows.length}. Puedes editar observaciones en el PDF
              generado desde las tablas del servidor en una iteración posterior; aquí se envían las filas precargadas.
            </p>
            <div className="flex items-center gap-2">
              <Checkbox id="close-all" checked={closeAll} onCheckedChange={(v) => setCloseAll(v === true)} />
              <Label htmlFor="close-all">
                Registrar devolución de todos los equipos y cerrar las licencias al generar el acta
              </Label>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting || loading || !employeeId}>
            {submitting ? 'Generando…' : 'Generar acta PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
