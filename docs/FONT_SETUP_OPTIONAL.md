# Optionale Font-Einbindung

Die App nutzt aktuell robuste CSS-Fallbacks:

- Display: Sora, Geist, Inter, system-ui
- Body: Geist, Inter, system-ui
- Mono: IBM Plex Mono, SFMono-Regular, Consolas

Damit `npm run build` auch ohne Internet stabil läuft, werden die Google Fonts in dieser ZIP nicht über `next/font/google` erzwungen.

Wenn du die Fonts fest einbinden möchtest, kannst du in `app/layout.tsx` später `next/font/google` ergänzen, sobald dein lokaler Build und Vercel Zugriff auf Google Fonts haben.

Beispiel:

```tsx
import { Sora, Inter, IBM_Plex_Mono } from 'next/font/google';

const displayFont = Sora({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const bodyFont = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-mono', display: 'swap' });
```

Dann im Body:

```tsx
<body className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
```
