import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import empleados from './data/empleados-cni.json';
import proveedores from './data/proveedores-cni.json';
import {
  seedCniMasterData,
  type EmpleadoSeedRecord,
  type ProveedorSeedRecord,
} from './lib/master-data-seed';

const dbUrl = new URL(process.env.DATABASE_URL || process.env.DIRECT_URL || '');
if (!dbUrl.hostname) {
  throw new Error('DATABASE_URL (o DIRECT_URL) es requerida para el seed de Railway.');
}

const pool = new Pool({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port || '5432', 10),
  database: dbUrl.pathname.slice(1),
  user: dbUrl.username,
  password: decodeURIComponent(dbUrl.password),
  ssl: dbUrl.searchParams.get('sslmode') === 'disable' ? false : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const isProduction = process.env.NODE_ENV === 'production';
  const allowProductionSeed = process.env.ALLOW_PRODUCTION_SEED === 'true';

  if (isProduction && !allowProductionSeed) {
    console.error('⚠️  Seed de Railway bloqueado en producción.');
    console.error('   Establece ALLOW_PRODUCTION_SEED=true para ejecutarlo en Railway.');
    process.exit(1);
  }

  console.log('🌱 Seed maestro CNI (proveedores + empleados)\n');
  console.log(`   Entorno: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`   Proveedores en archivo: ${proveedores.length}`);
  console.log(`   Empleados en archivo: ${empleados.length}\n`);

  const result = await seedCniMasterData(prisma, {
    proveedores: proveedores as ProveedorSeedRecord[],
    empleados: empleados as EmpleadoSeedRecord[],
  });

  const totalProveedores = await prisma.proveedor.count({
    where: { organizationId: result.organizationId, deletedAt: null },
  });
  const totalEmpleados = await prisma.employee.count({
    where: { organizationId: result.organizationId, isActive: true },
  });

  console.log('✅ Seed completado\n');
  console.log(`   Organización: ${result.organizationId}`);
  console.log(`   Proveedores → creados: ${result.proveedores.created}, actualizados: ${result.proveedores.updated}, omitidos: ${result.proveedores.skipped}`);
  console.log(`   Empleados   → creados: ${result.empleados.created}, actualizados: ${result.empleados.updated}, omitidos: ${result.empleados.skipped}`);
  console.log(`   Departamentos nuevos: ${result.departmentsCreated}`);
  console.log(`   Puestos nuevos:       ${result.positionsCreated}`);
  console.log(`   Total proveedores en BD: ${totalProveedores}`);
  console.log(`   Total empleados activos en BD: ${totalEmpleados}`);
}

main()
  .catch((error) => {
    console.error('❌ Error en seed Railway:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
