# Pinboard Liquid Glass Award Redesign

Diese Version setzt die nächste große visuelle Design-Runde um.

## Enthalten

- neue Liquid-Glass Designsprache für Hauptseite und Board-Detailansicht
- Private/Business Switch auf der Board-Hauptseite
- `boards.workspace_type` Migration mit Standardwert `private`
- Pin-Karten als visuelle Gallery-Cards
- Pin-Titel unten im Coverbild
- Beschreibung in der Hauptansicht ausgeblendet
- Beschreibung bleibt im Pin-Detail sichtbar
- Drag & Drop nur noch über Handle oben rechts
- minimierte Teilbereiche bleiben gültige Drop-Zonen
- Teilbereiche können inline umbenannt werden
- Mobile Grid mit exakt zwei Pin-Spalten
- Darkmode mit Schwarz, Graphit und warmen Akzenten
- Lightmode mit Off-White und ruhigen Kontrasten
- TypeScript-Fix in `lib/url-security.ts`

## Supabase

Vor dem Deployment muss diese Migration ausgeführt werden:

`supabase/migrations/20260616_pinboard_liquid_glass_workspace.sql`

Sie ergänzt:

```sql
boards.workspace_type text default 'private'
```

Bestehende Boards bleiben automatisch `private`.
