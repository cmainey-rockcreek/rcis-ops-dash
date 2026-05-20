// AssignmentsStore — Supabase-backed contractor → school/district placements.
// Mock seed assignments live in data-contractors.js and are merged on read.
// Same realtime + cold-cache pattern as RenewalsStore.

window.AssignmentsStore = (() => {
  const CACHE_KEY = 'rcis.assignments.cache.v1';
  const TABLE = 'assignments';

  function uid() {
    return 'as' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function fromRow(r) {
    return {
      id: r.id,
      contractorId: r.contractor_id,
      contractorName: r.contractor_name || '',
      schoolId: r.school_id || null,
      schoolName: r.school_name || '',
      districtId: r.district_id || null,
      districtName: r.district_name || '',
      spec: r.spec || '',
      directHours: Number(r.direct_hours) || 0,
      indirectHours: Number(r.indirect_hours) || 0,
      payRate: r.pay_rate != null ? Number(r.pay_rate) : null,
      billRate: r.bill_rate != null ? Number(r.bill_rate) : null,
      startDate: r.start_date || null,
      endDate: r.end_date || null,
      status: r.status || 'active',
      note: r.note || '',
      createdBy: r.created_by || null,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
      source: 'supabase',
    };
  }
  function toRow(a) {
    return {
      id: a.id,
      contractor_id: a.contractorId,
      contractor_name: a.contractorName || null,
      school_id: a.schoolId || null,
      school_name: a.schoolName || null,
      district_id: a.districtId || null,
      district_name: a.districtName || null,
      spec: a.spec || null,
      direct_hours: a.directHours || 0,
      indirect_hours: a.indirectHours || 0,
      pay_rate: a.payRate != null ? a.payRate : null,
      bill_rate: a.billRate != null ? a.billRate : null,
      start_date: a.startDate || null,
      end_date: a.endDate || null,
      status: a.status || 'active',
      note: a.note || '',
      created_by: a.createdBy || null,
    };
  }

  let state = [];
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
    const { data, error } = await window.sb.from(TABLE)
      .select('*').order('start_date', { ascending: false });
    if (error) { console.warn('assignments load failed', error); return; }
    setState((data || []).map(fromRow));
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-assignments')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setState(state.filter((a) => a.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          const row = fromRow(payload.new);
          if (!state.find((a) => a.id === row.id)) setState([row, ...state]);
        } else if (payload.eventType === 'UPDATE') {
          const row = fromRow(payload.new);
          setState(state.map((a) => a.id === row.id ? row : a));
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

    forContractor(contractorId) {
      return state.filter((a) => a.contractorId === contractorId);
    },

    async add(partial) {
      const now = Date.now();
      const current = window.TeamStore && window.TeamStore.current && window.TeamStore.current();
      const a = {
        id: uid(),
        contractorId: null, contractorName: '',
        schoolId: null, schoolName: '',
        districtId: null, districtName: '',
        spec: '',
        directHours: 0, indirectHours: 0,
        payRate: null, billRate: null,
        startDate: null, endDate: null,
        status: 'active', note: '',
        createdBy: current ? current.id : null,
        createdAt: now, updatedAt: now,
        source: 'supabase',
        ...partial,
      };
      // If user picks an end date in the past, mark completed on save.
      if (a.endDate) {
        const today = new Date().toISOString().slice(0, 10);
        if (a.endDate < today && a.status === 'active') a.status = 'completed';
      }
      setState([a, ...state]);
      const row = toRow(a);
      const { error } = await window.sb.from(TABLE).insert(row);
      if (error) {
        console.warn('assignments.add', error);
        setState(state.filter((x) => x.id !== a.id));
        return null;
      }
      return a;
    },

    async update(id, patch) {
      const existing = state.find((a) => a.id === id);
      if (!existing) return;
      const next = { ...existing, ...patch, updatedAt: Date.now() };
      if (next.endDate) {
        const today = new Date().toISOString().slice(0, 10);
        if (next.endDate < today && next.status === 'active') next.status = 'completed';
      }
      setState(state.map((a) => a.id === id ? next : a));
      const row = toRow(next);
      delete row.id;
      const { error } = await window.sb.from(TABLE).update(row).eq('id', id);
      if (error) console.warn('assignments.update', error);
    },

    async remove(id) {
      setState(state.filter((a) => a.id !== id));
      const { error } = await window.sb.from(TABLE).delete().eq('id', id);
      if (error) console.warn('assignments.remove', error);
    },

    reload: load,
  };
})();

window.useAssignments = function useAssignments() {
  const [s, setS] = React.useState(window.AssignmentsStore.get());
  React.useEffect(() => window.AssignmentsStore.subscribe(setS), []);
  return s;
};

// Combined view: mock assignments from a contractor record + persisted ones.
// Persisted always wins on id collision (which shouldn't happen — mock has
// no id). Returns objects shaped like the mock format so existing UI keeps
// working: { schoolId, school, district, state, startDate, endDate,
// hoursPerWeek, direct, indirect, status, payRate?, billRate?, _id?, source }.
window.useContractorAssignments = function useContractorAssignments(c) {
  const persisted = window.useAssignments();
  return React.useMemo(() => {
    const mock = (c && c.assignments) ? c.assignments.map((m) => ({ ...m, source: 'mock' })) : [];
    const real = persisted.filter((a) => a.contractorId === (c && c.id)).map((a) => {
      const direct = Number(a.directHours) || 0;
      const indirect = Number(a.indirectHours) || 0;
      return {
        _id: a.id,
        schoolId: a.schoolId || null,
        school: a.schoolName || '',
        districtId: a.districtId || null,
        district: a.districtName || '',
        state: '',
        startDate: a.startDate || '',
        endDate: a.endDate || null,
        hoursPerWeek: direct + indirect,
        direct, indirect,
        payRate: a.payRate, billRate: a.billRate,
        status: a.status || 'active',
        spec: a.spec || '',
        source: 'supabase',
      };
    });
    return [...real, ...mock];
  }, [c, persisted]);
};
