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
