-- PHASE C (finance visibility, Oct 2026). Drops the legacy rate columns
-- from the shared tables and the triggers that kept them blank. Paste ONCE,
-- a few days after phase-b-live.sql, once the Phase B client has proven
-- itself. Until then the columns are blank but still exist.
--
-- Guard: refuses unless phase-b-live.sql has been pasted (the "LOCKED"
-- marker on spec_financials). That marker is also removed by
-- rollback-finance-access.sql, so after a rollback this file cannot drop
-- columns that have just become the only copy of the rates.
--
-- Precondition that no SQL can check: the Phase B client that is live on
-- Vercel must no longer SEND any of these keys in an insert or update body:
-- pay_rate to contractors or contractor_overrides (the overrides store
-- sends its whole row on every profile edit, name and phone included),
-- pay_rate to assignments, bill_rate to coverage_gaps, and the five
-- financial keys to spec_settings. PostgREST rejects unknown columns on
-- write with HTTP 400, and most stores do not roll back on error, so a
-- leftover key would make saves appear to work and vanish on reload.
-- Verify first on the live site with the Network tab open (brief,
-- done-checklist item 4): create a contractor, edit a mock contractor's
-- phone, edit a Supabase contractor's phone, save an assignment, save a
-- gap, save a specialty row. `bill_rate` written to district_rate_cards is
-- expected and stays.
--
-- Same commit as this paste, in schema.sql: remove the five financial
-- columns from `create table if not exists public.spec_settings` and its
-- header comment; trim its seed insert to
--   insert into public.spec_settings (spec_code, indirect_ratio) values
--   ('SLP',0.25),('OT',0.25),('PT',0.25),('PSY',0.25),('BCBA',0.25),('MH',0.25),('SPED',0.25)
--   on conflict (spec_code) do nothing;
-- (otherwise the next schema.sql re-paste fails on the missing columns);
-- remove the legacy `pay_rate` / `bill_rate` lines from the other four
-- `create table` statements and the comments that describe them; update
-- CLAUDE.md's Money math and Database sections and the code comments in
-- financials.js and district-rate-card-store.js that still name
-- spec_settings.default_bill_low.
--
-- One transaction; any error means nothing changed.

do $$
declare
  marker text;
begin
  if to_regclass('public.spec_financials') is null then
    raise exception 'The finance tables do not exist. Phase C cannot run. Nothing was changed.';
  end if;
  marker := nullif(obj_description('public.spec_financials'::regclass, 'pg_class'), '');
  if marker is null or marker not like 'LOCKED%' then
    raise exception using
      message = 'Phase B has not been marked live (phase-b-live.sql not pasted since the finance tables were created). Refusing to drop the legacy rate columns. Nothing was changed.',
      hint    = 'Deploy the Phase B client, paste phase-b-live.sql, wait a few days, then paste this file.';
  end if;

  -- The blanking triggers reference the columns; remove them first.
  drop trigger if exists blank_legacy_rates on public.contractors;
  drop trigger if exists blank_legacy_rates on public.contractor_overrides;
  drop trigger if exists blank_legacy_rates on public.assignments;
  drop trigger if exists blank_legacy_rates on public.coverage_gaps;
  drop trigger if exists blank_legacy_rates on public.spec_settings;
  drop function if exists public.blank_legacy_rates();

  alter table public.contractors          drop column if exists pay_rate;
  alter table public.contractor_overrides drop column if exists pay_rate;
  alter table public.assignments          drop column if exists pay_rate;
  alter table public.coverage_gaps        drop column if exists bill_rate;
  alter table public.spec_settings        drop column if exists burden_per_billable_hour;
  alter table public.spec_settings        drop column if exists default_pay_low;
  alter table public.spec_settings        drop column if exists default_pay_high;
  alter table public.spec_settings        drop column if exists default_bill_low;
  alter table public.spec_settings        drop column if exists default_bill_high;
end $$;

-- Receipt: no legacy rate column remains (empty result).
select table_name || '.' || column_name as legacy_column_still_present
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name in ('contractors', 'contractor_overrides', 'assignments') and column_name = 'pay_rate')
     or (table_name = 'coverage_gaps' and column_name = 'bill_rate')
     or (table_name = 'spec_settings' and column_name in
         ('burden_per_billable_hour', 'default_pay_low', 'default_pay_high', 'default_bill_low', 'default_bill_high')));
