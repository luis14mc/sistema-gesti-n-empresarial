# Phase 9A — Integration architecture (foundation)

Status: Phase 9A ships the foundation that every other integration
subphase (9B – 9G) will build on. No provider SDKs, no email transport,
no Microsoft Graph, no SharePoint, no webhooks are wired in 9A.

## Goals

1. Introduce a central integration layer under `src/platform/integrations/`
   that the rest of the application uses through narrow interfaces.
2. Persist per-organization integration configurations without ever
   storing raw credentials in the database.
3. Provide a generic HTTP client with timeout, abort, retry classification,
   response-size cap, structured logging, and SSRF guard.
4. Provide a provider-agnostic retry policy and circuit breaker that
   protect the application from repeated provider failures.
5. Establish the `integrations.*` permission namespace and the audit
   events that every later subphase will reuse.
6. Ensure the existing CNI workflows continue to work without any
   integration being configured.

## Non-goals for 9A

- No Microsoft Graph, Microsoft Entra ID, SharePoint, Teams, or OneDrive
  adapters (lands in 9B / 9C).
- No SMTP transport (lands with notifications 8D, referenced as a
  registered provider here only).
- No outbound webhook deliveries (lands in 9D).
- No inbound webhook framework (lands in 9D).
- No synchronization framework (lands in 9E).
- No HR / financial / signature providers (lands in 9F).
- No metrics, alerts, retention, or hardening (lands in 9G).
- No UI.

## Module layout

```
src/platform/integrations/
  domain/
    integration-types.ts        # provider catalog, capabilities, timeouts
    connection-status.ts        # health computation
    integration-errors.ts       # domain errors
  application/
    registry.ts                 # integrationRegistry (provider metadata)
    secret-service.ts           # secretService (references, no plaintext)
    ssrf-guard.ts               # checkUrlForSsrf / assertUrlIsSafe
    retry-policy.ts             # classifyFailure + shouldRetry
    circuit-breaker.ts          # CircuitBreaker + integrationCircuitBreakers
    http-client.ts              # IntegrationHttpClient
    execution-service.ts        # start / complete / record / list / health
    connection-service.ts       # CRUD + test + rotate
  infrastructure/
    secrets/
      types.ts                  # SecretStore + reference validation
      in-memory-store.ts        # dev-only store
  presentation/
    http.ts                     # runIntegrationRoute
    schemas.ts                  # zod schemas
```

## Data model

`OrganizationIntegration` (per organization)

| Field              | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `id`               | CUID                                                   |
| `organizationId`   | Tenant scope                                           |
| `provider`         | Provider code (`MICROSOFT_GRAPH`, `SMTP`, …)           |
| `name`             | Display name (unique per `(organizationId, provider)`)  |
| `status`           | `DRAFT \| ACTIVE \| DEGRADED \| DISABLED \| ERROR`     |
| `capabilities`     | `IntegrationCapability[]`                              |
| `publicConfig`     | Non-secret configuration (Json, validated)             |
| `secretReference`  | **Reference only** (`secret:prod:org-…-int-…`)         |
| `lastTestedAt`     | Last connection test                                   |
| `lastSuccessfulAt` | Last successful execution                              |
| `lastFailureAt`    | Last failed execution                                  |
| `lastErrorCode`    | Provider error code from the last failure              |
| `lastErrorMessage` | Provider error message (truncated)                     |
| `createdById`      | User who created the integration                       |
| `updatedById`      | User who last updated the integration                  |

`IntegrationExecution` (audit / observability of every operation)

| Field               | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `id`                | CUID                                          |
| `organizationId`    | Tenant scope                                  |
| `integrationId`     | FK with cascade delete                        |
| `operation`         | Operation code (e.g. `email.send`)            |
| `status`            | `STARTED \| SUCCESS \| TRANSIENT_FAILURE \| PERMANENT_FAILURE \| CIRCUIT_OPEN \| CANCELLED` |
| `entityType/entityId`| Optional business entity context             |
| `requestId`         | Originating request                           |
| `correlationId`     | Provider correlation id                       |
| `attempt`           | Attempt number (≥ 1)                          |
| `durationMs`        | Recorded on completion                        |
| `providerStatusCode`| HTTP / SDK status code                        |
| `errorCode/Message` | Failure classification                        |
| `startedAt`         | Auto-set                                      |
| `completedAt`       | Set on completion                             |

## Secret reference abstraction

```ts
type SecretValue = Readonly<Record<string, string>>;
interface SecretStore {
  read(reference: string): Promise<SecretValue>;
  rotate(reference: string, value: SecretValue): Promise<void>;
  delete(reference: string): Promise<void>;
  listReferences(prefix: string): Promise<readonly string[]>;
}
```

- References are always `secret:<env>:<key>`. `secretService.buildReference(orgId, integrationId)` returns a deterministic reference for the per-organization integration store.
- The in-memory store is the **development-only** adapter. Production must swap in a vault-backed store (AWS Secrets Manager, Parameter Store, HashiCorp Vault) — Phase 9G.
- The `secretService` redacts values in audit attributes; only key lengths are recorded.
- Plaintext credentials are **never** accepted in `publicConfig` (Zod schema is `z.string()` for `secretPayload`; the API response never returns the payload or the resolved value).

## Generic HTTP client

`IntegrationHttpClient.request(input)` returns either:

```ts
{ ok: true; status, headers, text, durationMs, attempt, url }
{ ok: false; status?, headers?, text?, durationMs, attempt, url, classification, errorCode, errorMessage }
```

Behavior:
- SSRF guard (`checkUrlForSsrf`) **before** any network call.
- Circuit breaker checked before each attempt (`integrationCircuitBreakers` registry, keyed by `${provider}:${integrationId}` or `${provider}:global`).
- Bounded `timeoutMs` enforced via `AbortController` + linked signal.
- Body size capped (default 4 MB); partial reads abort with a `Response body exceeded X bytes.` error.
- Sensitive request and response headers are redacted (`authorization`, `x-api-key`, `cookie`, `set-cookie`).
- Transients (408, 425, 429, 5xx) retry with exponential backoff + jitter; permanent statuses (4xx other than 408/425/429) return immediately.
- `429` with `Retry-After` is honoured as a transient; exhaustion raises `IntegrationRateLimitedError`.
- Timeouts raise `IntegrationTimeoutError` and update the circuit breaker.
- Connection failures return a structured failure without leaking provider internals.

## Retry policy

```ts
classifyFailure({ status, cause, message }): 'TRANSIENT' | 'PERMANENT' | 'UNKNOWN'
shouldRetry({ attempt, classification, policy }): { retry, reason, delayMs }
```

`DEFAULT_RETRY_POLICY = { maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 5_000, jitterRatio: 0.2 }`.

## Circuit breaker

```ts
class CircuitBreaker {
  recordSuccess(now)
  recordFailure(now)
  canExecute(now)
  snapshot(now)
}
```

States: `CLOSED → OPEN → HALF_OPEN → CLOSED` after `halfOpenSuccessThreshold` successes. `OPEN` rejects `canExecute()`. `failureThreshold` defaults to 5 consecutive failures; `openDurationMs` defaults to 30 s; `halfOpenSuccessThreshold` defaults to 2.

`integrationCircuitBreakers` is a process-local registry keyed by `provider:integrationId`.

## Health computation

`computeHealth({ status, circuitState, lastSuccessAt, lastFailureAt, recentSuccesses, recentFailures })`:

| Status       | Circuit | Recent failures rate | Health        |
| ------------ | ------- | ------------------- | ------------- |
| `DISABLED`   | *       | *                   | `UNAVAILABLE` |
| `DRAFT`      | *       | *                   | `UNKNOWN`     |
| `OPEN`       | OPEN    | *                   | `UNAVAILABLE` |
| any          | *       | ≥ 0.75              | `UNAVAILABLE` |
| any          | *       | ≥ 0.25              | `DEGRADED`    |
| `ACTIVE`     | CLOSED  | < 0.25              | `HEALTHY`     |

Counts cover the last 24 hours of `IntegrationExecution` rows. The health is recomputed on every `recordConnectionTest` and can be requested via the inspection API.

## Permissions

```
integrations.read
integrations.create
integrations.update
integrations.enable
integrations.disable
integrations.test
integrations.rotate-credentials
integrations.view-history
integrations.retry
webhooks.manage
```

- `OWNER`, `ADMIN` — full set via `ORGANIZATION_PERMISSIONS`.
- `IT_MANAGER` — `integrations.read`, `integrations.test`, `integrations.view-history`.
- `AUDITOR` — same as `IT_MANAGER`.
- Other roles — none in 9A. They never reach the integration routes.

## Audit events

| Event                              | Module       | Outcome    |
| ---------------------------------- | ------------ | ---------- |
| `integration.created`              | `integrations` | `SUCCESS` |
| `integration.updated`              | `integrations` | `SUCCESS` |
| `integration.enabled` / `.disabled` / `.status_changed` | `integrations` | `SUCCESS` / `WARNING` |
| `integration.connection.tested`    | `integrations` | `SUCCESS` / `FAILURE` |
| `integration.credentials.rotated`  | `integrations` | `SUCCESS` (WARNING) |
| `integration.secret.stored`        | `integrations` | `SUCCESS` |
| `integration.secret.read`          | `integrations` | `SUCCESS` |
| `integration.secret.deleted`       | `integrations` | `SUCCESS` (WARNING) |
| `integration.request.failed`       | `integrations` | `DENIED`  |

Secrets are **never** included in any attribute. Only the reference and key lengths appear in audit attributes.

## API surface (9A scope)

| Method | Path                                                              |
| ------ | ----------------------------------------------------------------- |
| GET    | `/api/organizations/current/integrations`                         |
| POST   | `/api/organizations/current/integrations`                         |
| GET    | `/api/organizations/current/integrations/[id]`                    |
| PATCH  | `/api/organizations/current/integrations/[id]`                    |
| POST   | `/api/organizations/current/integrations/[id]/test`               |
| POST   | `/api/organizations/current/integrations/[id]/enable`             |
| POST   | `/api/organizations/current/integrations/[id]/disable`            |
| POST   | `/api/organizations/current/integrations/[id]/rotate-credentials` |
| GET    | `/api/organizations/current/integrations/[id]/executions`         |

All endpoints require `OrganizationContext` and the matching `integrations.*`
permission. The inspection response never returns `secretPayload` or
`secretReference`. The `test` endpoint runs a 5-second guarded operation
and records the outcome in `IntegrationExecution`.

## Tenant-isolation invariants

- Every query filters by `organizationId` from the resolved
  `OrganizationContext`. Cross-tenant access returns `INTEGRATION_NOT_FOUND`.
- `secretService.buildReference` includes the `organizationId`; the same
  integration identifier in a different organization yields a different
  reference and a different key in the secret store.
- Provider credentials are not returned by any API. The `publicConfig` is
  validated and may not contain a `secret*` key.
- Circuit breakers are keyed per integration; opening the breaker on
  one organization cannot starve another.

## Outstanding risks

1. **No vault adapter.** The in-memory store is the only implementation
   today. A production deployment must register an AWS Secrets Manager
   adapter (9G).
2. **Worker is disabled.** Integration executions and the (future)
   outbox-driven retries depend on the worker; until the worker is
   implemented, all retries are handled in-band by the HTTP client.
3. **No provider SDKs are imported.** 9A is provider-agnostic. 9B – 9F
   introduce the Microsoft, SMTP, and webhook adapters.
4. **No UI.** The management screens for `/ajustes/integraciones*` are
   not part of 9A.
5. **CNI requires no integration** and continues to operate without any
   provider configuration.
