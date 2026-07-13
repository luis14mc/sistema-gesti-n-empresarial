'use client';

// ============================================
// SETTINGS PAGE — Configuración
// Sprint 2: edición de perfil + cambio de contraseña
// ============================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/auth.service';
import { sileo } from 'sileo';
import { Palette, Shield, User as UserIcon, KeyRound, Save } from 'lucide-react';
import { ROLE_LABELS } from '@/types';

const profileSchema = z.object({
  firstName: z.string().min(2, 'Mínimo 2 caracteres').max(50),
  lastName:  z.string().min(2, 'Mínimo 2 caracteres').max(50),
  email:     z.string().email('Email inválido'),
  phone:     z.string().max(20).optional().or(z.literal('')),
});
type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Requerida'),
  newPassword:     z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});
type PasswordForm = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { user, refresh } = useAuth();

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName:  user?.lastName ?? '',
      email:     user?.email ?? '',
      phone:     user?.phone ?? '',
    },
    values: user ? {
      firstName: user.firstName,
      lastName:  user.lastName,
      email:     user.email,
      phone:     user.phone ?? '',
    } : undefined,
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const [profileLoading, setProfileLoading]     = useState(false);
  const [passwordLoading, setPasswordLoading]   = useState(false);

  async function onSubmitProfile(data: ProfileForm) {
    setProfileLoading(true);
    try {
      const res = await authService.updateProfile({
        firstName: data.firstName,
        lastName:  data.lastName,
        email:     data.email,
        phone:     data.phone || undefined,
      });
      await refresh();
      sileo.success({ title: 'Perfil actualizado' });
      void res;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      sileo.error({
        title: 'Error',
        description: err.response?.data?.error ?? 'No se pudo actualizar',
      });
    } finally {
      setProfileLoading(false);
    }
  }

  async function onSubmitPassword(data: PasswordForm) {
    setPasswordLoading(true);
    try {
      await authService.changePassword({
        currentPassword: data.currentPassword,
        newPassword:     data.newPassword,
      });
      passwordForm.reset();
      sileo.success({ title: 'Contraseña cambiada', description: 'Vuelve a iniciar sesión en otros dispositivos' });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      sileo.error({
        title: 'Error',
        description: err.response?.data?.error ?? 'No se pudo cambiar la contraseña',
      });
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-2xl">
        <PageHeader
          title="Ajustes"
          description="Configuración de tu cuenta y preferencias"
        />

        {/* ── Perfil ────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
              Tu perfil
            </CardTitle>
            <CardDescription>
              Actualiza tu información personal. Tu rol y permisos son administrados por el área de RRHH.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">Nombre</Label>
                  <Input id="firstName" {...profileForm.register('firstName')} />
                  {profileForm.formState.errors.firstName && (
                    <p className="text-xs text-destructive">{profileForm.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Apellido</Label>
                  <Input id="lastName" {...profileForm.register('lastName')} />
                  {profileForm.formState.errors.lastName && (
                    <p className="text-xs text-destructive">{profileForm.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...profileForm.register('email')} />
                {profileForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{profileForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" {...profileForm.register('phone')} placeholder="+502 5555 1234" />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Rol</p>
                  <p className="font-medium">{user ? ROLE_LABELS[user.role] : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Número de empleado</p>
                  <p className="font-medium font-mono">{user?.employeeNumber ?? '—'}</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={profileLoading}>
                  <Save className="h-4 w-4 mr-2" />
                  {profileLoading ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Contraseña ────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5 text-muted-foreground" />
              Cambiar contraseña
            </CardTitle>
            <CardDescription>
              Mínimo 8 caracteres. Usa una combinación de letras, números y símbolos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword">Contraseña actual</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  {...passwordForm.register('currentPassword')}
                />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="text-xs text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">Nueva contraseña</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register('newPassword')}
                />
                {passwordForm.formState.errors.newPassword && (
                  <p className="text-xs text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register('confirmPassword')}
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={passwordLoading}>
                  {passwordLoading ? 'Cambiando…' : 'Cambiar contraseña'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Apariencia ─────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette className="h-5 w-5 text-muted-foreground" />
              Apariencia
            </CardTitle>
            <CardDescription>Personaliza el aspecto visual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Modo oscuro</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Alterna entre modo claro y oscuro</p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        {/* ── Zona peligrosa ─────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Sesión
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Cierra tu sesión en este navegador. El resto de dispositivos mantendrán su sesión activa hasta 1 hora.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
