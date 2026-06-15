# Board Full Viewport Update

Diese Version passt die klassische Board-Detailansicht `/boards/[boardId]` auf ein echtes Full-Viewport-Canvas an.

## Geänderte Bereiche

- `components/pinboard/PinboardClient.tsx`
  - Board-Ansicht nutzt jetzt `100dvh` statt normalem Seitenfluss.
  - Header und Undo-Leiste bleiben feste Bereiche.
  - Der Board-Canvas nutzt die gesamte verbleibende Höhe.
  - Horizontales Scrollen findet nur noch im Board-Canvas statt.
  - Kein unnötiges globales Seiten-Scrolling mehr.

- `components/pinboard/SectionColumn.tsx`
  - Sections nutzen jetzt die volle Canvas-Höhe.
  - Pins scrollen innerhalb der jeweiligen Section.
  - Header der Section bleibt oben, Pin-Liste nutzt den restlichen Platz.

- `app/globals.css`
  - Neue Utility-Klasse `.board-viewport` für stabile Viewport-Höhe auf Desktop und Mobile.

## Ergebnis

Die Board-Ansicht verhält sich jetzt eher wie ein professionelles Produktivitäts-Canvas im Stil von Trello, Milanote oder Arc Spaces:

- volle Bildschirmhöhe
- feste App-Oberfläche
- horizontaler Board-Canvas
- vertikal scrollbare Pin-Spalten
- bessere Nutzung von großen Monitoren
- bessere Kontrolle auf mobilen Geräten
