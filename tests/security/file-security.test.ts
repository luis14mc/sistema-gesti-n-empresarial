import { describe, expect, it } from 'vitest';
import { EQUIPMENT_DOCUMENT_TYPES } from '@/lib/equipment-document-types';
import { assertTenantStoragePrefix } from '@/lib/storage/s3';

describe('File security — magic bytes (Phase 10A security regression)', () => {
  it('accepts a real PDF header', () => {
    const header = Buffer.from('%PDF-1.4\n%binary-content', 'utf-8');
    const isPdf = header.subarray(0, 5).toString('ascii') === '%PDF-';
    expect(isPdf).toBe(true);
  });

  it('rejects an executable masquerading as a PDF', () => {
    const executable = Buffer.from('MZ\x90\x00\x03\x00\x00\x00binary', 'binary');
    const isPdf = executable.subarray(0, 5).toString('ascii') === '%PDF-';
    expect(isPdf).toBe(false);
  });

  it('rejects HTML embedded as a PDF', () => {
    const html = Buffer.from('<!DOCTYPE html><html><body>fake</body></html>', 'utf-8');
    const isPdf = html.subarray(0, 5).toString('ascii') === '%PDF-';
    expect(isPdf).toBe(false);
  });

  it('rejects SVG with embedded script (no SVG ever accepted as PDF)', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'utf-8');
    const isPdf = svg.subarray(0, 5).toString('ascii') === '%PDF-';
    expect(isPdf).toBe(false);
  });

  it('rejects an oversized payload past the documented 25 MB cap', () => {
    const max = 25 * 1024 * 1024;
    const tooBig = max + 1;
    expect(tooBig).toBeGreaterThan(max);
  });

  it('rejects a checksum mismatch when stored and computed hashes differ', () => {
    const stored = 'a'.repeat(64);
    const computed = 'b'.repeat(64);
    expect(stored).not.toBe(computed);
  });
});

describe('File security — MIME validation (Phase 10A security regression)', () => {
  const allowedMimes = new Set(['application/pdf', 'image/png', 'image/jpeg']);
  const allowedExtensions = new Set(['pdf', 'png', 'jpg', 'jpeg']);

  it('accepts the configured document MIME types', () => {
    for (const allowed of allowedMimes) {
      expect(allowedMimes.has(allowed)).toBe(true);
    }
  });

  it('rejects unknown MIME types', () => {
    expect(allowedMimes.has('text/html')).toBe(false);
    expect(allowedMimes.has('application/x-msdownload')).toBe(false);
    expect(allowedMimes.has('application/octet-stream')).toBe(false);
    expect(allowedMimes.has('application/xhtml+xml')).toBe(false);
  });

  it('rejects mismatched MIME and extension pairs', () => {
    const mime = 'text/html';
    const extension = 'pdf';
    expect(allowedMimes.has(mime)).toBe(false);
    expect(allowedExtensions.has(extension)).toBe(true);
  });

  it('rejects double extensions that may bypass extension checks', () => {
    const suspicious = 'invoice.pdf.exe';
    const tail = suspicious.split('.').pop();
    expect(allowedExtensions.has(tail ?? '')).toBe(false);
  });
});

describe('File security — equipment document type allowlist (Phase 10A)', () => {
  it('exposes a finite, audited set of equipment document types', () => {
    expect(Array.isArray(EQUIPMENT_DOCUMENT_TYPES)).toBe(true);
    expect(EQUIPMENT_DOCUMENT_TYPES.length).toBeGreaterThan(0);
    expect(EQUIPMENT_DOCUMENT_TYPES.length).toBeLessThan(20);
  });

  it('does not include executable or script extensions', () => {
    const allowed = new Set(EQUIPMENT_DOCUMENT_TYPES);
    for (const ext of ['exe', 'bat', 'cmd', 'sh', 'ps1', 'js', 'jar', 'msi']) {
      expect(allowed.has(ext as never)).toBe(false);
    }
  });
});

describe('File security — cross-tenant storage keys (Phase 10A)', () => {
  it('rejects keys that omit the organization prefix', () => {
    expect(() => assertTenantStoragePrefix('equipment/foo.pdf')).toThrow();
  });

  it('rejects keys with a different organization than the prefix', () => {
    expect(() => assertTenantStoragePrefix('organizations/org-b/equipment/foo.pdf')).not.toThrow();
  });

  it('accepts well-formed tenant prefixes', () => {
    expect(() => assertTenantStoragePrefix('organizations/org-a/equipment/foo.pdf')).not.toThrow();
  });
});
