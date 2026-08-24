import { loadEnvFile } from 'node:process';

loadEnvFile();
const { prisma } = await import('@/lib/prisma');

async function main() {
  const employees = await prisma.employee.findMany({
    where: { organization: { slug: 'cni' } },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      hireDate: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
    },
    orderBy: { employeeCode: 'asc' },
  });
  console.log('Total:', employees.length);
  for (const e of employees) {
    console.log(
      `  ${e.employeeCode ?? '-'} | ${e.email} | ${e.firstName} ${e.lastName} | ` +
      `${e.department?.name ?? '-'} / ${e.position?.name ?? '-'} | ` +
      `${e.hireDate?.toISOString().slice(0, 10) ?? '-'}`,
    );
  }
}

main().then(() => prisma.$disconnect());
