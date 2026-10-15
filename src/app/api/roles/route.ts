import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';
import { ORGANIZATION_ROLE_LABELS } from '@/platform/security/authorization/roles';
import { ORGANIZATION_ROLES } from '@/platform/security/authorization/permissions';
import {
  isRoleMatrixModified,
  loadOrganizationRolePermissionMap,
} from '@/platform/security/authorization/role-permission-service';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const context = await authorizeOrganization(req, requestId, 'roles.manage');
    const roleMap = await loadOrganizationRolePermissionMap(context.organizationId);

    const counts = await prisma.organizationMembership.groupBy({
      by: ['role'],
      where: { organizationId: context.organizationId, status: 'ACTIVE' },
      _count: { _all: true },
    });
    const countByRole = new Map(counts.map((row) => [row.role, row._count._all]));

    const roles = ORGANIZATION_ROLES.map((role) => ({
      role,
      label: ORGANIZATION_ROLE_LABELS[role],
      memberCount: countByRole.get(role) ?? 0,
      modified: isRoleMatrixModified(role, roleMap),
    }));

    return NextResponse.json({ roles });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    console.error('GET /api/roles', error);
    return NextResponse.json({ error: 'Error al listar roles' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
