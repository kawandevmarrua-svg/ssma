import type { Metadata, Viewport } from 'next';
import NextTopLoader from 'nextjs-toploader';
import './globals.css';

export const metadata: Metadata = {
  title: 'Segurança em 360 — SSMA Smart Vision',
  description:
    'Plataforma de gestão SSMA com visão 360°: inspeções, alertas, indicadores e equipes em uma única solução.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background antialiased">
        <NextTopLoader color="#f97316" height={3} showSpinner={false} />
        {children}
      </body>
    </html>
  );
}
