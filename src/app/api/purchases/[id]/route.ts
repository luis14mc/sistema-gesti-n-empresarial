import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';

const DEPRECATED = {
  error: 'El módulo /api/purchases fue reemplazado por /api/compras/solicitudes',
};

export const GET = withAuth(async () => NextResponse.json(DEPRECATED, { status: 410 }));
export const PATCH = withAuth(async () => NextResponse.json(DEPRECATED, { status: 410 }));
export const DELETE = withAuth(async () => NextResponse.json(DEPRECATED, { status: 410 }));
