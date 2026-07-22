import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crear cuenta',
  description: 'Regístrate en el Sistema de Gestión Empresarial.',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
