-- Pinboard focused architecture update
-- Run this in Supabase when upgrading from older versions.

alter table if exists public.board_sections
  add column if not exists is_collapsed boolean not null default false;

alter table if exists public.pins
  alter column section_id drop not null;

alter table if exists public.pins
  drop constraint if exists pins_section_id_fkey;

alter table if exists public.pins
  add constraint pins_section_id_fkey
  foreign key (section_id) references public.board_sections(id) on delete set null;

create index if not exists pins_inbox_idx on public.pins(board_id, position) where section_id is null and deleted_at is null;

-- Refresh pin policies so ungrouped pins are valid.
drop policy if exists "pins_insert_own" on public.pins;
drop policy if exists "pins_update_own" on public.pins;

create policy "pins_insert_own" on public.pins
for insert
with check (
  auth.uid() = user_id
  and exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid())
  and (
    section_id is null
    or exists (select 1 from public.board_sections s where s.id = section_id and s.board_id = board_id and s.user_id = auth.uid())
  )
);

create policy "pins_update_own" on public.pins
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid())
  and (
    section_id is null
    or exists (select 1 from public.board_sections s where s.id = section_id and s.board_id = board_id and s.user_id = auth.uid())
  )
);
