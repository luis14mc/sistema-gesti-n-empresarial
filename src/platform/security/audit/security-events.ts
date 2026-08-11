import { Prisma, type SecurityEventOutcome, type SecurityEventSeverity } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/platform/observability/logger';

const SENSITIVE_KEY = /(authorization|cookie|credential|password|secret|token|private.?key|connection.?string|presigned.?url)/i;
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 25;
const MAX_STRING_LENGTH = 512;

type JsonRecord = Readonly<Record<string, unknown>>;

export type SecurityEventInput = Readonly<{
  organizationId?: string;
  userId?: string;
  eventType: string;
  outcome: SecurityEventOutcome;
  severity?: SecurityEventSeverity;
  reasonCode?: string;
  module: string;
  entityType: string;
  entityId?: string;
  action: string;
  attributes?: JsonRecord;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  occurredAt?: Date;
}>;

function sanitize(value: unknown, depth = 0): Prisma.InputJsonValue | null {
  if (depth >= MAX_DEPTH) return '[TRUNCATED]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map((entry) => sanitize(entry, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitize(entry, depth + 1),
    ]));
  }
  return String(value).slice(0, MAX_STRING_LENGTH);
}

function eventData(input: SecurityEventInput): Prisma.SystemAuditEventCreateInput {
  return {
    organization: input.organizationId ? { connect: { id: input.organizationId } } : undefined,
    userId: input.userId,
    eventType: input.eventType,
    outcome: input.outcome,
    severity: input.severity ?? 'INFO',
    reasonCode: input.reasonCode,
    module: input.module,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    attributes: input.attributes ? sanitize(input.attributes) as Prisma.InputJsonValue : undefined,
    requestId: input.requestId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    occurredAt: input.occurredAt,
    schemaVersion: 1,
  };
}

export function appendSecurityEvent(tx: Prisma.TransactionClient, input: SecurityEventInput) {
  return tx.systemAuditEvent.create({ data: eventData(input) });
}

export function recordSecurityEvent(input: SecurityEventInput) {
  return prisma.systemAuditEvent.create({ data: eventData(input) });
}

export async function recordSecurityEventBestEffort(input: SecurityEventInput): Promise<void> {
  try {
    await recordSecurityEvent(input);
  } catch (error) {
    createLogger({ requestId: input.requestId, organizationId: input.organizationId, userId: input.userId, module: 'security-audit' })
      .error('security_event.write_failed', { eventType: input.eventType, error });
  }
}
