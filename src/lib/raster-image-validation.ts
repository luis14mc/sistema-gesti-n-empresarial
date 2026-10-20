const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const RIFF_SIGNATURE = Buffer.from([0x52, 0x49, 0x46, 0x46]);

export type RasterImageKind = 'png' | 'jpeg' | 'webp';

const EXTENSIONS_BY_KIND: Record<RasterImageKind, readonly string[]> = {
  png: ['png'],
  jpeg: ['jpg', 'jpeg'],
  webp: ['webp'],
};

function startsWithBuffer(data: Buffer, signature: Buffer): boolean {
  return data.length >= signature.length && data.subarray(0, signature.length).equals(signature);
}

export function looksLikeSvgPayload(buffer: Buffer): boolean {
  const head = buffer.subarray(0, Math.min(buffer.length, 256)).toString('utf8').trimStart().toLowerCase();
  return head.startsWith('<') && (head.includes('<svg') || head.startsWith('<?xml'));
}

export function detectRasterImageKind(buffer: Buffer): RasterImageKind | null {
  if (buffer.length < 12) return null;
  if (looksLikeSvgPayload(buffer)) return null;
  if (startsWithBuffer(buffer, PNG_SIGNATURE)) return 'png';
  if (startsWithBuffer(buffer, JPEG_SIGNATURE)) return 'jpeg';
  if (
    startsWithBuffer(buffer, RIFF_SIGNATURE)
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export function validateRasterLogoUpload(fileName: string, buffer: Buffer): RasterImageKind {
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase() : '';
  if (!ext || ext === 'svg' || ext === 'gif') {
    throw new Error('Formato de logo no permitido. Use PNG, JPG o WebP.');
  }
  const allowedExt = new Set(['png', 'jpg', 'jpeg', 'webp']);
  if (!allowedExt.has(ext)) {
    throw new Error('Formato de logo no permitido. Use PNG, JPG o WebP.');
  }
  const kind = detectRasterImageKind(buffer);
  if (!kind) {
    throw new Error('El archivo no es una imagen PNG, JPG o WebP válida.');
  }
  if (!EXTENSIONS_BY_KIND[kind].includes(ext)) {
    throw new Error('La extensión del archivo no coincide con su contenido.');
  }
  return kind;
}
