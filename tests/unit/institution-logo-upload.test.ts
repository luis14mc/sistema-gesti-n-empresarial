import { describe, expect, it } from 'vitest';
import { detectRasterImageKind, looksLikeSvgPayload, validateRasterLogoUpload } from '@/platform/security/uploads/raster-image-validation';

const MINIMAL_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

describe('institution logo upload validation', () => {
  it('rejects an SVG payload even when the extension is .png', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'utf8');
    expect(looksLikeSvgPayload(svg)).toBe(true);
    expect(detectRasterImageKind(svg)).toBeNull();
    expect(() => validateRasterLogoUpload('logo.png', svg)).toThrow(/PNG, JPG o WebP/);
  });

  it('accepts a valid PNG by magic bytes and extension', () => {
    expect(detectRasterImageKind(MINIMAL_PNG)).toBe('png');
    expect(validateRasterLogoUpload('logo.png', MINIMAL_PNG)).toBe('png');
  });
});
