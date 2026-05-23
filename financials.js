// ContractorFinancials — centralized money math for contractor profiles,
// district rollups, and the matchmaker page.
//
// Single source of truth so we can later layer in payroll burden,
// utilization targets, true-profit calcs, district profitability, etc.
//
// Input shapes the helpers accept:
//   row = { direct, indirect, status, payRate?, spec?, districtId?, schoolId? }
//     (merged shape from useContractorAssignments — works for both mock
//     and Supabase rows). Bill rate is derived per-row via the district
//     rate card; see effectiveBill below.
//   defaults = { pay, spec } — used when an assignment doesn't carry its
//     own pay rate (e.g. mock seeds). `spec` lets the no-active-rows
//     fallback look up the per-spec default bill rate.

// Resolve the district id that owns a given assignment row, regardless of
// whether the row carries `districtId` directly (persisted assignments,
// district-wide rows) or only `schoolId` (mock seeds — district is
// derived from SCHOOLS[schoolId].district). Returns null if neither
// resolves. Lives here because it's the key used to look up bill rates
// from district_rate_cards via effectiveBill.
window.assignmentDistrictId = function assignmentDistrictId(a) {
  if (!a) return null;
  if (a.districtId) return a.districtId;
  if (a.schoolId) {
    const schools = (window.RCIS_DATA && window.RCIS_DATA.SCHOOLS) || [];
    const sch = schools.find((s) => s.id === a.schoolId);
    if (sch && sch.district) return sch.district;
  }
  return null;
};

window.ContractorFinancials = (() => {
  const WEEKS_PER_MONTH = 4;
  const WEEKS_PER_SCHOOL_YEAR = 36;

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  // Resolve a row's bill rate from the district rate card, in order:
  //   1. a.billRate              (legacy per-row override, going away)
  //   2. rateCardFor(districtId, spec)
  //   3. defaultBillFor(spec)    (spec_settings.default_bill_low — keeps
  //                               prototype numbers from collapsing to $0)
  //   4. defaults.bill           (transitional — most callers will drop this)
  function effectiveBill(a, defBill, defSpec) {
    if (a && a.billRate != null && Number.isFinite(Number(a.billRate))) {
      return Number(a.billRate);
    }
    const spec = (a && a.spec) || defSpec || null;
    const districtId = window.assignmentDistrictId
      ? window.assignmentDistrictId(a) : (a && a.districtId) || null;
    if (districtId && spec && window.rateCardFor) {
      const r = window.rateCardFor(districtId, spec);
      if (Number.isFinite(r) && r > 0) return r;
    }
    if (spec && window.defaultBillFor) {
      const dflt = window.defaultBillFor(spec);
      if (Number.isFinite(dflt) && dflt > 0) return dflt;
    }
    return num(defBill);
  }
  function effectivePay(a, defPay) {
    return a && a.payRate != null && Number.isFinite(Number(a.payRate))
      ? Number(a.payRate) : num(defPay);
  }
  function weeklyHours(a) {
    return num(a && a.direct) + num(a && a.indirect);
  }
  function activeRows(rows) {
    return (rows || []).filter((a) => (a && a.status) === 'active');
  }

  // ─── Revenue ──────────────────────────────────────────────────────────────
  function weeklyRevenue(rows, defaults) {
    const dB = defaults && defaults.bill;
    const dS = defaults && defaults.spec;
    return activeRows(rows).reduce((sum, a) =>
      sum + weeklyHours(a) * effectiveBill(a, dB, dS), 0);
  }
  function monthlyRevenue(rows, defaults) {
    return weeklyRevenue(rows, defaults) * WEEKS_PER_MONTH;
  }
  function annualRevenue(rows, defaults, weeksPerYear) {
    return weeklyRevenue(rows, defaults) * (weeksPerYear || WEEKS_PER_SCHOOL_YEAR);
  }

  // ─── Pay (contractor compensation) ───────────────────────────────────────
  function weeklyPay(rows, defaults) {
    const dP = defaults && defaults.pay;
    return activeRows(rows).reduce((sum, a) =>
      sum + weeklyHours(a) * effectivePay(a, dP), 0);
  }
  function monthlyPay(rows, defaults) {
    return weeklyPay(rows, defaults) * WEEKS_PER_MONTH;
  }

  // ─── Gross Margin (bill − pay) ───────────────────────────────────────────
  // Per-hour gross margin, hours-weighted across active assignments. If a
  // contractor has no active assignments, falls back to bare default bill -
  // default pay. (Same math as before — "Gross" naming is new.)
  function marginPerHour(rows, defaults) {
    const active = activeRows(rows);
    const totalHours = active.reduce((s, a) => s + weeklyHours(a), 0);
    if (totalHours <= 0) {
      // No active rows → fall back to the resolved bill (spec default) − pay.
      const fallbackBill = effectiveBill(null, defaults && defaults.bill, defaults && defaults.spec);
      return fallbackBill - num(defaults && defaults.pay);
    }
    const totalBill = active.reduce((s, a) => s + weeklyHours(a) * effectiveBill(a, defaults && defaults.bill, defaults && defaults.spec), 0);
    const totalPay  = active.reduce((s, a) => s + weeklyHours(a) * effectivePay(a,  defaults && defaults.pay),  0);
    return (totalBill - totalPay) / totalHours;
  }
  function weeklyMargin(rows, defaults) {
    return weeklyRevenue(rows, defaults) - weeklyPay(rows, defaults);
  }
  function monthlyMargin(rows, defaults) {
    return weeklyMargin(rows, defaults) * WEEKS_PER_MONTH;
  }
  function annualMargin(rows, defaults, weeksPerYear) {
    return weeklyMargin(rows, defaults) * (weeksPerYear || WEEKS_PER_SCHOOL_YEAR);
  }

  // ─── Net Margin (bill − pay − burden) ────────────────────────────────────
  // Burden is a per-BILLABLE-hour add-on cost beyond pay rate (taxes,
  // insurance, admin overhead). Direct AND indirect hours are both billed
  // at the same rate, so burden scales by total weekly hours — matching
  // how revenue and pay scale. Looked up per-row by spec via the optional
  // `burdenLookup(specCode)`; defaults to window.burdenFor when present,
  // otherwise 0. Rows without a spec contribute zero burden so legacy
  // data shows Net = Gross.
  function defaultBurden(specCode) {
    if (window.burdenFor) return num(window.burdenFor(specCode));
    return 0;
  }
  function totalBurden(rows, burdenLookup) {
    const lookup = burdenLookup || defaultBurden;
    return activeRows(rows).reduce((sum, a) =>
      sum + weeklyHours(a) * num(lookup(a && a.spec)), 0);
  }
  function netMarginPerHour(rows, defaults, burdenLookup) {
    const lookup = burdenLookup || defaultBurden;
    const active = activeRows(rows);
    const totalHours = active.reduce((s, a) => s + weeklyHours(a), 0);
    if (totalHours <= 0) {
      // No active rows → fall back to resolved bill (spec default) − pay
      // − burden looked up against the contractor-level spec on `defaults`.
      // Callers that don't carry a spec (older mock paths) get 0 burden,
      // which keeps the legacy "no spec = no burden" behavior intact.
      const fallbackBill = effectiveBill(null, defaults && defaults.bill, defaults && defaults.spec);
      const fallbackBurden = defaults && defaults.spec ? num(lookup(defaults.spec)) : 0;
      return fallbackBill - num(defaults && defaults.pay) - fallbackBurden;
    }
    const totalBill   = active.reduce((s, a) => s + weeklyHours(a) * effectiveBill(a, defaults && defaults.bill, defaults && defaults.spec), 0);
    const totalPay    = active.reduce((s, a) => s + weeklyHours(a) * effectivePay(a,  defaults && defaults.pay),  0);
    const totalBurden_ = active.reduce((s, a) => s + weeklyHours(a) * num(lookup(a && a.spec)), 0);
    return (totalBill - totalPay - totalBurden_) / totalHours;
  }
  function weeklyNetMargin(rows, defaults, burdenLookup) {
    return weeklyMargin(rows, defaults) - totalBurden(rows, burdenLookup);
  }
  function monthlyNetMargin(rows, defaults, burdenLookup) {
    return weeklyNetMargin(rows, defaults, burdenLookup) * WEEKS_PER_MONTH;
  }
  function annualNetMargin(rows, defaults, burdenLookup, weeksPerYear) {
    return weeklyNetMargin(rows, defaults, burdenLookup) * (weeksPerYear || WEEKS_PER_SCHOOL_YEAR);
  }

  // ─── Utilization ─────────────────────────────────────────────────────────
  function utilization(rows, capHours) {
    const cap = num(capHours);
    if (cap <= 0) return 0;
    const booked = activeRows(rows).reduce((s, a) => s + weeklyHours(a), 0);
    return booked / cap;
  }

  // ─── Formatting ──────────────────────────────────────────────────────────
  function formatUSD(amount, opts) {
    const cents = opts && opts.cents;
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      maximumFractionDigits: cents ? 2 : 0,
      minimumFractionDigits: cents ? 2 : 0,
    }).format(num(amount));
  }

  return {
    WEEKS_PER_MONTH, WEEKS_PER_SCHOOL_YEAR,
    effectiveBill, effectivePay, weeklyHours, activeRows,
    weeklyRevenue, monthlyRevenue, annualRevenue,
    weeklyPay, monthlyPay,
    // Gross
    marginPerHour, weeklyMargin, monthlyMargin, annualMargin,
    // Net (subtracts burden per row via spec)
    netMarginPerHour, weeklyNetMargin, monthlyNetMargin, annualNetMargin,
    totalBurden,
    utilization,
    formatUSD,
  };
})();
