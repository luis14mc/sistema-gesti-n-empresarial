# Phase 8A — Notifications architecture (foundation)

Status: Phase 8A establishes the notification domain, the dispatcher, the
delivery-attempt model, the rule catalog, the idempotency contract, and the
in-app API. Email transport, templates, reminders, and digests are
scheduled for Phases 8B–8G.

## Goals

1. Centralize every notification decision in `src/modules/notifications/`.
2. Make notifications tenant-scoped and permission-aware.
3. Guarantee that the same domain event never produces duplicate notifications.
4. Persist every delivery attempt for audit and retry.
5. Treat the existing `DomainEventOutbox` and the `SystemAuditEvent` table as
   the source of truth for asynchronous fan-out and audit.
6. Keep email out of the request path: in-app delivery is written inside the
   domain transaction; email is left in `PENDING` state until Phase 8D
   provides a job.

## Non-goals for 8A

- No email provider, no SMTP transport, no templates.
- No UI notification center (lands in 8B).
- No user preferences (lands in 8C).
- No reminders or digests (lands in 8E).
- No module-level integration outside the organization lifecycle (lands in 8F).

## Flow

```text
Domain command (e.g. organization lifecycle)
        |
        v
notificationDispatcher.dispatch(input)
        |
        |--- resolveRecipients(organizationId, rule.recipients)
        |          |
        |          v
        |     OrganizationMembership (status=ACTIVE, role in rule)
        |
        |--- for each (recipient, channel)
        |       |
        |       v
        |   Notification.create({
        |       idempotencyKey = sha256(organizationId|eventType|aggregateId|recipientId|channel|eventId),
        |       ...
        |   })
        |       |
        |       v
        |   NotificationDelivery.create({ status: SENT | PENDING, ... })
        |
        v
SystemAuditEvent (notification.dispatch.<eventType>)
```

The dispatcher is the only place that decides recipients, channels, and
content. Domain services never instantiate notifications, call email
providers, or write to `Notification` directly.

## Data model

`Notification`
- `organizationId`, `userId` (nullable for org-wide broadcasts)
- `eventType`, `channel` (IN_APP, EMAIL)
- `status` (PENDING | PROCESSING | SENT | FAILED | CANCELLED)
- `title`, `body`, `actionUrl` (validated internal path)
- `idempotencyKey` (unique together with `organizationId`)
- `readAt`, `sentAt`, `failedAt`, `deliveredAt`, `cancelledAt`
- timestamps + metadata JSON

`NotificationDelivery`
- `notificationId` (FK with cascade delete)
- `channel`, `destination`, `provider`, `status`, `attempt`
- `providerId`, `errorCode`, `errorMessage`
- `startedAt`, `completedAt`, `createdAt`

## Idempotency

`idempotencyKey = "<eventType>:<channel>:<sha256-prefix>"` where the hash
covers `organizationId | eventType | aggregateId | recipientId | channel |
eventId`. The `@@unique([organizationId, idempotencyKey])` constraint turns
duplicate inserts into a `P2002` violation that the dispatcher converts
into a `deduped: 1` counter and a `SKIPPED` delivery entry. Replays of an
outbox event therefore never produce a duplicate `Notification` row.

## Mandatory events

`organization.lifecycle.suspended`, `organization.lifecycle.archived`, and
`organization.lifecycle.closure_requested` are flagged `mandatory: true`
in the rule catalog. Mandatory events always reach the recipient on the
`IN_APP` channel — preference suppression and channel disabling will not
apply (enforced in 8C).

## Channels

`IN_APP` is fully implemented in 8A. The notification row is written
`status=SENT` with a corresponding `NotificationDelivery` row
`status=SENT`. The audit row `notification.created.in_app` is appended
inside the same transaction when the dispatcher runs in a transaction.

`EMAIL` is **registered** in the rule catalog but the dispatcher
deliberately filters it out in 8A (`isChannelSupportedInPhase('EMAIL',
'8A') === false`). The rows are not written; Phase 8D will introduce the
provider abstraction and a background job that materializes `EMAIL`
notifications from outbox / dispatcher events. This keeps the spec
invariant — *"Do not send email directly from domain services"* — and the
*Module integration* requirement from §30.

## Recipient resolution

`resolveRecipients(organizationId, recipients, options)` is the only
entry point. It always queries `OrganizationMembership` with
`status: 'ACTIVE'` and an explicit `organizationId` predicate. Cross-tenant
recipients are physically unreachable because the predicate is mandatory.

Helpers:
- `resolveOrganizationOwners`
- `resolveOrganizationAdmins`
- `resolveRecipients(organizationId, [{kind: 'organization-role', role}, {kind: 'specific-users', userIds}])`

## Audit

Every dispatch writes a `SystemAuditEvent` with:
- `eventType = 'notification.dispatch.<eventType>'`
- `module = 'notifications'`
- `entityType = 'Notification'`, `entityId = aggregateId`
- `attributes = { channels, attemptedRecipients, created, deduped, mandatory }`

Successful per-row delivery also writes
`notification.created.in_app` (or `notification.created.email` once 8D
lands) when the dispatcher runs inside a transaction.

## API (8A scope)

| Method | Path | Notes |
| --- | --- | --- |
| `GET`  | `/api/notifications` | Paginated list, scoped to the current user/org. |
| `GET`  | `/api/notifications/unread-count` | Tenant- and user-scoped unread count. |
| `POST` | `/api/notifications/[id]/read` | Marks one notification as read; rejects cross-user and cross-org access. |
| `POST` | `/api/notifications/read-all` | Marks all unread notifications for the current user/org. |

Every endpoint requires `OrganizationContext` and the
`notifications.read` permission. UI components must call the same
endpoints and never construct notifications client-side.

## Tenant-isolation invariants

- All queries filter by `organizationId` from the resolved
  `OrganizationContext`.
- `markRead` loads the notification inside a `findFirst` with
  `organizationId = context.organizationId`. Cross-org access returns
  `NOTIFICATION_NOT_FOUND`, never the foreign row.
- `markRead` enforces ownership: notifications addressed to a specific
  user cannot be read by another user; org-wide broadcasts
  (`userId = null`) can be read by anyone in the org.
- Recipient resolution joins `OrganizationMembership` with the active
  organization; cross-tenant membership rows are not loaded.

## Permissions

- `notifications.read` — granted to every organization role.
- `notifications.manage-own-preferences` — granted to OWNER, ADMIN, and
  IT_MANAGER. Wired in 8C.
- `notifications.manage-organization-settings` — granted to OWNER and
  ADMIN. Wired in 8C.
- `notifications.retry-failed` — granted to OWNER and ADMIN. Wired in 8D.
- `notifications.view-deliveries` — granted to OWNER and ADMIN. Wired in 8D.

## Event sources (8A)

- Organization lifecycle (suspend, reactivate, archive, request closure).
  The lifecycle service calls the dispatcher after the transactional
  update commits. Failure of the dispatcher is logged but does not
  roll back the lifecycle change — by design, because the audit event
  is the source of truth and a missed notification can be regenerated
  from the audit event in 8G.

## Module integration roadmap

- 8B — UI notification center, unread badge, read/unread UX, pagination.
- 8C — User preferences and organization defaults; mandatory events
  become non-suppressible.
- 8D — Email provider abstraction (`EmailProvider`), template registry,
  branding, retry policy, dead-letter handling.
- 8E — Scheduled reminders and digest jobs (idempotent per period).
- 8F — Module integration (purchases, equipment, disposal, oficios,
  reports, security).
- 8G — Metrics, dead-letter operations UI, retention, hardening.

## Outstanding risks

1. **Email transport absent.** Email-channel rules in 8A are not
   materialized; the dispatcher is intentionally phase-gated. 8D is
   mandatory before any mandatory event (suspension, archival, closure)
   can rely on email delivery.
2. **Worker still disabled.** The outbox producer/consumer
   infrastructure is not yet operational; the dispatcher is invoked
   synchronously from the domain service. Idempotency makes the future
   move to an outbox consumer safe.
3. **No notification UI yet.** In-app notifications are persisted but
   not visible in the app shell. This is the first item on the 8B
   checklist.
4. **Module coverage limited to lifecycle.** Purchase orders,
   equipment, disposal, oficios, reports, and security events are not
   yet wired; they remain audit-only.
