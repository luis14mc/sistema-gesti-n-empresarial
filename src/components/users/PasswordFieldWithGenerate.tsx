'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import {
  generateSecurePassword,
  PASSWORD_MIN_LENGTH,
  validatePasswordPolicy,
} from '@/platform/security/password-policy';

type Props = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
  autoComplete?: string;
};

export function PasswordFieldWithGenerate({
  id = 'password',
  label = 'Contraseña',
  value,
  onChange,
  onBlur,
  error,
  autoComplete = 'new-password',
}: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => onChange(generateSecurePassword())}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generar
        </Button>
      </div>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          minLength={PASSWORD_MIN_LENGTH}
          placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres, letra y número`}
          aria-invalid={Boolean(error)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function clientPasswordPolicyError(password: string): string | null {
  return validatePasswordPolicy(password);
}
