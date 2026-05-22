// ContractorFinancials — centralized money math for contractor profiles,
// district rollups, and the matchmaker page.
//
// Single source of truth so we can later layer in payroll burden,
// utilization targets, true-profit calcs, district profitability, etc.
//
// Input shapes the helpers accept:
//   row = { direct, indirect, status, billRate?, payRate? }  (merged shape
//   from useContractorAssignments — works for both mock and Supabase rows)
//   defaults = { bill, pay } — contractor-level fallback when an
//   assignment doesn't carry its own rate (e.g. mock seeds).

window.ContractorFinancials = (() => {
  const WEEKS_PER_MONTH = 4;
  const WEEKS_PER_SCHOOL_YEAR = 36;

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  function effectiveBill(a, defBill) {
    return a && a.billRate != null && Number.isFinite(Number(a.billRate))
      ? Number(a.billRate) : num(defBill);
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
    return activeRows(rows).reduce((sum, a) =>
      sum + weeklyHours(a) * effectiveBill(a, dB), 0);
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
      return num(defaults && defaults.bill) - num(defaults && defaults.pay);
    }
    const totalBill = active.reduce((s, a) => s + weeklyHours(a) * effectiveBill(a, defaults && defaults.bill), 0);
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
  // Burden is a per-billable-hour add-on cost beyond pay rate (taxes,
  // insurance, admin overhead). Looked up per-row by spec via the
  // optional `burdenLookup(specCode)`; defaults to window.burdenFor when
  // present, otherwise 0. Rows without a spec contribute zero burden so
  // legacy data shows Net = Gross.
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
      // No active rows → fall back to default bill − default pay − 0 burden.
      return num(defaults && defaults.bill) - num(defaults && defaults.pay);
    }
    const totalBill   = active.reduce((s, a) => s + weeklyHours(a) * effectiveBill(a, defaults && defaults.bill), 0);
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
