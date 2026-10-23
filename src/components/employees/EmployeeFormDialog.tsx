'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  EmployeeFormFields,
  emptyEmployeeFormValues,
  type EmployeeFormValues,
} from '@/components/employees/EmployeeFormFields';
import type { DepartmentWithPositions } from '@/hooks/useDepartments';
import type { Employee } from '@/types';

export function employeeToFormValues(employee: Employee): EmployeeFormValues {
  return {
    employeeCode: employee.employeeCode ?? '',
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    hireDate: employee.hireDate?.slice(0, 10) ?? '',
    phone: employee.phone ?? '',
    dni: employee.dni ?? '',
    departmentId: employee.departmentId ?? '',
    positionId: employee.positionId ?? '',
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  values: EmployeeFormValues;
  onChange: (patch: Partial<EmployeeFormValues>) => void;
  departments: DepartmentWithPositions[];
  onSubmit: () => Promise<void>;
  pending?: boolean;
  submitLabel?: string;
};

export function EmployeeFormDialog({
  open,
  onOpenChange,
  title,
  description,
  values,
  onChange,
  departments,
  onSubmit,
  pending,
  submitLabel = 'Guardar',
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
          className="space-y-4"
        >
          <EmployeeFormFields values={values} onChange={onChange} departments={departments} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { emptyEmployeeFormValues };
