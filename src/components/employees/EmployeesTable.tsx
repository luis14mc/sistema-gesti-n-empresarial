'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Employee, EmployeeListSortBy } from '@/types';
import { EmployeeRowActionsMenu } from '@/components/employees/EmployeeRowActionsMenu';

type Props = {
  employees: Employee[];
  sortBy: EmployeeListSortBy;
  sortDir: 'asc' | 'desc';
  onSort: (column: EmployeeListSortBy) => void;
  onRowClick: (employee: Employee) => void;
  canUpdate: boolean;
  canDelete: boolean;
  canDischargeActa: boolean;
  onEdit: (employee: Employee) => void;
  onToggleActive: (employee: Employee) => void;
  onDischargeActa: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
};

function SortButton({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  column: EmployeeListSortBy;
  sortBy: EmployeeListSortBy;
  sortDir: 'asc' | 'desc';
  onSort: (column: EmployeeListSortBy) => void;
}) {
  const active = sortBy === column;
  return (
    <Button type="button" variant="ghost" size="sm" className="-ml-3 h-8 font-medium" onClick={() => onSort(column)}>
      {label}
      {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : null}
    </Button>
  );
}

function formatHireDate(value: string | null) {
  if (!value) return '—';
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('es-HN');
}

export function EmployeesTable({
  employees,
  sortBy,
  sortDir,
  onSort,
  onRowClick,
  canUpdate,
  canDelete,
  canDischargeActa,
  onEdit,
  onToggleActive,
  onDischargeActa,
  onDelete,
}: Props) {
  const showActions = canUpdate || canDelete || canDischargeActa;

  return (
    <div className="overflow-x-auto rounded-lg border" data-testid="employees-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortButton label="Código" column="code" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortButton label="Empleado" column="name" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            </TableHead>
            <TableHead>Departamento · Puesto</TableHead>
            <TableHead>
              <SortButton label="Fecha de ingreso" column="hireDate" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            </TableHead>
            <TableHead>Estado</TableHead>
            {showActions ? <TableHead className="w-12 text-right" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow
              key={employee.id}
              className="h-14 cursor-pointer"
              onClick={() => onRowClick(employee)}
            >
              <TableCell className="align-middle font-mono text-sm">{employee.employeeCode ?? '—'}</TableCell>
              <TableCell className="align-middle">
                <div className="font-medium">{employee.fullName}</div>
                <div className="text-xs text-muted-foreground">{employee.email}</div>
              </TableCell>
              <TableCell className="max-w-[220px] truncate align-middle text-sm text-muted-foreground">
                {[employee.department?.name, employee.position?.name].filter(Boolean).join(' · ') || '—'}
              </TableCell>
              <TableCell className="whitespace-nowrap align-middle text-sm text-muted-foreground">
                {formatHireDate(employee.hireDate)}
              </TableCell>
              <TableCell className="align-middle">
                <Badge variant={employee.isActive ? 'default' : 'secondary'}>
                  {employee.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
              {showActions ? (
                <TableCell className="text-right align-middle">
                  <EmployeeRowActionsMenu
                    employee={employee}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                    canDischargeActa={canDischargeActa}
                    onView={() => onRowClick(employee)}
                    onEdit={() => onEdit(employee)}
                    onToggleActive={() => onToggleActive(employee)}
                    onDischargeActa={() => onDischargeActa(employee)}
                    onDelete={() => onDelete(employee)}
                  />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
