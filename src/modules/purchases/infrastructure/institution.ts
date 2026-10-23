import { access, readFile } from 'fs/promises';
import { checkUrlForSsrf } from '@/platform/integrations/application/ssrf-guard';
import path from 'path';
import { validateRasterLogoUpload } from '@/platform/security/uploads/raster-image-validation';
import { getStorage } from '@/platform/storage';
import {
  DEFAULT_INSTITUTION_SETTINGS,
  getInstitutionSettings,
  saveInstitutionSettings,
  type InstitutionSettings,
} from '@/modules/purchases/infrastructure/institution-store';
import { PurchaseBusinessError } from '@/modules/purchases/domain/errors';

const MIME_BY_EXT: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

const FALLBACK_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#003366"/><text x="60" y="68" text-anchor="middle" fill="#fff" font-family="Arial" font-size="28" font-weight="700">CNI</text></svg>`;

const PUBLIC_ROOT = path.resolve(process.cwd(), 'public');

/**
 * Verifica que una URL candidata a logo sea segura:
 * - Solo se permiten URLs https:// (no http:// — evitar SSRF en red interna).
 * - Solo se permiten data URIs con tipos MIME de imagen explícitos.
 * - Los paths deben estar dentro de PUBLIC_ROOT (mitiga path traversal `../`).
 * Retorna la URL sanitizada o null si es peligrosa/inválida.
 */
export function sanitizeLogoCandidate(candidate: string): string | null {
  if (!candidate || typeof candidate !== 'string') return null;

  if (candidate.startsWith('organizations/') && !candidate.includes('..')) {
    return candidate;
  }

  if (candidate.startsWith('https://')) {
    try {
      const u = new URL(candidate);
      if (u.protocol !== 'https:') return null;
      if (!u.hostname || u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname.startsWith('192.168.') || u.hostname.startsWith('10.')) {
        return null;
      }
      if (!checkUrlForSsrf(candidate).ok) return null;
      return candidate;
    } catch {
      return null;
    }
  }

  if (candidate.startsWith('data:')) {
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(candidate)) return null;
    return candidate;
  }

  if (candidate.includes(':') || candidate.startsWith('//')) return null;

  if (candidate.includes('..')) return null;

  if (/^\/(etc|proc|root|var|usr|home|sys|tmp|dev|boot|opt|srv|mnt|media)(\/|$)/.test(candidate)) {
    return null;
  }

  const relative = candidate.replace(/^\/+/, '');
  const absolute = path.resolve(PUBLIC_ROOT, relative);
  const normalizedRoot = PUBLIC_ROOT.endsWith(path.sep) ? PUBLIC_ROOT : PUBLIC_ROOT + path.sep;
  if (absolute !== PUBLIC_ROOT && !absolute.startsWith(normalizedRoot)) return null;

  return candidate;
}

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

async function storageKeyToDataUri(storageKey: string): Promise<string | null> {
  try {
    const stored = await getStorage().get(storageKey);
    const mime = stored.mimeType.startsWith('image/') ? stored.mimeType : 'image/png';
    return `data:${mime};base64,${stored.buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function resolveInstitutionLogoDataUri(logoPath?: string): Promise<string> {
  const candidates = [
    logoPath,
    '/Logo_CNI.png',
    '/assets/logo/logo-cni.png',
    '/logo-cni.png',
    '/uploads/institution/logo.png',
    '/assets/logo/logo.png',
  ].filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index);

  for (const candidate of candidates) {
    const safe = sanitizeLogoCandidate(candidate);
    if (!safe) continue;

    if (safe.startsWith('organizations/')) {
      const dataUri = await storageKeyToDataUri(safe);
      if (dataUri) return dataUri;
      continue;
    }

    if (safe.startsWith('https://') || safe.startsWith('data:')) {
      return safe;
    }

    const relative = safe.replace(/^\//, '');
    const absolute = path.join(PUBLIC_ROOT, relative);
    const dataUri = await fileToDataUri(absolute);
    if (dataUri) return dataUri;
  }

  return `data:image/svg+xml;base64,${Buffer.from(FALLBACK_LOGO_SVG).toString('base64')}`;
}

export async function getInstitutionConfig(organizationId: string) {
  const settings = await getInstitutionSettings(organizationId);
  return {
    ...settings,
    logoUrl: await resolveInstitutionLogoDataUri(settings.logoPath),
  };
}

export async function saveInstitutionLogo(
  organizationId: string,
  actorUserId: string,
  file: File,
): Promise<string> {
  if (file.size > 2 * 1024 * 1024) {
    throw new PurchaseBusinessError('El logo no puede superar 2 MB.', 500);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  validateRasterLogoUpload(file.name, buffer);

  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '.png';
  const mimeType =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  const storage = getStorage();
  const stored = await storage.put({
    prefix: `organizations/${organizationId}/compras/institution`,
    originalName: file.name,
    mimeType,
    size: buffer.length,
    buffer,
    desiredName: `logo${ext}`,
  });

  await saveInstitutionSettings(organizationId, actorUserId, { logoPath: stored.key });

  return stored.key;
}
