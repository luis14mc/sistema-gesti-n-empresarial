# Phase 9A — Provider registry

The integration registry is the single source of truth for supported
providers, their declared capabilities, and the timeout budget per
operation. Business modules never import provider SDKs directly; they
read metadata from `integrationRegistry` and call operations through
`IntegrationHttpClient` or the per-provider adapter (9B onward).

## Provider codes

| Code                  | Label               | Capabilities                                                              |
| --------------------- | ------------------- | ------------------------------------------------------------------------- |
| `MICROSOFT_ENTRA`     | Microsoft Entra ID  | `IDENTITY_LOGIN`, `USER_DIRECTORY_READ`                                   |
| `MICROSOFT_GRAPH`     | Microsoft Graph     | `EMAIL_SEND`, `CALENDAR_READ`, `CALENDAR_WRITE`, `USER_DIRECTORY_READ`, `TEAMS_NOTIFICATION` |
| `MICROSOFT_SHAREPOINT`| SharePoint          | `SHAREPOINT_FILE_READ`, `SHAREPOINT_FILE_WRITE`                           |
| `MICROSOFT_TEAMS`     | Microsoft Teams     | `TEAMS_NOTIFICATION`                                                      |
| `SMTP`                | SMTP / Email        | `EMAIL_SEND`                                                              |
| `AWS_S3`              | Amazon S3           | `OBJECT_STORAGE`                                                          |
| `GENERIC_REST`        | API REST genérica   | `WEBHOOK_SEND`, `WEBHOOK_RECEIVE`                                         |
| `WEBHOOK`             | Webhook saliente    | `WEBHOOK_SEND`                                                            |

## Default timeouts

| Provider              | Operation      | Default (ms) |
| --------------------- | -------------- | ------------ |
| `MICROSOFT_ENTRA`     | test           | 5_000        |
| `MICROSOFT_ENTRA`     | directory      | 5_000        |
| `MICROSOFT_ENTRA`     | oauth          | 10_000       |
| `MICROSOFT_GRAPH`     | test           | 5_000        |
| `MICROSOFT_GRAPH`     | email          | 10_000       |
| `MICROSOFT_GRAPH`     | calendar       | 10_000       |
| `MICROSOFT_GRAPH`     | directory      | 5_000        |
| `MICROSOFT_SHAREPOINT`| test           | 5_000        |
| `MICROSOFT_SHAREPOINT`| upload         | 30_000       |
| `MICROSOFT_SHAREPOINT`| download       | 30_000       |
| `MICROSOFT_SHAREPOINT`| list           | 15_000       |
| `MICROSOFT_TEAMS`     | test           | 5_000        |
| `MICROSOFT_TEAMS`     | notification   | 10_000       |
| `SMTP`                | test           | 5_000        |
| `SMTP`                | email          | 10_000       |
| `AWS_S3`              | test           | 5_000        |
| `AWS_S3`              | upload         | 30_000       |
| `AWS_S3`              | download       | 30_000       |
| `GENERIC_REST`        | test           | 5_000        |
| `GENERIC_REST`        | call           | 15_000       |
| `GENERIC_REST`        | bulk           | 60_000       |
| `WEBHOOK`             | test           | 5_000        |
| `WEBHOOK`             | send           | 10_000       |
| `WEBHOOK`             | bulk           | 60_000       |

Adapters may override these defaults at the call site via
`IntegrationHttpClient.request({ timeoutMs })`. They are not enforced
globally to keep 9A provider-agnostic.

## Capability assertions

`integrationRegistry.assertSupports(provider, capability)` is the canonical
gate. It throws if the provider does not declare the capability. Use it
in every adapter that needs to claim a capability for a specific
operation.

## Adding a new provider

1. Add the code to `INTEGRATION_PROVIDERS` in `domain/integration-types.ts`.
2. Add the label to `PROVIDER_LABELS`.
3. Add the capabilities to `PROVIDER_CAPABILITIES`.
4. Add the operation timeouts to `PROVIDER_TIMEOUTS_MS`.
5. Add a Zod enum entry to `presentation/schemas.ts` and any tests that
   enumerate providers.
6. Add a typed adapter under `infrastructure/<provider>/` in 9B – 9F.

## Removing a provider

Do not delete a provider code that is in use. Mark the integration as
`DISABLED` and keep the historical records. A future phase may add a
"deprecated" flag.

## Out of scope for 9A

- Microsoft-specific SDK imports.
- OAuth flows (lands in 9B with `MICROSOFT_ENTRA`).
- Webhook signing (lands in 9D).
- Sync conflict policies (lands in 9E).
