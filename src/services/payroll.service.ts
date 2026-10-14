import { apiHelpers } from '@/utils/api';
import type { ApiSuccess } from '@/platform/api/response';

const BASE = '/api/payroll';

export type PayrollEmployeeListItem = {
  id: string;
  fullName: string;
  employeeCode: string | null;
  email: string;
  hireDate: string | null;
  monthlySalary: number | null;
  otherDeduction: number;
  otherDeductionNote: string | null;
  payrollEnabled: boolean;
};

export type PayslipListItem = {
  id: string;
  year: number;
  month: number;
  neto: number;
  employee?: { fullName: string };
};

export type PayslipPreview = {
  salarioPeriodo: number;
  ihss: number;
  isr: number;
  otro: number;
  totalDeducciones: number;
  neto: number;
};

export type BatchGenerateResult = {
  payMonth: string;
  succeeded: number;
  failed: number;
  results: Array<{ employeeId: string; ok: boolean; error?: string }>;
};

export const payrollService = {
  listEmployees: (params?: Record<string, unknown>) =>
    apiHelpers.get<ApiSuccess<{ employees: PayrollEmployeeListItem[]; total: number; page: number; pageSize: number; totalPages: number }>>(
      `${BASE}/employees`,
      params,
    ),
  getEmployee: (id: string) => apiHelpers.get(`${BASE}/employees/${id}`),
  patchEmployee: (id: string, data: unknown) => apiHelpers.patch(`${BASE}/employees/${id}`, data),
  preview: (data: { employeeId: string; payMonth: string }) =>
    apiHelpers.post<ApiSuccess<PayslipPreview>>(`${BASE}/preview`, data),
  listPayslips: (params?: Record<string, unknown>) =>
    apiHelpers.get<ApiSuccess<{ payslips: PayslipListItem[]; total: number }>>(`${BASE}/payslips`, params),
  generatePayslip: (data: { employeeId: string; payMonth: string }) => apiHelpers.post(`${BASE}/payslips`, data),
  batchGenerate: (data: { payMonth: string; employeeIds?: string[] }) =>
    apiHelpers.post<ApiSuccess<BatchGenerateResult>>(`${BASE}/payslips/batch`, data),
  getSettings: () =>
    apiHelpers.get<ApiSuccess<{
      medicalExpensesAnnual: number;
      ivmDeductibleMonthly: number;
      ihssEmRate: number;
      ihssIvmRate: number;
      ihssCeilingMonthly: number;
    }>>(`${BASE}/settings`),
  patchSettings: (data: unknown) => apiHelpers.patch(`${BASE}/settings`, data),
  getIsrBrackets: (year: number) => apiHelpers.get(`${BASE}/isr-brackets`, { year }),
  putIsrBrackets: (data: unknown) => apiHelpers.put(`${BASE}/isr-brackets`, data),
  pdfUrl: (payslipId: string) => `${BASE}/payslips/${payslipId}/pdf`,
};
