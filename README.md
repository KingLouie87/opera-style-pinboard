# Broken Horizon Pinboard Rebuild

Pinboard-only App mit Broken-Horizon-inspirierter Glas- und Gallery-Oberfläche.

Siehe `docs/REBUILD_BROKEN_HORIZON_PINBOARD.md`.

# Pinboard Focused Premium

A focused premium visual pinboard app built with Next.js, TypeScript, Tailwind CSS and Supabase.

The app intentionally contains only the Pinboard product surface:

- Boards
- ungrouped inbox pins
- collapsible board sections
- visual pin cards
- link import
- file upload
- image upload with WebP conversion
- video pin detection and playback focus mode
- global search and filters
- drag and drop between inbox and sections
- mobile glass bottom navigation

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Supabase setup

For a fresh project, run:

```txt
supabase/schema.sql
```

For an existing project from an older version, run:

```txt
supabase/migrations/20260615_pinboard_focused_sections.sql
```

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Deployment

Push the project to GitHub and import it in Vercel. Add the same environment variables in Vercel and set Supabase Auth redirect URLs for your production domain.

## Opera Quick Capture Extension

Diese Version enthält zusätzlich eine lokale Opera/Chromium-Erweiterung im Ordner `opera-extension`.

Kurzinstallation:

1. App lokal starten oder Vercel-URL bereithalten.
2. Opera öffnen: `opera://extensions`
3. Entwicklermodus aktivieren.
4. `Entpackte Erweiterung laden` klicken.
5. Ordner `opera-extension` auswählen.
6. Im Erweiterungs-Popup App-Adresse speichern, z. B. `http://localhost:3000` oder die Vercel-URL.
7. Auf einer Website `Seite pinnen` klicken.

Die Extension öffnet `/capture` und übergibt URL, Seitentitel und optional markierten Text. Rechtsklick-Kontextmenüs für Seite, Link, Bild und Auswahl sind ebenfalls enthalten.
