'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DepartmentWithPositions } from '@/hooks/useDepartments';

export type EmployeeFormValues = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dni: string;
  hireDate: string;
  departmentId: string;
  positionId: string;
};

type Props = {
  values: EmployeeFormValues;
  onChange: (patch: Partial<EmployeeFormValues>) => void;
  departments: DepartmentWithPositions[];
  idPrefix?: string;
};

export function EmployeeFormFields({ values, onChange, departments, idPrefix = 'emp' }: Props) {
  const positions =
    departments.find((d) => d.id === values.departmentId)?.positions ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-firstName`}>Nombre *</Label>
          <Input
            id={`${idPrefix}-firstName`}
            value={values.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-lastName`}>Apellido *</Label>
          <Input
            id={`${idPrefix}-lastName`}
            value={values.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-email`}>Correo institucional *</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={values.email}
          onChange={(e) => onChange({ email: e.target.value })}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-code`}>Código empleado *</Label>
          <Input
            id={`${idPrefix}-code`}
            value={values.employeeCode}
            onChange={(e) => onChange({ employeeCode: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-hireDate`}>Fecha de ingreso *</Label>
          <Input
            id={`${idPrefix}-hireDate`}
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={values.hireDate}
            onChange={(e) => onChange({ hireDate: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-dni`}>DNI</Label>
          <Input
            id={`${idPrefix}-dni`}
            placeholder="0000-0000-00000"
            value={values.dni}
            onChange={(e) => onChange({ dni: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-phone`}>Teléfono</Label>
          <Input
            id={`${idPrefix}-phone`}
            value={values.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Departamento *</Label>
          <Select
            value={values.departmentId}
            onValueChange={(v) => onChange({ departmentId: v, positionId: '' })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccione" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Puesto *</Label>
          <Select
            value={values.positionId}
            onValueChange={(v) => onChange({ positionId: v })}
            disabled={!values.departmentId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccione" />
            </SelectTrigger>
            <SelectContent>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export const emptyEmployeeFormValues: EmployeeFormValues = {
  employeeCode: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dni: '',
  hireDate: '',
  departmentId: '',
  positionId: '',
};
