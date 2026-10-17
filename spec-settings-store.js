// SpecSettingsStore — the per-specialty indirect-hours ratio that drives
// the AssignmentEditor auto-fill. Every active teammate can read it.
//
// Burden $/hr and the default pay/bill bands used to live on this row too;
// since the finance visibility change (Oct 2026) they are admin-only and
// live in spec_financials, served by finance-rates-store.js (which also
// defines window.burdenFor / window.defaultBillFor). An `upsert` here that
// carries any of those keys forwards them there and keeps them off this
// row. Mirrors contractor-overrides-store.js: cold cache, realtime,
// optimistic upsert, hook + sync helper.
//
// Default if no row exists for a spec: indirectRatio = 0.25.

window.SpecSettingsStore = (() => {
  // v2: rows no longer carry the financial columns.
  const CACHE_KEY = 'rcis.spec_settings.cache.v2';
  try { localStorage.removeItem('rcis.spec_settings.cache.v1'); } catch (e) {}
  const TABLE = 'spec_settings';

  const DEFAULT_INDIRECT_RATIO = 0.25;
  const FINANCIAL_KEYS = ['burdenPerBillableHour', 'defaultPayLow', 'defaultPayHigh', 'defaultBillLow', 'defaultBillHigh'];

  function fromRow(r) {
    return {
      specCode: r.spec_code,
      indirectRatio: r.indirect_ratio != null ? Number(r.indirect_ratio) : DEFAULT_INDIRECT_RATIO,
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    };
  }
  function toRow(o) {
    return {
      spec_code: o.specCode,
      indirect_ratio: o.indirectRatio != null ? o.indirectRatio : DEFAULT_INDIRECT_RATIO,
    };
  }

  let state = {}; // keyed by spec_code
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) {}

  const listeners = new Set();
  function emit() { listeners.forEach((fn) => fn(state)); }
  function setState(next) {
    state = next;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch (e) {}
    emit();
  }

  // First-load gate — lets callers (e.g. AssignmentsStore.add) await the
  // initial network load before persisting auto-derived values that depend
  // on per-spec ratios. Resolves on first successful load, on a load error,
  // or after a 2s safety timeout (so we never hang a save).
  let firstLoadResolved = false;
  const firstLoadWaiters = [];
  let firstLoadPromise = new Promise((resolve) => {
    firstLoadWaiters.push(resolve);
    setTimeout(() => { settleFirstLoad(); }, 2000);
  });
  function settleFirstLoad() {
    if (firstLoadResolved) return;
    firstLoadResolved = true;
    firstLoadWaiters.splice(0).forEach((fn) => fn());
  }

  async function load() {
    if (!window.sb) { settleFirstLoad(); return; }
    const { data, error } = await window.sb.from(TABLE).select('*');
    if (error) { console.warn('spec_settings load failed', error); settleFirstLoad(); return; }
    const next = {};
    (data || []).forEach((r) => { const o = fromRow(r); next[o.specCode] = o; });
    setState(next);
    settleFirstLoad();
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-spec-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const next = { ...state };
          delete next[payload.old.spec_code];
          setState(next);
        } else {
          const row = fromRow(payload.new);
          setState({ ...state, [row.specCode]: row });
        }
      })
      .subscribe();
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
        setState({});
      }
    });
  }
  if (window.sb) boot(); else setTimeout(boot, 0);

  return {
    get() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    forSpec(specCode) {
      return state[specCode] || null;
    },

    async upsert(specCode, patch) {
      if (!specCode) return;
      // Financial keys are admin-only and live in spec_financials.
      const fin = {};
      const rest = {};
      Object.keys(patch || {}).forEach((k) => {
        if (FINANCIAL_KEYS.includes(k)) fin[k] = patch[k]; else rest[k] = patch[k];
      });
      if (Object.keys(fin).length && window.FinanceRatesStore) {
        window.FinanceRatesStore.upsertSpecFinancials(specCode, fin);
      }
      if (Object.keys(rest).length === 0) return;
      patch = rest;
      const before = state[specCode]; // may be undefined if no prior row
      const existing = before || { specCode };
      const next = { ...existing, ...patch, specCode };
      FINANCIAL_KEYS.forEach((k) => { delete next[k]; });
      setState({ ...state, [specCode]: next });
      const row = toRow(next);
      const { error } = await window.sb.from(TABLE)
        .upsert(row, { onConflict: 'spec_code' });
      if (error) {
        console.warn('spec_settings.upsert', error);
        // Roll back the optimistic change so the (cached) local state
        // doesn't lie about a value that never made it to the DB.
        const rolled = { ...state };
        if (before) rolled[specCode] = before;
        else delete rolled[specCode];
        setState(rolled);
      }
    },

    reload: load,

    // Resolves once the initial load (or its safety timeout) has settled.
    // Callers that need the freshest ratio/burden before persisting derived
    // values (e.g. AssignmentsStore.add) should await this.
    ready() { return firstLoadPromise; },

    DEFAULT_INDIRECT_RATIO,
  };
})();

window.useSpecSettings = function useSpecSettings() {
  const [s, setS] = React.useState(window.SpecSettingsStore.get());
  React.useEffect(() => window.SpecSettingsStore.subscribe(setS), []);
  return s;
};

// Synchronous helpers — usable from any non-React caller. Pull the latest
// store snapshot, fall back to sensible defaults so financials never NaN
// out before the first load resolves.
window.indirectRatioFor = function indirectRatioFor(specCode) {
  if (!specCode) return window.SpecSettingsStore.DEFAULT_INDIRECT_RATIO;
  const s = window.SpecSettingsStore.get()[specCode];
  if (!s || s.indirectRatio == null || !Number.isFinite(Number(s.indirectRatio))) {
    return window.SpecSettingsStore.DEFAULT_INDIRECT_RATIO;
  }
  return Number(s.indirectRatio);
};

// window.burdenFor and window.defaultBillFor moved to finance-rates-store.js.
