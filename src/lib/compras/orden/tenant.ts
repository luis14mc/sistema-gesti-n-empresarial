export function purchaseOrderScope(organizationId: string) {
  return { organizationId } as const;
}

export function purchaseOrderChildScope(organizationId: string) {
  return { orden: { organizationId } } as const;
}
