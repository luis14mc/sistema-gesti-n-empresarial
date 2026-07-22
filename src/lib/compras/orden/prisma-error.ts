import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

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

export function handlePrismaRouteError(error: unknown, context: string) {
  console.error(`[${context}]`, error);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const payload = {
      error: error.message,
      code: error.code,
      meta: error.meta ?? null,
      context,
    };
    return NextResponse.json(
      process.env.NODE_ENV === 'development'
        ? payload
        : { error: error.message, code: error.code },
      { status: statusFromPrismaCode(error.code) }
    );
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return NextResponse.json(
      process.env.NODE_ENV === 'development'
        ? { error: error.message, code: 'P_VALIDATION', context }
        : { error: 'Error de validación en consulta Prisma' },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : 'Error interno';
  return NextResponse.json(
    process.env.NODE_ENV === 'development'
      ? { error: message, context, stack: error instanceof Error ? error.stack : undefined }
      : { error: message },
    { status: 500 }
  );
}

export function mapLegacyEstadoFilter(status?: string): string | undefined {
  if (!status) return undefined;
  const map: Record<string, string> = {
    BORRADOR: 'DRAFT',
    GENERADA: 'GENERATED',
    EMITIDA: 'ISSUED',
    ANULADA: 'CANCELLED',
    CERRADA: 'CLOSED',
  };
  return map[status] ?? status;
}
