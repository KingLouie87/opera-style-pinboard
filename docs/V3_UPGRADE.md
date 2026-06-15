# Pinboard V3 Upgrade Anleitung

## 1. Dateien kopieren
Kopiere den Inhalt dieser ZIP in dein bestehendes Projekt und ersetze vorhandene Dateien.

## 2. Supabase Migration ausführen
In Supabase im SQL Editor ausführen:

`supabase/migrations/20260615_pinboard_v3_platform.sql`

Danach existieren die neuen Tabellen:

- workspaces
- vaults
- vault_items
- tasks
- incubator_items
- time_capsules
- mindmap_nodes
- mindmap_edges

## 3. Lokal testen

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm install
npm run dev
```

Öffne danach:

```txt
http://localhost:3000/workspaces
```

## 4. Erste Einrichtung

1. Auf „Workspaces anlegen“ klicken.
2. Private und Business Workspace werden erstellt.
3. Einen Workspace auswählen.
4. Einen Vault erstellen, z. B. „Broken Horizon“.
5. Vault öffnen.
6. Quick Capture testen.

## 5. GitHub und Vercel

```powershell
git add .
git commit -m "Add Pinboard V3 workspace vault foundation"
git push
```

Vercel sollte danach automatisch deployen.

## 6. Wichtige Hinweise

- Bestehende Boards und Notizen bleiben erhalten.
- Die neue V3-Struktur ergänzt die App und ersetzt die alten Bereiche noch nicht vollständig.
- `/boards` und `/notes` funktionieren weiterhin.
- `/workspaces` wird neue Startseite.
