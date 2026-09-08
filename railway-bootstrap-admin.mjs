import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const enabled = process.env.BOOTSTRAP_ADMIN_ENABLED === 'true';
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!enabled) {
  console.log('[bootstrap-admin] Disabled; skipping admin bootstrap');
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error('[bootstrap-admin] ERROR: DATABASE_URL is required');
  process.exit(1);
}

if (!email || !password) {
  console.error('[bootstrap-admin] ERROR: BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required when bootstrap is enabled');
  process.exit(1);
}

if (password.length < 12) {
  console.error('[bootstrap-admin] ERROR: bootstrap password must contain at least 12 characters');
  process.exit(1);
}

const dbUrl = new URL(process.env.DATABASE_URL);
const pool = new Pool({
  host: dbUrl.hostname,
  port: Number.parseInt(dbUrl.port || '5432', 10),
  database: dbUrl.pathname.slice(1),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  ssl: dbUrl.hostname.endsWith('.railway.internal') ? false : { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

try {
  const organization = await prisma.organization.upsert({
    where: { slug: 'cni' },
    update: {
      name: 'Consejo Nacional de Inversiones',
      status: 'ACTIVE',
    },
    create: {
      id: process.env.DEFAULT_ORGANIZATION_ID || 'org_cni_default',
      name: process.env.DEFAULT_ORGANIZATION_NAME || 'Consejo Nacional de Inversiones',
      legalName: 'Consejo Nacional de Inversiones',
      slug: process.env.DEFAULT_ORGANIZATION_SLUG || 'cni',
      status: 'ACTIVE',
    },
  });

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: existing.id,
        },
      },
      update: { role: 'ADMIN', status: 'ACTIVE' },
      create: {
        organizationId: organization.id,
        userId: existing.id,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    if (existing.role !== 'ADMIN' || !existing.isActive) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'ADMIN', isActive: true },
      });
    }

    console.log(`[bootstrap-admin] Admin already exists (${email}); membership/role verified. Password was not changed.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        employeeNumber: process.env.BOOTSTRAP_ADMIN_EMPLOYEE_NUMBER || 'CNI-IT-ADMIN',
        email,
        password: passwordHash,
        firstName: process.env.BOOTSTRAP_ADMIN_FIRST_NAME || 'Soporte',
        lastName: process.env.BOOTSTRAP_ADMIN_LAST_NAME || 'IT',
        role: 'ADMIN',
        isActive: true,
      },
    });

    await tx.organizationMembership.create({
      data: {
        organizationId: organization.id,
        userId: created.id,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    return created;
  });

  console.log(`[bootstrap-admin] Admin created successfully: ${user.email}`);
} catch (error) {
  console.error('[bootstrap-admin] ERROR:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await pool.end();
}
