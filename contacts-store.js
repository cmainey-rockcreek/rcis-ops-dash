// ContactsStore — Supabase-backed.
// Same pattern as TodosStore.

window.ContactsStore = (() => {
  const CACHE_KEY = 'rcis.contacts.cache.v2';
  const TABLE = 'contacts';

  function uid() {
    return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  function fromRow(r) {
    return {
      id: r.id,
      name: r.name,
      role: r.role || '',
      email: r.email || '',
      phone: r.phone || '',
      organization: r.organization || '',
      linkedTo: r.linked_to || [],
    };
  }
  function toRow(c) {
    return {
      id: c.id,
      name: c.name,
      role: c.role || '',
      email: c.email || '',
      phone: c.phone || '',
      organization: c.organization || '',
      linked_to: c.linkedTo || [],
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
      .select('*').order('name', { ascending: true });
    if (error) { console.warn('contacts load failed', error); return; }
    setState((data || []).map(fromRow));
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-contacts')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setState(state.filter((c) => c.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          const row = fromRow(payload.new);
          if (!state.find((c) => c.id === row.id)) setState([...state, row].sort((a, b) => a.name.localeCompare(b.name)));
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
      const c = {
        id: uid(),
        name: '', role: '', email: '', phone: '', organization: '',
        linkedTo: [],
        ...partial,
      };
      setState([c, ...state].sort((a, b) => a.name.localeCompare(b.name)));
      const { error } = await window.sb.from(TABLE).insert(toRow(c));
      if (error) console.warn('contacts.add', error);
      return c;
    },

    async update(id, patch) {
      const existing = state.find((c) => c.id === id);
      if (!existing) return;
      const next = { ...existing, ...patch };
      setState(state.map((c) => c.id === id ? next : c));
      const { error } = await window.sb.from(TABLE).update(toRow(next)).eq('id', id);
      if (error) console.warn('contacts.update', error);
    },

    async remove(id) {
      setState(state.filter((c) => c.id !== id));
      const { error } = await window.sb.from(TABLE).delete().eq('id', id);
      if (error) console.warn('contacts.remove', error);
    },

    forSchool(schoolId, opts = {}) {
      const includeDistrict = opts.includeDistrict !== false;
      const s = window.RCIS_DATA.SCHOOLS.find((x) => x.id === schoolId);
      const districtId = s && s.district;
      return state.filter((c) => c.linkedTo.some((l) =>
        (l.type === 'school' && l.id === schoolId) ||
        (includeDistrict && l.type === 'district' && l.id === districtId)
      ));
    },

    forDistrict(districtId) {
      return state.filter((c) =>
        c.linkedTo.some((l) => l.type === 'district' && l.id === districtId)
      );
    },

    reload: load,
  };
})();

// Live name lookup for any linkedTo entry on a task. Falls back to the
// snapshot (linkedTo.name) when the referenced record can't be found.
// Used by Kanban + Tasks list so renames propagate instantly.
window.resolveLinkedName = function resolveLinkedName(linkedTo) {
  if (!linkedTo) return '';
  const { type, id, name } = linkedTo;
  if (type === 'contractor' && window.contractorDisplayName) {
    return window.contractorDisplayName(id) || name || '';
  }
  if (type === 'contact' && window.ContactsStore) {
    const c = window.ContactsStore.get().find((x) => x.id === id);
    return (c && c.name) || name || '';
  }
  if (type === 'school' && window.RCIS_DATA) {
    const s = window.RCIS_DATA.SCHOOLS.find((x) => x.id === id);
    return (s && s.name) || name || '';
  }
  if (type === 'district' && window.RCIS_DATA) {
    const d = window.RCIS_DATA.DISTRICTS.find((x) => x.id === id);
    return (d && d.name) || name || '';
  }
  return name || '';
};

window.useContacts = function useContacts() {
  const [s, setS] = React.useState(window.ContactsStore.get());
  React.useEffect(() => window.ContactsStore.subscribe(setS), []);
  return s;
};
