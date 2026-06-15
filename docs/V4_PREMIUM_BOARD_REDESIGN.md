# Pinboard V4 Premium Board Redesign

Diese Version vereinheitlicht die App-Shell und gestaltet die klassischen Bereiche Boards und Notizen im Premium-Dark-Design neu.

## Enthalten

- globale AppShell mit linker Navigation und mobiler Bottom Navigation
- Boards und Notizen sind jetzt in dieselbe Navigation integriert
- Board-Detailansicht als echtes Full-Viewport-Canvas
- Board-Spalten nutzen die komplette verfügbare Höhe
- Pins scrollen innerhalb der jeweiligen Spalte
- deutlich reduzierte Radien nach 4 bis 12 px Prinzip
- dunkler Apple-inspirierter Material-Look
- kompaktere Panels, Karten und Buttons
- verbessertes Drag-Overlay beim Verschieben von Pins
- konsistenteres Design für Board-Übersicht, Board-Detail und Notizen

## Lokaler Start

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm install
npm run dev
```

## Wichtige URLs

- `/workspaces`
- `/boards`
- `/boards/[boardId]`
- `/notes`
