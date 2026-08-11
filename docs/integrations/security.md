# Phase 9A — Integration security baseline

This document is the security baseline that every later integration
subphase (9B – 9G) must respect. It is enforced at the foundation level
in 9A; later subphases only add provider-specific details.

## 1. No plaintext credentials in the database

- `OrganizationIntegration.secretReference` is the only field that
  references a credential. The string contains the environment and the
  key, never the value.
- `publicConfig` is validated by Zod; the schema rejects keys that look
  like secrets (anything starting with `secret`, `password`, `token`,
  `apikey`, `api_key`, `client_secret`, `clientKey`, `accessToken`,
  `refreshToken`, `privateKey`).
- `secretService.rotate` enforces per-value length and pattern checks.

## 2. No plaintext credentials in logs

- `SystemAuditEvent` attributes are sanitised by
  `src/platform/security/audit/security-events.ts` (regex-based redaction
  for `authorization`, `cookie`, `credential`, `password`, `secret`,
  `token`, `private key`, `connection string`, `presigned url`).
- The integration `recordSecurityEvent` calls only include key lengths
  in `attributes`. They never include the value or the key name.
- The HTTP client redacts request and response headers
  (`authorization`, `x-api-key`, `cookie`, `set-cookie`) before they
  appear in the result or in the structured logs.
- The HTTP client caps the response body at 4 MB; the body is not
  logged by default.

## 3. No plaintext credentials in API responses

- The `GET /api/organizations/current/integrations` and `[id]` routes
  return `publicConfig` and a `hasSecret: boolean` flag. They never
  return the resolved value or the key map.
- `rotate-credentials` returns only the integration metadata and
  `lastSuccessfulAt`. The response never includes the new credentials.
- The notification dispatcher and webhook senders will use the same
  contract when they land in 8D / 9D.

## 4. Tenant isolation

- Every `OrganizationIntegration` row carries an `organizationId`. Every
  query in the integration layer includes the resolved
  `OrganizationContext.organizationId` in the `where` clause.
- `secretService.buildReference` includes `organizationId`; the same
  integration id in two organizations produces two distinct references
  and two distinct keys in the secret store.
- Circuit breakers are keyed per integration. A breaker that opens on
  one organization cannot starve another.

## 5. SSRF protection

`checkUrlForSsrf` and `assertUrlIsSafe` enforce:

- `https://` and `http://` only.
- No loopback (`localhost`, `127.0.0.0/8`, `::1`).
- No private IPv4 (`10/8`, `172.16/12`, `192.168/16`, `169.254/16`).
- No private IPv6 (`fc00::/7`, `fe80::/10`, `ff00::/8`).
- No link-local, no multicast, no cloud metadata addresses.
- Optional `allowedHostnames` allowlist for trusted internal services.

The guard runs **before** any network call. Outbound URLs that fail the
guard raise `IntegrationConnectionFailedError` (`errorCode: SSRF_BLOCKED`)
and never touch the network.

## 6. Timeouts and resource limits

- Every HTTP call has an explicit `timeoutMs` enforced via
  `AbortController`. Timeouts raise `IntegrationTimeoutError`.
- The response body is bounded at 4 MB (configurable per call).
- Redirects are followed manually (`redirect: 'manual'`) so the
  application can validate the final URL against the SSRF guard
  before consuming the body. (Full re-validation lands in 9D alongside
  the webhook framework.)

## 7. Retries and circuit breakers

- Transient failures (408, 425, 429, 5xx) retry with exponential
  backoff + jitter. Permanent failures (4xx other than 408/425/429)
  return immediately.
- The default `maxAttempts` is 3. Exhausted retries on 429 raise
  `IntegrationRateLimitedError`; exhausted retries on other transients
  return a structured failure.
- `CircuitBreaker` opens after 5 consecutive failures, stays open for
  30 s, and probes recovery in `HALF_OPEN`. A failure during
  `HALF_OPEN` reopens the breaker.
- `integrationCircuitBreakers` is keyed per `provider:integrationId`
  so that one organization cannot exhaust the breaker for another.

## 8. Permissions

- `integrations.create` is required to create an integration.
- `integrations.update` for changes.
- `integrations.enable` / `integrations.disable` to change status.
- `integrations.test` to test the connection.
- `integrations.rotate-credentials` to rotate secrets.
- `integrations.view-history` to read `IntegrationExecution`.
- `integrations.read` to list or inspect.

`OWNER` and `ADMIN` hold the full set. `IT_MANAGER` and `AUDITOR` hold
the read-only set. Other roles do not hold any `integrations.*`
permission, so they cannot reach the integration routes.

## 9. Audit trail

- Every successful or denied operation is recorded in `SystemAuditEvent`.
- The audit `attributes` only contain references and key lengths; no
  values.
- Denied requests (`integration.request.failed`) capture the
  `reasonCode` so operators can spot permission, configuration, and
  provider errors.

## 10. What 9A does **not** do

- It does not run any provider SDK. Modules that need a provider must
  wait for 9B / 9C / 9D.
- It does not open outbound webhooks.
- It does not accept inbound webhooks.
- It does not synchronize external directories.
- It does not implement HR / financial / signature adapters.
- It does not retain payload bodies beyond the 4 MB response cap.
