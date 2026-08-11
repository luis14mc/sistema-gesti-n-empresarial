# Legacy Workflows

## Active canonical

- Active purchase orders: `CompraOrden` and `/api/compras/ordenes`.
- Equipment disposal: explicit submit, approve, reject, and cancel commands.
- Equipment assignment: explicit assignment, swap, and return endpoints, pending Phase 3C application-service migration.

## Compatibility-only

- `CompraSolicitud` and `/api/compras/solicitudes` remain operational for historical compatibility.
- `CompraSequence` supports the compatibility purchase flow and is not tenant-aware.
- `AuditRecord` remains readable while new commands migrate to `SystemAuditEvent`.

## Deprecated

- `/api/purchases`, ticket, time-entry, and promotional-item legacy APIs return retirement responses where configured.
- `CompraOrdenSequence` and `CompraOrdenSequenceLegacy` have no confirmed active canonical usage.

## Scheduled for removal

No schema or endpoint is removed in Phase 3A. Removal requires usage confirmation, data-retention review, replacement coverage, and a separately reviewed migration.

Development code must not introduce new dependencies on compatibility-only models or legacy sequence allocators.
