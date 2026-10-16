INSERT INTO "users" (
  "id",
  "email",
  "employeeNumber",
  "firstName",
  "lastName",
  "password",
  "role",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  'user_fixture_no_membership',
  'fixture-no-membership@example.test',
  'FIX-001',
  'Fixture',
  'User',
  'disabled',
  'USER',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
