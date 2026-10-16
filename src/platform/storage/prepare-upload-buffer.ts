import { optimizePdf } from '@/platform/pdf/optimize';

export type PreparedUploadBuffer = {
  buffer: Buffer;
  size: number;
  originalSizeBytes?: number;
  storedSizeBytes?: number;
  optimized?: boolean;
  signedPdf?: boolean;
  pdfOptimizationSummary?: string;
};

export async function prepareUploadBuffer(buffer: Buffer, mimeType: string): Promise<PreparedUploadBuffer> {
  if (mimeType !== 'application/pdf') {
    return { buffer, size: buffer.length };
  }

  const result = await optimizePdf(buffer);
  return {
    buffer: result.buffer,
    size: result.buffer.length,
    originalSizeBytes: result.originalSizeBytes,
    storedSizeBytes: result.storedSizeBytes,
    optimized: result.optimized,
    signedPdf: result.signed,
    pdfOptimizationSummary: result.summary,
  };
}
