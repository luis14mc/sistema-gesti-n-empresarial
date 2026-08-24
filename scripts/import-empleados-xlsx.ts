import { loadEnvFile } from 'node:process';
import ExcelJS from 'exceljs';

loadEnvFile();

const { prisma } = await import('@/lib/prisma');

const EXCEL_PATH = process.env.EMPLEADOS_XLSX ?? '/mnt/c/Users/sopor/Downloads/Plantilla_Importacion_Empleados.xlsx';
const DEFAULT_ORG_SLUG = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'cni';

type Row = {
  email: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  departmentName: string;
  positionName: string;
  hireDate: Date | null;
  esJefe: boolean;
  esDirector: boolean;
};

const norm = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    const obj = v as { text?: unknown; result?: unknown; value?: unknown };
    const inner = obj.text ?? obj.result ?? obj.value ?? '';
    return String(inner).trim().replace(/\s+/g, ' ');
  }
  return String(v).trim().replace(/\s+/g, ' ');
};

const parseBool = (v: unknown): boolean => {
  const s = norm(v).toLowerCase();
  return s === 'si' || s === 'sí' || s === 'yes' || s === 'true' || s === '1';
};

const parseDate = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const str = String(v).trim();
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
};

async function main() {
  const organization = await prisma.organization.findUnique({
    where: { slug: DEFAULT_ORG_SLUG },
    select: { id: true, name: true },
  });
  if (!organization) {
    throw new Error(`Organization "${DEFAULT_ORG_SLUG}" not found.`);
  }

  console.log(`📂 Reading Excel: ${EXCEL_PATH}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Excel sheet not found');

  const rows: Row[] = [];
  sheet.eachRow((row, idx) => {
    if (idx === 1) return;
    const email = norm(row.getCell(1).value).toLowerCase();
    if (!email || !email.includes('@')) return;
    rows.push({
      email,
      firstName: norm(row.getCell(2).value),
      lastName: norm(row.getCell(3).value),
      employeeCode: norm(row.getCell(4).value),
      departmentName: norm(row.getCell(5).value),
      positionName: norm(row.getCell(6).value),
      hireDate: parseDate(row.getCell(7).value),
      esJefe: parseBool(row.getCell(8).value),
      esDirector: parseBool(row.getCell(9).value),
    });
  });

  console.log(`📊 Empleados en archivo: ${rows.length}`);

  const departmentsByName = new Map<string, { id: string; name: string }>();
  const existingDeps = await prisma.department.findMany({
    where: { organizationId: organization.id },
    select: { id: true, name: true },
  });
  for (const d of existingDeps) departmentsByName.set(d.name.toLowerCase(), d);

  const positionsByName = new Map<string, { id: string; name: string; departmentId: string }>();
  const existingPositions = await prisma.jobPosition.findMany({
    select: { id: true, name: true, departmentId: true },
  });
  for (const p of existingPositions) positionsByName.set(p.name.toLowerCase(), p);

  const ensureDepartment = async (name: string): Promise<string> => {
    const key = name.toLowerCase();
    const existing = departmentsByName.get(key);
    if (existing) return existing.id;
    const created = await prisma.department.create({
      data: { organizationId: organization.id, name, isActive: true },
      select: { id: true, name: true },
    });
    departmentsByName.set(key, created);
    console.log(`   🏢 Departamento creado: "${name}"`);
    return created.id;
  };

  const ensurePosition = async (name: string, departmentId: string): Promise<string> => {
    const key = name.toLowerCase();
    const existing = positionsByName.get(key);
    if (existing) {
      if (existing.departmentId !== departmentId) {
        await prisma.jobPosition.update({
          where: { id: existing.id },
          data: { departmentId },
        });
        positionsByName.set(key, { ...existing, departmentId });
        console.log(`   🔄 Posición reasignada: "${name}" → nuevo departamento`);
      }
      return existing.id;
    }
    const created = await prisma.jobPosition.create({
      data: { name, departmentId, isActive: true },
      select: { id: true, name: true, departmentId: true },
    });
    positionsByName.set(key, created);
    console.log(`   💼 Posición creada: "${name}"`);
    return created.id;
  };

  const existingEmployees = await prisma.employee.findMany({
    where: { organizationId: organization.id },
    select: { id: true, email: true },
  });
  const employeeByEmail = new Map(existingEmployees.map((e) => [e.email.toLowerCase(), e]));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const flags: Array<{ email: string; esJefe: boolean; esDirector: boolean }> = [];

  for (const row of rows) {
    if (!row.firstName || !row.lastName || !row.employeeCode || !row.departmentName || !row.positionName) {
      console.warn(`⚠️  Fila incompleta para ${row.email || '(sin email)'}, omitida.`);
      skipped++;
      continue;
    }

    const departmentId = await ensureDepartment(row.departmentName);
    const positionId = await ensurePosition(row.positionName, departmentId);
    const fullName = `${row.firstName} ${row.lastName}`.trim();

    const data = {
      organizationId: organization.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName,
      employeeCode: row.employeeCode,
      hireDate: row.hireDate,
      departmentId,
      positionId,
      isActive: true,
    };

    const existing = employeeByEmail.get(row.email);
    if (existing) {
      try {
        await prisma.employee.update({ where: { id: existing.id }, data });
        updated++;
      } catch (error) {
        console.warn(`⚠️  No se pudo actualizar ${row.email}:`, (error as Error).message);
        skipped++;
      }
    } else {
      try {
        await prisma.employee.create({ data });
        created++;
        employeeByEmail.set(row.email, { id: 'new', email: row.email });
      } catch (error) {
        console.warn(`⚠️  No se pudo crear ${row.email}:`, (error as Error).message);
        skipped++;
      }
    }

    if (row.esJefe || row.esDirector) {
      flags.push({ email: row.email, esJefe: row.esJefe, esDirector: row.esDirector });
    }
  }

  console.log('\n✅ Importación completada');
  console.log(`   🟢 Creados:    ${created}`);
  console.log(`   🔵 Actualizados: ${updated}`);
  console.log(`   🟡 Omitidos:   ${skipped}`);
  console.log(`   📋 Total leídos: ${rows.length}`);

  if (flags.length > 0) {
    console.log(`\nℹ️  Flags "Es Jefe / Es Director" (no guardados, no están en el modelo):`);
    for (const f of flags) console.log(`   - ${f.email} → jefe=${f.esJefe ? 'Sí' : 'No'}, director=${f.esDirector ? 'Sí' : 'No'}`);
  }

  const totalDb = await prisma.employee.count({ where: { organizationId: organization.id } });
  console.log(`\n   🗄️  Total empleados en BD (${organization.name}): ${totalDb}`);
}

main()
  .catch((error) => {
    console.error('❌ Error en importación:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
