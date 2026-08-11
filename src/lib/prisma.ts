import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { validateDatabaseEnvironment } from '@/platform/config/env';
import { createLogger } from '@/platform/observability/logger';

// ============================================
// PRISMA 7 - Singleton con PG Adapter
// ============================================

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  const environment = validateDatabaseEnvironment(process.env);
  const pool = new Pool({
    connectionString: environment.DATABASE_URL,
    max: environment.DATABASE_POOL_MAX,
    idleTimeoutMillis: environment.DATABASE_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: environment.DATABASE_CONNECTION_TIMEOUT_MS,
  });
  pool.on('error', (error) => createLogger({ module: 'database' }).error('database.pool.error', { error }));

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
