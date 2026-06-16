# Glass, Overlay and Viewport QA Correction

This update focuses on the issues reported after the Apple/Broken-Horizon glass pass.

## Corrected

- Strengthened the transparent glass system for the login panel, opened-board topbar, modals, context menus, move dialogs, confirm dialogs, editor modal, side panels and mobile overlay navigation.
- Reduced opaque dark material so the background remains visible through glass surfaces.
- Added a central QA glass token layer with blur, saturation, contrast, brightness, glass lip, top reflection and fallback rules.
- Added robust context-menu viewport clamping based on the actual rendered menu size.
- Context menus now close on outside click, Escape, scroll and resize.
- Context menus use `position: fixed`, safe viewport margins and scroll internally if too tall.
- Modals are constrained to the viewport and avoid horizontal overflow.
- Pin detail modal constrains large images and long text blocks.
- Light mode text colors were corrected for dialogs, menus, fields, labels and floating surfaces.
- Image-overlay text remains white only where it sits on darkened cover images.

## Build note

`npm run build` successfully completed compilation and TypeScript checking in the sandbox. The command then exceeded the sandbox timeout while Next.js was generating static pages. Please run `npm run build` locally for the final full static generation pass.
