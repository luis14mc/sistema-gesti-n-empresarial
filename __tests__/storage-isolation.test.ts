import { describe, expect, it } from 'vitest';
import { assertTenantStoragePrefix } from '@/lib/storage/s3';

describe('protected storage namespaces', () => {
  it('requires organization-scoped logical prefixes', () => {
    expect(() => assertTenantStoragePrefix('organizations/org-a/equipment/documents')).not.toThrow();
    expect(() => assertTenantStoragePrefix('organizations/org-b/oficios/documents')).not.toThrow();
    expect(() => assertTenantStoragePrefix('equipment/documents')).toThrow('TENANT_STORAGE_PREFIX_REQUIRED');
  });
});
