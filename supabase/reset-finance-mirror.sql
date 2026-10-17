-- RESET the finance tables (finance visibility, Oct 2026). Empties
-- contractor_pay_rates, assignment_rates, gap_bill_rates and
-- spec_financials and clears the migrate marker, so the next
-- migrate-finance-rates.sql run rebuilds them from the legacy columns.
--
-- Only allowed while the legacy columns are still the source of truth:
-- the legacy columns must exist and Phase B must not have been marked live
-- (no "LOCKED" marker). In that window the finance tables are disposable:
-- they hold a mirror of the legacy columns plus whatever testing the Phase
-- B client at localhost wrote.
--
-- When to paste it:
--   * Deploy day for Phase B, as the first step, before the final migrate.
--   * Whenever migrate-finance-rates.sql or rollback-finance-access.sql
--     refuses because finance rows are newer than the marker and the new
--     dashboard is NOT live on Vercel.
-- Never after phase-b-live.sql: it refuses then, because the finance tables
-- have become the only copy of the rates.
--
-- One transaction; any error means nothing changed.

do $$
declare
  marker text;
begin
  if to_regclass('public.spec_financials') is null then
    raise exception 'The finance tables do not exist. Nothing to reset.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'assignments' and column_name = 'pay_rate') then
    raise exception 'The legacy rate columns are gone (Phase C has run). The finance tables are the only copy of the rates. Refusing. Nothing was changed.';
  end if;
  marker := nullif(obj_description('public.spec_financials'::regclass, 'pg_class'), '');
  if marker like 'LOCKED%' then
    raise exception using
      message = format('Phase B is live (%s). The finance tables are the source of truth and the legacy columns are blank. Refusing to empty them. Nothing was changed.', marker),
      hint    = 'To go back to the legacy columns follow the Rollback section of docs/finance-visibility-scope.md.';
  end if;
end $$;

delete from public.contractor_pay_rates;
delete from public.assignment_rates;
delete from public.gap_bill_rates;
delete from public.spec_financials;
comment on table public.spec_financials is null;

-- Receipt: every count is 0 and the marker is empty. Now paste
-- migrate-finance-rates.sql.
select 'contractor_pay_rates' as what, count(*) as rows from public.contractor_pay_rates
union all select 'assignment_rates',  count(*) from public.assignment_rates
union all select 'gap_bill_rates',    count(*) from public.gap_bill_rates
union all select 'spec_financials',   count(*) from public.spec_financials
union all select 'marker: ' || coalesce(obj_description('public.spec_financials'::regclass, 'pg_class'), '(empty)'), null;
