import type { OficioScope } from '@/lib/oficios-numbering';

const META_PREFIX = '[SGE:';
const META_SUFFIX = ']';

export interface OficioStoredMeta {
  scope: OficioScope;
  externalInstitution?: string;
}

export function encodeOficioMeta(
  comments: string | undefined,
  meta: OficioStoredMeta
): string {
  const metaTag = `${META_PREFIX}${JSON.stringify(meta)}${META_SUFFIX}`;
  const cleanComments = stripOficioMeta(comments);
  return cleanComments ? `${metaTag}\n${cleanComments}` : metaTag;
}

export function stripOficioMeta(comments?: string | null): string {
  if (!comments) return '';
  return comments.replace(/^\[SGE:\{.*?\}\]\n?/, '').trim();
}

export function decodeOficioMeta(comments?: string | null): OficioStoredMeta | null {
  if (!comments) return null;
  const match = comments.match(/^\[SGE:(\{.*?\})\]/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]) as OficioStoredMeta;
    if (!parsed.scope) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildMetaScopeFilter(scope: OficioScope): string {
  return `${META_PREFIX}{"scope":"${scope}"`;
}
