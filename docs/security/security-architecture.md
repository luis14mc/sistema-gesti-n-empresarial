# Security architecture

## Status and scope

This document records the Phase 6A identity and authorization foundation. It is evidence of implemented controls, not a claim that Phase 6 or any external compliance standard is complete.

Implemented in 6A:

- Tagged organization and platform authorization scopes
- Central capability map and explicit role mappings
- Service-level enforcement for reporting, equipment disposal, and audit-log queries
- Separate optional platform identity role with no implicit legacy promotion
- Append-only security events protected against update, delete, and truncate
- Redaction of credential-shaped security-event attributes
- Tenant-context and permission-denial events
- Immutable events for disposal changes, report export requests, and audit-log reads

Deferred to controlled later subphases:

- 6B: persisted sessions, revocation, password reset, invitations, distributed login throttling, security UI
- 6C: TOTP, recovery codes, MFA policy, step-up authentication
- 6D: CSRF, Origin/CORS enforcement, headers, CSP review, rate limits, systematic mass-assignment and IDOR conversion
- 6E: magic-byte validation, quarantine, malware scanning, checksums, key-only storage, secure delivery
- 6F: classification, retention, privacy workflows, closure, controlled support access, OWASP evidence
- 6G: security dashboard, alert routing, full regression and penetration-test preparation

## Preliminary threat inventory

| Threat | Current evidence | Status | Required owner |
| --- | --- | --- | --- |
| Global-role and membership-role confusion | Legacy routes use JWT `User.role` after tenant selection | Partially mitigated in converted services | 6A continuation / module owners |
| Deactivated user with existing API token | `withAuth()` trusts JWT claims on routes without organization context | Open | 6B |
| Token revocation and logout everywhere | No persisted session or token version | Open | 6B |
| Credential stuffing | Main Server Action login bypasses process-local API limiter | Open, high | 6B |
| JavaScript-readable token | Legacy API/Zustand flow stores JWT in local storage and a readable cookie | Open, high | 6B |
| Missing password reset and invitation lifecycle | No secure single-use token models | Open | 6B |
| CSRF and unexpected Origin | Cookie-authenticated writes have no centralized Origin/CSRF check | Open | 6D |
| Inert CORS configuration | `CORS_ORIGINS` is parsed but not enforced | Open | 6D |
| Route-only authorization | Many legacy services can be called without capabilities | Open outside converted services | 6A continuation |
| Cross-tenant legacy data | Employees and legacy purchase requests lack complete tenant ownership | Open, critical | Schema decision before 6D/6E |
| Mass assignment | Several legacy routes accept workflow/status/reference fields directly | Open | 6D |
| Public or bearer document URLs | Local storage and persisted S3 URLs bypass durable authorization | Open, high | 6E |
| MIME spoofing and active uploads | Upload validation trusts filename and browser MIME; no signature scan | Open, high | 6E |
| Audit tampering | `SystemAuditEvent` is append-only; legacy `AuditRecord` is mutable | Partial | 6A/6F |
| Secret leakage in audit metadata | New security-event path redacts sensitive keys; legacy logs do not | Partial | 6F |
| Dependency vulnerabilities | Next/Prisma updated and patched transitive versions pinned | Mitigated; continuously monitored | DevSecOps |

## Identity architecture

`User` owns credentials and account activation. A nullable `platformRole` represents true platform responsibilities. Tenant authority exists only in `OrganizationMembership.role`, allowing one user to hold different roles in different organizations without changing any other membership.

The legacy `User.role` remains because persisted workflows and UI still consume it. It is explicitly excluded from the new authorization API. The tagged `ScopedRole` input makes passing a raw role string fail closed at runtime and at compile time.

## Authorization architecture

The capability source of truth is `src/platform/security/authorization/permissions.ts`.

- `can(scopedRole, permission)` returns a policy decision without side effects.
- `requirePermission(context, permission)` accepts only a tagged organization or platform context.
- Organization capability decisions use the active membership role.
- Platform capabilities use only `User.platformRole` through `getPlatformIdentity()`.
- There is no platform-to-tenant bypass.

The role matrix is documented in `authorization-matrix.md`. Capability checks do not replace tenant predicates, entity ownership checks, state-transition rules, or input validation.

## Security audit architecture

`SystemAuditEvent` is the canonical immutable security-event store. Phase 6A adds event type, outcome, severity, reason code, sanitized attributes, occurrence time, and schema version. Organization and entity IDs are nullable to support pre-authentication and platform-scoped events without assigning them to an arbitrary tenant.

Database triggers reject `UPDATE`, `DELETE`, and `TRUNCATE`. Application code uses `appendSecurityEvent()` inside a caller transaction or `recordSecurityEventBestEffort()` for failed/denied operations where the protected operation cannot be rolled back.

Restrictions:

- Do not log passwords, hashes, cookies, authorization headers, tokens, secrets, private keys, connection strings, or presigned URLs.
- Do not copy complete request bodies or unrestricted business snapshots into security events.
- Tenant events must receive `organizationId` from trusted server context.
- Pre-authentication events remain platform-scoped with `organizationId = null`.
- Normal users cannot write, update, or delete events through an API.

Remaining database risk: the migration owner can still alter triggers, and runtime/migration database-role separation is not yet represented in deployment configuration. External immutable retention is deferred.

## Supply-chain control

Phase 6A upgrades Next.js and Prisma to patched versions, pins vulnerable transitives to published fixed versions, and adds a production dependency audit to CI. `pnpm audit --prod --audit-level high` is a blocking CI gate. CodeQL, secret scanning, dependency review, container scanning, and IaC scanning remain explicit later DevSecOps work rather than claimed controls.
