import { prisma } from '@/lib/prisma';
import { ACTA_DEFAULT_DELIVERER_DEPARTMENT } from '@/modules/equipment/domain/acta-texts';
import type { ActaParty } from '@/modules/equipment/domain/acta-view-models';

export async function resolveActaDeliverer(userId: string): Promise<ActaParty> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
      employeeProfile: {
        select: {
          fullName: true,
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
      },
    },
  });

  if (!user) {
    return { name: 'Responsable de entrega', position: '—', department: ACTA_DEFAULT_DELIVERER_DEPARTMENT };
  }

  const profile = user.employeeProfile;
  const name = profile?.fullName?.trim() || `${user.firstName} ${user.lastName}`.trim();
  const position = profile?.position?.name || user.position?.name || '—';
  const department =
    profile?.department?.name || user.department?.name || ACTA_DEFAULT_DELIVERER_DEPARTMENT;

  return { name, position, department };
}
