import { loadEnvFile } from 'node:process';

loadEnvFile();

const { prisma } = await import('@/lib/prisma');
const { ensureDefaultPayrollSettings } = await import('@/modules/payroll/application/settings-loader');

const DEFAULT_ORG_SLUG = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'cni';
const LEGACY_JSON = process.env.PAYROLL_LEGACY_JSON;

type LegacyRow = {
  employeeCode?: string;
  email?: string;
  monthlySalary?: number;
  otherDeduction?: number;
  otherDeductionNote?: string;
  payrollEnabled?: boolean;
};

async function main() {
  const organization = await prisma.organization.findUnique({
    where: { slug: DEFAULT_ORG_SLUG },
    select: { id: true, name: true },
  });
  if (!organization) {
    throw new Error(`Organization "${DEFAULT_ORG_SLUG}" not found.`);
  }

  await ensureDefaultPayrollSettings(organization.id);
  console.log(`✅ Default payroll settings for ${organization.name}`);

  if (!LEGACY_JSON) {
    console.log('ℹ️  Set PAYROLL_LEGACY_JSON to a JSON array of { employeeCode|email, monthlySalary, ... } to import rows.');
    return;
  }

  const rows = JSON.parse(LEGACY_JSON) as LegacyRow[];
  let updated = 0;
  for (const row of rows) {
    if (!row.employeeCode && !row.email) continue;
    const employee = await prisma.employee.findFirst({
      where: {
        organizationId: organization.id,
        OR: [
          row.employeeCode ? { employeeCode: row.employeeCode } : undefined,
          row.email ? { email: row.email.toLowerCase() } : undefined,
        ].filter(Boolean) as Array<{ employeeCode: string } | { email: string }>,
      },
    });
    if (!employee) {
      console.warn('⚠️  Employee not found:', row.employeeCode ?? row.email);
      continue;
    }
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        ...(row.monthlySalary !== undefined ? { monthlySalary: row.monthlySalary } : {}),
        ...(row.otherDeduction !== undefined ? { otherDeduction: row.otherDeduction } : {}),
        ...(row.otherDeductionNote !== undefined ? { otherDeductionNote: row.otherDeductionNote } : {}),
        ...(row.payrollEnabled !== undefined ? { payrollEnabled: row.payrollEnabled } : { payrollEnabled: true }),
      },
    });
    updated += 1;
  }
  console.log(`✅ Updated ${updated} employee payroll records.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma: db } = await import('@/lib/prisma');
    await db.$disconnect();
  });
