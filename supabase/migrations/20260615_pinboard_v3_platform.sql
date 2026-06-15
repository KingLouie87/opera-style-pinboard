-- Pinboard V3 platform foundation
-- Adds workspaces, vaults, vault-native items, tasks, incubator, time-capsule and mindmap tables.
-- Existing boards, pins, notebooks and notes are kept intact.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  kind text not null default 'private' check (kind in ('private', 'business')),
  icon text,
  color text,
  position bigint not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vaults (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  cover_url text,
  cover_path text,
  color text,
  favorite boolean not null default false,
  position bigint not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  vault_id uuid not null references public.vaults(id) on delete cascade,
  type text not null default 'pin' check (type in ('pin', 'note', 'task', 'file', 'media', 'mindmap', 'link')),
  title text not null,
  description text,
  url text,
  image_url text,
  image_path text,
  tags text[] default '{}',
  metadata jsonb not null default '{}'::jsonb,
  favorite boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  revisit_at timestamptz,
  position bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  vault_id uuid references public.vaults(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'doing', 'done', 'archived')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_at timestamptz,
  reminder_at timestamptz,
  recurrence_rule text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incubator_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  vault_id uuid references public.vaults(id) on delete set null,
  title text not null,
  content text,
  url text,
  image_url text,
  tags text[] default '{}',
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.time_capsules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  vault_id uuid references public.vaults(id) on delete cascade,
  item_id uuid references public.vault_items(id) on delete cascade,
  title text not null,
  note text,
  revisit_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mindmap_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vault_id uuid not null references public.vaults(id) on delete cascade,
  title text not null,
  content text,
  x double precision not null default 0,
  y double precision not null default 0,
  color text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mindmap_edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vault_id uuid not null references public.vaults(id) on delete cascade,
  source_node_id uuid not null references public.mindmap_nodes(id) on delete cascade,
  target_node_id uuid not null references public.mindmap_nodes(id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);

create index if not exists workspaces_user_position_idx on public.workspaces(user_id, position);
create index if not exists vaults_user_workspace_idx on public.vaults(user_id, workspace_id, position);
create index if not exists vault_items_user_vault_idx on public.vault_items(user_id, vault_id, position);
create index if not exists vault_items_user_search_idx on public.vault_items using gin(to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(url, '')));
create index if not exists vault_items_tags_idx on public.vault_items using gin(tags);
create index if not exists tasks_user_due_idx on public.tasks(user_id, due_at);
create index if not exists incubator_user_idx on public.incubator_items(user_id, created_at desc);
create index if not exists time_capsules_user_revisit_idx on public.time_capsules(user_id, revisit_at);
create index if not exists mindmap_nodes_vault_idx on public.mindmap_nodes(user_id, vault_id);

alter table public.workspaces enable row level security;
alter table public.vaults enable row level security;
alter table public.vault_items enable row level security;
alter table public.tasks enable row level security;
alter table public.incubator_items enable row level security;
alter table public.time_capsules enable row level security;
alter table public.mindmap_nodes enable row level security;
alter table public.mindmap_edges enable row level security;

do $$ begin
  create policy "Users manage own workspaces" on public.workspaces for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Users manage own vaults" on public.vaults for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Users manage own vault items" on public.vault_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Users manage own tasks" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Users manage own incubator items" on public.incubator_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Users manage own time capsules" on public.time_capsules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Users manage own mindmap nodes" on public.mindmap_nodes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Users manage own mindmap edges" on public.mindmap_edges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Optional compatibility columns. Existing rows stay valid.
alter table public.boards add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.boards add column if not exists vault_id uuid references public.vaults(id) on delete set null;
alter table public.notebooks add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.notebooks add column if not exists vault_id uuid references public.vaults(id) on delete set null;
