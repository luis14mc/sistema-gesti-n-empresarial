'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  payrollService,
  type BatchGenerateResult,
  type IsrBracketRecord,
  type PayslipPreview,
} from '@/services/payroll.service';
import type { ApiSuccess } from '@/platform/api/response';

export const payrollKeys = {
  all: ['payroll'] as const,
  employees: (filters?: Record<string, unknown>) => [...payrollKeys.all, 'employees', filters] as const,
  employee: (id: string) => [...payrollKeys.all, 'employee', id] as const,
  payslips: (filters?: Record<string, unknown>) => [...payrollKeys.all, 'payslips', filters] as const,
  settings: () => [...payrollKeys.all, 'settings'] as const,
  isr: (year: number) => [...payrollKeys.all, 'isr', year] as const,
};

export function usePayrollEmployees(filters?: {
  search?: string;
  payrollEnabled?: boolean;
  page?: number;
  pageSize?: number;
  previewPayMonth?: string;
}) {
  const query = useQuery({
    queryKey: payrollKeys.employees(filters),
    queryFn: async () => (await payrollService.listEmployees(filters as Record<string, unknown>)).data.data,
  });
  return {
    employees: query.data?.employees ?? [],
    stats: query.data?.stats,
    total: query.data?.total ?? 0,
    totalPages: query.data?.totalPages ?? 1,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function usePayrollEmployee(id: string | null) {
  const query = useQuery({
    queryKey: payrollKeys.employee(id ?? ''),
    queryFn: async () => (await payrollService.getEmployee(id!)).data.data,
    enabled: Boolean(id),
  });
  return {
    employee: query.data,
    isLoading: query.isLoading,
  };
}

export function usePayrollPayslips(filters?: {
  search?: string;
  year?: number;
  month?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = useQuery({
    queryKey: payrollKeys.payslips(filters),
    queryFn: async () => (await payrollService.listPayslips(filters as Record<string, unknown>)).data.data,
  });
  return {
    payslips: query.data?.payslips ?? [],
    summary: query.data?.summary,
    total: query.data?.total ?? 0,
    totalPages: query.data?.totalPages ?? 1,
    page: query.data?.page ?? 1,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function usePayrollSettings() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: payrollKeys.settings(),
    queryFn: async () => (await payrollService.getSettings()).data.data,
  });
  const updateMutation = useMutation({
    mutationFn: (data: Record<string, number>) => payrollService.patchSettings(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: payrollKeys.settings() }),
  });
  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    updateSettings: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

export function usePayrollIsrBrackets(year: number) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: payrollKeys.isr(year),
    queryFn: async () => (await payrollService.getIsrBrackets(year)).data.data,
  });
  const saveMutation = useMutation({
    mutationFn: (brackets: IsrBracketRecord[]) =>
      payrollService.putIsrBrackets({ year, brackets }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: payrollKeys.isr(year) }),
  });
  const resetMutation = useMutation({
    mutationFn: () => payrollService.resetIsrBrackets2026(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: payrollKeys.isr(year) }),
  });
  return {
    brackets: query.data?.brackets ?? [],
    isLoading: query.isLoading,
    saveBrackets: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    resetTo2026Defaults: resetMutation.mutateAsync,
    isResetting: resetMutation.isPending,
  };
}

export function usePayrollMutations() {
  const queryClient = useQueryClient();
  const previewMutation = useMutation({
    mutationFn: (data: { employeeId: string; payMonth: string }) => payrollService.preview(data),
  });
  const generateMutation = useMutation({
    mutationFn: (data: { employeeId: string; payMonth: string }) => payrollService.generatePayslip(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.payslips() });
    },
  });
  const batchMutation = useMutation({
    mutationFn: (data: { payMonth: string; employeeIds?: string[] }) => payrollService.batchGenerate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.payslips() });
    },
  });
  const patchEmployeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      payrollService.patchEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.employees() });
    },
  });
  return {
    preview: previewMutation.mutateAsync,
    isPreviewing: previewMutation.isPending,
    clearPreview: () => previewMutation.reset(),
    previewData: (previewMutation.data?.data as ApiSuccess<PayslipPreview> | undefined)?.data,
    previewError: previewMutation.error,
    generate: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
    batchGenerate: batchMutation.mutateAsync,
    isBatching: batchMutation.isPending,
    batchResult: (batchMutation.data?.data as ApiSuccess<{ succeeded: number; failed: number; results: BatchGenerateResult['results'] }> | undefined)?.data,
    patchEmployee: patchEmployeeMutation.mutateAsync,
    isPatching: patchEmployeeMutation.isPending,
  };
}
