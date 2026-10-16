import { execSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { optimizePdf, pdfTools } from '@/platform/pdf/optimize';

/** Plain text PDF (no signature); qpdf rewrites it with --warning-exit-0. */
const PLAIN_TEXT_PDF = Buffer.from(
  `%PDF-1.1
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /MediaBox [0 0 612 792] /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 44 >> stream
BT /F1 12 Tf 100 700 Td (Hola) Tj ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000015 00000 n 
0000000066 00000 n 
0000000125 00000 n 
0000000270 00000 n 
0000000366 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
446
%%EOF`,
  'latin1',
);

function hasQpdf(): boolean {
  try {
    execSync('command -v qpdf', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!hasQpdf())('optimizePdf with qpdf (integration)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs qpdf on a plain (non-encrypted) PDF and does not invoke Ghostscript', async () => {
    const previousEnabled = process.env.PDF_OPTIMIZE_ENABLED;
    process.env.PDF_OPTIMIZE_ENABLED = 'true';

    // Spies call through to the real implementation (real qpdf binary in CI).
    const encryptedSpy = vi.spyOn(pdfTools, 'isPdfEncrypted');
    const qpdfSpy = vi.spyOn(pdfTools, 'runQpdf');
    const gsSpy = vi.spyOn(pdfTools, 'runGhostscript');

    try {
      const result = await optimizePdf(PLAIN_TEXT_PDF);

      expect(encryptedSpy).toHaveBeenCalledTimes(1);
      await expect(encryptedSpy.mock.results[0].value).resolves.toBe(false);
      expect(qpdfSpy).toHaveBeenCalledTimes(1);
      expect(gsSpy).not.toHaveBeenCalled();
      expect(result.signed).toBe(false);
      expect(result.buffer.length).toBeGreaterThan(0);
    } finally {
      if (previousEnabled === undefined) delete process.env.PDF_OPTIMIZE_ENABLED;
      else process.env.PDF_OPTIMIZE_ENABLED = previousEnabled;
    }
  });
});
