export function auditScope(organizationId: string, id?: string) {
  return id ? { id, organizationId } as const : { organizationId } as const;
}

export function auditChildScope(organizationId: string, auditId?: string, id?: string) {
  return {
    ...(id ? { id } : {}),
    ...(auditId ? { auditId } : {}),
    audit: auditScope(organizationId, auditId),
  } as const;
}

export function correctiveActionScope(organizationId: string, id?: string) {
  return id ? { id, organizationId } as const : { organizationId } as const;
}

export function auditRecordScope(organizationId: string) {
  return { organizationId } as const;
}
