# Pinboard Link, Header, Popup und Mehrfachauswahl Fix

Diese Version setzt die gezielten Anforderungen aus der aktuellen Korrekturrunde um:

- Pin-Titel und Domain werden im Cover höher und klarer im unteren Bildbereich positioniert.
- Domain-Anzeige bleibt auf Hostnamen wie `example.com` oder `example.de` reduziert.
- Pin-Detail-Popups zeigen Bilder links über die volle Höhe und bündig zum oberen, unteren und linken Rand.
- Das Schließen-X sitzt korrekt oben rechts.
- Klick auf „Bearbeiten“ aus dem Detailpopup schließt zuerst das Detailpopup und öffnet danach den Editor im Vordergrund.
- Linkanalyse startet automatisch beim Einfügen oder Ändern einer gültigen URL mit Debounce.
- Schwierige Links bleiben speicherbar, auch wenn die automatische Vorschau blockiert wird.
- Remote-Coverbilder werden beim Import nach Möglichkeit gecacht, wodurch eine dominante Akzentfarbe gesetzt wird.
- Headerflächen nutzen eine einheitliche sticky Broken-Horizon-Glaslogik.
- Pinboard-Header bleibt linksbündig.
- Mehrfachauswahl für Pins sowie Teilbereiche wurde ergänzt, inklusive Bulk-Verschieben, Archivieren und Löschen.
- Schwarze Containerflächen hinter den Board-Kacheln werden neutralisiert.

## Build

`npm run build` wurde erfolgreich ausgeführt.
