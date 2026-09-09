/** Rutas frontend legacy fuera de alcance — redirigir al dashboard */
export const DEPRECATED_FRONTEND_PREFIXES = [
  '/tickets',
  '/inventory',
  '/time-entries',
] as const;

export function isDeprecatedFrontendPath(pathname: string): boolean {
  return DEPRECATED_FRONTEND_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
