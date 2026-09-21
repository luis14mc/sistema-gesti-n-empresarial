'use client';

import { Suspense } from 'react';
import { CorrespondenceHub } from '@/components/oficios/CorrespondenceHub';

export default function OficiosSalidasPage() {
  return (
    <Suspense fallback={<div className="p-8">Cargando…</div>}>
      <CorrespondenceHub initialDirection="OUTGOING" />
    </Suspense>
  );
}
