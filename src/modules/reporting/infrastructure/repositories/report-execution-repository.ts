import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ReportCode, ReportFilters, ReportFormat } from '../../domain/report-types';
import type { ReportExecutionRecord, ReportExecutionRepository } from '../../application/services/report-execution-service';
import { appendSecurityEvent } from '@/platform/security/audit/security-events';

function toRecord(record: Awaited<ReturnType<typeof prisma.reportExecution.create>>): ReportExecutionRecord {
  return {
    ...record,
    reportCode: record.reportCode as ReportCode,
    format: record.format as ReportFormat,
    filters: record.filters as ReportFilters,
  };
}

export class PrismaReportExecutionRepository implements ReportExecutionRepository {
  async create(input: Parameters<ReportExecutionRepository['create']>[0]): Promise<ReportExecutionRecord> {
    const record = await prisma.$transaction(async (tx) => {
      const execution = await tx.reportExecution.create({
        data: {
          ...input,
          filters: input.filters as Prisma.InputJsonValue,
        },
      });
      await appendSecurityEvent(tx, {
        organizationId: input.organizationId,
        userId: input.userId,
        eventType: 'report.export.requested',
        outcome: 'SUCCESS',
        severity: 'NOTICE',
        module: 'reporting',
        entityType: 'ReportExecution',
        entityId: execution.id,
        action: 'EXPORT_REQUESTED',
        requestId: input.requestId,
        attributes: { reportCode: input.reportCode, format: input.format },
      });
      return execution;
    });
    return toRecord(record);
  }
}

export const reportExecutionRepository = new PrismaReportExecutionRepository();
