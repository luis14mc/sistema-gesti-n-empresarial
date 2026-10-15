'use client';

import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export type AssignableRoleOption = {
  role: string;
  displayName: string;
  description: string | null;
  accessibleModuleLabels: string[];
};

type Props = {
  value: string;
  onValueChange: (role: string) => void;
  options: AssignableRoleOption[];
  /** Shown when editing a user whose role is no longer assignable */
  retainedOption?: AssignableRoleOption | null;
  canViewRolePermissions?: boolean;
  disabled?: boolean;
  id?: string;
};

export function UserRoleSelect({
  value,
  onValueChange,
  options,
  retainedOption,
  canViewRolePermissions = false,
  disabled = false,
  id = 'user-role',
}: Props) {
  const selected =
    options.find((o) => o.role === value) ??
    (retainedOption?.role === value ? retainedOption : null);

  const moduleSummary =
    selected && selected.accessibleModuleLabels.length > 0
      ? selected.accessibleModuleLabels.slice(0, 6).join(', ')
      : null;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Rol</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Seleccione un rol" />
        </SelectTrigger>
        <SelectContent>
          {retainedOption && !options.some((o) => o.role === retainedOption.role) ? (
            <SelectItem value={retainedOption.role} disabled>
              {retainedOption.displayName} (no disponible para nuevas asignaciones)
            </SelectItem>
          ) : null}
          {options.map((option) => (
            <SelectItem key={option.role} value={option.role}>
              <span className="font-medium">{option.displayName}</span>
              {option.description ? (
                <span className="text-muted-foreground"> — {option.description}</span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected?.description ? (
        <p className="text-xs text-muted-foreground">{selected.description}</p>
      ) : null}
      {moduleSummary ? (
        <p className="text-xs text-muted-foreground">
          Accede a: {moduleSummary}
          {selected && selected.accessibleModuleLabels.length > 6 ? '…' : ''}
        </p>
      ) : null}
      {canViewRolePermissions && value ? (
        <Link
          href={`/settings/roles/${value}`}
          className="text-xs text-primary underline-offset-4 hover:underline"
        >
          Ver permisos del rol
        </Link>
      ) : null}
    </div>
  );
}
