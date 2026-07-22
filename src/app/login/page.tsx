import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
  LoginFormContent,
  LoginFormFallback,
} from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description: 'Accede al Sistema de Gestión Empresarial con tu correo y contraseña.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginFormContent />
    </Suspense>
  );
}
