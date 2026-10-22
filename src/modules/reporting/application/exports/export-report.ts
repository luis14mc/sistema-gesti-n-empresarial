import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { renderExport, type ExportFormat } from '@/platform/reporting/export';
import type { ReportCode } from '@/modules/reporting/domain/report-types';
import type { ReportExportCode } from '@/modules/reporting/application/exports/types';
import { reportExecutionRepository } from '@/modules/reporting/infrastructure/repositories/report-execution-repository';
import { findOrganizationName, runReportDatasetBuilder } from '@/modules/reporting/infrastructure/exports/run-dataset-builder';
import { isExportableReportCode as isRegisteredReportCode } from '@/modules/reporting/infrastructure/exports/registry';

export function isExportableReportCode(code: string): code is ReportExportCode {
  return isRegisteredReportCode(code);
}

export type ExportReportInput = Readonly<{
  reportCode: ReportExportCode;
  reportName: string;
  organizationId: string;
  userId: string;
  timezone: string;
  requestId: string;
  startedAt: number;
  query: Readonly<{
    format: ExportFormat;
    from: string;
    to: string;
    status?: string;
    category?: string;
    type?: string;
  }>;
}>;

/**
 * Registra la ejecución, construye el dataset, lo renderiza y audita.
 * Si falla la construcción o el render, la ejecución queda FAILED y el error se propaga.
 */
export async function exportReport(input: ExportReportInput) {
  const { reportCode, organizationId, userId, requestId, query } = input;

  const organization = await findOrganizationName(organizationId);

  const execution = await reportExecutionRepository.create({
    organizationId,
    userId,
    reportCode: reportCode as ReportCode,
    format: query.format.toUpperCase() as 'CSV' | 'XLSX',
    filters: {
      from: query.from,
      to: query.to,
      timezone: input.timezone,
      status: query.status ?? null,
      category: query.category ?? null,
      type: query.type ?? null,
    },
    requestId,
  });

  try {
    const dataset = await runReportDatasetBuilder(reportCode, {
      organizationId,
      organizationName: organization?.name,
      from: query.from,
      to: query.to,
      filters: {
        status: query.status,
        category: query.category,
        type: query.type,
      },
    });

    const artifact = await renderExport(query.format, dataset);
    const durationMs = Math.round(performance.now() - input.startedAt);

    await reportExecutionRepository.complete({
      id: execution.id,
      organizationId,
      status: 'COMPLETED',
      rowCount: dataset.rows.length,
      durationMs,
    });

    await createAuditRecord({
      title: `Exportación de reporte ${input.reportName}`,
      description: `Exportó ${dataset.rows.length} filas (${query.format.toUpperCase()}, ${query.from}–${query.to})`,
      module: 'AUDITORIA',
      category: 'EXPORT',
      userId,
      organizationId,
      requestId,
      newData: {
        reportCode,
        format: query.format,
        from: query.from,
        to: query.to,
        rows: dataset.rows.length,
        executionId: execution.id,
      },
    });

    return artifact;
  } catch (error) {
    await reportExecutionRepository.complete({
      id: execution.id,
      organizationId,
      status: 'FAILED',
      durationMs: Math.round(performance.now() - input.startedAt),
    });
    throw error;
  }
}
