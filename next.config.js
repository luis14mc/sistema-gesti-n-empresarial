/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cabeceras de seguridad estrictas (Security Hardening)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY', // Previene Clickjacking
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff', // Previene MIME-sniffing
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin', // Control de filtración de referer
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload', // HSTS forzado
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()', // Bloquea uso de APIs de hardware
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;", 
            // CSP estricto (nota: unsafe-inline/eval temporalmente permitidos si los frameworks lo requieren en dev)
          },
        ],
      },
    ];
  },
};

export default nextConfig;
