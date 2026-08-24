import { loadEnvFile } from 'node:process';
import ExcelJS from 'exceljs';

loadEnvFile();

const { prisma } = await import('@/lib/prisma');

const EXCEL_PATH = process.env.PROVEEDORES_XLSX ?? '/mnt/c/Users/sopor/Downloads/BD PROVEEDORES 2026.xlsx';
const DEFAULT_ORG_SLUG = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'cni';

const PLACEHOLDER_RTNS = new Set([
  '00000000000000',
  '0000000000000',
  '000000000000000',
]);

const normalizeRtn = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const digits = str.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length < 8 || digits.length > 15) return null;
  if (PLACEHOLDER_RTNS.has(digits)) return null;
  if (/^0+$/.test(digits)) return null;
  return digits;
};

const cleanName = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  const name = String(raw).trim().replace(/\s+/g, ' ');
  return name.length >= 2 ? name : null;
};

async function main() {
  const organization = await prisma.organization.findUnique({
    where: { slug: DEFAULT_ORG_SLUG },
    select: { id: true, name: true },
  });

  if (!organization) {
    throw new Error(`Organization with slug "${DEFAULT_ORG_SLUG}" not found. Run seed first.`);
  }

  console.log(`📂 Reading Excel: ${EXCEL_PATH}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Excel sheet not found');

  const records: Array<{ nombreRazonSocial: string; rtn: string | null }> = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rtnCell = row.getCell(2).value;
    const nameCell = row.getCell(3).value;
    const nombre = cleanName(nameCell);
    if (!nombre) return;
    records.push({ nombreRazonSocial: nombre, rtn: normalizeRtn(rtnCell) });
  });

  console.log(`📊 Filas válidas detectadas: ${records.length}`);

  if (process.env.CLEAR_EXISTING === 'true') {
    const { count } = await prisma.proveedor.deleteMany({
      where: {
        organizationId: organization.id,
        comprasSolicitudes: { none: {} },
        comprasOrdenes: { none: {} },
      },
    });
    console.log(`� Proveedores previos sin dependencias eliminados: ${count}`);
  }

  const existing = await prisma.proveedor.findMany({
    where: { organizationId: organization.id },
    select: { id: true, rtn: true, nombreRazonSocial: true },
  });
  const existingNames = new Map(existing.map((p) => [p.nombreRazonSocial.toLowerCase(), p]));
  const existingRtns = new Map(existing.filter((p) => p.rtn).map((p) => [p.rtn as string, p]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const record of records) {
    const nameKey = record.nombreRazonSocial.toLowerCase();
    const byName = existingNames.get(nameKey);
    if (byName) {
      if (record.rtn && !byName.rtn) {
        try {
          await prisma.proveedor.update({
            where: { id: byName.id },
            data: { rtn: record.rtn },
          });
          updated++;
        } catch (error) {
          console.warn(`�️  No se pudo actualizar RTN para "${record.nombreRazonSocial}":`, (error as Error).message);
          skipped++;
        }
      } else {
        skipped++;
      }
      continue;
    }
    if (record.rtn && existingRtns.has(record.rtn)) {
      skipped++;
      continue;
    }
    try {
      const created_row = await prisma.proveedor.create({
        data: {
          organizationId: organization.id,
          nombreRazonSocial: record.nombreRazonSocial,
          rtn: record.rtn,
          activo: true,
        },
      });
      created++;
      existingNames.set(nameKey, { id: created_row.id, rtn: record.rtn, nombreRazonSocial: record.nombreRazonSocial });
      if (record.rtn) existingRtns.set(record.rtn, { id: created_row.id, rtn: record.rtn, nombreRazonSocial: record.nombreRazonSocial });
    } catch (error) {
      console.warn(`⚠️  No se pudo crear "${record.nombreRazonSocial}":`, (error as Error).message);
      skipped++;
    }
  }

  console.log('\n✅ Importación completada');
  console.log(`   🟢 Creados:    ${created}`);
  console.log(`   🔵 Actualizados: ${updated}`);
  console.log(`   🟡 Omitidos:   ${skipped} (duplicados / sin cambios)`);
  console.log(`   📋 Total leídos: ${records.length}`);

  const totalDb = await prisma.proveedor.count({ where: { organizationId: organization.id } });
  console.log(`   🗄️  Total en BD para ${organization.name}: ${totalDb}`);
}

main()
  .catch((error) => {
    console.error('❌ Error en importación:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
