/** Headers for user-uploaded static files served from /uploads (mitigate XSS via mislabeled content). */
export const UPLOAD_FILE_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox",
};
