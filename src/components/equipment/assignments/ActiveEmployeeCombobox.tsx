'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/useDebounce';
import { useEmployees } from '@/hooks/useEmployees';
import { cn } from '@/lib/utils';

export function ActiveEmployeeCombobox({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (employeeId: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const { employees } = useEmployees({ isActive: true, search: debounced || undefined, pageSize: 12 });
  const selected = employees.find((e) => e.id === value);

  return (
    <div className="space-y-2">
      <Label>Empleado</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            {selected ? selected.fullName : 'Buscar empleado activo…'}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Nombre o correo" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>Sin resultados</CommandEmpty>
              <CommandGroup>
                {employees.map((employee) => (
                  <CommandItem
                    key={employee.id}
                    value={employee.id}
                    onSelect={() => {
                      onChange(employee.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 size-4', value === employee.id ? 'opacity-100' : 'opacity-0')} />
                    {employee.fullName}
                    <span className="ml-2 text-xs text-muted-foreground">{employee.email}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
