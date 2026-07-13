import { apiHelpers } from '@/utils/api';
import type {
  Employee,
  EmployeeFilters,
  CreateEmployeeData,
  UpdateEmployeeData,
} from '@/types';

const BASE = '/api/employees';

export interface EmployeesListResponse {
  employees: Employee[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EmployeeResponse {
  employee: Employee;
}

export const employeesService = {
  list: (filters?: EmployeeFilters) =>
    apiHelpers.get<EmployeesListResponse>(BASE, filters as Record<string, unknown>),

  getById: (id: string) =>
    apiHelpers.get<EmployeeResponse>(`${BASE}/${id}`),

  create: (data: CreateEmployeeData) =>
    apiHelpers.post<EmployeeResponse>(BASE, data),

  update: (id: string, data: UpdateEmployeeData) =>
    apiHelpers.patch<EmployeeResponse>(`${BASE}/${id}`, data),
};
