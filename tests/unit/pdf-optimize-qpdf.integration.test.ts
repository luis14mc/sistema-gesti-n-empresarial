import { execSync } from 'node:child_process';
import { describe, expect, it, vi, afterEach } from 'vitest';

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
    vi.doUnmock('node:child_process');
    vi.resetModules();
  });

  it('runs qpdf successfully on a plain PDF without invoking Ghostscript', async () => {
    const commands: string[] = [];

    vi.doMock('node:child_process', async (importOriginal) => {
      const original = await importOriginal<typeof import('node:child_process')>();
      const realExecFile = original.execFile;

      const wrapped = ((file: string, ...rest: unknown[]) => {
        commands.push(file);
        if (file === 'gs') {
          const callback = rest.find((arg) => typeof arg === 'function') as
            | ((error: Error | null, stdout: string, stderr: string) => void)
            | undefined;
          callback?.(new Error('Ghostscript must not run when qpdf succeeds'), '', '');
          return {} as import('node:child_process').ChildProcess;
        }
        return (realExecFile as (...args: unknown[]) => import('node:child_process').ChildProcess)(file, ...rest);
      }) as typeof realExecFile;
      wrapped.__promisify__ = realExecFile.__promisify__;

      return { ...original, execFile: wrapped };
    });

    const previousEnabled = process.env.PDF_OPTIMIZE_ENABLED;
    process.env.PDF_OPTIMIZE_ENABLED = 'true';

    const { optimizePdf } = await import('@/platform/pdf/optimize');
    const result = await optimizePdf(PLAIN_TEXT_PDF);

    process.env.PDF_OPTIMIZE_ENABLED = previousEnabled;

    expect(commands.filter((cmd) => cmd === 'qpdf').length).toBeGreaterThanOrEqual(1);
    expect(commands.filter((cmd) => cmd === 'gs')).toHaveLength(0);
    expect(result.signed).toBe(false);
    expect(result.buffer.length).toBeGreaterThan(0);
  });
});
