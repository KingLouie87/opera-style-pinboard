# Broken Horizon Pinboard Rebuild

Diese Version setzt die App als Pinboard-only App neu zusammen und legt eine klare visuelle Grundlage für die weitere Entwicklung.

## Schwerpunkt

- Broken-Horizon-inspirierte Farbwelt
- durchgehender Glasbalken in geöffneten Boards
- reduzierte Rundungen
- Website-Font-System mit Sora, Inter und IBM Plex Mono via `next/font/google`
- Glass-System mit zentralen Tokens
- Login im gleichen Materialsystem
- Boards mit Bereichen
- Pins mit Teilbereichen
- drei Ansichten: Detailliert, Standard, Kompakt
- robuste Kontextmenü-Positionierung
- Dark Mode und korrigierter Light Mode

## Font-System

Die App nutzt robuste Font-Stacks mit Sora, Geist, Inter und IBM Plex Mono als gewünschte Markenrichtung. Damit der Build ohne Internet stabil läuft, werden die Google Fonts in dieser ZIP nicht erzwungen. Eine optionale Anleitung für `next/font/google` liegt in `docs/FONT_SETUP_OPTIONAL.md`.

## Migrationen

Die bestehenden Migrationen bleiben enthalten. Falls eine Spalte bereits existiert, sind die Migrationen überwiegend sicher wiederholbar angelegt.

## Hinweis

Nach dem Einspielen bitte lokal `npm install` und anschließend `npm run build` ausführen.
