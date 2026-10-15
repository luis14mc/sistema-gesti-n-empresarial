import { loadEnvFile } from 'node:process';

loadEnvFile();

const { prisma } = await import('@/lib/prisma');
const { calculatePayslip } = await import('@/modules/payroll/domain');
const { assertIsrRatesArePercentUnits } = await import('@/modules/payroll/domain');
const { generatePayslip } = await import('@/modules/payroll/application/payroll-service');
const { createAuditRecord } = await import('@/lib/audit');
import type { PayrollSettings } from '@/modules/payroll/domain';

const fix = process.argv.includes('--fix');
const tolerance = 0.01;

function payMonthFromParts(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function correctSettingsSnapshot(raw: unknown): PayrollSettings {
  if (!raw || typeof raw !== 'object') {
    throw new Error('PAYSLIP_SNAPSHOT_INVALID');
  }
  const snapshot = raw as PayrollSettings;
  const brackets = snapshot.isr.brackets.map((b) => {
    let rate = b.rate;
    if (rate > 0 && rate < 1) {
      rate = rate * 100;
    }
    return { ...b, rate };
  });
  assertIsrRatesArePercentUnits(brackets.map((b) => b.rate));
  return {
    ...snapshot,
    isr: { ...snapshot.isr, brackets },
  };
}

function amountsClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

async function resolveFixUserId(organizationId: string): Promise<string> {
  const envUser = process.env.PAYROLL_FIX_USER_ID;
  if (envUser) return envUser;

  const membership = await prisma.organizationMembership.findFirst({
    where: { organizationId, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  });
  if (!membership) {
    throw new Error(`No active member for organization ${organizationId}; set PAYROLL_FIX_USER_ID.`);
  }
  return membership.userId;
}

async function main() {
  const payslips = await prisma.payslip.findMany({
    orderBy: [{ organizationId: 'asc' }, { year: 'desc' }, { month: 'desc' }],
    include: {
      employee: {
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          hireDate: true,
          monthlySalary: true,
          otherDeduction: true,
          payrollEnabled: true,
        },
      },
    },
  });

  const mismatches: Array<{
    id: string;
    employee: string;
    payMonth: string;
    storedIsr: number;
    expectedIsr: number;
    storedNeto: number;
    expectedNeto: number;
  }> = [];

  for (const row of payslips) {
    const employee = row.employee;
    if (!employee.hireDate || employee.monthlySalary === null) {
      continue;
    }

    let settings: PayrollSettings;
    try {
      settings = correctSettingsSnapshot(row.parametersSnapshot);
    } catch (error) {
      console.warn(`⚠️  Payslip ${row.id}: snapshot inválido — ${error instanceof Error ? error.message : error}`);
      continue;
    }

    const payMonth = payMonthFromParts(row.year, row.month);
    let expected;
    try {
      expected = calculatePayslip({
        monthlySalary: Number(employee.monthlySalary.toString()),
        hireDate: employee.hireDate,
        payMonth,
        otherDeductions: Number(employee.otherDeduction.toString()),
        settings,
      });
    } catch {
      continue;
    }

    const storedIsr = Number(row.isr.toString());
    const storedNeto = Number(row.neto.toString());
    if (!amountsClose(storedIsr, expected.isr) || !amountsClose(storedNeto, expected.netPay)) {
      mismatches.push({
        id: row.id,
        employee: employee.fullName,
        payMonth,
        storedIsr,
        expectedIsr: expected.isr,
        storedNeto,
        expectedNeto: expected.netPay,
      });
    }
  }

  if (mismatches.length === 0) {
    console.log('✅ Todas las boletas coinciden con ISR recalculado (snapshot corregido).');
    return;
  }

  console.log(`❌ ${mismatches.length} boleta(s) con ISR/neto distinto al recálculo:\n`);
  for (const m of mismatches) {
    console.log(
      `  ${m.id} · ${m.employee} · ${m.payMonth} · ISR ${m.storedIsr} → ${m.expectedIsr} · neto ${m.storedNeto} → ${m.expectedNeto}`,
    );
  }

  if (!fix) {
    console.log('\nEjecute con --fix para actualizar montos, regenerar PDF y registrar auditoría.');
    process.exitCode = 1;
    return;
  }

  console.log('\n🔧 Aplicando correcciones…');
  const userByOrg = new Map<string, string>();

  for (const m of mismatches) {
    const row = payslips.find((p) => p.id === m.id)!;
    const orgId = row.organizationId;
    if (!userByOrg.has(orgId)) {
      userByOrg.set(orgId, await resolveFixUserId(orgId));
    }
    const userId = userByOrg.get(orgId)!;
    const payMonth = payMonthFromParts(row.year, row.month);
    const updated = await generatePayslip(orgId, row.employeeId, payMonth, userId);

    await createAuditRecord({
      title: 'Boleta de planilla corregida (ISR)',
      description: `Recálculo ISR/neto para ${row.employee.fullName} periodo ${payMonth}.`,
      module: 'MANUAL',
      category: 'PAYROLL',
      userId,
      organizationId: orgId,
      entityId: updated.id,
      entityType: 'Payslip',
      action: 'PAYROLL_ISR_FIX',
      metadata: {
        payslipId: row.id,
        before: { isr: m.storedIsr, neto: m.storedNeto },
        after: { isr: updated.isr, neto: updated.neto },
      },
    });
    console.log(`  ✓ ${m.id} (${m.employee})`);
  }

  console.log(`\n✅ ${mismatches.length} boleta(s) corregida(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
