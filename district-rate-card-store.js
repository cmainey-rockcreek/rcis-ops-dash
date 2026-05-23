// DistrictRateCardStore — bill rate per (district × specialty). Replaces
// the contractor-level bill rate: every assignment's bill rate is derived
// from this card via its district + the contractor's specialty.
//
// Same shape as spec-settings-store.js: cold cache, realtime, optimistic
// upsert, hook + sync helper. When a (district, spec) pair has no row,
// financials.js falls back to spec_settings.default_bill_low so prototype
// numbers don't collapse to $0 before each district is filled in.

window.DistrictRateCardStore = (() => {
  const CACHE_KEY = 'rcis.district_rate_cards.cache.v1';
  const TABLE = 'district_rate_cards';

  function keyOf(districtId, specCode) { return `${districtId}::${specCode}`; }

  function fromRow(r) {
    return {
      districtId: r.district_id,
      specCode: r.spec_code,
      billRate: r.bill_rate != null ? Number(r.bill_rate) : null,
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    };
  }
  function toRow(o) {
    return {
      district_id: o.districtId,
      spec_code: o.specCode,
      bill_rate: o.billRate,
    };
  }

  let state = {}; // keyed by `${districtId}::${specCode}`
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

  async function load() {
    if (!window.sb) return;
    const { data, error } = await window.sb.from(TABLE).select('*');
    if (error) { console.warn('district_rate_cards load failed', error); return; }
    const next = {};
    (data || []).forEach((r) => {
      const o = fromRow(r);
      next[keyOf(o.districtId, o.specCode)] = o;
    });
    setState(next);
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-district-rate-cards')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const next = { ...state };
          delete next[keyOf(payload.old.district_id, payload.old.spec_code)];
          setState(next);
        } else {
          const row = fromRow(payload.new);
          setState({ ...state, [keyOf(row.districtId, row.specCode)]: row });
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

    rateFor(districtId, specCode) {
      if (!districtId || !specCode) return null;
      const r = state[keyOf(districtId, specCode)];
      if (!r || r.billRate == null || !Number.isFinite(Number(r.billRate))) return null;
      return Number(r.billRate);
    },

    async upsert(districtId, specCode, billRate) {
      if (!districtId || !specCode) return;
      const rate = Number(billRate);
      if (!Number.isFinite(rate) || rate < 0) return;
      const k = keyOf(districtId, specCode);
      const before = state[k];
      const next = { districtId, specCode, billRate: rate, updatedAt: Date.now() };
      setState({ ...state, [k]: next });
      const { error } = await window.sb.from(TABLE)
        .upsert(toRow(next), { onConflict: 'district_id,spec_code' });
      if (error) {
        console.warn('district_rate_cards.upsert', error);
        const rolled = { ...state };
        if (before) rolled[k] = before; else delete rolled[k];
        setState(rolled);
      }
    },

    async remove(districtId, specCode) {
      if (!districtId || !specCode) return;
      const k = keyOf(districtId, specCode);
      const before = state[k];
      const next = { ...state };
      delete next[k];
      setState(next);
      const { error } = await window.sb.from(TABLE).delete()
        .eq('district_id', districtId).eq('spec_code', specCode);
      if (error) {
        console.warn('district_rate_cards.remove', error);
        if (before) setState({ ...state, [k]: before });
      }
    },

    reload: load,
  };
})();

window.useDistrictRateCards = function useDistrictRateCards() {
  const [s, setS] = React.useState(window.DistrictRateCardStore.get());
  React.useEffect(() => window.DistrictRateCardStore.subscribe(setS), []);
  return s;
};

// Sync helper for non-React callers (financials.js, district rollups).
// Returns the bill rate for a (district, spec) pair, or null if no row.
window.rateCardFor = function rateCardFor(districtId, specCode) {
  if (!window.DistrictRateCardStore) return null;
  return window.DistrictRateCardStore.rateFor(districtId, specCode);
};
