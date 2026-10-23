'use client';

import MainLayout from '@/components/layout/MainLayout';
import { EmployeesView } from '@/components/employees/EmployeesView';

export default function EmployeesPage() {
  return (
    <MainLayout>
      <EmployeesView />
    </MainLayout>
  );
}
