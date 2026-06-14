# Testplan

## Lokale Tests

1. `npm install`
2. `.env.local` füllen
3. Supabase SQL ausführen
4. `npm run dev`
5. Registrierung per Magic Link testen
6. Board erstellen
7. Bereich erstellen
8. Pin nur mit Text erstellen
9. Pin mit Link erstellen
10. Preview laden
11. Website-Bild auswählen
12. eigenes Bild hochladen
13. Pin innerhalb eines Bereichs verschieben
14. Pin in anderen Bereich verschieben
15. Bereich horizontal verschieben
16. Seite neu laden und Reihenfolge prüfen
17. Mobile Ansicht mit DevTools testen
18. PWA installieren testen

## Sicherheitstests

- `file:///etc/passwd` als Link testen, muss abgelehnt werden
- `http://localhost:3000` als Link testen, muss serverseitig blockiert werden
- sehr großes Bild testen, muss abgelehnt werden
- nicht angemeldet `/api/link-preview` aufrufen, muss 401 liefern
- Bildpfad eines anderen Users abrufen, muss 403 liefern
