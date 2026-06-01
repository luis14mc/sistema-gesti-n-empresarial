'use client';

// ============================================
// HOME PAGE — Landing / Redirect
// ============================================

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Ticket, FileText, Monitor, Package, Clock, Shield,
} from 'lucide-react';

const features = [
  { icon: Ticket, title: 'Tickets de Soporte', desc: 'Gestión de solicitudes técnicas' },
  { icon: FileText, title: 'Oficios', desc: 'Control de correspondencia oficial' },
  { icon: Monitor, title: 'Equipos IT', desc: 'Catálogo de activos tecnológicos' },
  { icon: Package, title: 'Inventario', desc: 'Artículos promocionales' },
  { icon: Clock, title: 'Asistencia', desc: 'Control de entradas y salidas' },
  { icon: Shield, title: 'Seguridad RBAC', desc: 'Permisos basados en roles' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 right-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-brand-blue/5 blur-3xl" />
        </div>

        <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mb-6">
          <span className="text-primary-foreground font-bold text-2xl font-heading">SG</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold font-heading tracking-tight max-w-2xl">
          Sistema de Gestión{' '}
          <span className="text-primary">Empresarial</span>
        </h1>
        <p className="text-muted-foreground mt-4 max-w-md text-base sm:text-lg">
          Plataforma integral para la gestión institucional con control de acceso por roles.
        </p>

        <div className="flex items-center gap-3 mt-8">
          <Link href="/login">
            <Button size="lg">Iniciar Sesión</Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="outline">Registrarse</Button>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-16 max-w-2xl w-full">
          {features.map((f) => (
            <Card key={f.title} className="text-left hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <f.icon className="h-6 w-6 text-primary mb-2" />
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} SGE — Sistema de Gestión Empresarial
      </footer>
    </div>
  );
}
