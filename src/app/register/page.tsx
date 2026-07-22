'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { sileo } from 'sileo';
import { UserPlus, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isRegistering } = useAuth();
  const headingId = useId();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPw, setShowPw] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      sileo.error({ title: 'Error', description: 'Las contraseñas no coinciden' });
      return;
    }
    try {
      await register({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
      });
      sileo.success({ title: 'Cuenta creada', description: 'Redirigiendo al dashboard...' });
      router.push('/dashboard');
    } catch {
      sileo.error({ title: 'Error', description: 'No se pudo crear la cuenta' });
    }
  };

  return (
    <AuthPageShell>
      <Card className="w-full max-w-md border-border/60 shadow-xl ring-1 ring-primary/10 backdrop-blur-sm">
        <CardHeader className="space-y-4 pb-2 text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-md shadow-primary/20"
            aria-hidden="true"
          >
            <span className="font-heading text-xl font-bold text-primary-foreground">SG</span>
          </div>
          <div className="space-y-1">
            <h1 id={headingId} className="font-heading text-2xl font-semibold tracking-tight">
              Crear Cuenta
            </h1>
            <CardDescription className="text-base">
              Sistema de Gestión Empresarial
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            aria-labelledby={headingId}
            noValidate
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  placeholder="Juan"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={update('firstName')}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  placeholder="Pérez"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={update('lastName')}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                placeholder="tu@email.com"
                autoComplete="email"
                value={form.email}
                onChange={update('email')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Mín. 6 caracteres"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={update('password')}
                  required
                  minLength={6}
                  className="pr-11"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full min-h-11 min-w-11 px-3 hover:bg-transparent"
                  aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPw}
                  onClick={() => setShowPw((prev) => !prev)}
                >
                  {showPw ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={update('confirmPassword')}
                required
              />
            </div>

            <Button
              type="submit"
              className="min-h-11 w-full"
              disabled={isRegistering}
              aria-busy={isRegistering}
            >
              {isRegistering ? (
                <span className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Registrando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  Registrarse
                </span>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
            >
              Inicia sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
