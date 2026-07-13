import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';

import { logEquipmentHistory } from '@/lib/equipment-history';

// GET /api/maintenance - Listar mantenimientos
async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const equipmentId = searchParams.get('equipmentId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const skip = (page - 1) * pageSize;

    const where: Prisma.EquipmentMaintenanceWhereInput = {};
    if (equipmentId) where.equipmentId = equipmentId;
    if (status) where.status = status as Prisma.EnumMaintenanceStatusFilter;
    if (type) where.type = type as Prisma.EnumMaintenanceTypeFilter;

    const [maintenances, total] = await Promise.all([
      prisma.equipmentMaintenance.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          equipment: {
            select: {
              id: true,
              inventoryCode: true,
              brand: true,
              model: true,
              type: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.equipmentMaintenance.count({ where }),
    ]);

    return NextResponse.json({
      maintenances,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error al obtener mantenimientos:', error);
    return NextResponse.json(
      { error: 'Error al obtener mantenimientos' },
      { status: 500 }
    );
  }
}

// POST /api/maintenance - Crear mantenimiento
async function postHandler(req: AuthenticatedRequest) {
  try {
    const {
      equipmentId,
      type,
      description,
      scheduledDate,
      completedDate,
      cost,
      technician,
      notes,
      status,
    } = await req.json();

    if (!equipmentId || !description) {
      return NextResponse.json(
        { error: 'Equipo y descripción son requeridos' },
        { status: 400 }
      );
    }

    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
    });

    if (!equipment) {
      return NextResponse.json(
        { error: 'Equipo no encontrado' },
        { status: 404 }
      );
    }

    const maintenance = await prisma.equipmentMaintenance.create({
      data: {
        equipmentId,
        type: type || 'PREVENTIVE',
        description,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        completedDate: completedDate ? new Date(completedDate) : null,
        cost: cost ? parseFloat(cost) : null,
        technician,
        notes,
        status: status || 'SCHEDULED',
        performedById: req.user!.userId,
      },
      include: {
        equipment: {
          select: {
            id: true,
            inventoryCode: true,
            brand: true,
            model: true,
          },
        },
      },
    });

    // Marcar equipo en mantenimiento si aplica
    const maintenanceStatuses = ['SCHEDULED', 'IN_PROGRESS'];
    if (maintenanceStatuses.includes(maintenance.status)) {
      await prisma.equipment.update({
        where: { id: equipmentId },
        data: { status: 'IN_MAINTENANCE' },
      });
    }

    await logEquipmentHistory({
      equipmentId,
      action: 'MAINTENANCE',
      title: 'Mantenimiento registrado',
      description: `${type || 'PREVENTIVE'}: ${description}`,
      newData: { maintenanceId: maintenance.id, type, status: maintenance.status },
      performedById: req.user!.userId,
    });

    await createAuditRecord({
      title: 'Mantenimiento registrado',
      description: `Mantenimiento ${type} para equipo ${equipment.inventoryCode}`,
      module: 'EQUIPOS',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: maintenance.id,
      newData: { equipmentId, type, description },
    });

    return NextResponse.json({ maintenance }, { status: 201 });
  } catch (error) {
    console.error('Error al crear mantenimiento:', error);
    return NextResponse.json(
      { error: 'Error al crear mantenimiento' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler, ['ADMIN', 'IT']);