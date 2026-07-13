import { access } from 'fs/promises';
import { readFile } from 'fs/promises';
import path from 'path';

const MIME_BY_EXT: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

export function getInstitutionName(): string {
  return process.env.INSTITUTION_NAME ?? 'Sistema de Gestión Empresarial';
}

/**
 * Resolves the institutional logo as a data URI from /public when possible,
 * avoiding network fetches inside Puppeteer (SSRF mitigation).
 */
const LOGO_CANDIDATES = [
  process.env.INSTITUTION_LOGO_PATH,
  '/assets/logo/logo.png',
  '/assets/logo/logo.svg',
  '/logo-cni.svg',
].filter((value): value is string => Boolean(value));

export async function resolveInstitutionLogoDataUri(): Promise<string> {
  for (const logoPath of LOGO_CANDIDATES) {
    if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
      continue;
    }

    const relative = logoPath.replace(/^\//, '');
    const absolute = path.join(process.cwd(), 'public', relative);
    try {
      await access(absolute);
      const buffer = await readFile(absolute);
      const ext = path.extname(relative).slice(1).toLowerCase() || 'svg';
      const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch {
      continue;
    }
  }

  throw new Error('No se encontró logo institucional en /public');
}

export async function getInstitutionConfig() {
  return {
    name: getInstitutionName(),
    logoUrl: await resolveInstitutionLogoDataUri(),
  };
}
