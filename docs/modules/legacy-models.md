# Legacy Models

The following areas are retained for historical compatibility and are not included in the Phase 1 tenant-safe boundary:

- `CompraSolicitud` and its item, attachment, and document models.
- `CompraOrdenLegacy` and its child models.
- `CompraSequence` and `CompraOrdenSequence`; new active numbering uses `DocumentSequence`.
- Attendance and promotional inventory models.

Legacy purchase data must remain read-only from tenant-aware active purchase workflows. New features must not add writes or expose these models to multiple organizations without first adding ownership, backfill, scoped access, and cross-tenant tests.

Global `User.departmentId` and `User.positionId` are also not a complete multi-organization personnel model. A future migration should move tenant-specific placement to membership or an organization employee profile.
