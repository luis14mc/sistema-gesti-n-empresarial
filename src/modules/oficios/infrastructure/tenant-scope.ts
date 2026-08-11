import type { Prisma } from '@prisma/client';

export function oficioTenantScope(organizationId: string): Prisma.OficioWhereInput {
  return { organizationId } as Prisma.OficioWhereInput;
}

export function oficioScope(organizationId: string, id: string): Prisma.OficioWhereInput {
  return { id, organizationId } as Prisma.OficioWhereInput;
}

export function oficioUserAccessScope(userId: string, email: string): Prisma.OficioWhereInput {
  return {
    OR: [
      { createdById: userId },
      { recipient: { contains: email, mode: 'insensitive' } },
    ],
  };
}

export function oficioDocumentScope(organizationId: string, oficioId: string): Prisma.OficioDocumentWhereInput {
  return { oficioId, oficio: oficioScope(organizationId, oficioId) };
}

export function oficioDocumentTenantScope(organizationId: string): Prisma.OficioDocumentWhereInput {
  return { oficio: oficioTenantScope(organizationId) };
}

export function oficioBatchTenantScope(organizationId: string): Prisma.OficioImportBatchWhereInput {
  return { organizationId } as Prisma.OficioImportBatchWhereInput;
}

export function oficioBatchScope(organizationId: string, id: string): Prisma.OficioImportBatchWhereInput {
  return { id, organizationId } as Prisma.OficioImportBatchWhereInput;
}

export function oficioSequenceScope(organizationId: string, year: number) {
  return {
    organizationId_documentType_year: {
      organizationId,
      documentType: 'OFFICE_DOCUMENT' as const,
      year,
    },
  };
}
