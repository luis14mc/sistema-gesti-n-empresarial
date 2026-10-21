import { prisma } from '@/lib/prisma';

export async function createSupplier(
  data: {
    nombreRazonSocial: string;
    rtn?: string | null;
    telefono?: string | null;
    email?: string | null;
    personaContacto?: string | null;
    direccion?: string | null;
  },
  organizationId: string,
) {
  return prisma.proveedor.create({ data: { ...data, organizationId } });
}

export async function updateSupplier(
  id: string,
  data: {
    nombreRazonSocial?: string;
    rtn?: string | null;
    telefono?: string | null;
    email?: string | null;
    personaContacto?: string | null;
    direccion?: string | null;
    activo?: boolean;
  },
  organizationId: string,
) {
  const existing = await prisma.proveedor.findFirst({
    where: { id, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new Error('PROVEEDOR_NOT_FOUND');

  return prisma.proveedor.update({
    where: { id },
    data: { ...data, version: { increment: 1 } },
  });
}

export async function deleteSupplier(id: string, organizationId: string) {
  const existing = await prisma.proveedor.findFirst({
    where: { id, organizationId, deletedAt: null },
    select: {
      id: true,
      comprasSolicitudes: { select: { id: true }, take: 1 },
      comprasOrdenes: { select: { id: true }, take: 1 },
    },
  });
  if (!existing) throw new Error('PROVEEDOR_NOT_FOUND');
  if (existing.comprasSolicitudes.length > 0 || existing.comprasOrdenes.length > 0) {
    throw new Error('PROVEEDOR_HAS_DEPENDENCIES');
  }

  return prisma.proveedor.update({
    where: { id },
    data: { deletedAt: new Date(), activo: false, version: { increment: 1 } },
  });
}

export async function listSuppliers(params: {
  organizationId: string;
  search?: string;
  activo?: boolean;
  page: number;
  pageSize: number;
}) {
  const { organizationId, search = '', activo, page, pageSize } = params;
  const skip = (page - 1) * pageSize;
  const digits = search.replace(/\D/g, '');
  const contains = { contains: search, mode: 'insensitive' as const };
  const where = {
    organizationId,
    deletedAt: null,
    ...(activo === true ? { activo: true } : {}),
    ...(search
      ? {
          OR: [
            { nombreRazonSocial: contains },
            { telefono: contains },
            { email: contains },
            { personaContacto: contains },
            { rtn: contains },
            ...(digits && digits !== search
              ? [{ rtn: { contains: digits } }, { telefono: { contains: digits } }]
              : []),
          ],
        }
      : {}),
  };

  const [proveedores, total] = await Promise.all([
    prisma.proveedor.findMany({ where, skip, take: pageSize, orderBy: { nombreRazonSocial: 'asc' } }),
    prisma.proveedor.count({ where }),
  ]);

  return { proveedores, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
