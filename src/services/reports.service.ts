import axios from 'axios';
import type { ReportDefinition } from '@/modules/reporting/domain/report-types';
import { defaultExportFilename } from '@/lib/reportes/report-ui';
import { extractApiErrorMessage, parseApiErrorPayload } from '@/lib/api-error-message';

export type ReportExportParams = {
  from: string;
  to: string;
  format: 'csv' | 'xlsx';
  status?: string;
  category?: string;
  type?: string;
};

type CatalogResponse = {
  success: true;
  data: { reports: ReportDefinition[] };
};

type ApiErrorBody = {
  success?: false;
  error?: string | { message?: string; code?: string };
  code?: string;
  message?: string;
};

export async function fetchReportsCatalog(): Promise<ReportDefinition[]> {
  const { data } = await axios.get<CatalogResponse>('/api/reports/catalog');
  return data.data.reports;
}

export async function downloadReportExport(
  code: string,
  params: ReportExportParams,
): Promise<{ blob: Blob; filename: string }> {
  const search = new URLSearchParams({
    format: params.format,
    from: params.from,
    to: params.to,
  });
  if (params.status) search.set('status', params.status);
  if (params.category) search.set('category', params.category);
  if (params.type) search.set('type', params.type);

  const url = `/api/reports/${encodeURIComponent(code)}/export?${search.toString()}`;
  const response = await fetch(url, { credentials: 'include' });

  if (!response.ok) {
    let body: ApiErrorBody | undefined;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = undefined;
    }
    const parsed = parseApiErrorPayload(body);
    const err = new Error(
      extractApiErrorMessage(body, 'No se pudo exportar el reporte.', response.status),
    ) as Error & {
      status: number;
      code?: string;
    };
    err.status = response.status;
    err.code = parsed.code ?? body?.code ?? undefined;
    throw err;
  }

  const blob = await response.blob();
  const filename =
    defaultExportFilename(
      code as ReportDefinition['code'],
      params.from,
      params.to,
      params.format,
    );

  return { blob, filename };
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
