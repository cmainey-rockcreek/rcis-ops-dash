// TodosStore — Supabase-backed team todo store.
//
// Loads on init, writes go to Supabase, realtime channel pushes other
// users' changes back to subscribers. localStorage is used only as a
// cold-start cache so the board renders instantly while the network
// round-trip happens.

window.TodosStore = (() => {
  const CACHE_KEY = 'rcis.todos.cache.v2';
  const TABLE = 'todos';

  function uid() {
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // DB row → in-memory todo (camelCase, plus the existing `column` alias)
  function fromRow(r) {
    return {
      id: r.id,
      title: r.title,
      column: r.column_name,
      owners: r.owners || [],
      label: r.label,
      priority: r.priority,
      due: r.due,
      linkedTo: r.linked_to || null,
      notes: r.notes || '',
      attachments: r.attachments || [],
      createdAt: new Date(r.created_at).getTime(),
      updatedAt: new Date(r.updated_at).getTime(),
      completedAt: r.completed_at ? new Date(r.completed_at).getTime() : null,
    };
  }
  function toRow(t) {
    return {
      id: t.id,
      title: t.title,
      column_name: t.column,
      owners: t.owners || [],
      label: t.label || 'Ops',
      priority: t.priority || 'medium',
      due: t.due || null,
      linked_to: t.linkedTo || null,
      notes: t.notes || '',
      attachments: t.attachments || [],
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

  // ── Load from Supabase + subscribe to realtime ─────────────────────────
  async function load() {
    if (!window.sb) return;
    const { data, error } = await window.sb.from(TABLE)
      .select('*').order('updated_at', { ascending: false });
    if (error) { console.warn('todos load failed', error); return; }
    setState((data || []).map(fromRow));
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-todos')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setState(state.filter((t) => t.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          const row = fromRow(payload.new);
          if (!state.find((t) => t.id === row.id)) setState([row, ...state]);
        } else if (payload.eventType === 'UPDATE') {
          const row = fromRow(payload.new);
          setState(state.map((t) => t.id === row.id ? row : t));
        }
      })
      .subscribe();
  }

  // Boot once auth is in. We poll auth state and trigger on first 'in'.
  function boot() {
    const unsub = (() => {
      let lastStatus = null;
      const tick = () => {
        const a = window.useAuth ? null : null; // avoid hooks here
      };
      return () => {};
    })();

    // Use the same listener model the auth wrapper uses.
    // Simpler: just listen via supabase auth state.
    if (window.sb) {
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
  }
  // Defer boot until supabase-client.js has run.
  if (window.sb) boot(); else setTimeout(boot, 0);

  return {
    get() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    async add(partial) {
      const now = Date.now();
      const todo = {
        id: uid(),
        title: '',
        column: 'todo',
        owners: [], label: 'Ops', priority: 'medium',
        due: null, linkedTo: null, notes: '', attachments: [],
        ...partial,
        createdAt: now, updatedAt: now,
        completedAt: partial && partial.column === 'done' ? now : null,
      };
      // Optimistic
      setState([todo, ...state]);
      const row = toRow(todo);
      if (partial && partial.column === 'done') row.completed_at = new Date().toISOString();
      const { error } = await window.sb.from(TABLE).insert(row);
      if (error) console.warn('todos.add', error);
      return todo;
    },

    async update(id, patch) {
      const existing = state.find((t) => t.id === id);
      if (!existing) return;
      const next = { ...existing, ...patch, updatedAt: Date.now() };
      // Track when an item enters Done.
      if (patch.column) {
        if (patch.column === 'done' && existing.column !== 'done') next.completedAt = Date.now();
        if (patch.column !== 'done' && existing.column === 'done') next.completedAt = null;
      }
      setState(state.map((t) => t.id === id ? next : t));
      const row = toRow(next);
      if (next.completedAt) row.completed_at = new Date(next.completedAt).toISOString();
      else row.completed_at = null;
      const { error } = await window.sb.from(TABLE).update(row).eq('id', id);
      if (error) console.warn('todos.update', error);
    },

    async remove(id) {
      setState(state.filter((t) => t.id !== id));
      const { error } = await window.sb.from(TABLE).delete().eq('id', id);
      if (error) console.warn('todos.remove', error);
    },

    move(id, column) {
      const t = state.find((x) => x.id === id);
      if (!t || t.column === column) return;
      this.update(id, { column });
    },

    byColumn() {
      const out = { todo: [], doing: [], done: [] };
      for (const t of state) if (out[t.column]) out[t.column].push(t);
      for (const k of Object.keys(out)) out[k].sort((a, b) => b.updatedAt - a.updatedAt);
      return out;
    },

    reload: load,
  };
})();

window.useTodos = function useTodos() {
  const [s, setS] = React.useState(window.TodosStore.get());
  React.useEffect(() => window.TodosStore.subscribe(setS), []);
  return s;
};
