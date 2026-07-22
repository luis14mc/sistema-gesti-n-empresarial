import { access, mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import {
  DEFAULT_INSTITUTION_SETTINGS,
  getInstitutionSettings,
  type InstitutionSettings,
} from './institution-store';

const MIME_BY_EXT: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

const FALLBACK_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#003366"/><text x="60" y="68" text-anchor="middle" fill="#fff" font-family="Arial" font-size="28" font-weight="700">CNI</text></svg>`;

export type { InstitutionSettings };

export function getInstitutionName(): string {
  return DEFAULT_INSTITUTION_SETTINGS.name;
}

async function fileToDataUri(absolutePath: string): Promise<string | null> {
  try {
    await access(absolutePath);
    const buffer = await readFile(absolutePath);
    const ext = path.extname(absolutePath).slice(1).toLowerCase() || 'svg';
    const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function resolveInstitutionLogoDataUri(logoPath?: string): Promise<string> {
  const settings = await getInstitutionSettings();
  const candidates = [
    logoPath,
    settings.logoPath,
    '/Logo_CNI.png',
    '/assets/logo/logo-cni.png',
    '/logo-cni.png',
    '/uploads/institution/logo.png',
    '/logo-cni.svg',
    '/assets/logo/logo.svg',
    '/assets/logo/logo.png',
  ].filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index);

  for (const candidate of candidates) {
    if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
      return candidate;
    }
    if (candidate.startsWith('data:')) {
      return candidate;
    }

    const relative = candidate.replace(/^\//, '');
    const absolute = path.join(process.cwd(), 'public', relative);
    const dataUri = await fileToDataUri(absolute);
    if (dataUri) return dataUri;
  }

  return `data:image/svg+xml;base64,${Buffer.from(FALLBACK_LOGO_SVG).toString('base64')}`;
}

export async function getInstitutionConfig() {
  const settings = await getInstitutionSettings();
  return {
    ...settings,
    logoUrl: await resolveInstitutionLogoDataUri(settings.logoPath),
  };
}

const LOGO_DIR = path.join(process.cwd(), 'public', 'uploads', 'institution');
const ALLOWED_LOGO_EXT = new Set(['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif']);

export async function saveInstitutionLogo(file: File): Promise<string> {
  const ext = path.extname(file.name).slice(1).toLowerCase();
  if (!ALLOWED_LOGO_EXT.has(ext)) {
    throw new Error('Formato de logo no permitido. Use SVG, PNG, JPG o WebP.');
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('El logo no puede superar 2 MB.');
  }

  await mkdir(LOGO_DIR, { recursive: true });
  const filename = `logo.${ext}`;
  const absolute = path.join(LOGO_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolute, buffer);

  return `/uploads/institution/${filename}`;
}
