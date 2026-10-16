-- Remove DENY overrides on locked admin permissions (users.*, roles.manage)
-- for users with OWNER/ADMIN membership. Safe to re-run (idempotent DELETE).

DO $$
DECLARE
  rows_to_delete integer;
BEGIN
  SELECT COUNT(*) INTO rows_to_delete
  FROM "user_permission_overrides" uo
  INNER JOIN "organization_memberships" om
    ON om."organizationId" = uo."organizationId"
   AND om."userId" = uo."userId"
   AND om."status" = 'ACTIVE'
   AND om."role" IN ('OWNER', 'ADMIN')
  WHERE uo."effect" = 'DENY'
    AND uo."permission" IN (
      'users.read',
      'users.create',
      'users.update',
      'users.deactivate',
      'roles.manage'
    );

  RAISE NOTICE 'remove_admin_locked_deny_overrides: % row(s) matched for deletion', rows_to_delete;

  DELETE FROM "user_permission_overrides" uo
  USING "organization_memberships" om
  WHERE om."organizationId" = uo."organizationId"
    AND om."userId" = uo."userId"
    AND om."status" = 'ACTIVE'
    AND om."role" IN ('OWNER', 'ADMIN')
    AND uo."effect" = 'DENY'
    AND uo."permission" IN (
      'users.read',
      'users.create',
      'users.update',
      'users.deactivate',
      'roles.manage'
    );
END $$;
