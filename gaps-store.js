// GapsStore — Supabase-backed coverage gaps.
//
// Same realtime + cold-cache pattern as TodosStore. Each gap belongs to a
// school or to a district (scope='school' or 'district'). Bill rate, notes,
// modality, urgency, attachments, and posted-at all live on the row.

window.GapsStore = (() => {
  const CACHE_KEY = 'rcis.coverage_gaps.cache.v1';
  const TABLE = 'coverage_gaps';

  function uid() {
    return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function fromRow(r) {
    return {
      id: r.id,
      scope: r.scope || 'school',
      schoolId: r.school_id || null,
      schoolName: r.school_name || null,
      districtId: r.district_id || null,
      districtName: r.district_name || '',
      state: r.state,
      spec: r.spec,
      hours: Number(r.hours) || 0,
      modality: r.modality || 'onsite',
      priority: r.priority || 'medium',
      billRate: r.bill_rate != null ? Number(r.bill_rate) : null,
      note: r.note || '',
      status: r.status || 'open',
      attachments: r.attachments || [],
      postedAt: r.posted_at ? new Date(r.posted_at).getTime() : Date.now(),
      createdBy: r.created_by || null,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    };
  }
  function toRow(g) {
    return {
      id: g.id,
      scope: g.scope || 'school',
      school_id: g.schoolId || null,
      school_name: g.schoolName || null,
      district_id: g.districtId || null,
      district_name: g.districtName || '',
      state: g.state,
      spec: g.spec,
      hours: g.hours,
      modality: g.modality || 'onsite',
      priority: g.priority || 'medium',
      bill_rate: g.billRate != null ? g.billRate : null,
      note: g.note || '',
      status: g.status || 'open',
      attachments: g.attachments || [],
      posted_at: new Date(g.postedAt || Date.now()).toISOString(),
      created_by: g.createdBy || null,
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
      .select('*').order('posted_at', { ascending: false });
    if (error) { console.warn('gaps load failed', error); return; }
    setState((data || []).map(fromRow));
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-coverage-gaps')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setState(state.filter((g) => g.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          const row = fromRow(payload.new);
          if (!state.find((g) => g.id === row.id)) setState([row, ...state]);
        } else if (payload.eventType === 'UPDATE') {
          const row = fromRow(payload.new);
          setState(state.map((g) => g.id === row.id ? row : g));
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
      const gap = {
        id: uid(),
        scope: 'school',
        schoolId: null, schoolName: null,
        districtId: null, districtName: '',
        state: '', spec: '',
        hours: 0,
        modality: 'onsite', priority: 'medium',
        billRate: null, note: '', status: 'open',
        attachments: [],
        postedAt: now,
        createdBy: current ? current.id : null,
        createdAt: now, updatedAt: now,
        ...partial,
      };
      setState([gap, ...state]);
      const row = toRow(gap);
      const { error } = await window.sb.from(TABLE).insert(row);
      if (error) {
        console.warn('gaps.add', error);
        setState(state.filter((g) => g.id !== gap.id));
        return null;
      }
      return gap;
    },

    async update(id, patch) {
      const existing = state.find((g) => g.id === id);
      if (!existing) return;
      const next = { ...existing, ...patch, updatedAt: Date.now() };
      setState(state.map((g) => g.id === id ? next : g));
      const row = toRow(next);
      delete row.id;
      const { error } = await window.sb.from(TABLE).update(row).eq('id', id);
      if (error) console.warn('gaps.update', error);
    },

    async remove(id) {
      const existing = state.find((g) => g.id === id);
      setState(state.filter((g) => g.id !== id));
      const { error } = await window.sb.from(TABLE).delete().eq('id', id);
      if (error) console.warn('gaps.remove', error);
      if (existing && window.deleteTaskAttachmentFiles) {
        await window.deleteTaskAttachmentFiles(existing.attachments);
      }
    },

    reload: load,
  };
})();

window.useCoverageGaps = function useCoverageGaps() {
  const [s, setS] = React.useState(window.GapsStore.get());
  React.useEffect(() => window.GapsStore.subscribe(setS), []);
  return s;
};
