-- Pinboard focused redesign migration
-- Run this on existing projects. It keeps existing boards and pins.

create extension if not exists pgcrypto;

alter table public.boards add column if not exists cover_path text;
alter table public.pins add column if not exists dominant_color text;
alter table public.pins add column if not exists category text;
alter table public.pins add column if not exists source text;
alter table public.pins add column if not exists media_kind text default 'webpage';
alter table public.pins add column if not exists content_type text;
alter table public.pins add column if not exists file_path text;
alter table public.pins add column if not exists file_name text;
alter table public.pins add column if not exists file_mime_type text;
alter table public.pins add column if not exists file_size_bytes integer;
alter table public.pins add column if not exists aspect_ratio numeric;

create index if not exists pins_media_idx on public.pins(user_id, media_kind) where deleted_at is null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pin-images','pin-images', false, 8388608, array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit)
values ('pin-files','pin-files', false, 52428800)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "pin_files_storage_select_own_folder" on storage.objects;
drop policy if exists "pin_files_storage_insert_own_folder" on storage.objects;
drop policy if exists "pin_files_storage_update_own_folder" on storage.objects;
drop policy if exists "pin_files_storage_delete_own_folder" on storage.objects;
create policy "pin_files_storage_select_own_folder" on storage.objects for select using (bucket_id = 'pin-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pin_files_storage_insert_own_folder" on storage.objects for insert with check (bucket_id = 'pin-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pin_files_storage_update_own_folder" on storage.objects for update using (bucket_id = 'pin-files' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'pin-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pin_files_storage_delete_own_folder" on storage.objects for delete using (bucket_id = 'pin-files' and (storage.foldername(name))[1] = auth.uid()::text);
