'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';
import { useDepartments } from '@/hooks/useDepartments';
import { CATEGORY_LABELS } from '@/modules/equipment/domain/equipment-asset-code';

type FilterState = {
  search: string;
  departmentId: string;
  equipmentCategory: string;
  assignedFrom: string;
  assignedTo: string;
};

type Props = {
  value: FilterState;
  onChange: (patch: Partial<FilterState>, resetPage?: boolean) => void;
  onClear: () => void;
};

export function AssignmentsFiltersBar({ value, onChange, onClear }: Props) {
  const [searchInput, setSearchInput] = useState(value.search);
  const debouncedSearch = useDebounce(searchInput, 300);
  const { departments } = useDepartments();

  useEffect(() => {
    setSearchInput(value.search);
  }, [value.search]);

  useEffect(() => {
    if (debouncedSearch !== value.search) {
      onChange({ search: debouncedSearch }, true);
    }
  }, [debouncedSearch, onChange, value.search]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 lg:flex-row lg:flex-wrap lg:items-end">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Empleado, inventario, serie, marca o modelo"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label="Buscar asignaciones"
        />
      </div>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Departamento</span>
        <select
          className="h-10 rounded-md border bg-background px-3"
          value={value.departmentId}
          onChange={(event) => onChange({ departmentId: event.target.value }, true)}
        >
          <option value="">Todos</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Tipo de equipo</span>
        <select
          className="h-10 rounded-md border bg-background px-3"
          value={value.equipmentCategory}
          onChange={(event) => onChange({ equipmentCategory: event.target.value }, true)}
        >
          <option value="">Todos</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Entrega desde</span>
        <Input
          type="date"
          value={value.assignedFrom}
          onChange={(event) => onChange({ assignedFrom: event.target.value }, true)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Entrega hasta</span>
        <Input
          type="date"
          value={value.assignedTo}
          onChange={(event) => onChange({ assignedTo: event.target.value }, true)}
        />
      </label>
      <Button type="button" variant="outline" onClick={onClear}>
        Limpiar filtros
      </Button>
    </div>
  );
}
