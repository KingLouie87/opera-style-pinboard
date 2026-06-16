# Pinboard Refinement: Views, Sections, Import Fallbacks

Diese Version ergänzt die nächste Design- und UX-Runde für das fokussierte Pinboard.

## Enthaltene Änderungen

- Robusterer Link-Import mit Fallback bei 403 oder blockierten Websites.
- 403-Links können weiterhin als Pin gespeichert werden.
- Video-Pins zeigen kein zusätzliches Video-Badge mehr auf dem Cover.
- Pin-Cover nutzen einen weicheren Blur- und Abdunklungsverlauf im unteren Bildbereich.
- Pin-Titel sind auf maximal drei Zeilen begrenzt.
- Reduzierte Radien für erwachsenere, ruhigere UI-Flächen.
- Grid-Hintergrund entfernt und durch subtile Gradients ersetzt.
- Pin-Detail-Pop-up auf ca. 2/3 Viewportbreite begrenzt, ohne horizontale Scrollbar.
- Lange Inhalte scrollen innerhalb ihrer eigenen Bereiche.
- Drei Pinboard-Ansichten: Detailliert, Standard und Kompakt.
- Kompaktansicht zeigt eine schnelle Liste mit gekürzter Domain ohne URL-Pfad.
- Teilbereiche haben ein Kontextmenü mit Umbenennen, Sortierung und Löschen.
- Stift-Icon in Teilbereichen wurde durch ein Zahnrad ersetzt.
- Löschen von Teilbereichen verschiebt Pins nach „Ohne Teilbereich“.
- Hauptseite nutzt dezenteres Suchfeld, kompakteren Board-Button und Board-Bereiche.
- Boards können alphabetisch, nach Aktualisierung, nach Neuesten oder manuell sortiert werden.

## Migration

Für Board-Bereiche auf der Hauptseite wurden diese Spalten ergänzt:

- `boards.board_group`
- `boards.board_position`

Die Migration liegt in:

`supabase/migrations/20260616_pinboard_liquid_glass_workspace.sql`

## Build

`npm run build` wurde erfolgreich ausgeführt.
