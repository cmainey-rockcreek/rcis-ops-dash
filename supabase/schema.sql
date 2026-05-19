-- RCIS internal dashboard — initial Supabase schema.
-- Paste this into Supabase SQL Editor and run.
-- Idempotent: safe to re-run.

-- ─── todos ────────────────────────────────────────────────────────────────
create table if not exists public.todos (
  id            text primary key,
  title         text not null,
  column_name   text not null default 'todo' check (column_name in ('todo','doing','done')),
  owners        text[] not null default '{}',
  label         text not null default 'Ops',
  priority      text not null default 'medium' check (priority in ('high','medium','low')),
  due           date,
  linked_to     jsonb,
  notes         text default '',
  attachments   jsonb not null default '[]',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index if not exists todos_column_idx     on public.todos (column_name);
create index if not exists todos_updated_at_idx on public.todos (updated_at desc);

-- ─── contacts ─────────────────────────────────────────────────────────────
create table if not exists public.contacts (
  id            text primary key,
  name          text not null,
  role          text default '',
  email         text default '',
  phone         text default '',
  organization  text default '',
  linked_to     jsonb not null default '[]',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists contacts_name_idx on public.contacts (name);

-- ─── documents ────────────────────────────────────────────────────────────
-- Attached to a district / school / (later) contractor.
create table if not exists public.documents (
  id            text primary key,
  scope         text not null check (scope in ('district','school','contractor')),
  scope_id      text not null,
  kind          text not null default 'link',
  url           text not null,
  name          text not null,
  added_at      timestamptz not null default now()
);
create index if not exists documents_scope_idx on public.documents (scope, scope_id);

-- ─── entity_notes ─────────────────────────────────────────────────────────
-- Free-text notes box on a district / school / contractor profile.
create table if not exists public.entity_notes (
  scope         text not null check (scope in ('district','school','contractor')),
  scope_id      text not null,
  content       text not null default '',
  updated_at    timestamptz not null default now(),
  primary key (scope, scope_id)
);

-- ─── Auto-update updated_at on row updates ────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_todos on public.todos;
create trigger touch_todos before update on public.todos
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_contacts on public.contacts;
create trigger touch_contacts before update on public.contacts
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_entity_notes on public.entity_notes;
create trigger touch_entity_notes before update on public.entity_notes
  for each row execute function public.touch_updated_at();

-- ─── Row-level security ───────────────────────────────────────────────────
-- Enable RLS on all tables, then grant authenticated users full access.
-- This means: only logged-in team members can read or write anything,
-- and anonymous (logged-out) access is blocked.
alter table public.todos        enable row level security;
alter table public.contacts     enable row level security;
alter table public.documents    enable row level security;
alter table public.entity_notes enable row level security;

drop policy if exists "team full access" on public.todos;
create policy "team full access" on public.todos
  for all to authenticated using (true) with check (true);

drop policy if exists "team full access" on public.contacts;
create policy "team full access" on public.contacts
  for all to authenticated using (true) with check (true);

drop policy if exists "team full access" on public.documents;
create policy "team full access" on public.documents
  for all to authenticated using (true) with check (true);

drop policy if exists "team full access" on public.entity_notes;
create policy "team full access" on public.entity_notes
  for all to authenticated using (true) with check (true);

-- ─── Realtime ─────────────────────────────────────────────────────────────
-- Lets the app receive live updates when teammates change anything.
alter publication supabase_realtime add table public.todos;
alter publication supabase_realtime add table public.contacts;
alter publication supabase_realtime add table public.documents;
alter publication supabase_realtime add table public.entity_notes;
