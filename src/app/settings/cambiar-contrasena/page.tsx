'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordFieldWithGenerate, clientPasswordPolicyError } from '@/components/users/PasswordFieldWithGenerate';
import { authService } from '@/services/auth.service';
import { sileo } from 'sileo';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';

export default function ForcedPasswordChangePage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const policyError = clientPasswordPolicyError(newPassword);
    if (policyError) {
      sileo.error({ title: 'Contraseña inválida', description: policyError });
      return;
    }
    if (newPassword !== confirmPassword) {
      sileo.error({ title: 'Las contraseñas no coinciden' });
      return;
    }
    if (currentPassword === newPassword) {
      sileo.error({ title: 'La nueva contraseña debe ser diferente a la actual' });
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.changePassword({ currentPassword, newPassword });
      sileo.success({ title: 'Contraseña actualizada' });
      // Navegación completa: el middleware Edge debe leer la cookie nueva
      // (sin mustChangePassword) que emitió /api/auth/password.
      window.location.assign('/dashboard');
    } catch {
      sileo.error({
        title: 'No se pudo cambiar la contraseña',
        description: 'Verifique la contraseña actual.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout layoutMode="minimal">
      <div className="mx-auto max-w-lg space-y-6">
        <PageHeader
          title="Cambio de contraseña obligatorio"
          description="Debe establecer una contraseña nueva antes de continuar usando el sistema."
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5" />
              Nueva contraseña
            </CardTitle>
            <CardDescription>
              Use la contraseña temporal que recibió e ingrese una contraseña personal segura.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">Contraseña actual</Label>
                <Input
                  id="current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <PasswordFieldWithGenerate
                id="new-password"
                label="Nueva contraseña"
                value={newPassword}
                onChange={setNewPassword}
              />
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar nueva contraseña</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando…' : 'Guardar y continuar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
