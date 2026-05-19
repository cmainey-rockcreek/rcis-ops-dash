// DocumentsStore — Supabase-backed, keyed by (scope, scope_id).
// Same pattern as TodosStore/ContactsStore: load on auth in, realtime,
// optimistic updates + localStorage cache.

window.DocumentsStore = (() => {
  const CACHE_KEY = 'rcis.docs.cache.v2';
  const TABLE = 'documents';

  function uid() {
    return 'doc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }
  function fromRow(r) {
    return {
      id: r.id, scope: r.scope, scopeId: r.scope_id,
      kind: r.kind, url: r.url, name: r.name,
      addedAt: new Date(r.added_at).getTime(),
    };
  }
  function toRow(d) {
    return {
      id: d.id, scope: d.scope, scope_id: d.scopeId,
      kind: d.kind, url: d.url, name: d.name,
    };
  }

  let state = [];
  try { state = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch (e) {}

  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(state));
  function setState(next) {
    state = next;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch (e) {}
    emit();
  }

  async function load() {
    if (!window.sb) return;
    const { data, error } = await window.sb.from(TABLE).select('*');
    if (error) { console.warn('docs load failed', error); return; }
    setState((data || []).map(fromRow));
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-docs')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setState(state.filter((d) => d.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          const row = fromRow(payload.new);
          if (!state.find((d) => d.id === row.id)) setState([...state, row]);
        } else if (payload.eventType === 'UPDATE') {
          const row = fromRow(payload.new);
          setState(state.map((d) => d.id === row.id ? row : d));
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

    forScope(scope, scopeId) {
      return state.filter((d) => d.scope === scope && d.scopeId === scopeId);
    },

    async add({ scope, scopeId, kind, url, name }) {
      const d = { id: uid(), scope, scopeId, kind, url, name, addedAt: Date.now() };
      setState([...state, d]);
      const { error } = await window.sb.from(TABLE).insert(toRow(d));
      if (error) console.warn('docs.add', error);
      return d;
    },

    async remove(id) {
      setState(state.filter((d) => d.id !== id));
      const { error } = await window.sb.from(TABLE).delete().eq('id', id);
      if (error) console.warn('docs.remove', error);
    },

    reload: load,
  };
})();

window.useDocuments = function useDocuments(scope, scopeId) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.DocumentsStore.subscribe(force), []);
  return window.DocumentsStore.forScope(scope, scopeId);
};
