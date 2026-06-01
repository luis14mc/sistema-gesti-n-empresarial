import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// ============================================
// PRISMA 7 - Singleton con PG Adapter
// ============================================

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Validar que DATABASE_URL existe
if (!process.env.DATABASE_URL) {
  console.error(
    '\x1b[31m[Prisma] ❌ DATABASE_URL no está definida en .env\x1b[0m'
  );
}

function createPrismaClient(): PrismaClient {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
