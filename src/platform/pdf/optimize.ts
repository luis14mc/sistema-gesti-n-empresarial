import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { validatePdfOptimizeEnvironment } from '@/platform/config/env';

const execFileAsync = promisify(execFile);

export type PdfOptimizeResult = {
  buffer: Buffer;
  originalSizeBytes: number;
  storedSizeBytes: number;
  optimized: boolean;
  signed: boolean;
  summary: string;
};

const OPTIMIZE_TIMEOUT_MS = 60_000;
const MIN_REDUCTION_RATIO = 0.1;

const SIGNED_LITERAL_MARKERS = ['/ByteRange', '/SigFlags'] as const;
const SIGNED_TYPE_MARKER = /\/Type\s*\/(Sig|DocTimeStamp)\b/;

/** Scans the full PDF buffer for digital signature markers. */
export function detectSignedPdf(buffer: Buffer): boolean {
  const text = buffer.toString('latin1');
  if (SIGNED_LITERAL_MARKERS.some((marker) => text.includes(marker))) {
    return true;
  }
  return SIGNED_TYPE_MARKER.test(text);
}

async function isPdfEncrypted(inputPath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('qpdf', ['--show-encryption', inputPath], {
      timeout: OPTIMIZE_TIMEOUT_MS,
    });
    return !/not encrypted/i.test(stdout);
  } catch {
    return true;
  }
}

async function runQpdf(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync(
    'qpdf',
    [
      '--warning-exit-0',
      '--object-streams=generate',
      '--compress-streams=y',
      inputPath,
      outputPath,
    ],
    { timeout: OPTIMIZE_TIMEOUT_MS },
  );
}

async function runGhostscript(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync(
    'gs',
    [
      '-sDEVICE=pdfwrite',
      '-dPDFSETTINGS=/ebook',
      '-dCompatibilityLevel=1.6',
      '-dDetectDuplicateImages=true',
      '-dNOPAUSE',
      '-dBATCH',
      '-dSAFER',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ],
    { timeout: OPTIMIZE_TIMEOUT_MS },
  );
}

export async function optimizePdf(input: Buffer): Promise<PdfOptimizeResult> {
  const env = validatePdfOptimizeEnvironment(process.env);
  const originalSizeBytes = input.length;
  const baseResult: PdfOptimizeResult = {
    buffer: input,
    originalSizeBytes,
    storedSizeBytes: originalSizeBytes,
    optimized: false,
    signed: false,
    summary: 'PDF sin cambios.',
  };

  if (!env.PDF_OPTIMIZE_ENABLED || input.length === 0) {
    return baseResult;
  }

  const maxBytes = env.PDF_OPTIMIZE_MAX_INPUT_MB * 1024 * 1024;
  if (input.length > maxBytes) {
    return {
      ...baseResult,
      summary: `PDF mayor a ${env.PDF_OPTIMIZE_MAX_INPUT_MB} MB: se conservó sin optimizar.`,
    };
  }

  if (detectSignedPdf(input)) {
    return {
      ...baseResult,
      signed: true,
      summary: 'PDF con firma digital: se conservó sin cambios.',
    };
  }

  const workDir = await mkdtemp(join(tmpdir(), 'sge-pdf-opt-'));
  const inputPath = join(workDir, 'input.pdf');
  const qpdfPath = join(workDir, 'qpdf.pdf');
  const gsPath = join(workDir, 'gs.pdf');

  try {
    await writeFile(inputPath, input);

    if (await isPdfEncrypted(inputPath)) {
      return baseResult;
    }

    let best = input;
    let qpdfSucceeded = false;

    try {
      await runQpdf(inputPath, qpdfPath);
      const qpdfBuffer = await readFile(qpdfPath);
      best = qpdfBuffer;
      qpdfSucceeded = true;
    } catch {
      // fall through to Ghostscript on original
    }

    const shouldTryGhostscript = !qpdfSucceeded || best.length > 1_024 * 1024;
    if (shouldTryGhostscript) {
      const gsInputPath = qpdfSucceeded ? qpdfPath : inputPath;
      try {
        await runGhostscript(gsInputPath, gsPath);
        const gsBuffer = await readFile(gsPath);
        if (gsBuffer.length < best.length) best = gsBuffer;
      } catch {
        if (!qpdfSucceeded) {
          return baseResult;
        }
      }
    }

    const reduction = (originalSizeBytes - best.length) / originalSizeBytes;
    if (best.length >= originalSizeBytes || reduction < MIN_REDUCTION_RATIO) {
      return baseResult;
    }

    return {
      buffer: best,
      originalSizeBytes,
      storedSizeBytes: best.length,
      optimized: true,
      signed: false,
      summary: `PDF optimizado: ${formatMb(originalSizeBytes)} → ${formatMb(best.length)}`,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
