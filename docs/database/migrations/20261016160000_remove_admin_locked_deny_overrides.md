# 20261016160000_remove_admin_locked_deny_overrides

## Purpose

Removes invalid `user_permission_overrides` rows where:

- `effect = 'DENY'`
- `permission` is one of the locked Super Admin capabilities (`users.*`, `roles.manage`)
- the user has an **active** `OWNER` or `ADMIN` membership in the same organization

These DENY rows could hide **Roles y permisos** from an admin despite role locks.

## Runtime log

During `prisma migrate deploy`, Postgres emits:

`NOTICE: remove_admin_locked_deny_overrides: N row(s) matched for deletion`

where `N` is the count selected immediately before the delete (same predicate).

## Reversal

Re-creating DENY overrides manually would reintroduce the bug; no schema rollback is required.
