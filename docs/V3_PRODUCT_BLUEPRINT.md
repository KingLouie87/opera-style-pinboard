# Pinboard V3 Product Blueprint

## Ziel
Pinboard V3 verschiebt die App von einem klassischen Board- und Notiztool zu einem visuellen Knowledge OS.

Die wichtigste Änderung: Inhalte werden nicht mehr primär über Datentypen organisiert, sondern über Workspaces und Vaults.

## Neue Ebenen

1. Workspace
   - Private Workspace
   - Business Workspace

2. Vault
   - Projektcontainer für Pins, Notizen, Aufgaben, Dateien, Medien und Mindmaps
   - Beispiel: Broken Horizon, Hotel Operations, Blender Research

3. Module im Vault
   - Pins
   - Notizen
   - To-do
   - Mindmap
   - Dateien

## Designsystem

Die Referenzen wurden in folgende UI-Regeln übersetzt:

- Dark Theme als Standard
- zurückhaltender Glas-Look
- Border Radius überwiegend 8 bis 16 px
- keine Bubble-Optik
- klare Side Navigation
- Premium Cards mit Layering
- dezente Neon-Akzente, aber keine bunte Oberfläche
- ruhige Microinteractions
- starke visuelle Hierarchie

## Umsetzung in dieser Version

Diese V3 ist bewusst eine Premium-Foundation, kein vollständiger Endausbau.

Enthalten:

- neue Route `/workspaces`
- neue Route `/vaults/[vaultId]`
- neuer Premium App Rail
- Workspace Dashboard
- Private und Business Workspace Erstellung
- Vault-Erstellung
- Vault-Ansicht mit Modul-Tabs
- Quick Capture für Pins und Aufgaben
- Collections-Vorschau
- Mindmap-Platzhalter mit visuellem Stage-Konzept
- neue Supabase-Migration für Workspaces, Vaults, Vault Items, Tasks, Incubator, Time Capsule und Mindmap Tabellen
- bestehende Boards und Notizen bleiben erhalten

Noch nicht vollständig produktiv implementiert:

- echter Rich Text Editor innerhalb Vault-Notizen
- Datei-Upload mit WebP-Komprimierung
- echter Knowledge Graph
- vollständiges Drag-and-Drop über alle Module
- Video Player mit Custom Controls
- automatische Dominant-Color-Analyse

Diese Funktionen sind vorbereitet und sollten als nächste Phasen umgesetzt werden.

## Reihenfolge der nächsten Ausbaustufen

### Phase 1
V3 Migration ausführen, Workspaces und Vaults testen.

### Phase 2
Bestehende Boards und Notizbücher in Vaults migrieren oder verknüpfen.

### Phase 3
Vault-native Pin-Erstellung mit Link-Import, Bildgalerie und Drag-and-Drop.

### Phase 4
Task-Modul mit Kalender, Reminder und Kanban.

### Phase 5
Mindmap-Modul mit React Flow oder eigenem Canvas.

### Phase 6
Knowledge Graph und Discovery Feed.
