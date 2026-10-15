import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { flattenOfficialRolePermissions } from '@/platform/security/authorization/official-role-permissions';
import { DEFAULT_ORG_ID_FOR_ROLE_SEED } from '../../prisma/lib/role-permission-seed';

const organizationId = process.argv[2] ?? DEFAULT_ORG_ID_FOR_ROLE_SEED;

const dbUrl = new URL(process.env.DATABASE_URL || '');
const pool = new Pool({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port || '5432', 10),
  database: dbUrl.pathname.slice(1),
  user: dbUrl.username,
  password: decodeURIComponent(dbUrl.password),
  ssl: dbUrl.searchParams.get('sslmode') === 'require' ? { rejectUnauthorized: false } : undefined,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function key(role: string, permission: string) {
  return `${role}::${permission}`;
}

async function main() {
  const official = flattenOfficialRolePermissions();
  const officialKeys = new Set(official.map(({ role, permission }) => key(role, permission)));

  const rows = await prisma.rolePermission.findMany({
    where: { organizationId },
    select: { role: true, permission: true },
  });
  const dbKeys = new Set(rows.map((row) => key(row.role, row.permission)));

  const missingInDb = [...officialKeys].filter((entry) => !dbKeys.has(entry));
  const extraInDb = [...dbKeys].filter((entry) => !officialKeys.has(entry));

  if (missingInDb.length || extraInDb.length) {
    console.error(`❌ RolePermission mismatch for organization ${organizationId}`);
    if (missingInDb.length) {
      console.error('\nMissing in DB (expected from official template):');
      for (const entry of missingInDb.sort()) console.error(`  - ${entry}`);
    }
    if (extraInDb.length) {
      console.error('\nExtra in DB (not in official template):');
      for (const entry of extraInDb.sort()) console.error(`  - ${entry}`);
    }
    process.exit(1);
  }

  console.log(`✅ RolePermission table matches official template (${rows.length} rows, org ${organizationId})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
