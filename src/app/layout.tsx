import type { Metadata } from 'next';
import { connection } from 'next/server';
import { headers } from 'next/headers';
import './globals.css';
import { Toaster } from 'sileo';
import Providers from '@/providers/QueryProvider';

import { BRAND_APP_NAME, BRAND_ORG_SHORT } from '@/lib/brand';

export const metadata: Metadata = {
  title: {
    default: BRAND_APP_NAME,
    template: `%s | ${BRAND_ORG_SHORT}`,
  },
  description: `Plataforma institucional de gestión integral — ${BRAND_ORG_SHORT}`,
  icons: {
    icon: [{ url: '/favicon.ico' }, { url: '/Logo_CNI.png', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/apple-icon', type: 'image/png' }],
  },
};

/**
 * Layout raíz — pasa el nonce CSP al script inline de tema.
 * El middleware genera un nonce único por request (ver src/middleware.ts)
 * vía `x-nonce` + Content-Security-Policy. Next.js aplica automáticamente
 * el nonce a sus scripts y chunks de hidratación.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fuerza render dinámico para que el nonce del middleware esté disponible en SSR.
  await connection();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-md focus-visible:bg-background focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-foreground focus-visible:shadow-lg"
        >
          Saltar al contenido principal
        </a>
        <Providers>
          {children}
        </Providers>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
