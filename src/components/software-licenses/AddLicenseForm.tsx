'use client';

import { useState } from 'react';
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
import { api } from '@/utils/api';
import { STATUS_LABEL } from '@/components/software-licenses/labels';

type SeatType = 'INDIVIDUAL' | 'SHARED' | 'DEVICE';

type Props = {
  subscriptionId: string;
  onCreated: () => Promise<void> | void;
};

export function AddLicenseForm({ subscriptionId, onCreated }: Props) {
  const [seatType, setSeatType] = useState<SeatType>('INDIVIDUAL');
  const [accountEmail, setAccountEmail] = useState('');
  const [equipmentQuery, setEquipmentQuery] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [equipmentLabel, setEquipmentLabel] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employeeLabel, setEmployeeLabel] = useState('');
  const [assignOnCreate, setAssignOnCreate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function searchEquipment() {
    if (equipmentQuery.trim().length < 2) return;
    const response = await api.get('/api/equipment', {
      params: { search: equipmentQuery.trim(), pageSize: 8 },
    });
    const items = response.data.items ?? response.data.data?.items ?? [];
    const match = items[0];
    if (match) {
      setEquipmentId(match.id);
      setEquipmentLabel(`${match.inventoryCode ?? match.code} · ${match.brand ?? ''} ${match.model ?? ''}`.trim());
    }
  }

  async function searchEmployee() {
    if (employeeQuery.trim().length < 2) return;
    const response = await api.get('/api/employees', {
      params: { search: employeeQuery.trim(), isActive: true, pageSize: 8 },
    });
    const items = response.data.employees ?? response.data.data ?? [];
    const match = items[0];
    if (match) {
      setEmployeeId(match.id);
      setEmployeeLabel(match.fullName);
    }
  }

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await api.post(`/api/software-licenses/${subscriptionId}/seats`, {
        seatType,
        accountEmail: seatType === 'DEVICE' ? null : accountEmail.trim() || null,
        equipmentId: seatType === 'DEVICE' ? equipmentId || null : null,
        licenseKey: seatType === 'DEVICE' ? licenseKey.trim() || null : null,
        employeeId:
          seatType === 'INDIVIDUAL' && assignOnCreate && employeeId ? employeeId : null,
      });
      setAccountEmail('');
      setLicenseKey('');
      setEmployeeId('');
      setEmployeeLabel('');
      await onCreated();
    } catch (reason) {
      const message = (reason as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        ?.message;
      setError(message ?? 'No se pudo registrar la licencia.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tipo de licencia</Label>
          <Select value={seatType} onValueChange={(value) => setSeatType(value as SeatType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INDIVIDUAL">{STATUS_LABEL.INDIVIDUAL}</SelectItem>
              <SelectItem value="SHARED">{STATUS_LABEL.SHARED}</SelectItem>
              <SelectItem value="DEVICE">{STATUS_LABEL.DEVICE}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {seatType !== 'DEVICE' ? (
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="license-email">Correo de la cuenta</Label>
            <Input
              id="license-email"
              type="email"
              value={accountEmail}
              onChange={(event) => setAccountEmail(event.target.value)}
              placeholder="usuario@empresa.com"
            />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="license-equipment">Equipo (código)</Label>
              <div className="flex gap-2">
                <Input
                  id="license-equipment"
                  value={equipmentQuery}
                  onChange={(event) => setEquipmentQuery(event.target.value)}
                  placeholder="INV-001"
                />
                <Button type="button" variant="secondary" onClick={() => void searchEquipment()}>
                  Buscar
                </Button>
              </div>
              {equipmentLabel ? <p className="text-xs text-muted-foreground">{equipmentLabel}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="license-key">Clave (opcional)</Label>
              <Input
                id="license-key"
                value={licenseKey}
                onChange={(event) => setLicenseKey(event.target.value)}
                placeholder="Solo se guarda en BD; se enmascara en listados"
                autoComplete="off"
              />
            </div>
          </>
        )}
      </div>
      {seatType === 'INDIVIDUAL' ? (
        <div className="rounded-lg border p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={assignOnCreate}
              onChange={(event) => setAssignOnCreate(event.target.checked)}
            />
            Crear y asignar en un paso
          </label>
          {assignOnCreate ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="license-employee">Empleado</Label>
                <Input
                  id="license-employee"
                  value={employeeQuery}
                  onChange={(event) => setEmployeeQuery(event.target.value)}
                  placeholder="Nombre del empleado activo"
                />
                {employeeLabel ? <p className="text-xs text-muted-foreground">{employeeLabel}</p> : null}
              </div>
              <Button type="button" variant="secondary" onClick={() => void searchEmployee()}>
                Buscar
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" disabled={busy} onClick={() => void submit()}>
        {busy ? 'Guardando…' : 'Registrar licencia'}
      </Button>
    </div>
  );
}
