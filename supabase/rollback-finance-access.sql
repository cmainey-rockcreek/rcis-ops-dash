-- ROLLBACK for the finance visibility change (schema.sql from Oct 16, 2026).
-- Paste into Supabase SQL Editor and run. Restores the previous model: pay
-- and bill rates live on the shared tables, every active teammate can read
-- them, and district_rate_cards is readable by every active teammate.
--
-- ORDER: run this FIRST, then deploy the pre-finance-visibility commit of
-- the app. The Phase B client only loses its finance widgets while the two
-- are out of step; the old client against a half-rolled-back database
-- would fail to load whole pages. Ask the admins not to change any rate
-- between the two steps.
--
-- Which copy of the rates is the truth depends on how far the rollout got,
-- and this file works it out from the state of the database:
--   A  Phase A only (legacy columns present, phase-b-live.sql never pasted):
--      the live client has been writing the legacy columns all along, so
--      they are already current. Nothing is copied back. The finance
--      tables are just dropped.
--   B  Phase B live (the "LOCKED" marker from phase-b-live.sql is present):
--      the finance tables are the truth and the legacy columns were
--      blanked. The legacy columns are rebuilt to mirror the finance
--      tables exactly, including rates removed through the app.
--   C  Phase C has run (legacy columns gone): step 1 re-adds them, then as
--      in B.
-- If finance rows were changed after the last migrate but phase-b-live.sql
-- was never pasted, the file refuses rather than guess (see step 0).
--
-- Safe to re-run: a second run finds no finance tables and only re-asserts
-- the district_rate_cards policy. One transaction; any error means nothing
-- changed.
--
-- AFTER THIS ROLLBACK, DO NOT RE-PASTE schema.sql until you are going
-- forward again: it recreates the empty finance tables and makes
-- district_rate_cards admin-only again, which the old client is not
-- prepared for (non-admins would see default-band bill figures and their
-- rate-card edits would revert). Going forward again: paste schema.sql,
-- paste migrate-finance-rates.sql, deploy the Phase B client, paste
-- phase-b-live.sql. schema.sql never drops columns, so re-pasting it never
-- loses data; the point above is about the policy.

-- 0. Decide the mode and stash it for the rest of the transaction.
do $$
declare
  marker         text;
  last_run       timestamptz;
  legacy_present boolean;
  mode           text;
begin
  if to_regclass('public.spec_financials') is null then
    perform set_config('rcis.rollback_mode', 'none', true);
    raise notice 'Finance tables are already gone; nothing to roll back. Re-asserting the district_rate_cards policy only.';
    return;
  end if;

  legacy_present := exists (select 1 from information_schema.columns
                             where table_schema = 'public' and table_name = 'assignments' and column_name = 'pay_rate');
  marker := nullif(obj_description('public.spec_financials'::regclass, 'pg_class'), '');

  if not legacy_present then
    mode := 'C';
  elsif marker like 'LOCKED%' then
    mode := 'B';
  else
    mode := 'A';
    if marker is null then
      if exists (select 1 from public.contractor_pay_rates)
      or exists (select 1 from public.assignment_rates)
      or exists (select 1 from public.gap_bill_rates) then
        raise exception using
          message = 'No migrate marker on spec_financials, but the finance tables hold rows. Cannot tell which copy of the rates is the truth. Nothing was changed.',
          hint    = 'Is the new dashboard live on Vercel? NO: paste reset-finance-mirror.sql, then this file. YES: stop and ask Claude; do not paste phase-b-live.sql.';
      end if;
    else
      begin
        last_run := marker::timestamptz;
      exception when others then
        raise exception using
          message = format('Unrecognised marker on spec_financials: "%s". Nothing was changed.', marker),
          hint    = 'Ask Claude before doing anything else.';
      end;
      if exists (select 1 from public.contractor_pay_rates where updated_at > last_run)
      or exists (select 1 from public.assignment_rates     where updated_at > last_run)
      or exists (select 1 from public.gap_bill_rates       where updated_at > last_run)
      or exists (select 1 from public.spec_financials      where updated_at > last_run) then
        raise exception using
          message = format('Finance rows were changed after the last migrate run (%s), which only the Phase B client does (at localhost or live), but phase-b-live.sql was never pasted. Cannot tell which copy of the rates is the truth. Nothing was changed.', last_run),
          hint    = 'Is the new dashboard live on Vercel? NO (localhost testing): paste reset-finance-mirror.sql, then this file. YES: stop and ask Claude; do not paste phase-b-live.sql.';
      end if;
    end if;
  end if;

  perform set_config('rcis.rollback_mode', mode, true);
  raise notice 'rollback mode %', mode;
end $$;

-- 1. Remove the triggers that keep the legacy columns blank while LOCKED
--    (installed by phase-b-live.sql; no-op if absent), then the legacy
--    columns back (no-op if they still exist). The triggers must go before
--    step 2 writes values into those columns.
drop trigger if exists blank_legacy_rates on public.contractors;
drop trigger if exists blank_legacy_rates on public.contractor_overrides;
drop trigger if exists blank_legacy_rates on public.assignments;
drop trigger if exists blank_legacy_rates on public.coverage_gaps;
drop trigger if exists blank_legacy_rates on public.spec_settings;
drop function if exists public.blank_legacy_rates();

alter table public.contractors          add column if not exists pay_rate  numeric;
alter table public.contractor_overrides add column if not exists pay_rate  numeric;
alter table public.assignments          add column if not exists pay_rate  numeric;
alter table public.coverage_gaps        add column if not exists bill_rate numeric;
alter table public.spec_settings add column if not exists burden_per_billable_hour numeric not null default 0;
alter table public.spec_settings add column if not exists default_pay_low   numeric;
alter table public.spec_settings add column if not exists default_pay_high  numeric;
alter table public.spec_settings add column if not exists default_bill_low  numeric;
alter table public.spec_settings add column if not exists default_bill_high numeric;

-- 2. Copy back when the finance tables are the truth (modes B and C).
--    The legacy columns are blanked first so a rate removed through the
--    Phase B app does not come back from a stale legacy value. Contractor
--    pay goes to `contractors` for a Supabase contractor and to
--    `contractor_overrides` for a mock one; blanking the overrides first
--    also clears any old override that would shadow the restored value.
do $$
declare
  mode text := current_setting('rcis.rollback_mode', true);
begin
  if mode is null or mode = '' then
    raise exception 'Run this whole file in one go in the Supabase SQL Editor (it must be a single transaction). Nothing was changed.';
  end if;
  if mode in ('none', 'A') then
    raise notice 'Legacy columns are the source of truth; nothing copied back.';
    return;
  end if;

  update public.contractors          set pay_rate  = null;
  update public.contractor_overrides set pay_rate  = null;
  update public.assignments          set pay_rate  = null;
  update public.coverage_gaps        set bill_rate = null;

  update public.contractors c
     set pay_rate = r.pay_rate
    from public.contractor_pay_rates r
   where r.contractor_id = c.id;

  insert into public.contractor_overrides (contractor_id, pay_rate)
  select r.contractor_id, r.pay_rate
    from public.contractor_pay_rates r
   where not exists (select 1 from public.contractors c where c.id = r.contractor_id)
  on conflict (contractor_id) do update set pay_rate = excluded.pay_rate;

  update public.assignments a
     set pay_rate = r.pay_rate
    from public.assignment_rates r
   where r.assignment_id = a.id;

  update public.coverage_gaps g
     set bill_rate = r.bill_rate
    from public.gap_bill_rates r
   where r.gap_id = g.id;

  update public.spec_settings s
     set burden_per_billable_hour = f.burden_per_billable_hour,
         default_pay_low          = f.default_pay_low,
         default_pay_high         = f.default_pay_high,
         default_bill_low         = f.default_bill_low,
         default_bill_high        = f.default_bill_high
    from public.spec_financials f
   where f.spec_code = s.spec_code;
end $$;

-- 3. district_rate_cards readable by every active teammate again.
drop policy if exists "admins full access" on public.district_rate_cards;
drop policy if exists "team full access"   on public.district_rate_cards;
create policy "team full access" on public.district_rate_cards
  for all to authenticated
  using ((select public.is_active_member())) with check ((select public.is_active_member()));

-- 4. Drop the finance tables. Removing them from the realtime publication
--    happens automatically; the migrate / LOCKED marker (a comment on
--    spec_financials) goes with the table. The contractor-delete cascade
--    trigger from schema.sql references contractor_pay_rates, so it goes
--    first (schema.sql recreates it when going forward again).
drop trigger if exists cascade_contractor_pay_rate_delete on public.contractors;
drop function if exists public.cascade_contractor_pay_rate_delete();
drop table if exists public.assignment_rates;
drop table if exists public.gap_bill_rates;
drop table if exists public.contractor_pay_rates;
drop table if exists public.spec_financials;

-- 5. Receipt.
select 'mode: ' || coalesce(current_setting('rcis.rollback_mode', true), '?') as what, null::bigint as rows_with_rate
union all
select 'contractors.pay_rate',            count(*) from public.contractors          where pay_rate  is not null
union all
select 'contractor_overrides.pay_rate',   count(*) from public.contractor_overrides where pay_rate  is not null
union all
select 'assignments.pay_rate',            count(*) from public.assignments          where pay_rate  is not null
union all
select 'coverage_gaps.bill_rate',         count(*) from public.coverage_gaps        where bill_rate is not null
union all
select 'spec_settings rows',              count(*) from public.spec_settings;
