/**
 * Trusted public base URL for PDF assets. Never derive from request Host headers.
 */
export function getTrustedAppBaseUrl(): string {
  const configured = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000';
  return 'http://127.0.0.1:3000';
}
