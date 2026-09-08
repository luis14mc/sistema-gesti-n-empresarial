import { loadEnvFile } from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

loadEnvFile();

const PROVEEDORES_XLSX =
  process.env.PROVEEDORES_XLSX ?? '/mnt/c/Users/sopor/Downloads/BD PROVEEDORES 2026.xlsx';
const EMPLEADOS_XLSX =
  process.env.EMPLEADOS_XLSX ?? '/mnt/c/Users/sopor/Downloads/Plantilla_Importacion_Empleados.xlsx';
const OUT_DIR = path.resolve('prisma/data');

const PLACEHOLDER_RTNS = new Set(['00000000000000', '0000000000000', '000000000000000']);

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const obj = value as {
      text?: unknown;
      hyperlink?: unknown;
      result?: unknown;
      richText?: Array<{ text?: string }>;
    };
    if (obj.text) return String(obj.text).trim();
    if (obj.hyperlink) return String(obj.hyperlink).replace(/^mailto:/i, '').trim();
    if (obj.result !== undefined) return String(obj.result).trim();
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((part) => part.text ?? '').join('').trim();
    }
  }
  return String(value).trim();
}

function normalizeRtn(raw: unknown): string | null {
  const digits = cellText(raw).replace(/\D/g, '');
  if (!digits || digits.length < 8 || digits.length > 15) return null;
  if (PLACEHOLDER_RTNS.has(digits) || /^0+$/.test(digits)) return null;
  return digits;
}

function parseDate(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  const text = cellText(raw);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

async function exportProveedores() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(PROVEEDORES_XLSX);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Hoja de proveedores no encontrada');

  const rows: Array<{ nombreRazonSocial: string; rtn: string | null }> = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const nombreRazonSocial = cellText(row.getCell(3).value).replace(/\s+/g, ' ');
    if (nombreRazonSocial.length < 2) return;
    rows.push({ nombreRazonSocial, rtn: normalizeRtn(row.getCell(2).value) });
  });
  return rows;
}

async function exportEmpleados() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EMPLEADOS_XLSX);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Hoja de empleados no encontrada');

  const rows: Array<{
    email: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    departmentName: string;
    positionName: string;
    hireDate: string | null;
  }> = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const email = cellText(row.getCell(1).value).toLowerCase();
    const firstName = cellText(row.getCell(2).value);
    const lastName = cellText(row.getCell(3).value);
    const employeeCode = cellText(row.getCell(4).value);
    const departmentName = cellText(row.getCell(5).value);
    const positionName = cellText(row.getCell(6).value);
    const hireDate = parseDate(row.getCell(7).value);
    if (!email.includes('@') || !firstName || !lastName || !employeeCode || !departmentName || !positionName) {
      return;
    }
    rows.push({ email, firstName, lastName, employeeCode, departmentName, positionName, hireDate });
  });

  return rows;
}

async function main() {
  console.log(`📂 Proveedores: ${PROVEEDORES_XLSX}`);
  console.log(`📂 Empleados:   ${EMPLEADOS_XLSX}`);

  const [proveedores, empleados] = await Promise.all([exportProveedores(), exportEmpleados()]);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const proveedoresPath = path.join(OUT_DIR, 'proveedores-cni.json');
  const empleadosPath = path.join(OUT_DIR, 'empleados-cni.json');

  fs.writeFileSync(proveedoresPath, `${JSON.stringify(proveedores, null, 2)}\n`);
  fs.writeFileSync(empleadosPath, `${JSON.stringify(empleados, null, 2)}\n`);

  console.log(`\n✅ Exportados ${proveedores.length} proveedores → ${proveedoresPath}`);
  console.log(`✅ Exportados ${empleados.length} empleados → ${empleadosPath}`);
}

main().catch((error) => {
  console.error('❌ Error exportando datos maestros:', error);
  process.exit(1);
});
