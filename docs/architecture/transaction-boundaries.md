# Transaction Boundaries

Every command defines one consistency boundary. Aggregate changes, child history, immutable audit events, and outbox events must use the same Prisma transaction client.

Optimistic updates predicate on `id`, `organizationId`, expected status, and expected version, then increment version atomically. A count other than one maps to `CONCURRENT_MODIFICATION`.

Serializable transactions may use `withTransactionRetry` only for Prisma `P2034` conflicts. Retried callbacks must be safe to repeat and must not contain storage, Puppeteer, email, or other external side effects.

External document workflow:

1. Validate domain state.
2. Render and store using a unique temporary/final key.
3. Execute a short database transaction.
4. Remove the stored object if persistence fails.
5. Record cleanup failure for retry rather than silently discarding it.

Module migrations must document their exact boundary and compensation behavior before implementation.
