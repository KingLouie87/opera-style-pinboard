import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PWARegister } from '@/components/PWARegister';

export const metadata: Metadata = {
  title: 'Pinboard',
  description: 'Persönliches Pinboard für Links, Bilder und Notizen',
  appleWebApp: {
    capable: true,
    title: 'Pinboard',
    statusBarStyle: 'default'
  }
};

export const viewport: Viewport = {
  themeColor: '#e44332',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
