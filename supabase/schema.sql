-- RCIS internal dashboard — initial Supabase schema.
-- Paste this into Supabase SQL Editor and run.
-- Idempotent: safe to re-run.

-- ─── todos ────────────────────────────────────────────────────────────────
create table if not exists public.todos (
  id            text primary key,
  title         text not null,
  column_name   text not null default 'todo' check (column_name in ('todo','doing','attention','done')),
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

-- ─── team_profiles ────────────────────────────────────────────────────────
-- One public profile per Supabase Auth user. Auth users themselves live in the
-- private auth schema, so the app reads this smaller team-safe profile table.
create table if not exists public.team_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  full_name     text not null default '',
  role          text not null default 'Team',
  initials      text not null default '',
  color         text not null default '#1FA39A',
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists team_profiles_active_idx on public.team_profiles (active, full_name);

-- ─── coverage_gaps ───────────────────────────────────────────────────────
-- Tracked needs (school-tied or district-wide). Drive the home page widget
-- and the Matchmaker page. Bill rate, modality, urgency, attachments and
-- notes all live on the row; comments live on gap_comments below.
create table if not exists public.coverage_gaps (
  id             text primary key,
  scope          text not null default 'school' check (scope in ('school','district')),
  school_id      text,
  school_name    text,
  district_id    text,
  district_name  text not null,
  state          text not null,
  spec           text not null,
  hours          numeric not null,
  modality       text not null default 'onsite' check (modality in ('onsite','tele','either')),
  priority       text not null default 'medium' check (priority in ('urgent','high','medium','low')),
  bill_rate      numeric,
  note           text default '',
  status         text not null default 'open' check (status in ('open','filled','closed')),
  attachments    jsonb not null default '[]',
  posted_at      timestamptz not null default now(),
  created_by     uuid references public.team_profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists coverage_gaps_status_idx     on public.coverage_gaps (status, priority);
create index if not exists coverage_gaps_state_idx      on public.coverage_gaps (state);
create index if not exists coverage_gaps_school_idx     on public.coverage_gaps (school_id) where school_id is not null;
create index if not exists coverage_gaps_district_idx   on public.coverage_gaps (district_id) where district_id is not null;
create index if not exists coverage_gaps_updated_idx    on public.coverage_gaps (updated_at desc);

-- ─── gap_comments ────────────────────────────────────────────────────────
create table if not exists public.gap_comments (
  id           text primary key,
  gap_id       text not null references public.coverage_gaps(id) on delete cascade,
  author_id    uuid not null references public.team_profiles(id) on delete set null,
  content      text not null,
  created_at   timestamptz not null default now()
);
create index if not exists gap_comments_gap_idx    on public.gap_comments (gap_id, created_at);
create index if not exists gap_comments_author_idx on public.gap_comments (author_id);

-- ─── renewals ────────────────────────────────────────────────────────────
-- Time-bound items that expire and need to be re-upped. Kinds:
--   contractor_license   → state board license per contractor (state required)
--   contractor_insurance → liability policy on a contractor
--   client_contract      → service contract on a school or district
-- Owner is exactly one of contractor_id, school_id, district_id (enforced in app).
create table if not exists public.renewals (
  id             text primary key,
  kind           text not null check (kind in ('contractor_license','contractor_insurance','contractor_background','client_contract')),
  contractor_id  text,
  contractor_name text,
  school_id      text,
  school_name    text,
  district_id    text,
  district_name  text,
  label          text not null default '',
  state          text,
  expires_on     date not null,
  status         text not null default 'active' check (status in ('active','pending','lapsed')),
  note           text default '',
  attachments    jsonb not null default '[]',
  created_by     uuid references public.team_profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists renewals_kind_idx        on public.renewals (kind, status);
create index if not exists renewals_expires_idx     on public.renewals (expires_on);
create index if not exists renewals_contractor_idx  on public.renewals (contractor_id) where contractor_id is not null;
create index if not exists renewals_school_idx      on public.renewals (school_id)     where school_id is not null;
create index if not exists renewals_district_idx    on public.renewals (district_id)   where district_id is not null;

-- ─── assignments ─────────────────────────────────────────────────────────
-- Contractor placements at schools / districts. Mock seed assignments still
-- live in data-contractors.js and are merged on read; user-created ones land
-- here. pay_rate and bill_rate are per-assignment so they can override the
-- contractor's defaults from contractor_overrides.
create table if not exists public.assignments (
  id              text primary key,
  contractor_id   text not null,
  contractor_name text,
  school_id       text,
  school_name     text,
  district_id     text,
  district_name   text,
  spec            text,
  direct_hours    numeric not null default 0,
  indirect_hours  numeric not null default 0,
  pay_rate        numeric,
  bill_rate       numeric,
  start_date      date,
  end_date        date,
  status          text not null default 'active' check (status in ('active','completed')),
  note            text default '',
  created_by      uuid references public.team_profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists assignments_contractor_idx on public.assignments (contractor_id);
create index if not exists assignments_school_idx     on public.assignments (school_id)   where school_id   is not null;
create index if not exists assignments_district_idx   on public.assignments (district_id) where district_id is not null;
create index if not exists assignments_status_idx     on public.assignments (status);

-- ─── contractor_overrides ────────────────────────────────────────────────
-- Per-contractor edits that override the mock defaults from data-contractors.js.
-- Stores the editable pay/bill rate plus the editable weekly schedule
-- (5 weekdays × 4 blocks: AM/Mid/PM/Late, each 0–3 load).
create table if not exists public.contractor_overrides (
  contractor_id  text primary key,
  pay_rate       numeric,
  bill_rate      numeric,
  schedule       jsonb,
  updated_at     timestamptz not null default now()
);

-- ─── task_comments ───────────────────────────────────────────────────────
-- Free-text discussion thread on a todo. Author resolves via team_profiles.
create table if not exists public.task_comments (
  id           text primary key,
  todo_id      text not null references public.todos(id) on delete cascade,
  author_id    uuid not null references public.team_profiles(id) on delete set null,
  content      text not null,
  created_at   timestamptz not null default now()
);
create index if not exists task_comments_todo_idx   on public.task_comments (todo_id, created_at);
create index if not exists task_comments_author_idx on public.task_comments (author_id);

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
-- Attached to a district / school / contractor.
-- Two flavors:
--   • Link docs        → url set, storage_path null,  source='link'
--   • Uploaded docs    → url null, storage_path set,  source='upload'
-- Uploads live in the same `task-attachments` Supabase Storage bucket as
-- task/renewal attachments and stream via signed URLs on click.
create table if not exists public.documents (
  id            text primary key,
  scope         text not null check (scope in ('district','school','contractor')),
  scope_id      text not null,
  kind          text not null default 'link',
  url           text,
  name          text not null,
  storage_path  text,
  size          bigint,
  mime          text,
  source        text default 'link',
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

drop trigger if exists touch_coverage_gaps on public.coverage_gaps;
create trigger touch_coverage_gaps before update on public.coverage_gaps
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_renewals on public.renewals;
create trigger touch_renewals before update on public.renewals
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_assignments on public.assignments;
create trigger touch_assignments before update on public.assignments
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_contractor_overrides on public.contractor_overrides;
create trigger touch_contractor_overrides before update on public.contractor_overrides
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_team_profiles on public.team_profiles;
create trigger touch_team_profiles before update on public.team_profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_contacts on public.contacts;
create trigger touch_contacts before update on public.contacts
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_entity_notes on public.entity_notes;
create trigger touch_entity_notes before update on public.entity_notes
  for each row execute function public.touch_updated_at();

-- ─── Auth user → team profile automation ─────────────────────────────────
create or replace function public.profile_initials(full_name text, email text)
returns text language plpgsql immutable as $$
declare
  cleaned text;
  parts text[];
begin
  cleaned := trim(coalesce(nullif(full_name, ''), split_part(coalesce(email, ''), '@', 1), 'Team Member'));
  cleaned := regexp_replace(cleaned, '[._-]+', ' ', 'g');
  parts := regexp_split_to_array(cleaned, '\s+');

  if array_length(parts, 1) >= 2 then
    return upper(left(parts[1], 1) || left(parts[array_length(parts, 1)], 1));
  end if;
  return upper(left(cleaned, 2));
end;
$$;

create or replace function public.profile_color(user_id uuid)
returns text language plpgsql immutable as $$
declare
  colors text[] := array['#1FA39A', '#E76B5D', '#1B2956', '#7A5AE0', '#C98A2C', '#3E8A57', '#5A6478'];
  idx int;
begin
  idx := (get_byte(decode(substr(md5(user_id::text), 1, 2), 'hex'), 0) % array_length(colors, 1)) + 1;
  return colors[idx];
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  display_name text;
begin
  display_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), '');

  insert into public.team_profiles (id, email, full_name, initials, color)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(display_name, split_part(coalesce(new.email, ''), '@', 1)),
    public.profile_initials(display_name, new.email),
    public.profile_color(new.id)
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(public.team_profiles.full_name, ''), excluded.full_name),
    initials = coalesce(nullif(public.team_profiles.initials, ''), excluded.initials),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

insert into public.team_profiles (id, email, full_name, initials, color)
select
  id,
  coalesce(email, ''),
  coalesce(nullif(raw_user_meta_data->>'full_name', ''), nullif(raw_user_meta_data->>'name', ''), split_part(coalesce(email, ''), '@', 1)),
  public.profile_initials(coalesce(nullif(raw_user_meta_data->>'full_name', ''), nullif(raw_user_meta_data->>'name', '')), email),
  public.profile_color(id)
from auth.users
on conflict (id) do update set
  email = excluded.email,
  updated_at = now();

-- ─── Row-level security ───────────────────────────────────────────────────
-- Enable RLS on all tables, then grant authenticated users full access.
-- This means: only logged-in team members can read or write anything,
-- and anonymous (logged-out) access is blocked.
alter table public.todos          enable row level security;
alter table public.task_comments  enable row level security;
alter table public.coverage_gaps  enable row level security;
alter table public.gap_comments   enable row level security;
alter table public.renewals       enable row level security;
alter table public.assignments    enable row level security;
alter table public.contractor_overrides enable row level security;
alter table public.team_profiles enable row level security;
alter table public.contacts      enable row level security;
alter table public.documents     enable row level security;
alter table public.entity_notes  enable row level security;

drop policy if exists "team full access" on public.todos;
create policy "team full access" on public.todos
  for all to authenticated using (true) with check (true);

drop policy if exists "team can read task comments" on public.task_comments;
create policy "team can read task comments"
  on public.task_comments for select to authenticated using (true);

drop policy if exists "team can create own task comments" on public.task_comments;
create policy "team can create own task comments"
  on public.task_comments for insert to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "team can delete own task comments" on public.task_comments;
create policy "team can delete own task comments"
  on public.task_comments for delete to authenticated
  using (auth.uid() = author_id);

drop policy if exists "team full access" on public.coverage_gaps;
create policy "team full access" on public.coverage_gaps
  for all to authenticated using (true) with check (true);

drop policy if exists "team full access" on public.renewals;
create policy "team full access" on public.renewals
  for all to authenticated using (true) with check (true);

drop policy if exists "team full access" on public.assignments;
create policy "team full access" on public.assignments
  for all to authenticated using (true) with check (true);

drop policy if exists "team full access" on public.contractor_overrides;
create policy "team full access" on public.contractor_overrides
  for all to authenticated using (true) with check (true);

drop policy if exists "team can read gap comments" on public.gap_comments;
create policy "team can read gap comments"
  on public.gap_comments for select to authenticated using (true);

drop policy if exists "team can create own gap comments" on public.gap_comments;
create policy "team can create own gap comments"
  on public.gap_comments for insert to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "team can delete own gap comments" on public.gap_comments;
create policy "team can delete own gap comments"
  on public.gap_comments for delete to authenticated
  using (auth.uid() = author_id);

drop policy if exists "team profiles visible to signed-in users" on public.team_profiles;
create policy "team profiles visible to signed-in users" on public.team_profiles
  for select to authenticated using (true);

drop policy if exists "users can create own team profile" on public.team_profiles;
create policy "users can create own team profile" on public.team_profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "users can update own team profile" on public.team_profiles;
create policy "users can update own team profile" on public.team_profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

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
do $$ begin
  alter publication supabase_realtime add table public.todos;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.task_comments;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.coverage_gaps;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.renewals;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.assignments;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.contractor_overrides;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.gap_comments;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.team_profiles;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.contacts;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.documents;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.entity_notes;
exception when duplicate_object then null;
end $$;
