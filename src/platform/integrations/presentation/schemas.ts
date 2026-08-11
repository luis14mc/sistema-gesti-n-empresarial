import { z } from 'zod';

export const INTEGRATION_PROVIDER_VALUES = [
  'MICROSOFT_ENTRA',
  'MICROSOFT_GRAPH',
  'MICROSOFT_SHAREPOINT',
  'MICROSOFT_TEAMS',
  'SMTP',
  'AWS_S3',
  'GENERIC_REST',
  'WEBHOOK',
] as const;

export const INTEGRATION_CAPABILITY_VALUES = [
  'IDENTITY_LOGIN',
  'USER_DIRECTORY_READ',
  'EMAIL_SEND',
  'CALENDAR_READ',
  'CALENDAR_WRITE',
  'TEAMS_NOTIFICATION',
  'SHAREPOINT_FILE_READ',
  'SHAREPOINT_FILE_WRITE',
  'OBJECT_STORAGE',
  'WEBHOOK_SEND',
  'WEBHOOK_RECEIVE',
  'ELECTRONIC_SIGNATURE',
] as const;

export const INTEGRATION_STATUS_VALUES = ['DRAFT', 'ACTIVE', 'DEGRADED', 'DISABLED', 'ERROR'] as const;

export const createIntegrationSchema = z.object({
  provider: z.enum(INTEGRATION_PROVIDER_VALUES),
  name: z.string().trim().min(2).max(120),
  capabilities: z.array(z.enum(INTEGRATION_CAPABILITY_VALUES)).min(1),
  publicConfig: z.record(z.string(), z.unknown()).optional().nullable(),
  secretPayload: z.record(z.string(), z.string().min(1).max(4096)).optional(),
});

export const updateIntegrationSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  capabilities: z.array(z.enum(INTEGRATION_CAPABILITY_VALUES)).min(1).optional(),
  publicConfig: z.record(z.string(), z.unknown()).optional().nullable(),
  status: z.enum(INTEGRATION_STATUS_VALUES).optional(),
});

export const rotateCredentialsSchema = z.object({
  secretPayload: z.record(z.string(), z.string().min(1).max(4096)),
});

export const setIntegrationStatusSchema = z.object({
  status: z.enum(INTEGRATION_STATUS_VALUES),
});

export const integrationsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  provider: z.enum(INTEGRATION_PROVIDER_VALUES).optional(),
  status: z.enum(INTEGRATION_STATUS_VALUES).optional(),
});

export const executionsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(['STARTED', 'SUCCESS', 'TRANSIENT_FAILURE', 'PERMANENT_FAILURE', 'CIRCUIT_OPEN', 'CANCELLED']).optional(),
});
