'use client';

import { Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export type RoleSettingsFormState = {
  displayName: string;
  description: string;
  assignable: boolean;
};

type Props = {
  value: RoleSettingsFormState;
  onChange: (patch: Partial<RoleSettingsFormState>) => void;
  adminLocked?: boolean;
  memberCount?: number;
  disabled?: boolean;
};

export function RoleSettingsFields({
  value,
  onChange,
  adminLocked = false,
  memberCount = 0,
  disabled = false,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="role-display-name">Nombre visible</Label>
        <Input
          id="role-display-name"
          value={value.displayName}
          onChange={(e) => onChange({ displayName: e.target.value })}
          disabled={disabled}
          maxLength={80}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role-description">Descripción</Label>
        <Textarea
          id="role-description"
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          disabled={disabled}
          maxLength={500}
          rows={3}
          placeholder="Texto breve para quien asigna usuarios"
        />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="role-assignable" className="text-sm font-medium">
            Disponible para asignar
          </Label>
          <p className="text-xs text-muted-foreground">
            {adminLocked
              ? 'Super Admin siempre puede asignarse a nuevos usuarios.'
              : memberCount > 0
                ? `${memberCount} usuario(s) tienen este rol hoy.`
                : 'Aparece en el formulario de usuarios cuando está activo.'}
          </p>
        </div>
        {adminLocked ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground" title="Siempre asignable">
            <Switch checked disabled aria-label="Siempre asignable" />
            <Lock className="size-3.5" aria-hidden="true" />
          </span>
        ) : (
          <Switch
            id="role-assignable"
            checked={value.assignable}
            onCheckedChange={(checked) => onChange({ assignable: checked })}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}
