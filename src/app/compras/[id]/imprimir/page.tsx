'use client';

import { use, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { comprasService } from '@/services/compras.service';

export default function CompraImprimirPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const url = comprasService.getImprimirUrl(id);
    window.open(url, '_blank');
  }, [id, user]);

  return (
    <div className="p-8 text-center text-muted-foreground">
      <p>Abriendo vista de impresión...</p>
      <p className="text-sm mt-2">
        Si no se abre automáticamente,{' '}
        <a
          href={comprasService.getImprimirUrl(id)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          haga clic aquí
        </a>
        .
      </p>
    </div>
  );
}
