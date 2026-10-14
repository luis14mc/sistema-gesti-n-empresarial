const FALLBACK_ORGANIZATION_ID = 'org_cni_default';

export function canonicalOrganizationId(): string {
  return process.env.DEFAULT_ORGANIZATION_ID || FALLBACK_ORGANIZATION_ID;
}
