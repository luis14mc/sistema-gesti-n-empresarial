-- Legacy rows before organizationId exists on oficio_import_batches (pre-20261016120000).

-- A fresh migrated DB has no memberships, so create a user with an ACTIVE membership
-- in org_cni_default explicitly (the backfill must resolve it via organization_memberships).
INSERT INTO "users" (
  "id", "email", "employeeNumber", "firstName", "lastName", "password", "role", "isActive", "createdAt", "updatedAt"
)
VALUES (
  'user_fixture_with_membership', 'fixture-membership@example.test', 'FIX-002',
  'Fixture', 'Member', 'disabled', 'USER', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "organization_memberships" ("id", "organizationId", "userId", "role", "status", "createdAt", "updatedAt")
VALUES (
  'membership_fixture_cni', 'org_cni_default', 'user_fixture_with_membership',
  'USER', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("organizationId", "userId") DO NOTHING;

INSERT INTO "oficio_import_batches" (
  "id",
  "source",
  "status",
  "totalFiles",
  "imported",
  "skipped",
  "errors",
  "performedById",
  "startedAt"
)
VALUES (
  'batch_fixture_membership',
  'HISTORICAL_IMPORT',
  'COMPLETED',
  0,
  1,
  0,
  0,
  'user_fixture_with_membership',
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

INSERT INTO "oficio_import_batches" (
  "id",
  "source",
  "status",
  "totalFiles",
  "imported",
  "skipped",
  "errors",
  "performedById",
  "startedAt"
)
VALUES (
  'batch_fixture_orphan',
  'HISTORICAL_IMPORT',
  'COMPLETED',
  0,
  0,
  0,
  0,
  'user_fixture_no_membership',
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;
