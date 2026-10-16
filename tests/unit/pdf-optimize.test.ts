import { describe, expect, it } from 'vitest';
import { optimizePdf } from '@/platform/pdf/optimize';

describe('optimizePdf', () => {
  it('returns signed PDF unchanged when ByteRange is present', async () => {
    const signed = Buffer.from('%PDF-1.4\n/ByteRange [0 100 200 300]\n%%EOF');
    const result = await optimizePdf(signed);
    expect(result.signed).toBe(true);
    expect(result.buffer.equals(signed)).toBe(true);
    expect(result.optimized).toBe(false);
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
