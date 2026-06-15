# Pinboard Interaction Refinement

Diese Version ergänzt den fokussierten Pinboard-Stand um:

- Pin-Cards mit bündigem Cover-Blur ohne weißen Innenrahmen
- gesamte Pin-Fläche als Drag-Bereich
- sichtbaren DragOverlay-Pin mit stärkerem Schatten
- Pin-Detail-Pop-up mit geblurtem Hintergrund
- Rechtsklickmenü für Pins
- Rechtsklickmenü für Boards
- Sicherheitsabfragen vor Löschaktionen
- Archiv-Icon und Archivseite für Boards und Pins
- Tag-Normalisierung auf einzelne Wörter
- mittiges Pin-Erstellen-Modal
- Darkmode mit neutraleren Schwarz- und Graphit-Tönen
- angenehmeren Lightmode mit Off-White-Basis

## Migration

Bei bestehenden Supabase-Projekten zusätzlich ausführen:

`supabase/migrations/20260615_pinboard_context_archive.sql`
