import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { CATEGORY_LABELS } from '@/lib/equipment-asset-code';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { assignmentScope, equipmentApiFailure, equipmentScope } from '@/modules/equipment/tenant';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await requireOrganizationContext(req, requestId);
    const scoped = equipmentScope(organizationId);
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const [
      total,
      available,
      assigned,
      inMaintenance,
      damaged,
      retired,
      lost,
      withoutSerial,
      warrantyExpiring,
      byCategory,
      byDepartment,
    ] = await Promise.all([
      prisma.equipment.count({ where: scoped }),
      prisma.equipment.count({ where: { ...scoped, status: 'AVAILABLE' } }),
      prisma.equipment.count({ where: { ...scoped, status: 'ASSIGNED' } }),
      prisma.equipment.count({ where: { ...scoped, status: 'IN_MAINTENANCE' } }),
      prisma.equipment.count({ where: { ...scoped, status: 'DAMAGED' } }),
      prisma.equipment.count({ where: { ...scoped, status: 'RETIRED' } }),
      prisma.equipment.count({ where: { ...scoped, status: 'LOST' } }),
      prisma.equipment.count({ where: { ...scoped, OR: [{ serialNumber: null }, { serialNumber: '' }] } }),
      prisma.equipment.count({
        where: {
          ...scoped,
          warrantyDate: { gte: now, lte: in30Days },
          status: { not: 'RETIRED' },
        },
      }),
      prisma.equipment.groupBy({
        by: ['category'],
        _count: { _all: true },
        where: { ...scoped, status: { not: 'RETIRED' } },
      }),
      prisma.equipmentAssignment.groupBy({
        by: ['departmentAtTime'],
        _count: { _all: true },
        where: { ...assignmentScope(organizationId), status: 'ACTIVE', departmentAtTime: { not: null } },
      }),
    ]);

    const categoryStats = byCategory.map((item) => ({
      category: item.category,
      label: CATEGORY_LABELS[item.category],
      count: item._count._all,
    }));

    const departmentStats = byDepartment
      .filter((item) => item.departmentAtTime)
      .map((item) => ({
        department: item.departmentAtTime,
        count: item._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      stats: {
        total,
        available,
        assigned,
        inMaintenance,
        damaged,
        retired,
        lost,
        withoutSerial,
        warrantyExpiring,
        unassigned: available,
        byCategory: categoryStats,
        byDepartment: departmentStats,
      },
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de equipos:', error);
    return equipmentApiFailure(error, requestId, { code: 'EQUIPMENT_STATS_FAILED', message: 'Error al obtener estadísticas', stage: 'LOAD_EQUIPMENT_STATS' });
  }
}

export const GET = withAuth(getHandler);
