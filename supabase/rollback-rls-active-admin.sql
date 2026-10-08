-- ROLLBACK for the active/admin access change (schema.sql from Oct 8, 2026).
-- Paste into Supabase SQL Editor and run. Restores the previous access
-- model: every signed-in user has full read/write, and any teammate can
-- edit any profile. Leaves the is_admin column and the helper functions
-- in place (harmless) and drops the own-flag rule from the trigger.
-- Source: supabase/schema.sql at commit 9ef793d. Re-running schema.sql
-- afterwards re-applies the access change.

-- 1. Trigger guard without the own-flag rule.
create or replace function public.protect_team_profile_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.id is not null and (new.id is distinct from old.id or new.invited = true) then
    raise exception 'claimed team profiles cannot be un-claimed or re-pointed';
  end if;
  if old.id is null and new.id is not null and auth.uid() is not null then
    raise exception 'pending invites are claimed by sign-up, not by edit';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_team_profile_identity on public.team_profiles;
create trigger protect_team_profile_identity
  before update on public.team_profiles
  for each row execute function public.protect_team_profile_identity();

-- 2. Table policies.

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

drop policy if exists "team full access" on public.school_overrides;
create policy "team full access" on public.school_overrides
  for all to authenticated using (true) with check (true);

drop policy if exists "team full access" on public.district_overrides;
create policy "team full access" on public.district_overrides
  for all to authenticated using (true) with check (true);

drop policy if exists "team full access" on public.schedule_slots;
create policy "team full access" on public.schedule_slots
  for all to authenticated using (true) with check (true);

drop policy if exists "team full access" on public.match_proposals;
create policy "team full access" on public.match_proposals
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

-- Drop the narrower per-user update policy: Postgres ORs RLS policies on
-- the same action, so this restriction was dead the moment we added the
-- broader 'team can update team profiles' policy below. Removing it makes
-- the intent explicit and avoids a false sense of restriction.
drop policy if exists "users can update own team profile" on public.team_profiles;

-- Admin page edits other teammates' rows (rename, role, initials, color,
-- active toggle). Trusted internal team — every signed-in user is an admin.
drop policy if exists "team can update team profiles" on public.team_profiles;
create policy "team can update team profiles" on public.team_profiles
  for update to authenticated using (true) with check (true);

-- Pre-add ("invite") a teammate from the Admin page: creates a pending
-- row with no auth uid yet. Restricted to rows that are clearly pending
-- (id is null, invited = true) so this policy can't be abused to insert
-- a row claiming someone else's auth uid — that's still gated by the
-- "users can create own team profile" policy above.
drop policy if exists "team can invite teammates" on public.team_profiles;
create policy "team can invite teammates" on public.team_profiles
  for insert to authenticated
  with check (id is null and invited = true);

-- Cancel a pending invite from the Admin page. Restricted to pending
-- rows only — claimed profiles can't be deleted through the app (auth
-- account deletion cascades from auth.users).
drop policy if exists "team can cancel pending invites" on public.team_profiles;
create policy "team can cancel pending invites" on public.team_profiles
  for delete to authenticated
  using (id is null and invited = true);

drop policy if exists "team full access" on public.contacts;
create policy "team full access" on public.contacts
  for all to authenticated using (true) with check (true);

drop policy if exists "team full access" on public.documents;
create policy "team full access" on public.documents
  for all to authenticated using (true) with check (true);

drop policy if exists "team full access" on public.entity_notes;
create policy "team full access" on public.entity_notes
  for all to authenticated using (true) with check (true);

drop policy if exists "team full access" on public.spec_settings;
create policy "team full access" on public.spec_settings
  for all to authenticated using (true) with check (true);

drop policy if exists "team full access" on public.contractors;
create policy "team full access" on public.contractors
  for all to authenticated using (true) with check (true);

drop policy if exists "team full access" on public.district_rate_cards;
create policy "team full access" on public.district_rate_cards
  for all to authenticated using (true) with check (true);


-- 3. Storage policies.
drop policy if exists "team can read task attachments" on storage.objects;
create policy "team can read task attachments" on storage.objects
  for select to authenticated using (bucket_id = 'task-attachments');

drop policy if exists "team can upload task attachments" on storage.objects;
create policy "team can upload task attachments" on storage.objects
  for insert to authenticated with check (bucket_id = 'task-attachments');

drop policy if exists "team can update task attachments" on storage.objects;
create policy "team can update task attachments" on storage.objects
  for update to authenticated using (bucket_id = 'task-attachments') with check (bucket_id = 'task-attachments');

drop policy if exists "team can delete task attachments" on storage.objects;
create policy "team can delete task attachments" on storage.objects
  for delete to authenticated using (bucket_id = 'task-attachments');
