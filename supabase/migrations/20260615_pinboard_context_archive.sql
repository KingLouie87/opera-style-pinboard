-- Pinboard context menus and archive support
-- Run this migration when upgrading an existing database.

alter table if exists public.boards
  add column if not exists archived_at timestamptz;

alter table if exists public.boards
  add column if not exists deleted_at timestamptz;

alter table if exists public.pins
  add column if not exists archived_at timestamptz;

alter table if exists public.pins
  add column if not exists deleted_at timestamptz;

create index if not exists boards_archive_idx on public.boards(user_id, archived_at) where deleted_at is null;
create index if not exists pins_archive_idx on public.pins(user_id, archived_at) where deleted_at is null;
