/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // ExcelJS relies on Node.js module resolution and JSZip internals that do
  // not survive Next's server bundling reliably in the standalone runtime.
  // Keep it external so the production server executes the package as a
  // normal Node dependency.
  serverExternalPackages: ['exceljs'],
  async redirects() {
    return [
      { source: '/equipment', destination: '/activos/equipos', permanent: false },
      { source: '/equipment/:path*', destination: '/activos/equipos/:path*', permanent: false },
      { source: '/assignments', destination: '/activos/asignaciones', permanent: false },
      { source: '/assignments/:path*', destination: '/activos/asignaciones/:path*', permanent: false },
      { source: '/equipment-disposal', destination: '/activos/bajas', permanent: false },
      { source: '/equipment-disposal/:path*', destination: '/activos/bajas/:path*', permanent: false },
      { source: '/ti/licencias', destination: '/activos/licencias', permanent: false },
      { source: '/ti/licencias/:path*', destination: '/activos/licencias/:path*', permanent: false },
    ];
  },
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/icon' }];
  },
  async headers() {
    return [
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: "default-src 'none'; img-src 'self'; sandbox" },
        ],
      },
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
