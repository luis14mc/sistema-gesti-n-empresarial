'use client';

import { Suspense, use } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { AssignmentDetailView } from '@/components/equipment/assignments/AssignmentDetailView';
import { Skeleton } from '@/components/ui/skeleton';

function AssignmentDetailPageInner({ id }: { id: string }) {
  return <AssignmentDetailView assignmentId={id} />;
}

export default function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <MainLayout>
      <Suspense
        fallback={
          <div className="space-y-6 p-1">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        }
      >
        <AssignmentDetailPageInner id={id} />
      </Suspense>
    </MainLayout>
  );
}
