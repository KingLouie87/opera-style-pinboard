# Opera Quick Capture Extension

Diese Version enthält eine lokale Browsererweiterung für Opera/Chromium-basierte Browser.

## Enthalten

- Neue App-Route `/capture`
- Capture-Seite für schnelle Pin-Erstellung aus Opera
- Lokale Browsererweiterung im Ordner `opera-extension`
- Toolbar-Popup mit aktueller Seite
- Kontextmenü für Seite, Link, Bild und Textauswahl
- konfigurierbare App-Adresse, z. B. `http://localhost:3000` oder deine Vercel-URL

## Lokal in Opera installieren

1. Projekt-ZIP entpacken und App wie gewohnt lokal starten.
2. In Opera öffnen: `opera://extensions`
3. Entwicklermodus aktivieren.
4. `Entpackte Erweiterung laden` wählen.
5. Den Ordner `opera-extension` aus dem Projekt auswählen.
6. Erweiterungsicon anklicken.
7. App-Adresse setzen, z. B. `http://localhost:3000`.
8. Auf einer beliebigen Website `Seite pinnen` klicken.

## Live/Vercel nutzen

Wenn die App online deployed ist, in der Extension die Vercel-Adresse speichern, z. B.:

```txt
https://dein-pinboard.vercel.app
```

Danach öffnet die Extension die Capture-Seite direkt in der Online-App.

## Kontextmenü

Rechtsklick in Opera:

- Seite in Pinboard speichern
- Link in Pinboard speichern
- Bild in Pinboard speichern
- Auswahl in Pinboard speichern

## Hinweise

- Die Extension wird lokal installiert und ist nicht im Store veröffentlicht.
- Es entstehen keine Store-Kosten.
- Die eigentliche Speicherung passiert über die eingeloggte Pinboard-App.
- Falls du nicht eingeloggt bist, leitet die App zur Login-Seite weiter.
