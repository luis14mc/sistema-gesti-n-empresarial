'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@/lib/zod-schemas';
import { loginAction } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { AuthPageShell, AuthFormFallback } from '@/components/auth/AuthPageShell';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { BRAND_APP_NAME } from '@/lib/brand';
import { sileo } from 'sileo';
import { LogIn, Eye, EyeOff } from 'lucide-react';

export function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const [showPw, setShowPw] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (data: LoginInput) => {
    startTransition(async () => {
      const result = await loginAction(data);

      if (!result.success) {
        sileo.error({
          title: 'Error de autenticación',
          description: result.error ?? 'Credenciales incorrectas',
        });
        return;
      }

      sileo.success({
        title: 'Bienvenido',
        description: `Hola, ${result.data?.firstName}`,
      });

      router.push(callbackUrl);
      router.refresh();
    });
  };

  return (
    <AuthPageShell>
      <Card className="w-full max-w-md border-border/60 shadow-xl ring-1 ring-primary/10 backdrop-blur-sm">
        <CardHeader className="space-y-4 pb-2 text-center">
          <div className="mx-auto px-2 py-1">
            <BrandLogo height={44} className="mx-auto" />
          </div>
          <div className="space-y-1">
            <h1 id="login-heading" className="font-heading text-2xl font-semibold tracking-tight">
              Iniciar Sesión
            </h1>
            <CardDescription className="text-base">
              {BRAND_APP_NAME}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            aria-labelledby="login-heading"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                placeholder="tu@empresa.com"
                autoComplete="email"
                autoFocus
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-11"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
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
              {errors.password && (
                <p id="password-error" role="alert" className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="min-h-11 w-full"
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Ingresando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Ingresar
                </span>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{' '}
            <Link
              href="/register"
              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
            >
              Regístrate
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}

export function LoginFormFallback() {
  return <AuthFormFallback message="Cargando formulario de acceso" />;
}
