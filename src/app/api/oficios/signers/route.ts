import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { oficioOrganizationFailure } from '@/modules/oficios/presentation/http';
import { normalizeOficioDependency } from '@/lib/oficios-numbering';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.read');
    const { searchParams } = new URL(req.url);
    const dependency = searchParams.get('dependency');
    const activeOnly = searchParams.get('active') !== 'false';

    const signers = await prisma.oficioSigner.findMany({
      where: {
        organizationId: organization.organizationId,
        ...(activeOnly ? { isActive: true } : {}),
        ...(dependency
          ? {
              OR: [
                { dependency: normalizeOficioDependency(dependency) },
                { dependency: null },
              ],
            }
          : {}),
      },
      orderBy: [{ name: 'asc' }],
    });

    return NextResponse.json({ signers });
  } catch (error) {
    const organizationResponse = oficioOrganizationFailure(error, requestId);
    if (organizationResponse) return organizationResponse;
    return NextResponse.json({ error: 'Error al listar firmantes' }, { status: 500 });
  }
}

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.configure');
    const body = await req.json();
    const name = String(body.name ?? '').trim();
    const positionTitle = String(body.positionTitle ?? '').trim();

    if (!name || !positionTitle) {
      return NextResponse.json(
        { error: 'Nombre y cargo del firmante son obligatorios' },
        { status: 400 },
      );
    }

    const signer = await prisma.oficioSigner.create({
      data: {
        organizationId: organization.organizationId,
        name,
        positionTitle,
        dependency: body.dependency ? normalizeOficioDependency(body.dependency) : null,
        isActive: body.isActive !== false,
        createdById: req.user!.userId,
      },
    });

    await createAuditRecord({
      title: 'Firmante de oficios creado',
      description: `${signer.name} — ${signer.positionTitle}`,
      module: 'OFICIOS',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: signer.id,
      organizationId: organization.organizationId,
      newData: signer,
    });

    return NextResponse.json({ signer }, { status: 201 });
  } catch (error) {
    const organizationResponse = oficioOrganizationFailure(error, requestId);
    if (organizationResponse) return organizationResponse;
    return NextResponse.json({ error: 'Error al crear firmante' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
