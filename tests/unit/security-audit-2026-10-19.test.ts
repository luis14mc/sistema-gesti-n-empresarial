import { afterEach, describe, expect, it } from 'vitest';
import { sanitizeLogoCandidate } from '@/modules/purchases/infrastructure/institution';
import { isEquipmentDocumentUrlAllowed } from '@/modules/equipment/infrastructure/equipment-attachments';

describe('F-2: logo URL uses the platform SSRF policy', () => {
  it.each([
    'https://169.254.169.254/latest/meta-data/iam/security-credentials/',
    'https://172.16.5.5/internal-admin',
    'https://100.64.0.1/x',
    'https://metadata.google.internal/computeMetadata/v1/',
    'https://[::1]:8500/',
    'https://[fe80::1]/x',
  ])('rejects %s', (url) => {
    expect(sanitizeLogoCandidate(url)).toBeNull();
  });

  it('still accepts a public https logo', () => {
    expect(sanitizeLogoCandidate('https://www.cni.hn/logo.png')).toBe('https://www.cni.hn/logo.png');
  });
});

describe('Hardening 2: equipment assignment document URL must belong to the tenant', () => {
  const previous = process.env.S3_ENDPOINT;
  afterEach(() => {
    if (previous === undefined) delete process.env.S3_ENDPOINT;
    else process.env.S3_ENDPOINT = previous;
  });

  it('accepts local uploads of the same organization', () => {
    expect(isEquipmentDocumentUrlAllowed('/uploads/organizations/org-1/equipment/acta.pdf', 'org-1')).toBe(true);
  });

  it('accepts signed URLs from the configured storage endpoint for the same organization', () => {
    process.env.S3_ENDPOINT = 'https://abc123.r2.cloudflarestorage.com';
    expect(
      isEquipmentDocumentUrlAllowed(
        'https://abc123.r2.cloudflarestorage.com/cni-sge-files/organizations/org-1/equipment/acta.pdf?X-Amz-Signature=x',
        'org-1',
      ),
    ).toBe(true);
  });

  it.each([
    ['otra organización', '/uploads/organizations/org-2/equipment/acta.pdf'],
    ['host externo', 'https://evil.example/organizations/org-1/acta.pdf'],
    ['javascript:', 'javascript:alert(1)'],
    ['http sin TLS', 'http://abc123.r2.cloudflarestorage.com/organizations/org-1/a.pdf'],
    ['path traversal', '/uploads/organizations/org-1/../org-2/a.pdf'],
  ])('rejects %s', (_label, url) => {
    process.env.S3_ENDPOINT = 'https://abc123.r2.cloudflarestorage.com';
    expect(isEquipmentDocumentUrlAllowed(url, 'org-1')).toBe(false);
  });
});
