import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';

/**
 * S1 security fix: legacy CompraSolicitud endpoints are disabled because the
 * model lacks `organizationId` (IDOR cross-tenant). Use /api/compras/ordenes/*
 * which has proper tenant isolation via CompraOrden.
 */
function legacyGone() {
  return NextResponse.json(
    {
      error: 'ENDPOINT_DEPRECATED',
      message: 'Las rutas /api/compras/solicitudes/* fueron deshabilitadas por seguridad (S1). Use /api/compras/ordenes/* (multi-tenant).',
    },
    {
      status: 410,
      headers: {
        'Deprecation': 'true',
        'Sunset': 'Tue, 01 Jan 2025 00:00:00 GMT',
        'Link': '</api/compras/ordenes>; rel="successor-version"',
      },
    }
  );
}

async function getHandler(_req: AuthenticatedRequest, _ctx: { params: Promise<{ id: string }> }) {
  return legacyGone();
}

async function patchHandler(_req: AuthenticatedRequest, _ctx: { params: Promise<{ id: string }> }) {
  return legacyGone();
}

async function deleteHandler(_req: AuthenticatedRequest, _ctx: { params: Promise<{ id: string }> }) {
  return legacyGone();
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
