import { api, apiHelpers } from '@/utils/api';
import type { ApiSuccess } from '@/platform/api/response';
import { DEFAULT_ISR_BRACKETS_2026, PAYROLL_YEAR } from '@/modules/payroll/domain/constants';

const BASE = '/api/payroll';

export type PayrollDepartmentRef = { id: string; name: string } | null;
export type PayrollPositionRef = { id: string; name: string } | null;

export type PayrollEmployeeListItem = {
  id: string;
  fullName: string;
  employeeCode: string | null;
  email: string;
  phone?: string | null;
  hireDate: string | null;
  monthlySalary: number | null;
  otherDeduction: number;
  otherDeductionNote: string | null;
  payrollEnabled: boolean;
  department?: PayrollDepartmentRef;
  position?: PayrollPositionRef;
  /** Preview IHSS for current list pay month (when provided by API). */
  previewIhss?: number | null;
  /** Preview ISR for current list pay month (when provided by API). */
  previewIsr?: number | null;
};

export type PayrollEmployeeDetail = PayrollEmployeeListItem;

export type PayslipListItem = {
  id: string;
  employeeId: string;
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  salarioPeriodo: number;
  ihss: number;
  isr: number;
  otro: number;
  totalDeducciones: number;
  neto: number;
  pdfStorageKey?: string | null;
  emailStatus?: string;
  deliveryType?: 'PDF' | 'EMAIL' | 'PDF_EMAIL';
  generatedAt?: string;
  employee?: { id: string; fullName: string; employeeCode: string | null };
};

export type PayslipPreview = {
  salarioPeriodo: number;
  ihss: number;
  isr: number;
  otro: number;
  totalDeducciones: number;
  neto: number;
  employeeId?: string;
  payMonth?: string;
  previewHtml?: string;
  payPeriod?: {
    start: string;
    end: string;
    year: number;
    month: number;
  };
  monthsWorkedInYear?: number;
  isPrimerMes?: boolean;
};

export type IsrBracketRecord = {
  id?: string;
  order: number;
  rate: number;
  toAnnual: number;
};

export type BatchGenerateResult = {
  payMonth: string;
  succeeded: number;
  failed: number;
  results: Array<{ employeeId: string; ok: boolean; error?: string; payslipId?: string }>;
};

export function defaultIsrBracketsForYear(year: number = PAYROLL_YEAR) {
  return {
    year,
    brackets: DEFAULT_ISR_BRACKETS_2026.map((b, index) => ({
      order: index + 1,
      rate: b.rate,
      toAnnual: Number.isFinite(b.to) ? b.to : 999_999_999_999,
    })),
  };
}

export const payrollService = {
  listEmployees: (params?: Record<string, unknown>) =>
    apiHelpers.get<
      ApiSuccess<{
        employees: PayrollEmployeeListItem[];
        stats?: {
          totalPayrollEmployees: number;
          totalMonthlyPayroll: number;
          averageMonthlySalary: number;
        };
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>
    >(`${BASE}/employees`, params),
  getEmployee: (id: string) =>
    apiHelpers.get<ApiSuccess<PayrollEmployeeDetail>>(`${BASE}/employees/${id}`),
  patchEmployee: (id: string, data: unknown) => apiHelpers.patch(`${BASE}/employees/${id}`, data),
  preview: (data: { employeeId: string; payMonth: string }) =>
    apiHelpers.post<ApiSuccess<PayslipPreview>>(`${BASE}/preview`, data),
  listPayslips: (params?: Record<string, unknown>) =>
    apiHelpers.get<
      ApiSuccess<{
        payslips: PayslipListItem[];
        summary?: {
          recordCount: number;
          netPayTotal: number;
          deductionsTotal: number;
        };
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>
    >(`${BASE}/payslips`, params),
  generatePayslip: (data: { employeeId: string; payMonth: string }) =>
    apiHelpers.post<ApiSuccess<PayslipListItem>>(`${BASE}/payslips`, data),
  batchGenerate: (data: { payMonth: string; employeeIds?: string[] }) =>
    apiHelpers.post<ApiSuccess<BatchGenerateResult>>(`${BASE}/payslips/batch`, data),
  getSettings: () =>
    apiHelpers.get<
      ApiSuccess<{
        medicalExpensesAnnual: number;
        ivmDeductibleMonthly: number;
        ihssEmRate: number;
        ihssIvmRate: number;
        ihssCeilingMonthly: number;
      }>
    >(`${BASE}/settings`),
  patchSettings: (data: unknown) => apiHelpers.patch(`${BASE}/settings`, data),
  getIsrBrackets: (year: number) =>
    apiHelpers.get<ApiSuccess<{ year: number; brackets: IsrBracketRecord[] }>>(`${BASE}/isr-brackets`, { year }),
  putIsrBrackets: (data: unknown) => apiHelpers.put(`${BASE}/isr-brackets`, data),
  resetIsrBrackets2026: () => payrollService.putIsrBrackets(defaultIsrBracketsForYear(PAYROLL_YEAR)),
  pdfUrl: (payslipId: string) => `${BASE}/payslips/${payslipId}/pdf`,
  exportPayslipsAudit: async (params?: Record<string, unknown>) => {
    const response = await api.get(`${BASE}/payslips/audit/export`, {
      params,
      responseType: 'blob',
    });
    return response.data as Blob;
  },
};
