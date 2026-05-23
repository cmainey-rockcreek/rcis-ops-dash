// ContractorsStore — user-created contractors that live alongside the
// in-file mock catalog (data-contractors.js).
//
// On every change, the store reassigns window.RCIS_DATA.CONTRACTORS to a
// merged list (user-created first, then originals) so existing UI that
// reads window.RCIS_DATA.CONTRACTORS picks up new rows without rewrites.
// Components that need live re-render on creation/edit should subscribe
// via useContractors().

window.ContractorsStore = (() => {
  const CACHE_KEY = 'rcis.contractors.cache.v1';
  const TABLE = 'contractors';

  // Snapshot the mock catalog at first load — we never mutate this; the
  // merged window.RCIS_DATA.CONTRACTORS is rebuilt from these + user rows.
  const ORIGINAL_MOCKS = (window.RCIS_DATA && Array.isArray(window.RCIS_DATA.CONTRACTORS))
    ? window.RCIS_DATA.CONTRACTORS.slice()
    : [];

  function uid() {
    return 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function fromRow(r) {
    return {
      id: r.id,
      name: r.name,
      spec: r.spec,
      cap: Number(r.cap) || 30,
      assigned: 0,
      status: r.status || 'avail',
      states: Array.isArray(r.states) ? r.states : [],
      modalities: Array.isArray(r.modalities) ? r.modalities : ['tele', 'onsite'],
      schools: 0,
      email: r.email || '',
      phone: r.phone || '',
      city: r.city || '',
      npi: r.npi || '',
      hireDate: r.hire_date || null,
      rates: {
        hourly: r.pay_rate != null ? Number(r.pay_rate) : 0,
      },
      licenses: [],
      schedule: [],
      assignments: [],
      documents: [],
      // Free-text notes flow through entity_notes (NotesStore), not this row.
      notes: '',
      createdBy: r.created_by || null,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
      source: 'supabase',
      __enriched: true,
    };
  }
  function toRow(c) {
    return {
      id: c.id,
      name: c.name,
      spec: c.spec,
      cap: c.cap != null ? c.cap : 30,
      status: c.status || 'avail',
      states: Array.isArray(c.states) ? c.states : [],
      modalities: Array.isArray(c.modalities) ? c.modalities : ['tele', 'onsite'],
      email: c.email || null,
      phone: c.phone || null,
      city: c.city || null,
      npi: c.npi || null,
      hire_date: c.hireDate || null,
      pay_rate: c.rates && c.rates.hourly != null ? c.rates.hourly : null,
      created_by: c.createdBy || null,
    };
  }

  let state = []; // array of user-created contractors
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) {}

  const listeners = new Set();
  function emit() { listeners.forEach((fn) => fn(state)); }
  function publishMerged() {
    if (!window.RCIS_DATA) return;
    // User-created first so they appear at the top of the list.
    window.RCIS_DATA.CONTRACTORS = [...state, ...ORIGINAL_MOCKS];
  }
  function setState(next) {
    state = next;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch (e) {}
    publishMerged();
    emit();
  }
  // Seed the merged list immediately on script load so first paint sees
  // any cold-cache user contractors.
  publishMerged();

  // window.getContractor was set by data-contractors.js to lookup in the
  // mock catalog only (it closed over a local array reference, so it can't
  // see our merged window.RCIS_DATA.CONTRACTORS updates). Wrap it: try the
  // user-created store first, fall through to the mock lookup.
  const _getContractorMock = window.getContractor;
  window.getContractor = (id) => {
    const userMade = state.find((c) => c.id === id);
    if (userMade) return userMade;
    return _getContractorMock ? _getContractorMock(id) : null;
  };

  async function load() {
    if (!window.sb) return;
    const { data, error } = await window.sb.from(TABLE)
      .select('*').order('created_at', { ascending: false });
    if (error) { console.warn('contractors load failed', error); return; }
    setState((data || []).map(fromRow));
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-contractors')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setState(state.filter((c) => c.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          const row = fromRow(payload.new);
          if (!state.find((c) => c.id === row.id)) setState([row, ...state]);
        } else if (payload.eventType === 'UPDATE') {
          const row = fromRow(payload.new);
          setState(state.map((c) => c.id === row.id ? row : c));
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
        setState([]);
      }
    });
  }
  if (window.sb) boot(); else setTimeout(boot, 0);

  return {
    get() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    async add(partial) {
      const now = Date.now();
      const current = window.TeamStore && window.TeamStore.current && window.TeamStore.current();
      const c = {
        id: uid(),
        name: '',
        spec: '',
        cap: 30,
        assigned: 0,
        status: 'avail',
        states: [],
        modalities: ['tele', 'onsite'],
        schools: 0,
        email: '',
        phone: '',
        city: '',
        npi: '',
        hireDate: null,
        rates: { hourly: 0 },
        licenses: [], schedule: [], assignments: [], documents: [],
        notes: '',
        createdBy: current ? current.id : null,
        createdAt: now, updatedAt: now,
        source: 'supabase',
        __enriched: true,
        ...partial,
      };
      setState([c, ...state]);
      const row = toRow(c);
      const { error } = await window.sb.from(TABLE).insert(row);
      if (error) {
        console.warn('contractors.add', error);
        setState(state.filter((x) => x.id !== c.id));
        return null;
      }
      return c;
    },

    async update(id, patch) {
      const existing = state.find((c) => c.id === id);
      if (!existing) return;
      const next = { ...existing, ...patch, updatedAt: Date.now() };
      // Patch may carry a top-level pay rate; normalize into rates.{}.
      if (patch.payRate != null)  next.rates = { ...(next.rates || {}), hourly: patch.payRate };
      setState(state.map((c) => c.id === id ? next : c));
      const row = toRow(next);
      delete row.id;
      const { error } = await window.sb.from(TABLE).update(row).eq('id', id);
      if (error) console.warn('contractors.update', error);
    },

    async remove(id) {
      setState(state.filter((c) => c.id !== id));
      const { error } = await window.sb.from(TABLE).delete().eq('id', id);
      if (error) console.warn('contractors.remove', error);
    },

    reload: load,

    // Whether an id refers to a user-created row (vs a mock).
    isUserCreated(id) {
      return state.some((c) => c.id === id);
    },
  };
})();

window.useContractors = function useContractors() {
  // Subscribe so consumers re-render when a new row is added/edited/removed.
  const [s, setS] = React.useState(window.ContractorsStore.get());
  React.useEffect(() => window.ContractorsStore.subscribe(setS), []);
  // Always return the live merged catalog so callers can keep using the
  // same `RCIS_DATA.CONTRACTORS`-shaped array.
  return (window.RCIS_DATA && window.RCIS_DATA.CONTRACTORS) || [];
};
