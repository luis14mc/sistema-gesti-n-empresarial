import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { auditWhere } from '@/modules/audits/infrastructure/repository';

// GET /api/audits - Listar auditorías
async function getHandler(req: AuthenticatedRequest) {
  try {
    const organization = await requireOrganizationContext(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditWhereInput = auditWhere(organization.organizationId);

    if (status) where.status = status as Prisma.EnumAuditStatusFilter;
    if (type) where.type = type as Prisma.EnumAuditTypeFilter;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { standard: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [audits, total] = await Promise.all([
      prisma.audit.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          leadAuditor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.audit.count({ where }),
    ]);

    return NextResponse.json({
      audits,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error al obtener auditorías:', error);
    return NextResponse.json(
      { error: 'Error al obtener auditorías' },
      { status: 500 }
    );
  }
}

// POST /api/audits - Crear auditoría
async function postHandler(req: AuthenticatedRequest) {
  try {
    const organization = await requireOrganizationContext(req);
    const {
      title,
      description,
      type,
      standard,
      scope,
      objectives,
      criteria,
      department,
      leadAuditorId,
      plannedDate,
    } = await req.json();

    if (!title) {
      return NextResponse.json(
        { error: 'El título es requerido' },
        { status: 400 }
      );
    }

    // Generar código correlativo con transacción para evitar race conditions
    const audit = await prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const lastAudit = await tx.audit.findFirst({
        where: auditWhere(organization.organizationId, { code: { startsWith: 'AUD-' } }),
        orderBy: { code: 'desc' },
      });

      let nextNumber = 1;
      if (lastAudit) {
        const parts = lastAudit.code.split('-');
        const lastNum = parseInt(parts[1]);
        if (!isNaN(lastNum)) nextNumber = lastNum + 1;
      }
      const code = `AUD-${nextNumber.toString().padStart(3, '0')}-${year}`;

      return tx.audit.create({
        data: {
          organizationId: organization.organizationId,
          code,
          title,
          description,
          type: type || 'INTERNAL',
          standard,
          scope,
          objectives,
          criteria,
          department,
          leadAuditorId: leadAuditorId || null,
          plannedDate: plannedDate ? new Date(plannedDate) : null,
          createdById: req.user!.userId,
        } as Prisma.AuditUncheckedCreateInput,
        include: {
          leadAuditor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
    });

    await createAuditRecord({
      title: 'Creación de auditoría',
      description: `Se creó auditoría: ${audit.title}`,
      module: 'MANUAL',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: audit.id,
      organizationId: organization.organizationId,
      newData: { code: audit.code, title, type },
    });

    return NextResponse.json({ audit }, { status: 201 });
  } catch (error) {
    console.error('Error al crear auditoría:', error);
    return NextResponse.json(
      { error: 'Error al crear auditoría' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler, ['ADMIN', 'RRHH', 'IT']);
