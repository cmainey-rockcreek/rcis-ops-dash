// GapCommentsStore — Supabase-backed comment thread per coverage gap.
// Same realtime + cold-cache pattern as CommentsStore (which serves tasks).

window.GapCommentsStore = (() => {
  const CACHE_KEY = 'rcis.gap_comments.cache.v1';
  const TABLE = 'gap_comments';

  function uid() {
    return 'gc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function fromRow(r) {
    return {
      id: r.id,
      gapId: r.gap_id,
      authorId: r.author_id,
      content: r.content,
      createdAt: new Date(r.created_at).getTime(),
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
      .select('*').order('created_at', { ascending: true });
    if (error) { console.warn('gap comments load failed', error); return; }
    setState((data || []).map(fromRow));
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-gap-comments')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setState(state.filter((c) => c.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          const row = fromRow(payload.new);
          if (!state.find((c) => c.id === row.id)) {
            const next = [...state, row];
            next.sort((a, b) => a.createdAt - b.createdAt);
            setState(next);
          }
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
    forGap(gapId) {
      if (!gapId) return [];
      return state.filter((c) => c.gapId === gapId);
    },
    countForGap(gapId) {
      if (!gapId) return 0;
      let n = 0;
      for (const c of state) if (c.gapId === gapId) n++;
      return n;
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    async add(gapId, content) {
      const trimmed = (content || '').trim();
      if (!trimmed || !gapId) return null;
      const current = window.TeamStore && window.TeamStore.current && window.TeamStore.current();
      if (!current) { console.warn('gap comments.add: no current user'); return null; }
      const row = {
        id: uid(),
        gap_id: gapId,
        author_id: current.id,
        content: trimmed,
      };
      const optimistic = {
        id: row.id,
        gapId,
        authorId: current.id,
        content: trimmed,
        createdAt: Date.now(),
      };
      const next = [...state, optimistic];
      next.sort((a, b) => a.createdAt - b.createdAt);
      setState(next);
      const { error } = await window.sb.from(TABLE).insert(row);
      if (error) {
        console.warn('gap comments.add', error);
        setState(state.filter((c) => c.id !== optimistic.id));
        return null;
      }
      return optimistic;
    },

    async remove(commentId) {
      const existing = state.find((c) => c.id === commentId);
      setState(state.filter((c) => c.id !== commentId));
      const { error } = await window.sb.from(TABLE).delete().eq('id', commentId);
      if (error) {
        console.warn('gap comments.remove', error);
        if (existing) {
          const next = [...state, existing];
          next.sort((a, b) => a.createdAt - b.createdAt);
          setState(next);
        }
      }
    },

    reload: load,
  };
})();

window.useGapComments = function useGapComments(gapId) {
  const [, force] = React.useState(0);
  React.useEffect(() => window.GapCommentsStore.subscribe(() => force((n) => n + 1)), []);
  return window.GapCommentsStore.forGap(gapId);
};

window.useGapCommentCount = function useGapCommentCount(gapId) {
  const [, force] = React.useState(0);
  React.useEffect(() => window.GapCommentsStore.subscribe(() => force((n) => n + 1)), []);
  return window.GapCommentsStore.countForGap(gapId);
};
