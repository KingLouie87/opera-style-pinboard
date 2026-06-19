-- Smart cover focus points for pin cover images.
-- Safe to run multiple times.

alter table public.pins
add column if not exists cover_focus_x numeric default 50;

alter table public.pins
add column if not exists cover_focus_y numeric default 50;

update public.pins
set cover_focus_x = coalesce(cover_focus_x, 50),
    cover_focus_y = coalesce(cover_focus_y, 50)
where cover_focus_x is null or cover_focus_y is null;
