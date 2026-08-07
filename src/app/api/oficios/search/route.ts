import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import type { Role } from '@/types';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { oficioOrganizationFailure } from '@/modules/oficios/presentation/http';
import { oficioTenantScope, oficioUserAccessScope } from '@/modules/oficios/infrastructure/tenant-scope';

export const dynamic = 'force-dynamic';

/**
 * Búsqueda global de oficios.
 *
 * Filtros:
 *   - q: texto libre (number, systemNumber, subject, recipient, institution, preparedBy, comments, originalName de documentos)
 *   - scope: INTERNO | CNI | DESPACHO
 *   - status: OficioStatus
 *   - recordSource: OficioRecordSource
 *   - type: OficioType
 *   - hasDocument: true | false (true = tiene documentos, false = sin documentos)
 *   - year: filtra por año de oficioDate
 *   - dateFrom / dateTo: rango sobre oficioDate
 *   - page / pageSize
 */
async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await requireOrganizationContext(req, requestId);
    const role = req.user!.role as Role;
    if (!canAccess(role, 'oficios', 'read')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();
    const scope = searchParams.get('scope')?.trim();
    const status = searchParams.get('status')?.trim();
    const recordSource = searchParams.get('recordSource')?.trim();
    const type = searchParams.get('type')?.trim();
    const hasDocument = searchParams.get('hasDocument');
    const yearParam = searchParams.get('year');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = Math.max(1, Math.min(parseInt(searchParams.get('page') || '1', 10) || 1, 10_000));
    const pageSize = Math.min(Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10) || 25), 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.OficioWhereInput = oficioTenantScope(organization.organizationId);
    const andConditions: Prisma.OficioWhereInput[] = [];

    // RBAC: USER solo ve los propios
    if (role === 'USER') {
      andConditions.push(oficioUserAccessScope(req.user!.userId, req.user!.email));
    }

    if (scope) where.scope = scope;
    if (status) where.status = status as Prisma.EnumOficioStatusFilter;
    if (recordSource) where.recordSource = recordSource as Prisma.EnumOficioRecordSourceFilter;
    if (type) where.type = type as Prisma.EnumOficioTypeFilter;

    if (yearParam && /^\d{4}$/.test(yearParam)) {
      const y = parseInt(yearParam, 10);
      where.oficioDate = {
        gte: new Date(`${y}-01-01`),
        lt: new Date(`${y + 1}-01-01`),
      };
    }
    if (dateFrom || dateTo) {
      const range: { gte?: Date; lt?: Date } = {};
      if (dateFrom) range.gte = new Date(dateFrom);
      if (dateTo) {
        const d = new Date(dateTo);
        d.setDate(d.getDate() + 1);
        range.lt = d;
      }
      where.oficioDate = { ...(where.oficioDate as object), ...range };
    }

    if (hasDocument === 'true') where.documents = { some: {} };
    if (hasDocument === 'false') where.documents = { none: {} };

    if (q) {
      andConditions.push({
        OR: [
          { number: { contains: q, mode: 'insensitive' } },
          { systemNumber: { contains: q, mode: 'insensitive' } },
          { subject: { contains: q, mode: 'insensitive' } },
          { recipient: { contains: q, mode: 'insensitive' } },
          { institution: { contains: q, mode: 'insensitive' } },
          { preparedBy: { contains: q, mode: 'insensitive' } },
          { comments: { contains: q, mode: 'insensitive' } },
          { documents: { some: { originalName: { contains: q, mode: 'insensitive' } } } },
        ],
      });
    }
    if (andConditions.length > 0) where.AND = andConditions;

    const [oficios, total] = await Promise.all([
      prisma.oficio.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          documents: {
            select: { id: true, url: true, originalName: true, mimeType: true, isPrimary: true },
            orderBy: [{ isPrimary: 'desc' }, { uploadedAt: 'desc' }],
          },
        },
        orderBy: [{ oficioDate: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.oficio.count({ where }),
    ]);

    return NextResponse.json({
      oficios,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    const organizationResponse = oficioOrganizationFailure(error, requestId);
    if (organizationResponse) return organizationResponse;
    console.error('Error en /api/oficios/search:', error);
    return NextResponse.json({ error: 'Error al buscar oficios' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
