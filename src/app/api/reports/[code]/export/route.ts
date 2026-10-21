import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { ReportExportTooLargeError } from '@/lib/reportes/errors';
import { parseReportExportSearchParams } from '@/lib/reportes/export-query-schema';
import { isExportableReportCode, REPORT_DATASET_BUILDERS } from '@/lib/reportes/registry';
import { getAvailableReportDefinition } from '@/modules/reporting/application/services/report-catalog';
import type { ReportCode } from '@/modules/reporting/domain/report-types';
import { reportExecutionRepository } from '@/modules/reporting/infrastructure/repositories/report-execution-repository';
import {
  isSupportedExportFormat,
  renderExport,
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

    const organization = await prisma.organization.findUnique({
      where: { id: orgContext.organizationId },
      select: { name: true },
    });

    const execution = await reportExecutionRepository.create({
      organizationId: orgContext.organizationId,
      userId: orgContext.userId,
      reportCode: reportCode as ReportCode,
      format: query.format.toUpperCase() as 'CSV' | 'XLSX',
      filters: {
        from: query.from,
        to: query.to,
        timezone: orgContext.timezone,
        status: query.status ?? null,
        category: query.category ?? null,
        type: query.type ?? null,
      },
      requestId,
    });

    try {
      const builder = REPORT_DATASET_BUILDERS[reportCode];
      const dataset = await builder({
        prisma,
        organizationId: orgContext.organizationId,
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
      const durationMs = Math.round(performance.now() - startedAt);

      await reportExecutionRepository.complete({
        id: execution.id,
        organizationId: orgContext.organizationId,
        status: 'COMPLETED',
        rowCount: dataset.rows.length,
        durationMs,
      });

      await createAuditRecord({
        title: `Exportación de reporte ${definition.name}`,
        description: `Exportó ${dataset.rows.length} filas (${query.format.toUpperCase()}, ${query.from}–${query.to})`,
        module: 'AUDITORIA',
        category: 'EXPORT',
        userId: orgContext.userId,
        organizationId: orgContext.organizationId,
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
      await reportExecutionRepository.complete({
        id: execution.id,
        organizationId: orgContext.organizationId,
        status: 'FAILED',
        durationMs: Math.round(performance.now() - startedAt),
      });
      throw error;
    }
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
