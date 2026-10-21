import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { PermissionDeniedError } from '@/platform/domain/errors';

function statusFromPrismaCode(code: string): number {
  switch (code) {
    case 'P2002':
      return 409;
    case 'P2025':
      return 404;
    case 'P2003':
    case 'P2014':
      return 400;
    default:
      return 500;
  }
}

const INTERNAL_ERROR_MESSAGE = 'Error interno del servidor';

function statusFromError(error: unknown): number {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return statusFromPrismaCode(error.code);
  if (error instanceof Prisma.PrismaClientValidationError) return 400;
  return 500;
}

export function handlePurchaseOrderRouteError(
  error: unknown,
  context: string,
  requestId: string = crypto.randomUUID(),
) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (isOrganizationContextError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`[${context}]`, { requestId, error });

  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: INTERNAL_ERROR_MESSAGE, requestId },
      { status: statusFromError(error) },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        meta: error.meta ?? null,
        context,
      },
      { status: statusFromPrismaCode(error.code) }
    );
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return NextResponse.json(
      { error: error.message, code: 'P_VALIDATION', context },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : 'Error interno';
  return NextResponse.json(
    { error: message, context, stack: error instanceof Error ? error.stack : undefined },
    { status: 500 }
  );
}

/** @deprecated alias for migration from lib/compras/orden/prisma-error */
export const handlePrismaRouteError = handlePurchaseOrderRouteError;
