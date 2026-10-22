import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import {
  buildCompareReportRows,
  formatCompareCsv,
  parseLegacyPayrollCsv,
  parsePayMonth,
  type SgePayrollAmounts,
} from './compare-month-core';
import { moneyNumber } from '@/modules/payroll/domain/decimal';

loadEnvFile();

function usage(): never {
  console.error('Usage: pnpm payroll:compare -- --month=YYYY-MM path/to/legacy.csv [--organization-id=uuid]');
  process.exit(1);
}

function parseArgs(argv: string[]) {
  let month: string | undefined;
  let organizationId: string | undefined;
  const positional: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith('--month=')) month = arg.slice('--month='.length);
    else if (arg.startsWith('--organization-id=')) organizationId = arg.slice('--organization-id='.length);
    else if (arg === '--help' || arg === '-h') usage();
    else positional.push(arg);
  }

  if (!month || positional.length !== 1) usage();
  return { month, csvPath: resolve(positional[0]!), organizationId };
}

async function main() {
  const { month, csvPath, organizationId } = parseArgs(process.argv.slice(2));
  const { year, month: monthNum, label } = parsePayMonth(month);

  const csvContent = await readFile(csvPath, 'utf8');
  const legacyByCode = parseLegacyPayrollCsv(csvContent);

  const { prisma } = await import('@/lib/prisma');

  const payslips = await prisma.payslip.findMany({
    where: {
      year,
      month: monthNum,
      ...(organizationId ? { organizationId } : {}),
    },
    select: {
      salarioPeriodo: true,
      ihss: true,
      isr: true,
      otro: true,
      neto: true,
      employee: { select: { employeeCode: true } },
    },
  });

  const sgeByCode = new Map<string, SgePayrollAmounts>();
  for (const slip of payslips) {
    const codigo = slip.employee.employeeCode?.trim();
    if (!codigo) continue;
    sgeByCode.set(codigo, {
      salario: moneyNumber(slip.salarioPeriodo),
      ihss: moneyNumber(slip.ihss),
      isr: moneyNumber(slip.isr),
      otro: moneyNumber(slip.otro),
      neto: moneyNumber(slip.neto),
    });
  }

  const { diffs, compared, matches } = buildCompareReportRows(legacyByCode, sgeByCode);
  const reportDir = resolve('reports');
  await mkdir(reportDir, { recursive: true });
  const outPath = resolve(reportDir, `payroll-compare-${label}.csv`);
  await writeFile(outPath, formatCompareCsv(diffs), 'utf8');

  const diffEmployees = new Set(diffs.map((d) => d.codigo)).size;
  console.log(`[payroll:compare] Month ${label}`);
  console.log(`  Legacy rows (CSV):     ${legacyByCode.size}`);
  console.log(`  SGE payslips (month):  ${payslips.length}`);
  console.log(`  Employees compared:    ${compared}`);
  console.log(`  Full matches:          ${matches}`);
  console.log(`  With differences:      ${diffEmployees}`);
  console.log(`  Diff lines (> L 0.01): ${diffs.length}`);
  console.log(`  Report:                ${outPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
