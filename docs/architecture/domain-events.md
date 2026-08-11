# Domain Events

`DomainEventOutbox` is the outbox-ready integration boundary. Events are inserted in the same transaction as the aggregate change and are unique by organization, aggregate, aggregate version, and event type.

Required event data:

- Organization and aggregate identity.
- Aggregate version.
- Stable event type.
- Versioned JSON payload.
- Optional correlation metadata.
- Occurrence and processing state.

`appendOutboxEvent` treats a duplicate event identity as idempotent and returns the existing event. Initial processing may remain synchronous. Redis or an external queue is not required.

`SystemAuditEvent` is a separate append-only compliance record. Database triggers reject update, delete, and truncate operations. Institutional `Audit` records remain editable business aggregates and must not be confused with system events.
