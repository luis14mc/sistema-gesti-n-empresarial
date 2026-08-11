# Phase 9A — Secret reference abstraction

The application never stores provider credentials in plaintext, in
environment variables, or in `OrganizationIntegration.publicConfig`. The
`secretService` is the only entry point that materializes credentials for
adapter use, and it does so by reference.

## Reference grammar

```
secret:<env>:<key>
```

- `<env>` — `dev | prod` (extensible; `stage` etc. are accepted by the
  pattern but not used in 9A).
- `<key>` — `[A-Za-z0-9][A-Za-z0-9._:/+-]{0,127}`. The character class
  restricts the surface area so references can be safely logged, stored
  in URL query parameters, and embedded in audit attributes.

`secretService.buildReference(organizationId, integrationId)` always
returns `secret:prod:org-<organizationId>-int-<integrationId>`. The same
integration id in a different organization yields a different reference.

## Storage abstraction

```ts
interface SecretStore {
  read(reference: string): Promise<SecretValue>;
  rotate(reference: string, value: SecretValue): Promise<void>;
  delete(reference: string): Promise<void>;
  listReferences(prefix: string): Promise<readonly string[]>;
}
```

`SecretValue` is a `Readonly<Record<string, string>>`. Each value is
validated on `rotate`:

- Key matches `SECRET_KEY_PATTERN`.
- Value is a non-empty string ≤ 4096 characters.

References are validated on every operation via `normalizeSecretReference`.

## Adapters

| Adapter            | Status     | Notes                                                                                          |
| ------------------ | ---------- | ---------------------------------------------------------------------------------------------- |
| `inMemorySecretStore` | Shipped  | Development and test only. The map lives in-process. No persistence across restarts.          |
| AWS Secrets Manager | 9G       | Will replace the in-memory store in production. The interface is stable; only the adapter changes. |

`setSecretStore` swaps the active adapter at boot. Tests can substitute
their own implementation.

## What is stored in the database

`OrganizationIntegration.secretReference` holds the **reference** only.
The `publicConfig` JSON is validated by the Zod schemas in
`presentation/schemas.ts`; secret keys (anything starting with `secret`,
`password`, `token`, `apikey`, `api_key`, `client_secret`, `clientKey`,
`accessToken`, `refreshToken`, `privateKey`) are rejected by the schema.

## What is logged

- The reference itself (`secret:prod:org-org-1-int-int-1`) is safe to log
  and is recorded in `IntegrationExecution` and `SystemAuditEvent`.
- The values are never logged.
- The audit `attributes` object records the **length** of each secret
  key, not the name or the value. This lets operators correlate the
  shape of the payload without leaking the content.

## Rotation

`integrationConnectionService.rotateCredentials({ organizationId, integrationId, secretPayload, actorUserId, requestId })`
is the only mutation path. It:

1. Loads the integration to ensure it exists in the organization.
2. Calls `secretService.storeForIntegration` to overwrite the value.
3. Writes a `SystemAuditEvent` (`integration.credentials.rotated`) with the
   key lengths in `attributes`.
4. Returns the updated integration (with `secretReference` and a derived
   `lastSuccessfulAt` for observability).

Rotation never returns the resolved secret value to the caller.

## Future phases

- 9B — Microsoft Entra ID will store `clientId`, `clientSecret`,
  `tenantId`, and OAuth tokens under the same reference.
- 9C — Microsoft Graph will reuse the same reference for `EMAIL_SEND`
  and Teams notifications.
- 9D — Webhook secrets will be stored under
  `secret:prod:org-<orgId>-webhook-<webhookId>`.
- 9G — AWS Secrets Manager adapter and rotation policy.
