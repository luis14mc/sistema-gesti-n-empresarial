import { describe, expect, it, afterEach } from 'vitest';
import {
  equipmentDocumentFileUrl,
  equipmentDocumentKeyFromUrl,
  isEquipmentDocumentKeyForOrganization,
  toEquipmentDocumentHref,
  withStableEquipmentDocumentUrls,
} from '@/lib/equipment-document-access';
import { isEquipmentDocumentUrlAllowed } from '@/lib/equipment-attachments';
import { mapAssignmentResponse } from '@/lib/equipment-mapper';

const ORG = 'org_123';
const KEY = `organizations/${ORG}/equipment/actas-asignacion/2026/10/acta.pdf`;
const SIGNED = `https://acct.r2.cloudflarestorage.com/sge-bucket/production/${KEY}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&X-Amz-Signature=abc`;

describe('equipment document stable URLs (signed URL expiry fix)', () => {
  const originalEndpoint = process.env.S3_ENDPOINT;
  afterEach(() => {
    process.env.S3_ENDPOINT = originalEndpoint;
  });

  it('builds a stable app URL from the storage key', () => {
    expect(equipmentDocumentFileUrl(KEY)).toBe(`/api/equipment/documents/file?key=${encodeURIComponent(KEY)}`);
  });

  it('extracts the logical key from a legacy signed R2 URL (bucket + APP_ENV prefix)', () => {
    expect(equipmentDocumentKeyFromUrl(SIGNED)).toBe(KEY);
  });

  it('round-trips the key through the stable URL', () => {
    expect(equipmentDocumentKeyFromUrl(equipmentDocumentFileUrl(KEY))).toBe(KEY);
  });

  it('rewrites signed URLs to the stable route and leaves local paths untouched', () => {
    expect(toEquipmentDocumentHref(SIGNED)).toBe(equipmentDocumentFileUrl(KEY));
    const local = `/uploads/organizations/${ORG}/equipment/acta.pdf`;
    expect(toEquipmentDocumentHref(local)).toBe(local);
    expect(toEquipmentDocumentHref(null)).toBeNull();
  });

  it('normalizes legacy rows on read (no data migration needed)', () => {
    const mapped = withStableEquipmentDocumentUrls({
      deliveryDocumentUrl: SIGNED,
      returnDocumentUrl: null,
      urlNotaPdf: SIGNED,
    });
    expect(mapped.deliveryDocumentUrl).toBe(equipmentDocumentFileUrl(KEY));
    expect(mapped.urlNotaPdf).toBe(equipmentDocumentFileUrl(KEY));
    expect(mapped.returnDocumentUrl).toBeNull();
  });

  it('mapAssignmentResponse exposes stable URLs', () => {
    const mapped = mapAssignmentResponse({
      deliveryDocumentUrl: null,
      urlNotaPdf: SIGNED,
      returnDocumentUrl: SIGNED,
    } as unknown as Parameters<typeof mapAssignmentResponse>[0]);
    expect(mapped.deliveryDocumentUrl).toBe(equipmentDocumentFileUrl(KEY));
    expect(mapped.returnDocumentUrl).toBe(equipmentDocumentFileUrl(KEY));
  });

  it('only serves keys inside the caller organization', () => {
    expect(isEquipmentDocumentKeyForOrganization(KEY, ORG)).toBe(true);
    expect(isEquipmentDocumentKeyForOrganization(KEY, 'other_org')).toBe(false);
    expect(isEquipmentDocumentKeyForOrganization(`organizations/${ORG}/../other/a.pdf`, ORG)).toBe(false);
    expect(isEquipmentDocumentKeyForOrganization(`/organizations/${ORG}/a.pdf`, ORG)).toBe(false);
    expect(isEquipmentDocumentKeyForOrganization(null, ORG)).toBe(false);
  });

  it('accepts the stable route as a valid assignment document URL only for the same tenant', () => {
    expect(isEquipmentDocumentUrlAllowed(equipmentDocumentFileUrl(KEY), ORG)).toBe(true);
    expect(isEquipmentDocumentUrlAllowed(equipmentDocumentFileUrl(KEY), 'other_org')).toBe(false);
    expect(
      isEquipmentDocumentUrlAllowed(equipmentDocumentFileUrl(`organizations/${ORG}/../x/a.pdf`), ORG),
    ).toBe(false);
  });

  it('still accepts legacy signed URLs from the configured storage host', () => {
    process.env.S3_ENDPOINT = 'https://acct.r2.cloudflarestorage.com';
    expect(isEquipmentDocumentUrlAllowed(SIGNED, ORG)).toBe(true);
  });
});
