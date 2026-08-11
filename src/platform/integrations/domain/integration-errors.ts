import type { IntegrationProvider } from './integration-types';

export class IntegrationNotFoundError extends Error {
  readonly name = 'IntegrationNotFoundError';
  readonly code = 'INTEGRATION_NOT_FOUND';
  readonly status = 404;
  readonly details: Readonly<{ integrationId: string; organizationId: string }>;
  constructor(integrationId: string, organizationId: string) {
    super(`Integration ${integrationId} not found in organization ${organizationId}.`);
    this.details = Object.freeze({ integrationId, organizationId });
  }
}

export class IntegrationNotEnabledError extends Error {
  readonly name = 'IntegrationNotEnabledError';
  readonly code = 'INTEGRATION_NOT_ENABLED';
  readonly status = 409;
  readonly details: Readonly<{ integrationId: string; status: string }>;
  constructor(integrationId: string, status: string) {
    super(`Integration ${integrationId} is not enabled (current status: ${status}).`);
    this.details = Object.freeze({ integrationId, status });
  }
}

export class IntegrationConfigurationInvalidError extends Error {
  readonly name = 'IntegrationConfigurationInvalidError';
  readonly code = 'INTEGRATION_CONFIGURATION_INVALID';
  readonly status = 422;
  readonly details: Readonly<{ provider: IntegrationProvider; reason: string }>;
  constructor(provider: IntegrationProvider, reason: string) {
    super(`Configuration for provider ${provider} is invalid: ${reason}`);
    this.details = Object.freeze({ provider, reason });
  }
}

export class IntegrationPermissionDeniedError extends Error {
  readonly name = 'IntegrationPermissionDeniedError';
  readonly code = 'INTEGRATION_PERMISSION_DENIED';
  readonly status = 403;
  readonly details: Readonly<{ provider?: IntegrationProvider }>;
  constructor(provider?: IntegrationProvider) {
    super('The current user lacks permission to manage integrations.');
    this.details = Object.freeze(provider ? { provider } : {});
  }
}

export class IntegrationCredentialExpiredError extends Error {
  readonly name = 'IntegrationCredentialExpiredError';
  readonly code = 'INTEGRATION_CREDENTIAL_EXPIRED';
  readonly status = 409;
  readonly details: Readonly<{ integrationId: string }>;
  constructor(integrationId: string) {
    super(`Credentials for integration ${integrationId} have expired.`);
    this.details = Object.freeze({ integrationId });
  }
}

export class IntegrationSecretReferenceError extends Error {
  readonly name = 'IntegrationSecretReferenceError';
  readonly code = 'INTEGRATION_SECRET_REFERENCE_INVALID';
  readonly status = 422;
  readonly details: Readonly<{ reference?: string; reason: string }>;
  constructor(reason: string, reference?: string) {
    super(reference ? `Secret reference ${reference} is invalid: ${reason}` : reason);
    this.details = Object.freeze({ reference, reason });
  }
}

export class IntegrationConnectionFailedError extends Error {
  readonly name = 'IntegrationConnectionFailedError';
  readonly code = 'INTEGRATION_CONNECTION_FAILED';
  readonly status = 502;
  readonly details: Readonly<{ provider: IntegrationProvider; errorCode?: string; errorMessage?: string }>;
  constructor(provider: IntegrationProvider, errorCode?: string, errorMessage?: string) {
    super(`Connection to ${provider} failed${errorCode ? ` (${errorCode})` : ''}.`);
    this.details = Object.freeze({
      provider,
      ...(errorCode ? { errorCode } : {}),
      ...(errorMessage ? { errorMessage } : {}),
    });
  }
}

export class IntegrationTimeoutError extends Error {
  readonly name = 'IntegrationTimeoutError';
  readonly code = 'INTEGRATION_TIMEOUT';
  readonly status = 504;
  readonly details: Readonly<{ provider: IntegrationProvider; timeoutMs: number }>;
  constructor(provider: IntegrationProvider, timeoutMs: number) {
    super(`Operation against ${provider} timed out after ${timeoutMs}ms.`);
    this.details = Object.freeze({ provider, timeoutMs });
  }
}

export class IntegrationRateLimitedError extends Error {
  readonly name = 'IntegrationRateLimitedError';
  readonly code = 'INTEGRATION_RATE_LIMITED';
  readonly status = 429;
  readonly details: Readonly<{ provider: IntegrationProvider; retryAfterMs?: number }>;
  constructor(provider: IntegrationProvider, retryAfterMs?: number) {
    super(`Provider ${provider} is rate-limiting the current request.`);
    this.details = Object.freeze({
      provider,
      ...(retryAfterMs ? { retryAfterMs } : {}),
    });
  }
}

export class IntegrationCircuitOpenError extends Error {
  readonly name = 'IntegrationCircuitOpenError';
  readonly code = 'INTEGRATION_CIRCUIT_OPEN';
  readonly status = 503;
  readonly details: Readonly<{ provider: IntegrationProvider; openedAt: Date }>;
  constructor(provider: IntegrationProvider, openedAt: Date) {
    super(`Circuit breaker for ${provider} is open.`);
    this.details = Object.freeze({ provider, openedAt });
  }
}

export function isIntegrationDomainError(error: unknown): boolean {
  return error instanceof Error && [
    IntegrationNotFoundError,
    IntegrationNotEnabledError,
    IntegrationConfigurationInvalidError,
    IntegrationPermissionDeniedError,
    IntegrationCredentialExpiredError,
    IntegrationSecretReferenceError,
    IntegrationConnectionFailedError,
    IntegrationTimeoutError,
    IntegrationRateLimitedError,
    IntegrationCircuitOpenError,
  ].some((ctor) => error instanceof ctor);
}
