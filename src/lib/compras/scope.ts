import { prisma } from '@/lib/prisma';
import type { Role } from '@/types';
import type { CreateCompraSolicitudInput, UpdateCompraSolicitudInput } from './schemas';

async function assertCentroCostoActivo(centroCostoId: string): Promise<void> {
  const centro = await prisma.costCenter.findFirst({
    where: { id: centroCostoId, isActive: true },
    select: { id: true },
  });
  if (!centro) throw new Error('Centro de costo inválido o inactivo');
}

export async function resolveCompraSolicitudScope(
  data: CreateCompraSolicitudInput,
  userId: string,
  role: Role
): Promise<CreateCompraSolicitudInput> {
  await assertCentroCostoActivo(data.centroCostoId);

  if (role === 'ADMIN') return data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });
  if (!user?.departmentId) {
    throw new Error('Usuario sin departamento asignado');
  }

  if (
    data.departamentoSolicitanteId &&
    data.departamentoSolicitanteId !== user.departmentId
  ) {
    throw new Error('No puede crear solicitudes para otro departamento');
  }

  return {
    ...data,
    departamentoSolicitanteId: user.departmentId,
  };
}

export async function assertCompraSolicitudUpdateScope(
  data: UpdateCompraSolicitudInput,
  userId: string,
  role: Role
): Promise<UpdateCompraSolicitudInput> {
  if (role === 'ADMIN') {
    if (data.centroCostoId) await assertCentroCostoActivo(data.centroCostoId);
    return data;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });
  if (!user?.departmentId) {
    throw new Error('Usuario sin departamento asignado');
  }

  if (
    data.departamentoSolicitanteId &&
    data.departamentoSolicitanteId !== user.departmentId
  ) {
    throw new Error('No puede asignar otro departamento');
  }

  if (data.centroCostoId) await assertCentroCostoActivo(data.centroCostoId);

  return {
    ...data,
    departamentoSolicitanteId: data.departamentoSolicitanteId ?? user.departmentId,
  };
}
