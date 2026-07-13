import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import { connection } from 'next/server';
import { headers } from 'next/headers';
import './globals.css';
import { Toaster } from 'sileo';
import Providers from '@/providers/QueryProvider';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sistema de Gestión Empresarial',
  description: 'Plataforma institucional de gestión integral',
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
      <body className={`${montserrat.variable} antialiased`} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
