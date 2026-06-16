# Broken Horizon Font- und Glass-System für die Pinboard-App

Diese Version übernimmt die gestalterische Richtung aus den Broken-Horizon-Website-CSS-Dateien in die Pinboard-App: dunkles Glas, cineastische Tiefe, warme Textfarben, reduzierte Linien und die Schriftlogik aus Sora, Geist, Inter und IBM Plex Mono.

## Aktueller Stand in der ZIP

Die App nutzt robuste CSS-Font-Stacks, damit `npm run build` auch dann funktioniert, wenn während des Builds keine Google-Fonts-Verbindung verfügbar ist.

In `app/globals.css` sind diese Tokens gesetzt:

```css
:root {
  --app-font-display: "Sora", "Geist", "Inter", system-ui, sans-serif;
  --app-font-body: "Geist", "Inter", system-ui, sans-serif;
  --app-font-mono: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
}
```

Damit nutzt die App die gewünschte Schrift sofort, sobald die Fonts im Browser verfügbar sind. Wenn sie nicht verfügbar sind, fällt sie sauber auf Systemschriften zurück.

## Welche Fonts benötigt werden

- **Sora** für große Display-Elemente, Board-Titel, Login-Headline und Hero-Texte.
- **Geist** als UI- und Body-Schrift.
- **Inter** als zusätzlicher UI-Fallback.
- **IBM Plex Mono** für Domains, kleine Labels, technische Kicker und Metadaten.

## Optional: Fonts fest über `next/font/google` einbinden

Wenn du möchtest, dass Next.js die Fonts kontrolliert einbindet und optimiert, kannst du später `app/layout.tsx` auf `next/font/google` umstellen.

Beispiel:

```tsx
import { Sora, Geist, Inter, IBM_Plex_Mono } from "next/font/google";

const sora = Sora({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap"
});
```

Dann auf das `html`-Element legen:

```tsx
<html lang="de" className={`${sora.variable} ${geist.variable} ${inter.variable} ${ibmPlexMono.variable}`}>
```

Und in `globals.css` die Tokens so anpassen:

```css
:root {
  --app-font-display: var(--font-display), var(--font-body), var(--font-inter), system-ui, sans-serif;
  --app-font-body: var(--font-body), var(--font-inter), system-ui, sans-serif;
  --app-font-mono: var(--font-mono), "SFMono-Regular", Consolas, monospace;
}
```

## Wichtig für lokale Builds

`next/font/google` braucht beim Build eine Verbindung zu Google Fonts. Falls `npm run build` mit „Failed to fetch font“ scheitert, bleibe bei der aktuellen CSS-Font-Stack-Lösung oder stelle sicher, dass die Build-Umgebung Zugriff auf Google Fonts hat.

## Prüfung im Browser

1. App öffnen.
2. DevTools öffnen.
3. Ein Textelement auswählen.
4. Im Reiter „Computed“ nach `font-family` suchen.
5. Bei großen Headlines sollte Sora sichtbar sein, bei UI-Text Geist/Inter und bei Domains IBM Plex Mono.

## Glass-System

Die Board-Topbar und das Login-Panel nutzen den Website-Header als Vorlage:

- dunkles transparentes Material
- starker Blur
- erhöhte Sättigung und Kontrast
- innere Kanten
- untere Glaslippe
- ruhiger Schatten
- cineastische Broken-Horizon-Farbwelt

Die wichtigsten Tokens liegen in `globals.css` unter `--bh-app-*` und `--app-glass-*`.
