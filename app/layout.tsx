import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PWARegister } from '@/components/PWARegister';
import { ThemeScript } from '@/components/pinboard/ThemeScript';

export const metadata: Metadata = {
  title: 'Pinboard',
  description: 'Broken Horizon inspired visual pinboard for links, media, files and inspiration.',
  applicationName: 'Pinboard',
  manifest: '/manifest.webmanifest'
};

export const viewport: Viewport = {
  themeColor: '#020607',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <ThemeScript />
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
