# Apple Glass Correction

Diese Version korrigiert den Glaseffekt der Pinboard-App.

## Geändert

- Der Board-Topbar-Blur wurde transparenter und stärker im Stil des Broken-Horizon-Headers umgesetzt.
- Login-Panel nutzt jetzt echtes transparentes Glasmaterial mit sichtbarem Backdrop-Blur.
- Pop-ups, Kontextmenüs, Move-Dialoge, Confirm-Dialoge und Pin-Detail-Modal nutzen denselben Glas-Layer.
- Pin-Editor-Modal erhielt eine eigene `editor-glass-panel` Klasse.
- Lightmode-Kontrast wurde korrigiert, damit Texte auf hellen Flächen nicht mehr weiß bleiben.
- Bild-Cover-Overlays behalten bewusst helle Schrift, weil sie auf dunklem Bildverlauf liegen.

## Wichtige CSS-Tokens

- `--apple-glass-bg`
- `--apple-glass-bg-strong`
- `--apple-glass-line`
- `--apple-glass-shadow`
- `--apple-glass-filter`

Diese Tokens steuern alle überlagernden Glasflächen.
