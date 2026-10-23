'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/utils/api';
import { STATUS_LABEL } from '@/components/software-licenses/labels';

type Assignment = {
  id: string;
  unassignedAt: string | null;
  employee: { id: string; fullName: string; isActive: boolean };
};

export type LicenseSeatRow = {
  id: string;
  accountEmail: string | null;
  seatType: 'INDIVIDUAL' | 'SHARED' | 'DEVICE';
  effectiveStatus: string;
  status: string;
  licenseKey?: string | null;
  licenseKeyPresent?: boolean;
  equipment?: { inventoryCode: string; brand: string; model: string } | null;
  assignments: Assignment[];
};

type Props = {
  seats: LicenseSeatRow[];
  canUpdate: boolean;
  onChange: () => Promise<void>;
};

export function LicenseSeatsTable({ seats, canUpdate, onChange }: Props) {
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [employees, setEmployees] = useState<Array<{ id: string; fullName: string }>>([]);
  const [reveal, setReveal] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      await onChange();
    } catch (reason) {
      const message = (reason as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        ?.message;
      setError(message ?? 'La operación no se completó.');
    }
  }

  async function loadEmployees() {
    if (employeeQuery.trim().length < 2) return;
    const response = await api.get('/api/employees', {
      params: { search: employeeQuery.trim(), isActive: true, pageSize: 8 },
    });
    setEmployees(response.data.employees ?? response.data.data ?? []);
  }

  async function revealKey(seatId: string) {
    const response = await api.post(`/api/software-licenses/seats/${seatId}/reveal-key`);
    setReveal((prev) => ({ ...prev, [seatId]: response.data.data.licenseKey as string }));
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Cuenta / Clave</TableHead>
              <TableHead>Equipo</TableHead>
              <TableHead>Usuarios</TableHead>
              <TableHead>Estado</TableHead>
              {canUpdate ? <TableHead className="text-right">Acciones</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {seats.map((seat) => {
              const active = seat.assignments.filter((a) => !a.unassignedAt);
              const accountOrKey =
                seat.seatType === 'DEVICE'
                  ? reveal[seat.id] ?? seat.licenseKey ?? (seat.licenseKeyPresent ? '•••••' : '—')
                  : seat.accountEmail ?? '—';
              return (
                <TableRow key={seat.id}>
                  <TableCell>{STATUS_LABEL[seat.seatType] ?? seat.seatType}</TableCell>
                  <TableCell className="font-mono text-xs">{accountOrKey}</TableCell>
                  <TableCell>
                    {seat.equipment
                      ? `${seat.equipment.inventoryCode} · ${seat.equipment.brand} ${seat.equipment.model}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {active.length > 0
                      ? active.map((a) => a.employee.fullName).join(', ')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{STATUS_LABEL[seat.effectiveStatus] ?? seat.effectiveStatus}</Badge>
                  </TableCell>
                  {canUpdate ? (
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {seat.licenseKeyPresent ? (
                          <Button size="sm" variant="ghost" type="button" onClick={() => void revealKey(seat.id)}>
                            Mostrar clave
                          </Button>
                        ) : null}
                        {active.map((assignment) => (
                          <Button
                            key={assignment.id}
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={() =>
                              run(() =>
                                api.post(`/api/software-licenses/assignments/${assignment.id}/unassign`),
                              )
                            }
                          >
                            Quitar
                          </Button>
                        ))}
                        {seat.effectiveStatus !== 'SUSPENDED' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() =>
                              run(() =>
                                api.patch(`/api/software-licenses/seats/${seat.id}`, { status: 'SUSPENDED' }),
                              )
                            }
                          >
                            Suspender
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() =>
                              run(() =>
                                api.patch(`/api/software-licenses/seats/${seat.id}`, { status: 'AVAILABLE' }),
                              )
                            }
                          >
                            Reactivar
                          </Button>
                        )}
                      </div>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Input
                          className="max-w-[200px]"
                          value={employeeQuery}
                          onChange={(event) => setEmployeeQuery(event.target.value)}
                          onBlur={() => void loadEmployees()}
                          placeholder="Asignar empleado"
                        />
                        {employees.map((employee) => {
                          const replaceId =
                            seat.seatType === 'INDIVIDUAL' && active.length === 1 ? active[0]!.id : undefined;
                          return (
                            <Button
                              key={`${seat.id}-${employee.id}`}
                              size="sm"
                              variant="secondary"
                              type="button"
                              onClick={() =>
                                run(() =>
                                  api.post(`/api/software-licenses/seats/${seat.id}/assignments`, {
                                    employeeId: employee.id,
                                    replaceAssignmentId: replaceId,
                                  }),
                                )
                              }
                            >
                              {replaceId ? `Reasignar a ${employee.fullName}` : employee.fullName}
                            </Button>
                          );
                        })}
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
