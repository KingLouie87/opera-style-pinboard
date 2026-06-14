# Pinboard V2 Upgrade

Dieses Update bringt:

- Apple-inspirierten Darkmode mit Glasflächen
- flexiblere Pins ohne Pflicht-Link
- bessere Bildauswahl als Galerie/Slider
- Board-Titelbilder ändern, entfernen oder aus Pin-Bildern wählen
- neuen Notizbereich unter `/notes`
- Notizbücher, Kapitel, Seiten, Auto-Save und Suche
- E-Mail/Passwort-Login statt Magic Link

## 1. Migration in Supabase ausführen

Öffne in Supabase den SQL Editor und führe aus:

```txt
supabase/migrations/20260614_pinboard_v2_notes.sql
```

Die Migration ist additiv. Bestehende Boards und Pins bleiben erhalten.

## 2. Lokal starten

```powershell
npm install
npm run dev
```

Öffne:

```txt
http://localhost:3000
```

## 3. Testreihenfolge

1. Einloggen
2. Boards öffnen
3. Board-Bild ändern
4. Board öffnen
5. Pin ohne Link speichern
6. Pin mit Link speichern und Bilder durchblättern
7. eigenes Bild hochladen
8. Notizen öffnen
9. Notizbuch erstellen
10. Kapitel erstellen
11. Seite erstellen
12. Text schreiben und Auto-Save prüfen

## 4. Deployment

Nach lokalem Test:

```powershell
git add .
git commit -m "Add dark glass design and notes workspace"
git push
```

Vercel baut danach automatisch neu.

## 5. Wichtige Hinweise

- Die neue Notizseite funktioniert erst nach der SQL-Migration.
- Board-Titelbilder verwenden denselben privaten Supabase Storage Bucket `pin-images`.
- Falls Supabase meldet, dass `cover_path` fehlt, wurde die Migration noch nicht ausgeführt.
- Falls `/notes` einen Fehler wegen fehlender Tabellen zeigt, wurde die Migration noch nicht ausgeführt.
