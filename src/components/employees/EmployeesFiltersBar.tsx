'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DepartmentWithPositions } from '@/hooks/useDepartments';
import type { EmployeesUrlState } from '@/components/employees/employees-search-params';

type Props = {
  state: EmployeesUrlState;
  departments: DepartmentWithPositions[];
  onPatch: (patch: Record<string, string | null | undefined>, resetPage?: boolean) => void;
};

export function EmployeesFiltersBar({ state, departments, onPatch }: Props) {
  const positions = state.departmentId
    ? (departments.find((d) => d.id === state.departmentId)?.positions ?? [])
    : departments.flatMap((d) => d.positions ?? []);

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, correo, código o DNI…"
          className="pl-9"
          value={state.search}
          onChange={(e) => onPatch({ search: e.target.value }, true)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Select
          value={state.departmentId || 'all'}
          onValueChange={(value) =>
            onPatch({ departmentId: value === 'all' ? null : value, positionId: null }, true)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los departamentos</SelectItem>
            {departments.map((department) => (
              <SelectItem key={department.id} value={department.id}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={state.positionId || 'all'}
          onValueChange={(value) => onPatch({ positionId: value === 'all' ? null : value }, true)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Puesto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los puestos</SelectItem>
            {positions.map((position) => (
              <SelectItem key={position.id} value={position.id}>
                {position.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={state.status}
          onValueChange={(value) => onPatch({ status: value }, true)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
