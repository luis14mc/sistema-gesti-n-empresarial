'use client';

import { useEffect, useState } from 'react';
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
import { useEquipment } from '@/hooks/useEquipment';
import { cn } from '@/lib/utils';
import type { Equipment } from '@/types';

function equipmentLabel(eq: Equipment): string {
  const parts = [eq.inventoryCode || eq.code, eq.brand, eq.model].filter(Boolean);
  if (eq.serialNumber) parts.push(`S/N ${eq.serialNumber}`);
  return parts.join(' · ');
}

export function AvailableEquipmentCombobox({
  id,
  label = 'Equipo',
  value,
  onChange,
  disabled,
  enabled = true,
}: {
  id?: string;
  label?: string;
  value: Equipment | null;
  onChange: (equipment: Equipment | null) => void;
  disabled?: boolean;
  enabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedSearch = useDebounce(query, 300);

  const { equipment, isLoading, isError } = useEquipment(
    {
      status: 'AVAILABLE',
      search: debouncedSearch.trim() || undefined,
      pageSize: 50,
      page: 1,
    },
    { enabled, notifyOnError: true },
  );

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const emptyMessage = (() => {
    if (isLoading) return 'Cargando equipos…';
    if (isError) return 'No se pudieron cargar los equipos.';
    if (debouncedSearch.trim()) return 'Sin equipos disponibles';
    if (equipment.length === 0) return 'Sin equipos disponibles';
    return 'Escriba para buscar…';
  })();

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {value ? equipmentLabel(value) : 'Selecciona un equipo disponible'}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por inventario, marca, modelo o serie…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {equipment.length === 0 ? <CommandEmpty>{emptyMessage}</CommandEmpty> : null}
              <CommandGroup>
                {equipment.map((eq) => (
                  <CommandItem
                    key={eq.id}
                    value={eq.id}
                    onSelect={() => {
                      onChange(eq);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 size-4',
                        value?.id === eq.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="truncate">{equipmentLabel(eq)}</span>
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
