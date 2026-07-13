import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
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
 * Layout raíz — pasa el nonce CSP al atributo nonce del <html>.
 * El middleware genera un nonce único por request (ver src/middleware.ts)
 * y lo expone en el header `x-sge-nonce`. Next.js aplica automáticamente
 * el nonce a sus scripts y chunks.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get('x-sge-nonce') ?? undefined;

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
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
