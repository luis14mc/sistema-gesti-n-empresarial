import { prisma } from '@/lib/prisma';
import type { Role } from '@/types';
import { canAccess } from '@/lib/permissions';

export async function canAccessCompraDocument(
  userId: string,
  role: Role,
  solicitudId: string
): Promise<boolean> {
  if (!canAccess(role, 'purchases', 'read')) return false;
  if (role === 'ADMIN') return true;

  const solicitud = await prisma.compraSolicitud.findFirst({
    where: { id: solicitudId, deletedAt: null },
    select: {
      solicitadoPorId: true,
      departamentoSolicitanteId: true,
      solicitadoPor: { select: { departmentId: true } },
    },
  });
  if (!solicitud) return false;
  if (solicitud.solicitadoPorId === userId) return true;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });

  if (role === 'RRHH' && user?.departmentId === solicitud.departamentoSolicitanteId) {
    return true;
  }

  return role === 'IT';
}
