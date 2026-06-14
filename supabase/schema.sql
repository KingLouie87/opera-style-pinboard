-- Opera Style Pinboard Schema
-- In Supabase SQL Editor ausführen.

create extension if not exists pgcrypto;

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.board_sections (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  position numeric not null default 1000,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  section_id uuid not null references public.board_sections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  description text,
  url text,
  image_url text,
  image_path text,
  notes text,
  color text,
  status text,
  tags text[] not null default '{}',
  position numeric not null default 1000,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pins_url_protocol check (url is null or url ~* '^https?://')
);

create table if not exists public.pin_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pin_id uuid references public.pins(id) on delete set null,
  source_type text not null check (source_type in ('upload', 'remote-cache')),
  original_url text,
  storage_path text not null,
  mime_type text,
  size_bytes integer,
  created_at timestamptz not null default now()
);

create index if not exists boards_user_idx on public.boards(user_id, updated_at desc);
create index if not exists board_sections_board_idx on public.board_sections(board_id, position);
create index if not exists pins_section_idx on public.pins(section_id, position) where deleted_at is null;
create index if not exists pins_board_idx on public.pins(board_id, position) where deleted_at is null;
create index if not exists pins_tags_idx on public.pins using gin(tags);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists boards_updated_at on public.boards;
create trigger boards_updated_at before update on public.boards for each row execute function public.set_updated_at();

drop trigger if exists board_sections_updated_at on public.board_sections;
create trigger board_sections_updated_at before update on public.board_sections for each row execute function public.set_updated_at();

drop trigger if exists pins_updated_at on public.pins;
create trigger pins_updated_at before update on public.pins for each row execute function public.set_updated_at();

alter table public.boards enable row level security;
alter table public.board_sections enable row level security;
alter table public.pins enable row level security;
alter table public.pin_images enable row level security;


-- Policies sicher neu anlegen, damit das Script mehrfach ausführbar bleibt.
drop policy if exists "boards_select_own" on public.boards;
drop policy if exists "boards_insert_own" on public.boards;
drop policy if exists "boards_update_own" on public.boards;
drop policy if exists "boards_delete_own" on public.boards;
drop policy if exists "sections_select_own" on public.board_sections;
drop policy if exists "sections_insert_own" on public.board_sections;
drop policy if exists "sections_update_own" on public.board_sections;
drop policy if exists "sections_delete_own" on public.board_sections;
drop policy if exists "pins_select_own" on public.pins;
drop policy if exists "pins_insert_own" on public.pins;
drop policy if exists "pins_update_own" on public.pins;
drop policy if exists "pins_delete_own" on public.pins;
drop policy if exists "pin_images_select_own" on public.pin_images;
drop policy if exists "pin_images_insert_own" on public.pin_images;
drop policy if exists "pin_images_update_own" on public.pin_images;
drop policy if exists "pin_images_delete_own" on public.pin_images;
drop policy if exists "pin_images_storage_select_own_folder" on storage.objects;
drop policy if exists "pin_images_storage_insert_own_folder" on storage.objects;
drop policy if exists "pin_images_storage_update_own_folder" on storage.objects;
drop policy if exists "pin_images_storage_delete_own_folder" on storage.objects;

create policy "boards_select_own" on public.boards for select using (auth.uid() = user_id);
create policy "boards_insert_own" on public.boards for insert with check (auth.uid() = user_id);
create policy "boards_update_own" on public.boards for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "boards_delete_own" on public.boards for delete using (auth.uid() = user_id);

create policy "sections_select_own" on public.board_sections for select using (auth.uid() = user_id);
create policy "sections_insert_own" on public.board_sections for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid())
);
create policy "sections_update_own" on public.board_sections for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid())
);
create policy "sections_delete_own" on public.board_sections for delete using (auth.uid() = user_id);

create policy "pins_select_own" on public.pins for select using (auth.uid() = user_id);
create policy "pins_insert_own" on public.pins for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid())
  and exists (select 1 from public.board_sections s where s.id = section_id and s.board_id = board_id and s.user_id = auth.uid())
);
create policy "pins_update_own" on public.pins for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid())
  and exists (select 1 from public.board_sections s where s.id = section_id and s.board_id = board_id and s.user_id = auth.uid())
);
create policy "pins_delete_own" on public.pins for delete using (auth.uid() = user_id);

create policy "pin_images_select_own" on public.pin_images for select using (auth.uid() = user_id);
create policy "pin_images_insert_own" on public.pin_images for insert with check (auth.uid() = user_id);
create policy "pin_images_update_own" on public.pin_images for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pin_images_delete_own" on public.pin_images for delete using (auth.uid() = user_id);

-- Private Storage Bucket für Pin-Bilder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pin-images',
  'pin-images',
  false,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "pin_images_storage_select_own_folder"
on storage.objects for select
using (
  bucket_id = 'pin-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "pin_images_storage_insert_own_folder"
on storage.objects for insert
with check (
  bucket_id = 'pin-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "pin_images_storage_update_own_folder"
on storage.objects for update
using (
  bucket_id = 'pin-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'pin-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "pin_images_storage_delete_own_folder"
on storage.objects for delete
using (
  bucket_id = 'pin-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- Pinboard V2 Migration
-- In Supabase SQL Editor ausführen. Bestehende Boards und Pins bleiben erhalten.

create extension if not exists pgcrypto;

alter table public.boards add column if not exists cover_path text;

create table if not exists public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  color text,
  position numeric not null default 1000,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notebook_sections (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  position numeric not null default 1000,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.note_pages (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  section_id uuid references public.notebook_sections(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Unbenannte Seite',
  content text not null default '',
  tags text[] not null default '{}',
  position numeric not null default 1000,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.note_page_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  page_id uuid not null references public.note_pages(id) on delete cascade,
  pin_id uuid references public.pins(id) on delete cascade,
  board_id uuid references public.boards(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint note_page_links_has_target check (pin_id is not null or board_id is not null)
);

create index if not exists notebooks_user_idx on public.notebooks(user_id, position) where archived_at is null;
create index if not exists notebook_sections_user_idx on public.notebook_sections(user_id, notebook_id, position) where archived_at is null;
create index if not exists note_pages_user_idx on public.note_pages(user_id, notebook_id, section_id, position) where archived_at is null;
create index if not exists note_pages_search_idx on public.note_pages using gin(to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '')));
create index if not exists note_page_links_page_idx on public.note_page_links(page_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notebooks_updated_at on public.notebooks;
create trigger notebooks_updated_at before update on public.notebooks for each row execute function public.set_updated_at();

drop trigger if exists notebook_sections_updated_at on public.notebook_sections;
create trigger notebook_sections_updated_at before update on public.notebook_sections for each row execute function public.set_updated_at();

drop trigger if exists note_pages_updated_at on public.note_pages;
create trigger note_pages_updated_at before update on public.note_pages for each row execute function public.set_updated_at();

alter table public.notebooks enable row level security;
alter table public.notebook_sections enable row level security;
alter table public.note_pages enable row level security;
alter table public.note_page_links enable row level security;

drop policy if exists "notebooks_select_own" on public.notebooks;
drop policy if exists "notebooks_insert_own" on public.notebooks;
drop policy if exists "notebooks_update_own" on public.notebooks;
drop policy if exists "notebooks_delete_own" on public.notebooks;
drop policy if exists "notebook_sections_select_own" on public.notebook_sections;
drop policy if exists "notebook_sections_insert_own" on public.notebook_sections;
drop policy if exists "notebook_sections_update_own" on public.notebook_sections;
drop policy if exists "notebook_sections_delete_own" on public.notebook_sections;
drop policy if exists "note_pages_select_own" on public.note_pages;
drop policy if exists "note_pages_insert_own" on public.note_pages;
drop policy if exists "note_pages_update_own" on public.note_pages;
drop policy if exists "note_pages_delete_own" on public.note_pages;
drop policy if exists "note_page_links_select_own" on public.note_page_links;
drop policy if exists "note_page_links_insert_own" on public.note_page_links;
drop policy if exists "note_page_links_update_own" on public.note_page_links;
drop policy if exists "note_page_links_delete_own" on public.note_page_links;

create policy "notebooks_select_own" on public.notebooks for select using (auth.uid() = user_id);
create policy "notebooks_insert_own" on public.notebooks for insert with check (auth.uid() = user_id);
create policy "notebooks_update_own" on public.notebooks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notebooks_delete_own" on public.notebooks for delete using (auth.uid() = user_id);

create policy "notebook_sections_select_own" on public.notebook_sections for select using (auth.uid() = user_id);
create policy "notebook_sections_insert_own" on public.notebook_sections for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.notebooks n where n.id = notebook_id and n.user_id = auth.uid())
);
create policy "notebook_sections_update_own" on public.notebook_sections for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.notebooks n where n.id = notebook_id and n.user_id = auth.uid())
);
create policy "notebook_sections_delete_own" on public.notebook_sections for delete using (auth.uid() = user_id);

create policy "note_pages_select_own" on public.note_pages for select using (auth.uid() = user_id);
create policy "note_pages_insert_own" on public.note_pages for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.notebooks n where n.id = notebook_id and n.user_id = auth.uid())
  and (section_id is null or exists (select 1 from public.notebook_sections s where s.id = section_id and s.notebook_id = notebook_id and s.user_id = auth.uid()))
);
create policy "note_pages_update_own" on public.note_pages for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.notebooks n where n.id = notebook_id and n.user_id = auth.uid())
  and (section_id is null or exists (select 1 from public.notebook_sections s where s.id = section_id and s.notebook_id = notebook_id and s.user_id = auth.uid()))
);
create policy "note_pages_delete_own" on public.note_pages for delete using (auth.uid() = user_id);

create policy "note_page_links_select_own" on public.note_page_links for select using (auth.uid() = user_id);
create policy "note_page_links_insert_own" on public.note_page_links for insert with check (auth.uid() = user_id);
create policy "note_page_links_update_own" on public.note_page_links for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "note_page_links_delete_own" on public.note_page_links for delete using (auth.uid() = user_id);
