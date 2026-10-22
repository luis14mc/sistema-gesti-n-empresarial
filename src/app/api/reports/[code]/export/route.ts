import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { ReportExportTooLargeError } from '@/modules/reporting/domain/export-errors';
import { parseReportExportSearchParams } from '@/modules/reporting/presentation/schemas/export-query';
import { exportReport, isExportableReportCode } from '@/modules/reporting/application/exports/export-report';
import { getAvailableReportDefinition } from '@/modules/reporting/application/services/report-catalog';
import type { ReportCode } from '@/modules/reporting/domain/report-types';
import {
  isSupportedExportFormat,
  SUPPORTED_EXPORT_FORMATS,
} from '@/platform/reporting/export';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';
import { requireOrganizationPermission } from '@/platform/security/authorization/effective-permissions';
import { AuthenticationRequiredError } from '@/modules/organizations/application/context';

type RouteContext = { params: Promise<{ code: string }> };

async function getHandler(req: AuthenticatedRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();

  try {
    if (!req.user?.userId) {
      return NextResponse.json({ error: 'Autenticación requerida.', code: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
    }

    const { code: rawCode } = await context.params;
    const reportCode = rawCode.toUpperCase();
    if (!isExportableReportCode(reportCode)) {
      return NextResponse.json({ error: 'Reporte no disponible.', code: 'REPORT_NOT_AVAILABLE' }, { status: 404 });
    }

    const definition = getAvailableReportDefinition(reportCode as ReportCode);
    const orgContext = await authorizeOrganization(req, requestId, definition.requiredPermission);
    await requireOrganizationPermission(orgContext.userId, orgContext.organizationId, orgContext.role, 'reports.export');

    let query;
    try {
      query = parseReportExportSearchParams(new URL(req.url).searchParams);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: 'Parámetros de exportación inválidos.', code: 'INVALID_REPORT_EXPORT_PARAMS', details: error.flatten() },
          { status: 400 },
        );
      }
      throw error;
    }

    if (!isSupportedExportFormat(query.format)) {
      return NextResponse.json(
        { error: `Formato no soportado. Use: ${SUPPORTED_EXPORT_FORMATS.join(', ')}`, code: 'UNSUPPORTED_FORMAT' },
        { status: 400 },
      );
    }

    const artifact = await exportReport({
      reportCode,
      reportName: definition.name,
      organizationId: orgContext.organizationId,
      userId: orgContext.userId,
      timezone: orgContext.timezone,
      requestId,
      startedAt,
      query,
    });

    return new NextResponse(artifact.body as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': artifact.contentType,
        'Content-Disposition': `attachment; filename="${artifact.filename}"`,
        'Content-Length': String(artifact.body.byteLength),
        'Cache-Control': 'no-store',
        'x-request-id': requestId,
      },
    });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: 'Autenticación requerida.', code: error.code }, { status: 401 });
    }
    if (error instanceof ReportExportTooLargeError) {
      return NextResponse.json(
        {
          error: `El reporte excede el límite de ${error.limit} filas para exportación directa.`,
          code: 'EXPORT_ROW_LIMIT_EXCEEDED',
        },
        { status: 413 },
      );
    }
    if (error instanceof Error && ['INVALID_STATUS', 'INVALID_CATEGORY', 'INVALID_TYPE'].includes(error.message)) {
      return NextResponse.json({ error: 'Filtro inválido.', code: error.message }, { status: 400 });
    }
    console.error('GET /api/reports/[code]/export failed', error);
    return NextResponse.json({ error: 'Error al exportar el reporte.', code: 'REPORT_EXPORT_FAILED' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
