// NotesStore — Supabase-backed free-text notes box, keyed by (scope, scope_id).
// One row per entity. Debounced upsert on edit so we don't write on every keystroke.

window.NotesStore = (() => {
  const CACHE_KEY = 'rcis.notes.cache.v2';
  const TABLE = 'entity_notes';

  function key(scope, scopeId) { return `${scope}:${scopeId}`; }

  let state = {};
  try { state = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (e) {}

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
    if (error) { console.warn('notes load failed', error); return; }
    const next = {};
    for (const r of data || []) next[key(r.scope, r.scope_id)] = r.content || '';
    setState(next);
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const k = key(payload.old.scope, payload.old.scope_id);
          const next = { ...state }; delete next[k]; setState(next);
        } else {
          const r = payload.new;
          setState({ ...state, [key(r.scope, r.scope_id)]: r.content || '' });
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

  // Per-key debounce timers so concurrent edits to different entities don't
  // collide.
  const pending = {};

  return {
    get() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    getFor(scope, scopeId) { return state[key(scope, scopeId)] || ''; },

    // Local-immediate set + 500ms debounced Supabase upsert.
    set(scope, scopeId, content) {
      const k = key(scope, scopeId);
      setState({ ...state, [k]: content });
      clearTimeout(pending[k]);
      pending[k] = setTimeout(async () => {
        if (!window.sb) return;
        const { error } = await window.sb.from(TABLE)
          .upsert({ scope, scope_id: scopeId, content }, { onConflict: 'scope,scope_id' });
        if (error) console.warn('notes.set', error);
      }, 500);
    },
  };
})();

window.useEntityNotes = function useEntityNotes(scope, scopeId) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.NotesStore.subscribe(force), []);
  return [
    window.NotesStore.getFor(scope, scopeId),
    (v) => window.NotesStore.set(scope, scopeId, v),
  ];
};
