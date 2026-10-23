'use client';

import MainLayout from '@/components/layout/MainLayout';
import { AssignmentsView } from '@/components/equipment/assignments/AssignmentsView';

export default function AssignmentsPage() {
  return (
    <MainLayout>
      <AssignmentsView />
    </MainLayout>
  );
}
