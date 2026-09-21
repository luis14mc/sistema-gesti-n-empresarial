import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { oficioOrganizationFailure } from '@/modules/oficios/presentation/http';
import { normalizeOficioDependency } from '@/lib/oficios-numbering';
import { PermissionDeniedError } from '@/platform/domain/errors';

type RouteContext = { params: Promise<{ id: string }> };

function parseDependency(value: unknown): string | null {
  if (value == null || value === '' || value === 'ALL' || value === 'null') return null;
  return normalizeOficioDependency(String(value));
}

async function patchHandler(req: AuthenticatedRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.configure');
    const { id } = await context.params;
    const body = await req.json();

    const current = await prisma.oficioSigner.findFirst({
      where: { id, organizationId: organization.organizationId },
    });
    if (!current) {
      return NextResponse.json({ error: 'Firmante no encontrado' }, { status: 404 });
    }

    const name =
      body.name !== undefined ? String(body.name).trim() : current.name;
    const positionTitle =
      body.positionTitle !== undefined
        ? String(body.positionTitle).trim()
        : current.positionTitle;

    if (!name || !positionTitle) {
      return NextResponse.json(
        { error: 'Nombre y cargo del firmante son obligatorios' },
        { status: 400 },
      );
    }

    const dependency =
      body.dependency !== undefined ? parseDependency(body.dependency) : current.dependency;
    const isActive =
      body.isActive !== undefined ? Boolean(body.isActive) : current.isActive;

    const signer = await prisma.oficioSigner.update({
      where: { id: current.id },
      data: { name, positionTitle, dependency, isActive },
    });

    const activationChanged = current.isActive !== signer.isActive;
    await createAuditRecord({
      title: activationChanged
        ? signer.isActive
          ? 'Firmante de oficios activado'
          : 'Firmante de oficios desactivado'
        : 'Firmante de oficios actualizado',
      description: `${signer.name} — ${signer.positionTitle}`,
      module: 'OFICIOS',
      category: 'UPDATE',
      userId: req.user!.userId,
      entityId: signer.id,
      organizationId: organization.organizationId,
      previousData: {
        name: current.name,
        positionTitle: current.positionTitle,
        dependency: current.dependency,
        isActive: current.isActive,
      },
      newData: {
        name: signer.name,
        positionTitle: signer.positionTitle,
        dependency: signer.dependency,
        isActive: signer.isActive,
      },
    });

    return NextResponse.json({ signer });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const organizationResponse = oficioOrganizationFailure(error, requestId);
    if (organizationResponse) return organizationResponse;
    return NextResponse.json({ error: 'Error al actualizar firmante' }, { status: 500 });
  }
}

export const PATCH = withAuth(patchHandler);
