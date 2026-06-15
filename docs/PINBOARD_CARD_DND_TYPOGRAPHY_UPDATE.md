# Pinboard Card, Drag & Typography Update

Diese Version fokussiert die Pinboard-Oberfläche weiter auf hochwertige visuelle Cards, zuverlässige Drop-Zonen und ein ruhigeres Typografie-System.

## Geändert

- Pin-Karten nutzen jetzt stärker bilddominierte Card-Kompositionen.
- Der Textbereich liegt als bündiger Glas-/Gradient-Layer direkt im Coverbild.
- Das separate Metadatenpanel unter Pins wurde entfernt, damit Pins weniger nach Bookmark-Liste wirken.
- Pin-Overlay beim Drag bleibt vollständig sichtbar, skaliert leicht und erhält stärkere Schatten.
- Minimierte Teilbereiche bleiben als Droppable-Zonen aktiv.
- Collapsed Sections zeigen eine eigene Drop-Fläche und reagieren visuell bei Berührung.
- Die Collision-Detection bevorzugt Pointer-Kontakt und fällt auf closestCorners zurück.
- Die Typografie nutzt einen Aptos-first Font-Stack mit Inter, Geist und System-Fallback.
- Die Pinboard-CSS-Tokens begrenzen die wichtigsten UI-Schriftgrößen auf vier Stufen.

## Wichtige Dateien

- `components/pinboard/PinCard.tsx`
- `components/pinboard/PinboardClient.tsx`
- `app/globals.css`

## Testpunkte

1. Board öffnen.
2. Pins mit und ohne Coverbild prüfen.
3. Längere Beschreibungen auf Pin-Karten prüfen.
4. Teilbereich minimieren.
5. Pin auf den minimierten Teilbereich ziehen.
6. Pin loslassen und prüfen, ob `section_id` übernommen wurde.
7. Pin aus einem Bereich in den ungruppierten Bereich ziehen.
8. DragOverlay prüfen: Pin darf nicht transparent sein.
9. Breiten Viewport prüfen: mehr Pins nebeneinander statt überbreite Pins.
10. Darkmode und Lightmode auf Kontrast prüfen.
