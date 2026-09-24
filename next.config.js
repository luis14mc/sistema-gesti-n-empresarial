/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/icon' }];
  },
  async redirects() {
    return [
      { source: '/ti/licencias', destination: '/equipment/licencias', permanent: false },
      { source: '/ti/licencias/:path*', destination: '/equipment/licencias/:path*', permanent: false },
    ];
  },
  // Cabeceras de seguridad aplicadas por src/middleware.ts en cada request:
  //   - Content-Security-Policy con nonce dinámico
  //   - X-Frame-Options DENY
  //   - X-Content-Type-Options nosniff
  //   - Referrer-Policy strict-origin-when-cross-origin
  //   - Strict-Transport-Security preload
  //   - Permissions-Policy bloqueando APIs de hardware
  //   - COOP/COEP para aislamiento cross-origin
  //
  // NOTA: NO definir Content-Security-Policy aquí — quedaría estático y
  // sobrescribiría el nonce generado por el middleware.
};

export default nextConfig;
