import type { PrismaClient } from '@prisma/client';

export type ProveedorSeedRecord = {
  nombreRazonSocial: string;
  rtn?: string | null;
  telefono?: string | null;
  email?: string | null;
  personaContacto?: string | null;
  direccion?: string | null;
};

export type EmpleadoSeedRecord = {
  email: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  departmentName: string;
  positionName: string;
  hireDate?: string | null;
  phone?: string | null;
  dni?: string | null;
};

export type MasterDataSeedResult = {
  organizationId: string;
  proveedores: { created: number; updated: number; skipped: number };
  empleados: { created: number; updated: number; skipped: number };
  departmentsCreated: number;
  positionsCreated: number;
};

const DEFAULT_ORG = {
  id: 'org_cni_default',
  slug: 'cni',
  name: 'Consejo Nacional de Inversiones',
  legalName: 'Consejo Nacional de Inversiones',
};

export async function ensureCniOrganization(prisma: PrismaClient) {
  return prisma.organization.upsert({
    where: { slug: DEFAULT_ORG.slug },
    update: {
      name: DEFAULT_ORG.name,
      legalName: DEFAULT_ORG.legalName,
      status: 'ACTIVE',
    },
    create: {
      id: DEFAULT_ORG.id,
      slug: DEFAULT_ORG.slug,
      name: DEFAULT_ORG.name,
      legalName: DEFAULT_ORG.legalName,
      status: 'ACTIVE',
    },
    select: { id: true, name: true, slug: true },
  });
}

async function ensureDepartment(
  prisma: PrismaClient,
  organizationId: string,
  cache: Map<string, string>,
  name: string
): Promise<{ id: string; created: boolean }> {
  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached) return { id: cached, created: false };

  const existing = await prisma.department.findFirst({
    where: { organizationId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) {
    cache.set(key, existing.id);
    return { id: existing.id, created: false };
  }

  const created = await prisma.department.create({
    data: { organizationId, name, isActive: true },
    select: { id: true },
  });
  cache.set(key, created.id);
  return { id: created.id, created: true };
}

async function ensurePosition(
  prisma: PrismaClient,
  cache: Map<string, string>,
  name: string,
  departmentId: string
): Promise<{ id: string; created: boolean }> {
  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached) {
    await prisma.jobPosition.updateMany({
      where: { id: cached, departmentId: { not: departmentId } },
      data: { departmentId },
    });
    return { id: cached, created: false };
  }

  const existing = await prisma.jobPosition.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true, departmentId: true },
  });
  if (existing) {
    if (existing.departmentId !== departmentId) {
      await prisma.jobPosition.update({
        where: { id: existing.id },
        data: { departmentId },
      });
    }
    cache.set(key, existing.id);
    return { id: existing.id, created: false };
  }

  const created = await prisma.jobPosition.create({
    data: { name, departmentId, isActive: true },
    select: { id: true },
  });
  cache.set(key, created.id);
  return { id: created.id, created: true };
}

export async function seedProveedores(
  prisma: PrismaClient,
  organizationId: string,
  records: ProveedorSeedRecord[]
) {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const existing = await prisma.proveedor.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true, rtn: true, nombreRazonSocial: true },
  });
  const byName = new Map(existing.map((row) => [row.nombreRazonSocial.toLowerCase(), row]));
  const byRtn = new Map(existing.filter((row) => row.rtn).map((row) => [row.rtn as string, row]));

  for (const record of records) {
    const nombreRazonSocial = record.nombreRazonSocial.trim().replace(/\s+/g, ' ');
    if (nombreRazonSocial.length < 2) {
      skipped++;
      continue;
    }

    const payload = {
      nombreRazonSocial,
      rtn: record.rtn ?? null,
      telefono: record.telefono ?? null,
      email: record.email ?? null,
      personaContacto: record.personaContacto ?? null,
      direccion: record.direccion ?? null,
      activo: true,
    };

    const nameKey = nombreRazonSocial.toLowerCase();
    const matchByName = byName.get(nameKey);
    if (matchByName) {
      const needsUpdate =
        (payload.rtn && payload.rtn !== matchByName.rtn) ||
        payload.telefono ||
        payload.email ||
        payload.personaContacto ||
        payload.direccion;

      if (needsUpdate) {
        try {
          await prisma.proveedor.update({
            where: { id: matchByName.id },
            data: {
              rtn: payload.rtn ?? undefined,
              telefono: payload.telefono ?? undefined,
              email: payload.email ?? undefined,
              personaContacto: payload.personaContacto ?? undefined,
              direccion: payload.direccion ?? undefined,
              activo: true,
              deletedAt: null,
            },
          });
          updated++;
        } catch {
          skipped++;
        }
      } else {
        skipped++;
      }
      continue;
    }

    if (payload.rtn && byRtn.has(payload.rtn)) {
      skipped++;
      continue;
    }

    try {
      const row = await prisma.proveedor.create({
        data: { organizationId, ...payload },
        select: { id: true, rtn: true, nombreRazonSocial: true },
      });
      created++;
      byName.set(nameKey, row);
      if (row.rtn) byRtn.set(row.rtn, row);
    } catch {
      skipped++;
    }
  }

  return { created, updated, skipped };
}

export async function seedEmpleados(
  prisma: PrismaClient,
  organizationId: string,
  records: EmpleadoSeedRecord[]
) {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let departmentsCreated = 0;
  let positionsCreated = 0;

  const departmentCache = new Map<string, string>();
  const positionCache = new Map<string, string>();

  const existingEmployees = await prisma.employee.findMany({
    where: { organizationId },
    select: { id: true, email: true },
  });
  const byEmail = new Map(existingEmployees.map((row) => [row.email.toLowerCase(), row]));

  for (const record of records) {
    const email = record.email.trim().toLowerCase();
    const firstName = record.firstName.trim();
    const lastName = record.lastName.trim();
    const employeeCode = record.employeeCode.trim();
    const departmentName = record.departmentName.trim();
    const positionName = record.positionName.trim();

    if (!email.includes('@') || !firstName || !lastName || !employeeCode || !departmentName || !positionName) {
      skipped++;
      continue;
    }

    const department = await ensureDepartment(prisma, organizationId, departmentCache, departmentName);
    if (department.created) departmentsCreated++;

    const position = await ensurePosition(prisma, positionCache, positionName, department.id);
    if (position.created) positionsCreated++;

    const fullName = `${firstName} ${lastName}`.trim();
    const hireDate = record.hireDate ? new Date(record.hireDate) : null;
    const data = {
      organizationId,
      email,
      firstName,
      lastName,
      fullName,
      employeeCode,
      hireDate: hireDate && !Number.isNaN(hireDate.getTime()) ? hireDate : null,
      phone: record.phone ?? null,
      dni: record.dni ?? null,
      departmentId: department.id,
      positionId: position.id,
      isActive: true,
    };

    const existing = byEmail.get(email);
    if (existing) {
      try {
        await prisma.employee.update({ where: { id: existing.id }, data });
        updated++;
      } catch {
        skipped++;
      }
      continue;
    }

    try {
      await prisma.employee.create({ data });
      created++;
      byEmail.set(email, { id: 'new', email });
    } catch {
      skipped++;
    }
  }

  return { created, updated, skipped, departmentsCreated, positionsCreated };
}

export async function seedCniMasterData(
  prisma: PrismaClient,
  input: {
    proveedores: ProveedorSeedRecord[];
    empleados: EmpleadoSeedRecord[];
  }
): Promise<MasterDataSeedResult> {
  const organization = await ensureCniOrganization(prisma);
  const proveedores = await seedProveedores(prisma, organization.id, input.proveedores);
  const empleadosResult = await seedEmpleados(prisma, organization.id, input.empleados);

  return {
    organizationId: organization.id,
    proveedores,
    empleados: {
      created: empleadosResult.created,
      updated: empleadosResult.updated,
      skipped: empleadosResult.skipped,
    },
    departmentsCreated: empleadosResult.departmentsCreated,
    positionsCreated: empleadosResult.positionsCreated,
  };
}
