import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { auditChildScope } from '@/modules/audits/infrastructure/tenant-scope';
import { findAudit } from '@/modules/audits/infrastructure/repository';

// POST /api/audits/[id]/checklist - Agregar item al checklist
async function postHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const organization = await requireOrganizationContext(req);
    const { requirement, clause, sortOrder } = await req.json();

    if (!requirement) {
      return NextResponse.json(
        { error: 'El requerimiento es obligatorio' },
        { status: 400 }
      );
    }

    const audit = await findAudit(organization.organizationId, params.id);
    if (!audit) {
      return NextResponse.json(
        { error: 'Auditoría no encontrada' },
        { status: 404 }
      );
    }

    const item = await prisma.auditChecklistItem.create({
      data: {
        auditId: params.id,
        requirement,
        clause,
        sortOrder: sortOrder ?? 0,
        completed: false,
      },
    });

    await createAuditRecord({
      title: 'Item de checklist agregado',
      description: `Se agregó item al checklist de auditoría ${audit.code}`,
      module: 'MANUAL',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: item.id,
      organizationId: organization.organizationId,
      newData: { requirement, clause, auditId: audit.id },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Error al crear item de checklist:', error);
    return NextResponse.json(
      { error: 'Error al crear item de checklist' },
      { status: 500 }
    );
  }
}

// PATCH /api/audits/[id]/checklist - Actualizar resultado de item
async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const organization = await requireOrganizationContext(req);
    const { itemId, result, notes, evidence, completed } = await req.json();

    if (!itemId) {
      return NextResponse.json(
        { error: 'ID del item es requerido' },
        { status: 400 }
      );
    }

    const existing = await prisma.auditChecklistItem.findFirst({
      where: auditChildScope(organization.organizationId, params.id, itemId),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Item de checklist no encontrado' },
        { status: 404 }
      );
    }

    await prisma.auditChecklistItem.updateMany({
      where: auditChildScope(organization.organizationId, params.id, itemId),
      data: {
        result: result ?? existing.result,
        notes: notes !== undefined ? notes : existing.notes,
        evidence: evidence !== undefined ? evidence : existing.evidence,
        completed: completed !== undefined ? completed : existing.completed,
      },
    });
    const item = await prisma.auditChecklistItem.findFirstOrThrow({
      where: auditChildScope(organization.organizationId, params.id, itemId),
    });

    await createAuditRecord({
      title: 'Evaluación de checklist actualizada',
      description: `Se actualizó resultado del item ${itemId}`,
      module: 'MANUAL',
      category: 'UPDATE',
      userId: req.user!.userId,
      entityId: item.id,
      organizationId: organization.organizationId,
      previousData: { result: existing.result, completed: existing.completed },
      newData: { result: item.result, completed: item.completed },
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Error al actualizar item de checklist:', error);
    return NextResponse.json(
      { error: 'Error al actualizar item de checklist' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler, ['ADMIN', 'RRHH', 'IT']);
export const PATCH = withAuth(patchHandler, ['ADMIN', 'RRHH', 'IT']);
