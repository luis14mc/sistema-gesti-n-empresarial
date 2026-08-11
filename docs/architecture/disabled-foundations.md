# Disabled / Foundation-Only Capabilities

Capabilities whose code exists but which are **not operational** for the internal CNI release. They must never be presented to institutional users as delivered features. Each entry states the honest label and the pre-conditions to activate.

| Capability | Label | Runtime | UI/Nav | Activation pre-condition |
|------------|-------|---------|--------|--------------------------|
| Platform administration (`/api/platform/organizations/**`, org lifecycle) | FUTURE | to be disabled (14B) | none | CNI IT confirms a real need; technical-admin flag |
| Organization switching / provisioning / lifecycle UI | TECHNICAL_ADMIN_ONLY | internal only | none | multi-org requirement (not anticipated) |
| Organization limits / usage metering / quotas | ABSENT | not built | none | commercial model (out of scope) |
| Support access / impersonation (`SecuritySupportStatus`) | DISABLE | enum only | none | — (use normal authorized admin accounts; no impersonation) |
| Integration framework (`src/platform/integrations/**`, `OrganizationIntegration`, `IntegrationExecution`) | FOUNDATION_ONLY | to be disabled (14C) | none | a confirmed CNI integration + a specific adapter |
| Webhooks / external identity / inbound events | ABSENT | not built | none | — |
| `DomainEventOutbox` | FOUNDATION_ONLY / dormant | **no producers/consumers** | none | a genuine reliable-async requirement |
| Background async jobs | NOT_ENABLED_FOR_INITIAL_RELEASE | worker dormant, registry empty | none | a real long-running job + registered handler |
| Notifications (multi-channel) | FOUNDATION_ONLY | one caller (org-lifecycle) | none | a real institutional event + in-app center |
| Email channel | NOT_ENABLED_FOR_INITIAL_RELEASE | — | none | SMTP + a required notification |
| Institutional Audits (`/audits`) | DISABLED (pending 14F) | routes exist | not in nav | `audits` permission module + verified workflow |
| Maintenance UI (`/maintenance`) | INCOMPLETE | API exists, no page | not in nav | build page (14F) |
| `CompraSolicitud` / `CompraOrden*Legacy` | DEPRECATED / DEAD | read-only history | none | — (canonical = `CompraOrden`) |

**Technical controls that are NOT SaaS quotas and must remain:** upload size limits, export row limits, API rate limits, job concurrency limits.
