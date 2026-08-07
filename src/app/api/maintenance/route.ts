import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';

import { logEquipmentHistory } from '@/lib/equipment-history';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { equipmentApiFailure, maintenanceScope } from '@/modules/equipment/tenant';

const MAINTENANCE_TYPES = ['PREVENTIVE', 'CORRECTIVE', 'UPDATE', 'INSPECTION'] as const;
const MAINTENANCE_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

const maintenanceCreateSchema = z.object({
  equipmentId: z.string().min(1),
  type: z.enum(MAINTENANCE_TYPES).default('PREVENTIVE'),
  description: z.string().min(1).max(2000),
  scheduledDate: z.coerce.date().optional().nullable(),
  completedDate: z.coerce.date().optional().nullable(),
  cost: z.coerce.number().nonnegative().optional().nullable(),
  technician: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  status: z.enum(MAINTENANCE_STATUSES).default('SCHEDULED'),
}).refine(
  (data) => !data.completedDate || !data.scheduledDate || data.completedDate >= data.scheduledDate,
  { message: 'completedDate debe ser >= scheduledDate', path: ['completedDate'] }
);

// GET /api/maintenance - Listar mantenimientos
async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await requireOrganizationContext(req, requestId);
    const { searchParams } = new URL(req.url);
    const equipmentId = searchParams.get('equipmentId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(Math.max(1, parseInt(searchParams.get('pageSize') || '10') || 10), 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.EquipmentMaintenanceWhereInput = maintenanceScope(organizationId);
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
    return equipmentApiFailure(error, requestId, { code: 'MAINTENANCE_LIST_FAILED', message: 'Error al obtener mantenimientos', stage: 'LIST_MAINTENANCE' });
  }
}

// POST /api/maintenance - Crear mantenimiento (transaccional, valida estado del equipo)
async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await requireOrganizationContext(req, requestId);
    const body = await req.json();
    const parsed = maintenanceCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const setsEquipmentInMaintenance = data.status === 'SCHEDULED' || data.status === 'IN_PROGRESS';

    const result = await prisma.$transaction(async (tx) => {
      const equipment = await tx.equipment.findFirst({
        where: { id: data.equipmentId, organizationId },
        include: {
          assignments: { where: { status: 'ACTIVE' }, take: 1, select: { id: true } },
        },
      });

      if (!equipment) {
        throw Object.assign(new Error('EQUIPMENT_NOT_FOUND'), { status: 404 });
      }

      // A-3 fix: NO pisar ASSIGNED. Si tiene asignación activa, no se puede
      // programar mantenimiento que mueva el equipo a IN_MAINTENANCE.
      if (setsEquipmentInMaintenance && equipment.assignments.length > 0) {
        throw Object.assign(new Error('EQUIPMENT_HAS_ACTIVE_ASSIGNMENT'), {
          status: 409,
          meta: { activeAssignmentId: equipment.assignments[0].id },
        });
      }

      // A-3 fix: no forzar IN_MAINTENANCE si está en estado terminal.
      if (setsEquipmentInMaintenance && ['DISPOSED', 'RETIRED', 'LOST'].includes(equipment.status)) {
        throw Object.assign(new Error('EQUIPMENT_NOT_ELIGIBLE_FOR_MAINTENANCE'), {
          status: 409,
          meta: { currentStatus: equipment.status },
        });
      }

      const maintenance = await tx.equipmentMaintenance.create({
        data: {
          equipmentId: data.equipmentId,
          type: data.type,
          description: data.description,
          scheduledDate: data.scheduledDate ?? null,
          completedDate: data.completedDate ?? null,
          cost: data.cost ?? null,
          technician: data.technician ?? null,
          notes: data.notes ?? null,
          status: data.status,
          performedById: req.user!.userId,
        },
        include: {
          equipment: {
            select: { id: true, inventoryCode: true, brand: true, model: true },
          },
        },
      });

      if (setsEquipmentInMaintenance) {
        await tx.equipment.update({
          where: { id: data.equipmentId, organizationId },
          data: { status: 'IN_MAINTENANCE' },
        });
      }

      return maintenance;
    });

    await logEquipmentHistory({
      equipmentId: data.equipmentId,
      action: 'MAINTENANCE',
      title: 'Mantenimiento registrado',
      description: `${data.type}: ${data.description}`,
      newData: { maintenanceId: result.id, type: data.type, status: result.status },
      performedById: req.user!.userId,
    });

    await createAuditRecord({
      title: 'Mantenimiento registrado',
      description: `Mantenimiento ${data.type} para equipo ${result.equipment.inventoryCode}`,
      module: 'EQUIPOS',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: result.id,
      organizationId,
      newData: { equipmentId: data.equipmentId, type: data.type, description: data.description },
    });

    return NextResponse.json({ maintenance: result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && 'status' in error && typeof (error as { status: number }).status === 'number') {
      const status = (error as { status: number }).status;
      if (status === 404 || status === 409) {
        const meta = (error as { meta?: Record<string, unknown> }).meta;
        return NextResponse.json({ error: error.message, ...meta }, { status });
      }
    }
    console.error('Error al crear mantenimiento:', error);
    return equipmentApiFailure(error, requestId, { code: 'MAINTENANCE_CREATE_FAILED', message: 'Error al crear mantenimiento', stage: 'CREATE_MAINTENANCE' });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler, ['ADMIN', 'IT']);
