'use client';

import MainLayout from '@/components/layout/MainLayout';
import { EmployeeProfileView } from '@/components/employees/EmployeeProfileView';
import { useParams } from 'next/navigation';

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <MainLayout>
      <EmployeeProfileView employeeId={params.id} />
    </MainLayout>
  );
}
