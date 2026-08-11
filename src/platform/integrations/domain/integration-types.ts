import type { IntegrationCapability, IntegrationStatus, IntegrationExecutionStatus } from '@prisma/client';

export { IntegrationCapability, IntegrationStatus, IntegrationExecutionStatus };

export const INTEGRATION_PROVIDERS = [
  'MICROSOFT_ENTRA',
  'MICROSOFT_GRAPH',
  'MICROSOFT_SHAREPOINT',
  'MICROSOFT_TEAMS',
  'SMTP',
  'AWS_S3',
  'GENERIC_REST',
  'WEBHOOK',
] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export function isIntegrationProvider(value: string): value is IntegrationProvider {
  return (INTEGRATION_PROVIDERS as readonly string[]).includes(value);
}

export const PROVIDER_LABELS: Readonly<Record<IntegrationProvider, string>> = Object.freeze({
  MICROSOFT_ENTRA: 'Microsoft Entra ID',
  MICROSOFT_GRAPH: 'Microsoft Graph',
  MICROSOFT_SHAREPOINT: 'SharePoint',
  MICROSOFT_TEAMS: 'Microsoft Teams',
  SMTP: 'SMTP / Email',
  AWS_S3: 'Amazon S3',
  GENERIC_REST: 'API REST genérica',
  WEBHOOK: 'Webhook saliente',
});

export const PROVIDER_CAPABILITIES: Readonly<Record<IntegrationProvider, readonly IntegrationCapability[]>> = Object.freeze({
  MICROSOFT_ENTRA: ['IDENTITY_LOGIN', 'USER_DIRECTORY_READ'],
  MICROSOFT_GRAPH: ['EMAIL_SEND', 'CALENDAR_READ', 'CALENDAR_WRITE', 'USER_DIRECTORY_READ', 'TEAMS_NOTIFICATION'],
  MICROSOFT_SHAREPOINT: ['SHAREPOINT_FILE_READ', 'SHAREPOINT_FILE_WRITE'],
  MICROSOFT_TEAMS: ['TEAMS_NOTIFICATION'],
  SMTP: ['EMAIL_SEND'],
  AWS_S3: ['OBJECT_STORAGE'],
  GENERIC_REST: ['WEBHOOK_SEND', 'WEBHOOK_RECEIVE'],
  WEBHOOK: ['WEBHOOK_SEND'],
});

export const PROVIDER_TIMEOUTS_MS: Readonly<Record<IntegrationProvider, Readonly<Record<string, number>>>>
  = Object.freeze({
    MICROSOFT_ENTRA: { test: 5_000, directory: 5_000, oauth: 10_000 },
    MICROSOFT_GRAPH: { test: 5_000, email: 10_000, calendar: 10_000, directory: 5_000 },
    MICROSOFT_SHAREPOINT: { test: 5_000, upload: 30_000, download: 30_000, list: 15_000 },
    MICROSOFT_TEAMS: { test: 5_000, notification: 10_000 },
    SMTP: { test: 5_000, email: 10_000 },
    AWS_S3: { test: 5_000, upload: 30_000, download: 30_000 },
    GENERIC_REST: { test: 5_000, call: 15_000, bulk: 60_000 },
    WEBHOOK: { test: 5_000, send: 10_000, bulk: 60_000 },
  });

export function getProviderTimeout(provider: IntegrationProvider, operation: string, fallbackMs = 10_000): number {
  return PROVIDER_TIMEOUTS_MS[provider]?.[operation] ?? fallbackMs;
}

export function isValidProviderCapability(provider: IntegrationProvider, capability: IntegrationCapability): boolean {
  return PROVIDER_CAPABILITIES[provider].includes(capability);
}

export const INTEGRATION_HEALTH = {
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  UNAVAILABLE: 'UNAVAILABLE',
  DISABLED: 'DISABLED',
  UNKNOWN: 'UNKNOWN',
} as const;
export type IntegrationHealth = (typeof INTEGRATION_HEALTH)[keyof typeof INTEGRATION_HEALTH];
