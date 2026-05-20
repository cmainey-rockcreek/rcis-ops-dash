// MatchProposalsStore — Supabase-backed Matchmaker shortlist.
//
// A row is a (gap_id, contractor_id) pair the team has shortlisted but not
// yet confirmed. Confirming creates an assignment + marks the gap filled
// (handled at the call site); dismissing just deletes the row.
//
// Same realtime + cache pattern as RenewalsStore.

window.MatchProposalsStore = (() => {
  const CACHE_KEY = 'rcis.match_proposals.cache.v1';
  const TABLE = 'match_proposals';

  function uid() {
    return 'mp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function fromRow(r) {
    return {
      id: r.id,
      gapId: r.gap_id,
      contractorId: r.contractor_id,
      note: r.note || '',
      createdBy: r.created_by || null,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    };
  }
  function toRow(p) {
    return {
      id: p.id,
      gap_id: p.gapId,
      contractor_id: p.contractorId,
      note: p.note || '',
      created_by: p.createdBy || null,
    };
  }

  let state = [];
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) {}

  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(state));
  function setState(next) {
    state = next;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch (e) {}
    emit();
  }

  async function load() {
    if (!window.sb) return;
    const { data, error } = await window.sb.from(TABLE)
      .select('*').order('created_at', { ascending: false });
    if (error) { console.warn('match_proposals load failed', error); return; }
    setState((data || []).map(fromRow));
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-match-proposals')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setState(state.filter((p) => p.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          const row = fromRow(payload.new);
          if (!state.find((p) => p.id === row.id)) setState([row, ...state]);
        } else if (payload.eventType === 'UPDATE') {
          const row = fromRow(payload.new);
          setState(state.map((p) => p.id === row.id ? row : p));
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

    has(gapId, contractorId) {
      return state.some((p) => p.gapId === gapId && p.contractorId === contractorId);
    },

    async add(gapId, contractorId, note) {
      if (!gapId || !contractorId) return null;
      if (state.some((p) => p.gapId === gapId && p.contractorId === contractorId)) return null;
      const current = window.TeamStore && window.TeamStore.current && window.TeamStore.current();
      const p = {
        id: uid(),
        gapId, contractorId,
        note: note || '',
        createdBy: current ? current.id : null,
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      setState([p, ...state]);
      const { error } = await window.sb.from(TABLE).insert(toRow(p));
      if (error) {
        console.warn('match_proposals.add', error);
        setState(state.filter((x) => x.id !== p.id));
        return null;
      }
      return p;
    },

    async updateNote(id, note) {
      const existing = state.find((p) => p.id === id);
      if (!existing) return;
      const next = { ...existing, note, updatedAt: Date.now() };
      setState(state.map((p) => p.id === id ? next : p));
      const { error } = await window.sb.from(TABLE)
        .update({ note }).eq('id', id);
      if (error) console.warn('match_proposals.updateNote', error);
    },

    async remove(id) {
      setState(state.filter((p) => p.id !== id));
      const { error } = await window.sb.from(TABLE).delete().eq('id', id);
      if (error) console.warn('match_proposals.remove', error);
    },

    reload: load,
  };
})();

window.useMatchProposals = function useMatchProposals() {
  const [s, setS] = React.useState(window.MatchProposalsStore.get());
  React.useEffect(() => window.MatchProposalsStore.subscribe(setS), []);
  return s;
};
