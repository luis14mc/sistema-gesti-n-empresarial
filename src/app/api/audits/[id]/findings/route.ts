import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { findAudit } from '@/modules/audits/infrastructure/repository';

// POST /api/audits/[id]/findings - Agregar hallazgo
async function postHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const organization = await requireOrganizationContext(req);
    const { description, severity, evidence, clause } = await req.json();

    if (!description || !severity) {
      return NextResponse.json(
        { error: 'Descripción y severidad son requeridas' },
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

    // Generar código correlativo para el hallazgo
    const lastFinding = await prisma.auditFinding.findFirst({
      where: { auditId: params.id },
      orderBy: { code: 'desc' },
    });

    let nextNumber = 1;
    if (lastFinding?.code) {
      const parts = lastFinding.code.split('-');
      const lastNum = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastNum)) nextNumber = lastNum + 1;
    }
    const code = `${audit.code}-H${nextNumber.toString().padStart(2, '0')}`;

    const finding = await prisma.auditFinding.create({
      data: {
        auditId: params.id,
        code,
        description,
        severity,
        evidence,
        clause,
        status: 'OPEN',
      },
    });

    await createAuditRecord({
      title: 'Hallazgo registrado',
      description: `Se registró hallazgo en auditoría ${audit.code}`,
      module: 'MANUAL',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: finding.id,
      organizationId: organization.organizationId,
      newData: { code, severity, auditId: audit.id },
    });

    return NextResponse.json({ finding }, { status: 201 });
  } catch (error) {
    console.error('Error al crear hallazgo:', error);
    return NextResponse.json(
      { error: 'Error al crear hallazgo' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler, ['ADMIN', 'RRHH', 'IT']);
