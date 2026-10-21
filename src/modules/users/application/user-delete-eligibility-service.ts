import type { AuthenticatedRequest } from '@/lib/middleware';
import { NextResponse } from 'next/server';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { PermissionDeniedError } from '@/platform/domain/errors';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { countBlockingUserReferences } from '@/modules/users/application/user-reference-counts';
import { prisma } from '@/modules/users/infrastructure/user-repository';

export async function getUserDeleteEligibility(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await ctx.params;
    const { organizationId } = await authorizeOrganization(req, requestId, 'users.read');

    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: id, organizationId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const referenceCount = await countBlockingUserReferences(id);
    return NextResponse.json({
      canHardDelete: referenceCount === 0 && id !== req.user!.userId,
      referenceCount,
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (isOrganizationContextError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error al evaluar eliminación' }, { status: 500 });
  }
}

