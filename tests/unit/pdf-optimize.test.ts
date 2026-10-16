import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { detectSignedPdf, optimizePdf } from '@/platform/pdf/optimize';

describe('detectSignedPdf', () => {
  it('detects signature markers anywhere in the buffer', () => {
    const padding = Buffer.alloc(1.2 * 1024 * 1024, 0x20);
    const tail = Buffer.from('\n/Type /Sig\n/ByteRange [0 100 200 300]\n%%EOF', 'latin1');
    const signed = Buffer.concat([Buffer.from('%PDF-1.4\n'), padding, tail]);

    expect(signed.length).toBeGreaterThan(1024 * 1024);
    expect(detectSignedPdf(signed)).toBe(true);
  });

  it('detects /SigFlags and /Type /DocTimeStamp', () => {
    expect(detectSignedPdf(Buffer.from('%PDF\n/SigFlags 3\n'))).toBe(true);
    expect(detectSignedPdf(Buffer.from('%PDF\n/Type /DocTimeStamp\n'))).toBe(true);
  });

  it('detects /Type/Sig and /Type/DocTimeStamp without spaces', () => {
    expect(detectSignedPdf(Buffer.from('%PDF\n/Type/Sig\n'))).toBe(true);
    expect(detectSignedPdf(Buffer.from('%PDF\n/Type/DocTimeStamp\n'))).toBe(true);
  });
});

describe('optimizePdf', () => {
  it('returns signed PDF unchanged when signature is at end of a large file', async () => {
    const padding = Buffer.alloc(1.2 * 1024 * 1024, 0x20);
    const tail = Buffer.from('\n/ByteRange [0 100 200 300]\n%%EOF', 'latin1');
    const signed = Buffer.concat([Buffer.from('%PDF-1.4\n'), padding, tail]);
    const beforeHash = createHash('sha256').update(signed).digest('hex');

    const result = await optimizePdf(signed);
    expect(result.signed).toBe(true);
    expect(result.buffer.equals(signed)).toBe(true);
    expect(createHash('sha256').update(result.buffer).digest('hex')).toBe(beforeHash);
  });

  it('returns original buffer when optimization is disabled', async () => {
    const previous = process.env.PDF_OPTIMIZE_ENABLED;
    process.env.PDF_OPTIMIZE_ENABLED = 'false';
    const input = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
    const result = await optimizePdf(input);
    expect(result.buffer.equals(input)).toBe(true);
    process.env.PDF_OPTIMIZE_ENABLED = previous;
  });
});
