/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // ExcelJS relies on Node.js module resolution and JSZip internals that do
  // not survive Next's server bundling reliably in the standalone runtime.
  // Keep it external so the production server executes the package as a
  // normal Node dependency.
  serverExternalPackages: ['exceljs'],
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
