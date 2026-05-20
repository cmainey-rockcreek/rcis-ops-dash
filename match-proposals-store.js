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
      status: r.status || 'pending',
      decidedAt: r.decided_at ? new Date(r.decided_at).getTime() : null,
      decidedBy: r.decided_by || null,
      resultingAssignmentId: r.resulting_assignment_id || null,
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
      status: p.status || 'pending',
      decided_at: p.decidedAt ? new Date(p.decidedAt).toISOString() : null,
      decided_by: p.decidedBy || null,
      resulting_assignment_id: p.resultingAssignmentId || null,
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

    // Only "pending" pairs count — dismissed/confirmed rows are history
    // and shouldn't block re-shortlisting the same pair.
    has(gapId, contractorId) {
      return state.some((p) =>
        p.gapId === gapId &&
        p.contractorId === contractorId &&
        p.status === 'pending');
    },

    async add(gapId, contractorId, note) {
      if (!gapId || !contractorId) return null;
      if (state.some((p) =>
            p.gapId === gapId &&
            p.contractorId === contractorId &&
            p.status === 'pending')) return null;
      const current = window.TeamStore && window.TeamStore.current && window.TeamStore.current();
      const p = {
        id: uid(),
        gapId, contractorId,
        note: note || '',
        status: 'pending',
        decidedAt: null, decidedBy: null, resultingAssignmentId: null,
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

    // Soft-delete: dismiss flips status + stamps decision metadata so it
    // shows up in History instead of vanishing.
    async dismiss(id) {
      const existing = state.find((p) => p.id === id);
      if (!existing) return;
      if (existing.status !== 'pending') return;
      const current = window.TeamStore && window.TeamStore.current && window.TeamStore.current();
      const next = {
        ...existing,
        status: 'dismissed',
        decidedAt: Date.now(),
        decidedBy: current ? current.id : null,
        updatedAt: Date.now(),
      };
      setState(state.map((p) => p.id === id ? next : p));
      const { error } = await window.sb.from(TABLE).update({
        status: 'dismissed',
        decided_at: new Date().toISOString(),
        decided_by: current ? current.id : null,
      }).eq('id', id);
      if (error) console.warn('match_proposals.dismiss', error);
    },

    async markConfirmed(id, assignmentId) {
      const existing = state.find((p) => p.id === id);
      if (!existing) return;
      if (existing.status !== 'pending') return;
      const current = window.TeamStore && window.TeamStore.current && window.TeamStore.current();
      const next = {
        ...existing,
        status: 'confirmed',
        decidedAt: Date.now(),
        decidedBy: current ? current.id : null,
        resultingAssignmentId: assignmentId || null,
        updatedAt: Date.now(),
      };
      setState(state.map((p) => p.id === id ? next : p));
      const { error } = await window.sb.from(TABLE).update({
        status: 'confirmed',
        decided_at: new Date().toISOString(),
        decided_by: current ? current.id : null,
        resulting_assignment_id: assignmentId || null,
      }).eq('id', id);
      if (error) console.warn('match_proposals.markConfirmed', error);
    },

    // Hard-delete is kept for cleanup / undo. Rarely used in normal flow.
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

// Convenience: only currently-pending proposals (what the strip renders).
window.useMatchProposalsPending = function useMatchProposalsPending() {
  const all = window.useMatchProposals();
  return React.useMemo(() => all.filter((p) => p.status === 'pending'), [all]);
};
