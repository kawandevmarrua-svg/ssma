import type { Metadata, Viewport } from 'next';
import { Poppins, JetBrains_Mono } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';
import { Toaster } from '@/components/ui/sonner';
import { ConfirmProvider } from '@/components/confirm-provider';
import { PwaRegister } from '@/components/pwa-register';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Marrua',
  description:
    'Plataforma de gestão SSMA com visão 360°: inspeções, alertas, indicadores e equipes em uma única solução.',
  applicationName: 'Marrua',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Marrua',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f97316',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${poppins.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        <NextTopLoader color="#f97316" height={3} showSpinner={false} />
        <ConfirmProvider>{children}</ConfirmProvider>
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}
