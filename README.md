# Opera Style Pinboard PWA

Ein eigenes Pinboard-Tool als moderne Web-App: Boards, frei sortierbare Bereiche, Pins mit Link/Text/Bild, Drag-and-Drop, Supabase-Login, private Bildablage und PWA-Installation.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, Postgres und Storage
- dnd-kit für Drag-and-Drop
- eigene API-Routen für Link Preview, Bild-Caching und private Bildauslieferung

## MVP-Funktionen

- E-Mail-Magic-Link-Login
- Boards erstellen und verwalten
- Teilbereiche erstellen, umbenennen, löschen und sortieren
- Pins erstellen, bearbeiten, löschen, duplizieren und archivieren
- Pins per Drag-and-Drop innerhalb und zwischen Bereichen verschieben
- Link-Preview mit Titel, Beschreibung, Favicon und mehreren Website-Bildern
- Auswahl eines Website-Bildes vor dem Speichern
- eigener Bild-Upload in private Supabase Storage Buckets
- Suche und Statusfilter
- responsive Desktop- und Mobile-Oberfläche
- installierbare PWA mit Manifest und Service Worker

## Installation

```bash
npm install
cp .env.example .env.local
npm run dev
```

Öffne danach `http://localhost:3000`.

## Supabase einrichten

1. Neues Supabase-Projekt erstellen.
2. SQL Editor öffnen.
3. Den Inhalt aus `supabase/schema.sql` ausführen.
4. In Supabase Auth die Site URL setzen:
   - lokal: `http://localhost:3000`
   - später Produktion: deine echte Domain
5. Redirect URLs hinzufügen:
   - `http://localhost:3000/auth/callback`
   - `https://deine-domain.de/auth/callback`
6. `.env.local` mit Supabase URL und Anon Key füllen.

## Deployment

Empfohlen: Vercel + Supabase.

Bei Vercel diese Environment Variablen setzen:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
```

## Sicherheit

Die App enthält bereits:

- Row Level Security für Boards, Sections, Pins und Storage-Objekte
- private Storage-Auslieferung über `/api/images/...`
- URL-Validierung für Link Previews
- Blockierung privater IP-Bereiche gegen SSRF
- Fetch-Timeouts und Redirect-Limit
- Dateigrößenlimit für gecachte Website-Bilder
- Upload-Akzeptanz nur für Bilder

Für harte Produktion zusätzlich empfohlen:

- Upstash Redis oder Supabase Edge Function Rate Limits
- Viren-/Malware-Scan für Uploads
- Bildkomprimierung und Thumbnails
- vollständiger Audit-Log
- Team-/Sharing-Rechte

## Projektstruktur

```txt
app/
  api/
    cache-image/route.ts
    images/[...path]/route.ts
    link-preview/route.ts
  auth/callback/route.ts
  boards/
    [boardId]/page.tsx
    page.tsx
  login/page.tsx
components/
lib/
supabase/schema.sql
```
