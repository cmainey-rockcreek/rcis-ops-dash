// SpecSettingsStore — per-specialty knobs that drive auto-indirect ratios
// and Net Margin burden. Mirrors contractor-overrides-store.js: cold cache,
// realtime, optimistic upsert, hook + sync helpers.
//
// Defaults if no row exists for a spec:
//   indirectRatio       = 0.25
//   burdenPerBillable   = 0   (additive cost beyond pay rate)

window.SpecSettingsStore = (() => {
  const CACHE_KEY = 'rcis.spec_settings.cache.v1';
  const TABLE = 'spec_settings';

  const DEFAULT_INDIRECT_RATIO = 0.25;
  const DEFAULT_BURDEN = 0;

  function fromRow(r) {
    return {
      specCode: r.spec_code,
      indirectRatio: r.indirect_ratio != null ? Number(r.indirect_ratio) : DEFAULT_INDIRECT_RATIO,
      burdenPerBillableHour: r.burden_per_billable_hour != null ? Number(r.burden_per_billable_hour) : DEFAULT_BURDEN,
      defaultPayLow:   r.default_pay_low   != null ? Number(r.default_pay_low)   : null,
      defaultPayHigh:  r.default_pay_high  != null ? Number(r.default_pay_high)  : null,
      defaultBillLow:  r.default_bill_low  != null ? Number(r.default_bill_low)  : null,
      defaultBillHigh: r.default_bill_high != null ? Number(r.default_bill_high) : null,
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    };
  }
  function toRow(o) {
    return {
      spec_code: o.specCode,
      indirect_ratio: o.indirectRatio != null ? o.indirectRatio : DEFAULT_INDIRECT_RATIO,
      burden_per_billable_hour: o.burdenPerBillableHour != null ? o.burdenPerBillableHour : DEFAULT_BURDEN,
      default_pay_low:   o.defaultPayLow,
      default_pay_high:  o.defaultPayHigh,
      default_bill_low:  o.defaultBillLow,
      default_bill_high: o.defaultBillHigh,
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
      const existing = state[specCode] || { specCode };
      const next = { ...existing, ...patch, specCode };
      setState({ ...state, [specCode]: next });
      const row = toRow(next);
      const { error } = await window.sb.from(TABLE)
        .upsert(row, { onConflict: 'spec_code' });
      if (error) console.warn('spec_settings.upsert', error);
    },

    reload: load,

    // Resolves once the initial load (or its safety timeout) has settled.
    // Callers that need the freshest ratio/burden before persisting derived
    // values (e.g. AssignmentsStore.add) should await this.
    ready() { return firstLoadPromise; },

    DEFAULT_INDIRECT_RATIO,
    DEFAULT_BURDEN,
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

window.burdenFor = function burdenFor(specCode) {
  if (!specCode) return window.SpecSettingsStore.DEFAULT_BURDEN;
  const s = window.SpecSettingsStore.get()[specCode];
  if (!s || s.burdenPerBillableHour == null || !Number.isFinite(Number(s.burdenPerBillableHour))) {
    return window.SpecSettingsStore.DEFAULT_BURDEN;
  }
  return Number(s.burdenPerBillableHour);
};
