-- Premium Pinboard workspace and liquid-glass refinement support

alter table public.boards
  add column if not exists workspace_type text not null default 'private';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'boards_workspace_type_check'
      and conrelid = 'public.boards'::regclass
  ) then
    alter table public.boards
      add constraint boards_workspace_type_check check (workspace_type in ('private','business'));
  end if;
end $$;

update public.boards
set workspace_type = 'private'
where workspace_type is null;

create index if not exists boards_workspace_idx
  on public.boards(user_id, workspace_type, updated_at desc)
  where deleted_at is null;
