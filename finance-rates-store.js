// FinanceRatesStore — every pay / bill / burden figure the app knows about,
// read from the four admin-only tables created in Phase A of the finance
// visibility change (see docs/finance-visibility-scope.md):
//
//   contractor_pay_rates  → contractorPay[contractorId]  = $/hr
//   assignment_rates      → assignmentPay[assignmentId]  = $/hr override
//   gap_bill_rates        → gapBill[gapId]               = $/hr override
//   spec_financials       → spec[specCode] = { burdenPerBillableHour,
//                           defaultPayLow/High, defaultBillLow/High }
//
// RLS lets only admins read or write these tables. A non-admin's load
// returns zero rows (no error), so every lookup here answers null / 0 and
// the UI gate (window.useFinanceAccess) hides the widgets that would show
// them. The shared tables (assignments, coverage_gaps, contractors,
// contractor_overrides, spec_settings) no longer carry money; their stores
// forward any pay / bill patch here.
//
// A missing row means "no rate set". The rate columns are NOT NULL, so a
// cleared or 0 rate deletes the row rather than writing null.
//
// Same cold-cache + realtime + optimistic shape as todos-store.js.

window.FinanceRatesStore = (() => {
  const CACHE_KEY = 'rcis.finance_rates.cache.v1';

  const EMPTY = () => ({ contractorPay: {}, assignmentPay: {}, gapBill: {}, spec: {} });

  const DEFAULT_BURDEN = 0;

  function specFromRow(r) {
    return {
      specCode: r.spec_code,
      burdenPerBillableHour: r.burden_per_billable_hour != null ? Number(r.burden_per_billable_hour) : DEFAULT_BURDEN,
      defaultPayLow:   r.default_pay_low   != null ? Number(r.default_pay_low)   : null,
      defaultPayHigh:  r.default_pay_high  != null ? Number(r.default_pay_high)  : null,
      defaultBillLow:  r.default_bill_low  != null ? Number(r.default_bill_low)  : null,
      defaultBillHigh: r.default_bill_high != null ? Number(r.default_bill_high) : null,
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    };
  }
  function specToRow(o) {
    return {
      spec_code: o.specCode,
      burden_per_billable_hour: o.burdenPerBillableHour != null ? o.burdenPerBillableHour : DEFAULT_BURDEN,
      default_pay_low:   o.defaultPayLow,
      default_pay_high:  o.defaultPayHigh,
      default_bill_low:  o.defaultBillLow,
      default_bill_high: o.defaultBillHigh,
    };
  }

  let state = EMPTY();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) state = { ...EMPTY(), ...JSON.parse(raw) };
  } catch (e) {}

  const listeners = new Set();
  function emit() {
    // Hand subscribers a fresh snapshot object so memos recompute even when
    // only access (not data) changed.
    state = { ...state };
    listeners.forEach((fn) => fn(state));
  }
  function setState(next) {
    state = next;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch (e) {}
    emit();
  }

  // Whether the signed-in user may see money. Mirrors the RLS rule
  // (is_admin) as a UX hint; the database enforces it. False until the
  // team store has loaded the profile, so nothing financial flashes on a
  // cold start.
  function canView() {
    const p = window.TeamStore && window.TeamStore.currentProfile
      ? window.TeamStore.currentProfile() : null;
    return !!(p && p.ready && p.isAdmin);
  }

  // Three small rate maps share one loader so the four queries run in
  // parallel and the UI sees one update.
  const RATE_TABLES = [
    { table: 'contractor_pay_rates', key: 'contractorPay', idCol: 'contractor_id', rateCol: 'pay_rate' },
    { table: 'assignment_rates',     key: 'assignmentPay', idCol: 'assignment_id', rateCol: 'pay_rate' },
    { table: 'gap_bill_rates',       key: 'gapBill',       idCol: 'gap_id',        rateCol: 'bill_rate' },
  ];

  async function load() {
    if (!window.sb) return;
    const results = await Promise.all([
      ...RATE_TABLES.map((t) => window.sb.from(t.table).select('*')),
      window.sb.from('spec_financials').select('*'),
    ]);
    const next = EMPTY();
    let failed = false;
    RATE_TABLES.forEach((t, i) => {
      const { data, error } = results[i];
      if (error) { console.warn(`${t.table} load failed`, error); failed = true; return; }
      (data || []).forEach((r) => {
        if (r[t.rateCol] != null) next[t.key][r[t.idCol]] = Number(r[t.rateCol]);
      });
    });
    const specRes = results[RATE_TABLES.length];
    if (specRes.error) { console.warn('spec_financials load failed', specRes.error); failed = true; }
    else (specRes.data || []).forEach((r) => { const o = specFromRow(r); next.spec[o.specCode] = o; });
    if (failed) return;
    setState(next);
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    let ch = window.sb.channel('rcis-finance-rates');
    RATE_TABLES.forEach((t) => {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t.table }, (payload) => {
        const map = { ...state[t.key] };
        if (payload.eventType === 'DELETE') {
          delete map[payload.old[t.idCol]];
        } else if (payload.new && payload.new[t.rateCol] != null) {
          map[payload.new[t.idCol]] = Number(payload.new[t.rateCol]);
        }
        setState({ ...state, [t.key]: map });
      });
    });
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'spec_financials' }, (payload) => {
      const spec = { ...state.spec };
      if (payload.eventType === 'DELETE') delete spec[payload.old.spec_code];
      else { const o = specFromRow(payload.new); spec[o.specCode] = o; }
      setState({ ...state, spec });
    });
    channel = ch.subscribe();
  }

  // Access can flip after the data has loaded (the team profile resolves
  // last on a cold start, or an admin flag changes). Consumers memoise on
  // this store's state, so emit a fresh state object whenever canView
  // changes. useFinanceAccess() re-renders the subscribing component; this
  // keeps the memoised views in step with it.
  let lastCanView = null;
  function watchAccess() {
    const now = canView();
    if (now !== lastCanView) {
      lastCanView = now;
      emit();
    }
  }
  if (window.TeamStore && typeof window.TeamStore.subscribe === 'function') {
    window.TeamStore.subscribe(watchAccess);
  }

  function boot() {
    if (!window.sb) return;
    window.sb.auth.getSession().then(({ data }) => {
      if (data.session) { load(); subscribeRealtime(); }
    });
    window.sb.auth.onAuthStateChange((event, session) => {
      if (session) { load(); subscribeRealtime(); }
      else {
        if (channel) { window.sb.removeChannel(channel); channel = null; }
        setState(EMPTY());
      }
    });
  }
  if (window.sb) boot(); else setTimeout(boot, 0);

  // Normalise an editor value: '', null, NaN, 0 and negatives all mean
  // "no rate" and delete the row.
  function normRate(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  async function setRate(t, id, value) {
    if (!id || !window.sb) return;
    const rate = normRate(value);
    const before = state[t.key][id];
    const map = { ...state[t.key] };
    if (rate == null) delete map[id]; else map[id] = rate;
    setState({ ...state, [t.key]: map });
    let error;
    if (rate == null) {
      ({ error } = await window.sb.from(t.table).delete().eq(t.idCol, id));
    } else {
      const row = { [t.idCol]: id, [t.rateCol]: rate };
      ({ error } = await window.sb.from(t.table).upsert(row, { onConflict: t.idCol }));
    }
    if (error) {
      console.warn(`${t.table}.set`, error);
      const rolled = { ...state[t.key] };
      if (before != null) rolled[id] = before; else delete rolled[id];
      setState({ ...state, [t.key]: rolled });
    }
  }

  // Resolve a contractor's pay. Supabase-created contractors have no pay
  // outside this store; mock contractors fall back to the prototype rate
  // baked into data-contractors.js. Null for anyone who may not see money,
  // so no widget can show a mock rate to a non-admin either.
  function contractorPayFor(cOrId) {
    if (!canView()) return null;
    const c = typeof cOrId === 'string'
      ? (window.getContractor ? window.getContractor(cOrId) : null)
      : cOrId;
    const id = c ? c.id : cOrId;
    const stored = state.contractorPay[id];
    if (stored != null) return stored;
    if (c && c.source !== 'supabase' && c.rates && Number.isFinite(Number(c.rates.hourly)) && Number(c.rates.hourly) > 0) {
      return Number(c.rates.hourly);
    }
    return null;
  }

  return {
    // A new object per access flip so React memos keyed on the snapshot
    // recompute; same contents otherwise.
    get() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    canView,

    contractorPayFor,
    assignmentPayFor(id) { const v = state.assignmentPay[id]; return v != null ? v : null; },
    gapBillFor(id)       { const v = state.gapBill[id];       return v != null ? v : null; },
    specFinancialsFor(code) { return state.spec[code] || null; },

    setContractorPay(id, v) { return setRate(RATE_TABLES[0], id, v); },
    setAssignmentPay(id, v) { return setRate(RATE_TABLES[1], id, v); },
    setGapBill(id, v)       { return setRate(RATE_TABLES[2], id, v); },

    async upsertSpecFinancials(specCode, patch) {
      if (!specCode || !window.sb) return;
      const before = state.spec[specCode];
      const next = { ...(before || { specCode }), ...patch, specCode };
      setState({ ...state, spec: { ...state.spec, [specCode]: next } });
      const { error } = await window.sb.from('spec_financials')
        .upsert(specToRow(next), { onConflict: 'spec_code' });
      if (error) {
        console.warn('spec_financials.upsert', error);
        const spec = { ...state.spec };
        if (before) spec[specCode] = before; else delete spec[specCode];
        setState({ ...state, spec });
      }
    },

    reload: load,
    DEFAULT_BURDEN,
  };
})();

window.useFinanceRates = function useFinanceRates() {
  const [s, setS] = React.useState(window.FinanceRatesStore.get());
  React.useEffect(() => window.FinanceRatesStore.subscribe(setS), []);
  return s;
};

// Synchronous helpers for non-React callers (financials.js, rollups).
window.contractorPayFor = (c) => window.FinanceRatesStore.contractorPayFor(c);
window.assignmentPayFor = (id) => window.FinanceRatesStore.assignmentPayFor(id);
window.gapBillFor = (id) => window.FinanceRatesStore.gapBillFor(id);

window.burdenFor = function burdenFor(specCode) {
  if (!specCode) return window.FinanceRatesStore.DEFAULT_BURDEN;
  const s = window.FinanceRatesStore.specFinancialsFor(specCode);
  if (!s || s.burdenPerBillableHour == null || !Number.isFinite(Number(s.burdenPerBillableHour))) {
    return window.FinanceRatesStore.DEFAULT_BURDEN;
  }
  return Number(s.burdenPerBillableHour);
};

// Per-spec default bill rate — the financials.effectiveBill fallback when
// no district_rate_cards row exists for a (district, spec). Uses the spec's
// `default_bill_low` so prototype numbers don't collapse to $0 before each
// district is filled in. 0 when neither spec nor default exists (and for
// anyone who may not see money, since their spec map is empty).
window.defaultBillFor = function defaultBillFor(specCode) {
  if (!specCode) return 0;
  const s = window.FinanceRatesStore.specFinancialsFor(specCode);
  if (!s || s.defaultBillLow == null || !Number.isFinite(Number(s.defaultBillLow))) return 0;
  return Number(s.defaultBillLow);
};
