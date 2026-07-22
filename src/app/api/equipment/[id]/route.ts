import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { logEquipmentHistory } from '@/lib/equipment-history';
import { mapEquipmentResponse } from '@/lib/equipment-mapper';
import { requireOrganizationContext } from '@/modules/organizations/application/context';

async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const organization = await requireOrganizationContext(req);
    const equipment = await prisma.equipment.findFirst({
      where: { id, organizationId: organization.organizationId },
      include: {
        assignments: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            employee: {
              select: {
                id: true,
                fullName: true,
                email: true,
                department: { select: { name: true } },
                position: { select: { name: true } },
              },
            },
          },
          orderBy: { assignedDate: 'desc' },
        },
        maintenances: { orderBy: { createdAt: 'desc' } },
        history: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });

    if (!equipment) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ equipment: mapEquipmentResponse(equipment) });
  } catch (error) {
    console.error('Error al obtener equipo:', error);
    return NextResponse.json({ error: 'Error al obtener equipo' }, { status: 500 });
  }
}

async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const organization = await requireOrganizationContext(req);
    const data = await req.json();
    const current = await prisma.equipment.findFirst({ where: { id, organizationId: organization.organizationId } });

    if (!current) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }
    if (data.status === 'RETIRED' || data.status === 'DISPOSED') {
      return NextResponse.json(
        { error: 'Use el flujo de dictamen técnico para dar de baja el equipo.' },
        { status: 409 },
      );
    }

    const allowedFields = [
      'type', 'category', 'brand', 'model', 'serialNumber', 'status',
      'ram', 'processor', 'storage', 'os', 'purchaseDate', 'purchaseOrder',
      'supplier', 'warrantyDate', 'cost', 'ipAddress', 'macAddress',
      'location', 'notes', 'retirementReason',
    ];
    const updateData: Record<string, unknown> = {};
    allowedFields.forEach((field) => {
      if (data[field] !== undefined) updateData[field] = data[field];
    });

    const equipment = await prisma.equipment.update({
      where: { id },
      data: updateData,
    });

    const action = data.status && data.status !== current.status ? 'STATUS_CHANGED' : 'UPDATED';
    await logEquipmentHistory({
      equipmentId: equipment.id,
      action,
      title: action === 'STATUS_CHANGED' ? 'Estado actualizado' : 'Equipo actualizado',
      description: `Equipo ${equipment.inventoryCode} actualizado.`,
      previousData: { status: current.status },
      newData: { status: equipment.status, ...updateData },
      performedById: req.user!.userId,
    });

    await createAuditRecord({
      title: 'Actualización de equipo',
      description: `Se actualizó equipo: ${equipment.inventoryCode}`,
      module: 'EQUIPOS',
      category: 'UPDATE',
      userId: req.user!.userId,
      entityId: equipment.id,
      entityType: 'Equipment',
      organizationId: organization.organizationId,
      action: 'EQUIPMENT_UPDATED',
      previousData: { status: current.status },
      newData: { status: equipment.status },
    });

    return NextResponse.json({ equipment: mapEquipmentResponse(equipment) });
  } catch (error) {
    console.error('Error al actualizar equipo:', error);
    return NextResponse.json({ error: 'Error al actualizar equipo' }, { status: 500 });
  }
}

async function deleteHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params;
    await requireOrganizationContext(req);
    return NextResponse.json(
      { error: 'Use el flujo de dictamen técnico para dar de baja el equipo.' },
      { status: 409 },
    );
  } catch (error) {
    console.error('Error al dar de baja equipo:', error);
    return NextResponse.json({ error: 'Error al dar de baja equipo' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler, ['ADMIN', 'IT']);
export const DELETE = withAuth(deleteHandler, ['ADMIN', 'IT']);
