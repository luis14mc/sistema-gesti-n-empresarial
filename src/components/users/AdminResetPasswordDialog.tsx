'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PasswordFieldWithGenerate, clientPasswordPolicyError } from '@/components/users/PasswordFieldWithGenerate';
import type { User } from '@/types';
import { Copy, AlertTriangle } from 'lucide-react';
import { sileo } from 'sileo';

type Props = {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { newPassword: string; mustChangePassword: boolean }) => Promise<void>;
  isSubmitting?: boolean;
};

export function AdminResetPasswordDialog({
  user,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: Props) {
  const [password, setPassword] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [savedPassword, setSavedPassword] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const resetLocal = () => {
    setPassword('');
    setMustChangePassword(true);
    setSavedPassword(null);
    setFieldError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetLocal();
    onOpenChange(next);
  };

  const handleSave = async () => {
    const policyError = clientPasswordPolicyError(password);
    if (policyError) {
      setFieldError(policyError);
      return;
    }
    setFieldError(null);
    await onSubmit({ newPassword: password, mustChangePassword });
    setSavedPassword(password);
    setPassword('');
  };

  const copySaved = async () => {
    if (!savedPassword) return;
    try {
      await navigator.clipboard.writeText(savedPassword);
      sileo.success({ title: 'Contraseña copiada al portapapeles' });
    } catch {
      sileo.error({ title: 'No se pudo copiar' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restablecer contraseña</DialogTitle>
          <DialogDescription>
            {user
              ? `Nueva contraseña para ${user.firstName} ${user.lastName}`
              : 'Seleccione un usuario'}
          </DialogDescription>
        </DialogHeader>

        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            Se cerrarán las sesiones activas del usuario al guardar.
          </AlertDescription>
        </Alert>

        {!savedPassword ? (
          <div className="space-y-4">
            <PasswordFieldWithGenerate
              value={password}
              onChange={setPassword}
              error={fieldError}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="must-change"
                checked={mustChangePassword}
                onCheckedChange={(v) => setMustChangePassword(v === true)}
              />
              <Label htmlFor="must-change" className="font-normal cursor-pointer">
                Pedir cambio al iniciar sesión
              </Label>
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border p-3 bg-muted/40">
            <p className="text-sm text-muted-foreground">
              Contraseña guardada. Compártela de forma segura con el usuario.
            </p>
            <div className="flex gap-2">
              <code className="flex-1 truncate rounded bg-background px-2 py-1 text-sm">{savedPassword}</code>
              <Button type="button" variant="outline" size="icon" onClick={copySaved} aria-label="Copiar contraseña">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {savedPassword ? (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} disabled={isSubmitting || !user}>
                {isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
