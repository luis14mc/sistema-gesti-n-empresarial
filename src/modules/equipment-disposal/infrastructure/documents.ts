import { createHash } from 'node:crypto';
import { getStorage } from '@/lib/storage';

const ALLOWED_TYPES = new Map([
  ['application/pdf', '.pdf'],
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
]);
const MAX_SIZE = 10 * 1024 * 1024;

export async function storeDisposalDocument(input: { organizationId: string; disposalId: string; file: File }) {
  const extension = `.${input.file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  const expectedExtension = ALLOWED_TYPES.get(input.file.type);
  if (!expectedExtension || (expectedExtension === '.jpg' ? !['.jpg', '.jpeg'].includes(extension) : extension !== expectedExtension)) {
    throw new Error('INVALID_DISPOSAL_DOCUMENT_TYPE');
  }
  if (input.file.size <= 0 || input.file.size > MAX_SIZE) throw new Error('INVALID_DISPOSAL_DOCUMENT_SIZE');
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const hash = createHash('sha256').update(buffer).digest('hex');
  const stored = await getStorage().put({
    prefix: `organizations/${input.organizationId}/equipment-disposals/${input.disposalId}/evidence`,
    originalName: input.file.name,
    mimeType: input.file.type,
    size: input.file.size,
    buffer,
  });
  return { stored, hash };
}
