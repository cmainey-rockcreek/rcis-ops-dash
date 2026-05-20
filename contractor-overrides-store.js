// ContractorOverridesStore — per-contractor edits on top of the mock
// defaults in data-contractors.js. Stores pay rate, bill rate, and the
// weekly schedule (5 days × 4 blocks).
//
// Pattern mirrors RenewalsStore. When no row exists for a contractor, the
// mock values from data-contractors.js win.

window.ContractorOverridesStore = (() => {
  const CACHE_KEY = 'rcis.contractor_overrides.cache.v1';
  const TABLE = 'contractor_overrides';

  function fromRow(r) {
    return {
      contractorId: r.contractor_id,
      name: r.name || null,
      payRate: r.pay_rate != null ? Number(r.pay_rate) : null,
      billRate: r.bill_rate != null ? Number(r.bill_rate) : null,
      schedule: Array.isArray(r.schedule) ? r.schedule : null,
      email: r.email || null,
      phone: r.phone || null,
      city:  r.city  || null,
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    };
  }
  function toRow(o) {
    return {
      contractor_id: o.contractorId,
      name: o.name || null,
      pay_rate: o.payRate != null ? o.payRate : null,
      bill_rate: o.billRate != null ? o.billRate : null,
      schedule: o.schedule || null,
      email: o.email || null,
      phone: o.phone || null,
      city:  o.city  || null,
    };
  }

  let state = {}; // keyed by contractor_id
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
    if (error) { console.warn('overrides load failed', error); return; }
    const next = {};
    (data || []).forEach((r) => { const o = fromRow(r); next[o.contractorId] = o; });
    setState(next);
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-contractor-overrides')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const next = { ...state };
          delete next[payload.old.contractor_id];
          setState(next);
        } else {
          const row = fromRow(payload.new);
          setState({ ...state, [row.contractorId]: row });
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

    forContractor(contractorId) {
      return state[contractorId] || null;
    },

    // Upsert by contractor_id. Patch is partial; existing fields preserved.
    async upsert(contractorId, patch) {
      if (!contractorId) return;
      const existing = state[contractorId] || { contractorId };
      const next = { ...existing, ...patch, contractorId };
      setState({ ...state, [contractorId]: next });
      const row = toRow(next);
      const { error } = await window.sb.from(TABLE)
        .upsert(row, { onConflict: 'contractor_id' });
      if (error) console.warn('overrides.upsert', error);
    },

    reload: load,
  };
})();

window.useContractorOverrides = function useContractorOverrides() {
  const [s, setS] = React.useState(window.ContractorOverridesStore.get());
  React.useEffect(() => window.ContractorOverridesStore.subscribe(setS), []);
  return s;
};

// Convenience: returns the contractor with overrides applied. Falls back to
// mock values when no override exists. Contact fields (email/phone/city)
// also flow through this so the contractor header can edit them inline.
window.useContractorView = function useContractorView(c) {
  const all = window.useContractorOverrides();
  return React.useMemo(() => {
    if (!c) return c;
    const o = all[c.id] || {};
    const rates = {
      ...(c.rates || {}),
      hourly: o.payRate  != null ? o.payRate  : (c.rates && c.rates.hourly),
      bill:   o.billRate != null ? o.billRate : (c.rates && c.rates.bill),
    };
    const schedule = o.schedule || c.schedule;
    return {
      ...c,
      rates,
      schedule,
      name:  o.name  != null ? o.name  : c.name,
      email: o.email != null ? o.email : c.email,
      phone: o.phone != null ? o.phone : c.phone,
      city:  o.city  != null ? o.city  : c.city,
    };
  }, [c, all]);
};

// Bulk view: returns the entire contractor array with overrides applied.
// Used by the contractor list page so renames show up in the table.
window.useContractorsView = function useContractorsView(contractors) {
  const all = window.useContractorOverrides();
  return React.useMemo(() => {
    if (!Array.isArray(contractors)) return contractors;
    return contractors.map((c) => {
      const o = all[c.id];
      if (!o) return c;
      const rates = {
        ...(c.rates || {}),
        hourly: o.payRate  != null ? o.payRate  : (c.rates && c.rates.hourly),
        bill:   o.billRate != null ? o.billRate : (c.rates && c.rates.bill),
      };
      return {
        ...c,
        rates,
        name:  o.name  != null ? o.name  : c.name,
        email: o.email != null ? o.email : c.email,
        phone: o.phone != null ? o.phone : c.phone,
        city:  o.city  != null ? o.city  : c.city,
      };
    });
  }, [contractors, all]);
};
