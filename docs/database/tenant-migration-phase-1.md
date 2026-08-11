# Phase 1 Tenant Migration

Migration `20260722210000_phase1_tenant_hardening` completes required ownership for the bounded Phase 1 modules.

## Deployment order

1. Back up the database and run `pnpm saas:check`.
2. Confirm exactly one active organization has slug `cni`.
3. Review duplicate non-empty supplier RTNs. The migration aborts rather than deleting or merging records.
4. Run `pnpm prisma migrate deploy` in the target environment.
5. Run `pnpm prisma generate`, `pnpm prisma validate`, and `pnpm saas:check`.
6. Exercise focused tenant tests before enabling traffic.

## Data behavior

- Existing CNI records are assigned using the organization selected by slug, not a hard-coded organization ID.
- Assignment ownership is derived from its equipment parent.
- Existing document numbers, historical snapshots, PDFs, Decimal values, discounts, and tax rates are unchanged.
- Blank supplier RTNs are normalized to `NULL`; duplicate non-empty RTNs block migration.
- Business identifiers become unique per organization for equipment, Oficios, active purchase orders, departments, cost centers, suppliers, and institutional audits.

## Rollback

Restore the pre-migration backup for data rollback. Do not manually drop ownership columns after writes from multiple organizations, because that would collapse uniqueness boundaries.
