'use client';

import { Suspense } from 'react';
import { CorrespondenceHub } from '@/components/oficios/CorrespondenceHub';

export default function OficiosEntradasPage() {
  return (
    <Suspense fallback={<div className="p-8">Cargando…</div>}>
      <CorrespondenceHub initialDirection="INCOMING" />
    </Suspense>
  );
}
