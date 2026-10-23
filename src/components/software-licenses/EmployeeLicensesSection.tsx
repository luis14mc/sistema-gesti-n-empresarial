'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AssignLicenseDialog } from '@/components/software-licenses/AssignLicenseDialog';
import { moneyLabel, STATUS_LABEL } from '@/components/software-licenses/labels';
import type { Role } from '@/types';
import { canAccess } from '@/platform/security/session-module-access';

export type EmployeeLicenseRow = {
  assignmentId: string;
  subscriptionId: string;
  seatId: string;
  producto: string;
  plan: string;
  cuenta: string | null;
  tipo?: string;
  costoMensualUnitario?: number;
  asignadoDesde: string;
};

type Props = {
  role: Role;
  employee: { id: string; fullName: string };
  licencias: EmployeeLicenseRow[];
  currency?: string;
  onRefresh?: () => void;
};

function seatTypeLabel(tipo?: string) {
  if (tipo === 'SHARED') return STATUS_LABEL.SHARED;
  if (tipo === 'DEVICE') return STATUS_LABEL.DEVICE;
  if (tipo === 'INDIVIDUAL') return STATUS_LABEL.INDIVIDUAL;
  return tipo ?? '—';
}

export function EmployeeLicensesSection({
  role,
  employee,
  licencias,
  currency = 'USD',
  onRefresh,
}: Props) {
  const showLicenses = canAccess(role, 'software-licenses', 'read');
  const canAssign = canAccess(role, 'software-licenses', 'update');

  if (!showLicenses) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Licencias</CardTitle>
        {canAssign ? (
          <AssignLicenseDialog employeeId={employee.id} employeeName={employee.fullName} onAssigned={onRefresh} />
        ) : null}
      </CardHeader>
      <CardContent>
        {licencias.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin licencias activas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Costo/mes unit.</TableHead>
                <TableHead>Desde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licencias.map((item) => (
                <TableRow key={item.assignmentId}>
                  <TableCell>
                    <Link
                      href={`/activos/licencias/${item.subscriptionId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {item.producto}
                    </Link>
                    <p className="text-xs text-muted-foreground">{item.plan}</p>
                  </TableCell>
                  <TableCell>{item.cuenta ?? '—'}</TableCell>
                  <TableCell>{seatTypeLabel(item.tipo)}</TableCell>
                  <TableCell>
                    {typeof item.costoMensualUnitario === 'number'
                      ? moneyLabel(currency, item.costoMensualUnitario)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {format(new Date(item.asignadoDesde), 'dd/MM/yyyy', { locale: es })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
