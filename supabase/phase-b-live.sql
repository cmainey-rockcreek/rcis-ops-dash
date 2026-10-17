-- PHASE B LIVE (finance visibility, Oct 2026). Paste ONCE, on deploy day,
-- in this order:
--   1. everyone stops editing pay, bill and burden until told
--   2. paste reset-finance-mirror.sql (throws away localhost test writes)
--   3. paste migrate-finance-rates.sql (final mirror; receipt counts match)
--   4. deploy the Phase B client; wait for Vercel READY
--   5. every teammate reloads the dashboard (an old tab keeps the old code)
--   6. paste this file
-- From here on the finance tables are the source of truth.
--
-- What it does, in one transaction:
--   * Refuses unless the marker on spec_financials is the timestamp written
--     by migrate-finance-rates.sql, and unless every legacy rate equals its
--     finance row (and every finance row has a legacy source). A skipped or
--     stale final migrate therefore cannot blank rates that were never
--     mirrored. Finance rows newer than the marker are skipped in that
--     check: they are edits made through the new client after the mirror.
--   * Marks Phase B live: the marker becomes "LOCKED …".
--     migrate-finance-rates.sql and reset-finance-mirror.sql refuse while
--     it is there, rollback-finance-access.sql copies the finance tables
--     back when it is there, and phase-c-drop-legacy-rates.sql requires it.
--   * Blanks the legacy copies of every rate and installs triggers that
--     keep them blank while LOCKED, so a save from a stale old-client tab
--     cannot put a rate back where every active teammate can read it. The
--     legacy columns stay on the shared tables until Phase C.
--
-- Safe to re-run: the lock is kept as first written and the blanking is a
-- no-op the second time. To undo, follow the Rollback section of
-- docs/finance-visibility-scope.md (run rollback-finance-access.sql FIRST,
-- then redeploy the old client).

-- 0. Guard, and the mirror check.
do $$
declare
  marker   text;
  last_run timestamptz;
  n_pay    bigint;
  n_asg    bigint;
  n_gap    bigint;
  n_spec   bigint;
begin
  if to_regclass('public.spec_financials') is null then
    raise exception 'The finance tables do not exist. Paste schema.sql, then migrate-finance-rates.sql, deploy, then this. Nothing was changed.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'assignments' and column_name = 'pay_rate') then
    raise exception 'The legacy rate columns are already gone (Phase C has run). Nothing to do.';
  end if;

  marker := nullif(obj_description('public.spec_financials'::regclass, 'pg_class'), '');
  if marker is null then
    raise exception using
      message = 'migrate-finance-rates.sql has not run since the finance tables were created or reset, so they hold no mirrored rates. Blanking the legacy columns now would lose them. Nothing was changed.',
      hint    = 'Paste migrate-finance-rates.sql, check its receipt, then paste this file.';
  end if;
  if marker like 'LOCKED%' then
    raise notice 'Already marked live (%). Keeping that marker; re-blanking the legacy columns.', marker;
    return;
  end if;
  begin
    last_run := marker::timestamptz;
  exception when others then
    raise exception using
      message = format('Unrecognised marker on spec_financials: "%s". Only the timestamp written by migrate-finance-rates.sql is accepted here. Nothing was changed.', marker),
      hint    = 'Ask Claude before doing anything else.';
  end;

  -- Legacy contractor pay as the client resolves it: override wins.
  create temp table legacy_pay on commit drop as
    select coalesce(o.contractor_id, c.id) as id,
           coalesce(o.pay_rate, c.pay_rate)  as rate
      from public.contractors c
      full join public.contractor_overrides o on o.contractor_id = c.id
     where coalesce(o.pay_rate, c.pay_rate) is not null;

  select (select count(*) from legacy_pay l
           where not exists (select 1 from public.contractor_pay_rates r
                              where r.contractor_id = l.id
                                and (r.pay_rate = l.rate or r.updated_at > last_run)))
       + (select count(*) from public.contractor_pay_rates r
           where r.updated_at <= last_run
             and not exists (select 1 from legacy_pay l where l.id = r.contractor_id))
    into n_pay;

  select (select count(*) from public.assignments a
           where a.pay_rate is not null
             and not exists (select 1 from public.assignment_rates r
                              where r.assignment_id = a.id
                                and (r.pay_rate = a.pay_rate or r.updated_at > last_run)))
       + (select count(*) from public.assignment_rates r
           where r.updated_at <= last_run
             and not exists (select 1 from public.assignments a
                              where a.id = r.assignment_id and a.pay_rate is not null))
    into n_asg;

  select (select count(*) from public.coverage_gaps g
           where g.bill_rate is not null
             and not exists (select 1 from public.gap_bill_rates r
                              where r.gap_id = g.id
                                and (r.bill_rate = g.bill_rate or r.updated_at > last_run)))
       + (select count(*) from public.gap_bill_rates r
           where r.updated_at <= last_run
             and not exists (select 1 from public.coverage_gaps g
                              where g.id = r.gap_id and g.bill_rate is not null))
    into n_gap;

  select (select count(*) from public.spec_settings s
           where not exists (select 1 from public.spec_financials f
                              where f.spec_code = s.spec_code
                                and (f.updated_at > last_run
                                     or (f.burden_per_billable_hour is not distinct from s.burden_per_billable_hour
                                         and f.default_pay_low   is not distinct from s.default_pay_low
                                         and f.default_pay_high  is not distinct from s.default_pay_high
                                         and f.default_bill_low  is not distinct from s.default_bill_low
                                         and f.default_bill_high is not distinct from s.default_bill_high))))
       + (select count(*) from public.spec_financials f
           where f.updated_at <= last_run
             and not exists (select 1 from public.spec_settings s where s.spec_code = f.spec_code))
    into n_spec;

  if n_pay + n_asg + n_gap + n_spec > 0 then
    raise exception using
      message = format('The finance tables do not match the legacy rates (contractor pay %s, assignment overrides %s, gap overrides %s, specialty rows %s differ). Nothing was changed.', n_pay, n_asg, n_gap, n_spec),
      hint    = 'Paste reset-finance-mirror.sql, then migrate-finance-rates.sql, check its receipt, then paste this file again. If the migrate refuses, stop and ask Claude.';
  end if;

  execute format('comment on table public.spec_financials is %L',
                 'LOCKED Phase B live ' || clock_timestamp()::text);
end $$;

-- 1. Keep the legacy columns blank while LOCKED. Any insert or update from a
--    stale old-client tab would otherwise write cached rates back into
--    columns every active teammate can read. Nulls the values rather than
--    rejecting the row, because the old client sends the key on every save
--    (a name or schedule edit included). Removed by
--    phase-c-drop-legacy-rates.sql and by rollback-finance-access.sql.
create or replace function public.blank_legacy_rates()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(obj_description(to_regclass('public.spec_financials'), 'pg_class'), '') not like 'LOCKED%' then
    return new;
  end if;
  if tg_table_name = 'spec_settings' then
    new.burden_per_billable_hour := 0;
    new.default_pay_low  := null;
    new.default_pay_high := null;
    new.default_bill_low := null;
    new.default_bill_high := null;
  elsif tg_table_name = 'coverage_gaps' then
    new.bill_rate := null;
  else
    new.pay_rate := null;
  end if;
  return new;
end;
$$;

drop trigger if exists blank_legacy_rates on public.contractors;
create trigger blank_legacy_rates before insert or update on public.contractors
  for each row execute function public.blank_legacy_rates();
drop trigger if exists blank_legacy_rates on public.contractor_overrides;
create trigger blank_legacy_rates before insert or update on public.contractor_overrides
  for each row execute function public.blank_legacy_rates();
drop trigger if exists blank_legacy_rates on public.assignments;
create trigger blank_legacy_rates before insert or update on public.assignments
  for each row execute function public.blank_legacy_rates();
drop trigger if exists blank_legacy_rates on public.coverage_gaps;
create trigger blank_legacy_rates before insert or update on public.coverage_gaps
  for each row execute function public.blank_legacy_rates();
drop trigger if exists blank_legacy_rates on public.spec_settings;
create trigger blank_legacy_rates before insert or update on public.spec_settings
  for each row execute function public.blank_legacy_rates();

-- 2. Blank the legacy copies. The `where` clauses skip rows that are already
--    blank so the touch triggers do not fire needlessly.
update public.contractors          set pay_rate  = null where pay_rate  is not null;
update public.contractor_overrides set pay_rate  = null where pay_rate  is not null;
update public.assignments          set pay_rate  = null where pay_rate  is not null;
update public.coverage_gaps        set bill_rate = null where bill_rate is not null;
update public.spec_settings
   set burden_per_billable_hour = 0,
       default_pay_low  = null, default_pay_high  = null,
       default_bill_low = null, default_bill_high = null
 where burden_per_billable_hour <> 0
    or default_pay_low  is not null or default_pay_high  is not null
    or default_bill_low is not null or default_bill_high is not null;

-- 3. Receipt: every legacy count is 0 and the marker reads LOCKED.
select 'contractors.pay_rate still set'           as what, count(*) as rows from public.contractors          where pay_rate  is not null
union all
select 'contractor_overrides.pay_rate still set',           count(*)         from public.contractor_overrides where pay_rate  is not null
union all
select 'assignments.pay_rate still set',                    count(*)         from public.assignments          where pay_rate  is not null
union all
select 'coverage_gaps.bill_rate still set',                 count(*)         from public.coverage_gaps        where bill_rate is not null
union all
select 'spec_settings financial columns still set',         count(*)         from public.spec_settings
 where burden_per_billable_hour <> 0 or default_pay_low is not null or default_pay_high is not null
    or default_bill_low is not null or default_bill_high is not null
union all
select 'marker: ' || obj_description('public.spec_financials'::regclass, 'pg_class'), null;
