export function disposalScope(organizationId: string, id: string) {
  return { id, organizationId } as const;
}

export function disposalDocumentScope(organizationId: string, disposalId: string, documentId: string) {
  return { id: documentId, disposalId, organizationId } as const;
}

export function disposalPolicyScope(organizationId: string) {
  return { organizationId } as const;
}

export function disposalSequenceScope(organizationId: string, year: number) {
  return {
    organizationId_documentType_year: {
      organizationId,
      documentType: 'EQUIPMENT_DISPOSAL' as const,
      year,
    },
  } as const;
}
