# Pinboard Focused Redesign

This version removes the broader productivity platform idea and focuses entirely on the Pinboard experience.

## Product model

- A user owns multiple boards.
- Each board can contain ungrouped pins in the top inbox area.
- Each board can contain collapsible sections.
- Pins can be moved between inbox and sections through drag and drop.

## Visual direction

- Premium dark mode and light mode.
- Reduced Apple-inspired glass material.
- 4 to 8 px radii for most elements.
- Visual cards with image-first hierarchy.
- Glass readability panel over cover images.
- Subtle pin accent color derived from image or preset color.

## Key files

- `components/pinboard/PinboardClient.tsx`
- `components/pinboard/PinCard.tsx`
- `components/pinboard/PinEditor.tsx`
- `components/BoardDashboard.tsx`
- `app/globals.css`
- `supabase/schema.sql`
- `supabase/migrations/20260615_pinboard_focused_sections.sql`
