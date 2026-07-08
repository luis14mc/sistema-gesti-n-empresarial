import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';

// GET /api/audits/[id] - Obtener auditoría por ID
async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const audit = await prisma.audit.findUnique({
      where: { id: params.id },
      include: {
        leadAuditor: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        findings: {
          orderBy: { createdAt: 'desc' },
        },
        checklist: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!audit) {
      return NextResponse.json(
        { error: 'Auditoría no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ audit });
  } catch (error) {
    console.error('Error al obtener auditoría:', error);
    return NextResponse.json(
      { error: 'Error al obtener auditoría' },
      { status: 500 }
    );
  }
}

// PATCH /api/audits/[id] - Actualizar auditoría
async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await req.json();
    const current = await prisma.audit.findUnique({ where: { id: params.id } });

    if (!current) {
      return NextResponse.json(
        { error: 'Auditoría no encontrada' },
        { status: 404 }
      );
    }

    const allowedFields = [
      'title', 'description', 'type', 'status', 'standard', 'scope',
      'objectives', 'criteria', 'department', 'conclusions',
      'recommendations', 'auditeeContact', 'leadAuditorId',
      'plannedDate', 'startDate', 'endDate'
    ];

    const updateData: any = {};
    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        if (['plannedDate'].includes(field) && data[field]) {
          updateData[field] = new Date(data[field]);
        } else if (['startDate', 'endDate'].includes(field) && data[field]) {
          updateData[field] = new Date(data[field]);
        } else {
          updateData[field] = data[field];
        }
      }
    });

    const audit = await prisma.audit.update({
      where: { id: params.id },
      data: updateData,
      include: {
        leadAuditor: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await createAuditRecord({
      title: 'Actualización de auditoría',
      description: `Se actualizó auditoría: ${audit.title}`,
      module: 'MANUAL',
      category: 'UPDATE',
      userId: req.user!.userId,
      entityId: audit.id,
      previousData: { status: current.status },
      newData: { status: audit.status },
    });

    return NextResponse.json({ audit });
  } catch (error) {
    console.error('Error al actualizar auditoría:', error);
    return NextResponse.json(
      { error: 'Error al actualizar auditoría' },
      { status: 500 }
    );
  }
}

// DELETE /api/audits/[id] - Eliminar auditoría
async function deleteHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const current = await prisma.audit.findUnique({ where: { id: params.id } });
    if (!current) {
      return NextResponse.json(
        { error: 'Auditoría no encontrada' },
        { status: 404 }
      );
    }

    await prisma.audit.delete({ where: { id: params.id } });

    await createAuditRecord({
      title: 'Eliminación de auditoría',
      description: `Se eliminó auditoría: ${current.title}`,
      module: 'MANUAL',
      category: 'DELETE',
      userId: req.user!.userId,
      entityId: params.id,
      previousData: { code: current.code, title: current.title },
    });

    return NextResponse.json({ message: 'Auditoría eliminada' });
  } catch (error) {
    console.error('Error al eliminar auditoría:', error);
    return NextResponse.json(
      { error: 'Error al eliminar auditoría' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler, ['ADMIN', 'RRHH', 'IT']);
export const DELETE = withAuth(deleteHandler, ['ADMIN']);