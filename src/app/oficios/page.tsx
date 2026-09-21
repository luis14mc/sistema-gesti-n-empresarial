'use client';

import { Suspense } from 'react';
import { CorrespondenceHub } from '@/components/oficios/CorrespondenceHub';

export default function OficiosPage() {
  return (
    <Suspense fallback={<div className="p-8">Cargando correspondencia…</div>}>
      <CorrespondenceHub />
    </Suspense>
  );
}
