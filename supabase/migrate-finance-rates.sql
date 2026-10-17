-- ONE-SHOT DATA MOVE for finance visibility (Phase A → B, Oct 2026).
-- Mirrors the pay / bill rates from the legacy columns on the shared tables
-- into the admin-only finance tables created by schema.sql. Paste schema.sql
-- first. Paste this at Phase A, and once more on Phase B deploy day right
-- before the deploy, so edits made in between are picked up.
--
-- Each run is a full mirror of the legacy columns: rates added, changed or
-- cleared since the last run are all carried across, and a finance row
-- whose legacy rate is now null (or whose contractor row is gone) is
-- removed. Until the Phase B client is live the legacy columns are the
-- source of truth, so re-running in that window never loses anything.
-- Exception: testing the Phase B client at localhost writes to the finance
-- tables, and the guard below then refuses (it cannot tell a localhost test
-- from a live deploy). Deploy day therefore always starts by pasting
-- reset-finance-mirror.sql, which throws the finance contents away, and
-- then this file, which rebuilds them from the legacy columns.
--
-- NEVER after the Phase B client is live: from then on the finance tables
-- are the truth and the legacy columns are blanked. Step 0 enforces this:
--   * phase-b-live.sql writes a "LOCKED …" marker as the table comment on
--     spec_financials; this file refuses while it is there.
--   * Before that, the marker is the timestamp of the last run here. Every
--     mirrored row carries its legacy updated_at (triggers are paused for
--     the copy), so a finance row newer than the marker can only have come
--     from the Phase B client. The file refuses in that case too.
--   * No marker but rows already in the rate tables means the marker was
--     wiped (the Supabase Table Editor shows it as the table "description").
--     The file refuses rather than guess.
--
-- The whole file runs as one transaction in the Supabase SQL Editor: any
-- error means nothing changed. Step 8 raises if a count is off, so a
-- partial copy can never commit. Step 9 prints the counts as a receipt;
-- every `expected` equals its `copied`. If anything here fails, stop and
-- ask Claude. Do NOT run rollback-finance-access.sql as a remedy.

-- 0. Guard.
do $$
declare
  marker   text;
  last_run timestamptz;
begin
  if to_regclass('public.spec_financials') is null then
    raise exception 'The finance tables do not exist yet. Paste schema.sql first. Nothing was changed.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'assignments' and column_name = 'pay_rate') then
    raise exception 'The legacy rate columns are gone (Phase C has run). There is nothing to copy. Nothing was changed.';
  end if;

  marker := nullif(obj_description('public.spec_financials'::regclass, 'pg_class'), '');

  if marker is null then
    if exists (select 1 from public.contractor_pay_rates)
    or exists (select 1 from public.assignment_rates)
    or exists (select 1 from public.gap_bill_rates) then
      raise exception using
        message = 'No migrate marker on spec_financials, but the finance tables already hold rows. The marker was cleared or the Phase B client has written rows. Nothing was changed.',
        hint    = 'Is the new dashboard live on Vercel? NO: paste reset-finance-mirror.sql, then this file. YES: stop and ask Claude; do not paste phase-b-live.sql.';
    end if;
    return;  -- first run
  end if;

  if marker like 'LOCKED%' then
    raise exception using
      message = format('Phase B is live (%s). This file would overwrite the finance tables with the blanked legacy columns and must not run again. Nothing was changed.', marker),
      hint    = 'To return to the legacy columns follow the Rollback section of docs/finance-visibility-scope.md.';
  end if;

  begin
    last_run := marker::timestamptz;
  exception when others then
    raise exception using
      message = format('Unrecognised migrate marker on spec_financials: "%s". Nothing was changed.', marker),
      hint    = 'Ask Claude before doing anything else.';
  end;

  if exists (select 1 from public.contractor_pay_rates where updated_at > last_run)
  or exists (select 1 from public.assignment_rates     where updated_at > last_run)
  or exists (select 1 from public.gap_bill_rates       where updated_at > last_run)
  or exists (select 1 from public.spec_financials      where updated_at > last_run) then
    raise exception using
      message = format('Finance rows were changed after the last migrate run (%s). Only the Phase B client does that, at localhost or live. Refusing to overwrite them. Nothing was changed.', last_run),
      hint    = 'Is the new dashboard live on Vercel? NO (localhost testing): paste reset-finance-mirror.sql, then this file. YES: stop and ask Claude; do not paste phase-b-live.sql.';
  end if;
end $$;

-- 1. Pause the touch triggers so each mirrored row keeps its legacy
--    updated_at (the guard above depends on it).
alter table public.contractor_pay_rates disable trigger touch_contractor_pay_rates;
alter table public.assignment_rates     disable trigger touch_assignment_rates;
alter table public.gap_bill_rates       disable trigger touch_gap_bill_rates;
alter table public.spec_financials      disable trigger touch_spec_financials;

-- 2. Remove finance rows whose legacy rate is gone (cleared to null, or the
--    parent row deleted). spec_financials needs no delete: schema.sql seeds
--    the same seven codes and spec_settings rows are never deleted.
delete from public.contractor_pay_rates r
 where not exists (select 1 from public.contractors c
                    where c.id = r.contractor_id and c.pay_rate is not null)
   and not exists (select 1 from public.contractor_overrides o
                    where o.contractor_id = r.contractor_id and o.pay_rate is not null);

delete from public.assignment_rates r
 where not exists (select 1 from public.assignments a
                    where a.id = r.assignment_id and a.pay_rate is not null);

delete from public.gap_bill_rates r
 where not exists (select 1 from public.coverage_gaps g
                    where g.id = r.gap_id and g.bill_rate is not null);

-- 3. Contractor pay. Supabase-created contractors keep pay on `contractors`;
--    mock contractors keep it on `contractor_overrides`. The client merge
--    prefers the override when both exist, so copy contractors first and let
--    overrides overwrite.
insert into public.contractor_pay_rates (contractor_id, pay_rate, updated_at)
select id, pay_rate, updated_at
  from public.contractors
 where pay_rate is not null
on conflict (contractor_id) do update
  set pay_rate = excluded.pay_rate, updated_at = excluded.updated_at;

insert into public.contractor_pay_rates (contractor_id, pay_rate, updated_at)
select contractor_id, pay_rate, updated_at
  from public.contractor_overrides
 where pay_rate is not null
on conflict (contractor_id) do update
  set pay_rate = excluded.pay_rate, updated_at = excluded.updated_at;

-- 4. Per-assignment pay override.
insert into public.assignment_rates (assignment_id, pay_rate, updated_at)
select id, pay_rate, updated_at
  from public.assignments
 where pay_rate is not null
on conflict (assignment_id) do update
  set pay_rate = excluded.pay_rate, updated_at = excluded.updated_at;

-- 5. Per-gap bill override.
insert into public.gap_bill_rates (gap_id, bill_rate, updated_at)
select id, bill_rate, updated_at
  from public.coverage_gaps
 where bill_rate is not null
on conflict (gap_id) do update
  set bill_rate = excluded.bill_rate, updated_at = excluded.updated_at;

-- 6. Per-specialty burden and rate bands. schema.sql seeds spec_financials
--    with the prototype defaults; this overwrites them with whatever the
--    admins have actually set on /financials.
insert into public.spec_financials
  (spec_code, burden_per_billable_hour,
   default_pay_low, default_pay_high, default_bill_low, default_bill_high, updated_at)
select spec_code, burden_per_billable_hour,
       default_pay_low, default_pay_high, default_bill_low, default_bill_high, updated_at
  from public.spec_settings
on conflict (spec_code) do update
  set burden_per_billable_hour = excluded.burden_per_billable_hour,
      default_pay_low          = excluded.default_pay_low,
      default_pay_high         = excluded.default_pay_high,
      default_bill_low         = excluded.default_bill_low,
      default_bill_high        = excluded.default_bill_high,
      updated_at               = excluded.updated_at;

-- 7. Triggers back on.
alter table public.contractor_pay_rates enable trigger touch_contractor_pay_rates;
alter table public.assignment_rates     enable trigger touch_assignment_rates;
alter table public.gap_bill_rates       enable trigger touch_gap_bill_rates;
alter table public.spec_financials      enable trigger touch_spec_financials;

-- 8. Record this run for the guard, then assert the mirror is exact. The
--    marker is the later of the wall clock now (not the transaction start,
--    which could predate a legacy edit committed while this ran) and the
--    newest mirrored row, so nothing copied here ever looks "newer".
do $$
declare
  stamp timestamptz;
  bad   text;
begin
  select greatest(clock_timestamp(),
                  coalesce((select max(updated_at) from public.contractor_pay_rates), '-infinity'),
                  coalesce((select max(updated_at) from public.assignment_rates),     '-infinity'),
                  coalesce((select max(updated_at) from public.gap_bill_rates),       '-infinity'),
                  coalesce((select max(updated_at) from public.spec_financials),      '-infinity'))
    into stamp;
  execute format('comment on table public.spec_financials is %L', stamp::text);

  select string_agg(what, '; ') into bad from (
    select 'contractor pay' as what
     where (select count(*) from (select id from public.contractors where pay_rate is not null
                                  union
                                  select contractor_id from public.contractor_overrides where pay_rate is not null) s)
        <> (select count(*) from public.contractor_pay_rates)
    union all
    select 'assignment pay overrides'
     where (select count(*) from public.assignments where pay_rate is not null)
        <> (select count(*) from public.assignment_rates)
    union all
    select 'gap bill overrides'
     where (select count(*) from public.coverage_gaps where bill_rate is not null)
        <> (select count(*) from public.gap_bill_rates)
    union all
    select 'specialty financials'
     where (select count(*) from public.spec_settings)
        <> (select count(*) from public.spec_financials)
  ) m;
  if bad is not null then
    raise exception using
      message = format('Mirror check failed for: %s. Nothing was changed.', bad),
      hint    = 'Ask Claude before doing anything else.';
  end if;
end $$;

-- 9. Receipt. Every `expected` equals `copied` (step 8 guarantees it).
select 'contractor pay (distinct ids across contractors + overrides)' as what,
       (select count(*) from (
          select id from public.contractors where pay_rate is not null
          union
          select contractor_id from public.contractor_overrides where pay_rate is not null) s) as expected,
       (select count(*) from public.contractor_pay_rates) as copied
union all
select 'assignment pay overrides',
       (select count(*) from public.assignments where pay_rate is not null),
       (select count(*) from public.assignment_rates)
union all
select 'gap bill overrides',
       (select count(*) from public.coverage_gaps where bill_rate is not null),
       (select count(*) from public.gap_bill_rates)
union all
select 'specialty financials',
       (select count(*) from public.spec_settings),
       (select count(*) from public.spec_financials)
union all
select 'migrate marker (last run): ' || obj_description('public.spec_financials'::regclass, 'pg_class'),
       null,
       null;
