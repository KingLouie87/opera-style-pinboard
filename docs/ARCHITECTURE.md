# Architektur

## Produktidee

Die App ist ein persönliches, visuelles Pinboard. Sie übernimmt die Stärke von Operas Pinboard, nämlich schnelle visuelle Sammlungen, erweitert sie aber um mehrere Boards, frei konfigurierbare Bereiche, private Speicherung, echte Drag-and-Drop-Persistenz und mobile Nutzung.

## Hauptmodule

1. **Auth**
   - Supabase Magic Link Login
   - Session über SSR-Cookies

2. **Boards**
   - Sammlungsebene
   - Name, Beschreibung, optional Cover

3. **Sections**
   - frei sortierbare Teilbereiche eines Boards
   - Desktop: horizontale Spalten
   - Mobile: horizontal scrollbare Spalten mit Touch-DnD

4. **Pins**
   - optionale Inhalte: Titel, Beschreibung, URL, Bild, Notiz, Tags, Status
   - Position wird in der Datenbank gespeichert

5. **Link Preview**
   - API Route ruft HTML ab
   - blockiert private IPs und unsichere Schemes
   - liest Open Graph, Twitter Cards, Favicons und img-Tags aus

6. **Images**
   - eigene Uploads direkt nach Supabase Storage
   - Website-Bilder werden zuerst angezeigt, dann nach Auswahl gecacht
   - private Auslieferung über `/api/images/...`

## API-Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/api/link-preview` | URL analysieren, Metadaten und Bildkandidaten zurückgeben |
| POST | `/api/cache-image` | ausgewähltes Website-Bild sicher abrufen und privat speichern |
| GET | `/api/images/[...path]` | privates Storage-Bild nur für angemeldeten Besitzer ausliefern |

## Ausbauversion

- echtes Revision/Undo-System
- Papierkorb-Seite
- Board-Export und Import als JSON
- Opera-Bookmarks-Import
- Share-Links mit Berechtigungen
- Team-Boards
- Thumbnails und responsive Bildgrößen
- Offline-Queue für Drag-and-Drop-Änderungen
- Volltextsuche über Postgres `tsvector`
- Command Palette
- Browser Extension zum schnellen Speichern von Links
