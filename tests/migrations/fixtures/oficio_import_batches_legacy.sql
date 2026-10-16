-- Legacy rows before organizationId exists on oficio_import_batches (pre-20261016120000).

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
SELECT
  'batch_fixture_membership',
  'HISTORICAL_IMPORT',
  'COMPLETED',
  0,
  1,
  0,
  0,
  m."userId",
  CURRENT_TIMESTAMP
FROM "organization_memberships" m
WHERE m."organizationId" = 'org_cni_default'
  AND m.status = 'ACTIVE'
LIMIT 1;

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
