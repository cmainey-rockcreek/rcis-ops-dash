// RenewalsStore — Supabase-backed renewal/expiration records.
//
// Same realtime + cold-cache pattern as GapsStore. Each renewal belongs to
// exactly one owner (contractor / school / district) depending on `kind`:
//   contractor_license   → contractor_id + state
//   contractor_insurance → contractor_id
//   client_contract      → school_id OR district_id
//
// `expires_on` is a YYYY-MM-DD string. Status: active | pending | lapsed.

window.RenewalsStore = (() => {
  const CACHE_KEY = 'rcis.renewals.cache.v1';
  const TABLE = 'renewals';

  function uid() {
    return 'rn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function fromRow(r) {
    return {
      id: r.id,
      kind: r.kind,
      contractorId: r.contractor_id || null,
      contractorName: r.contractor_name || '',
      schoolId: r.school_id || null,
      schoolName: r.school_name || '',
      districtId: r.district_id || null,
      districtName: r.district_name || '',
      label: r.label || '',
      state: r.state || '',
      expiresOn: r.expires_on || null,
      status: r.status || 'active',
      note: r.note || '',
      attachments: r.attachments || [],
      createdBy: r.created_by || null,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    };
  }
  function toRow(r) {
    return {
      id: r.id,
      kind: r.kind,
      contractor_id: r.contractorId || null,
      contractor_name: r.contractorName || null,
      school_id: r.schoolId || null,
      school_name: r.schoolName || null,
      district_id: r.districtId || null,
      district_name: r.districtName || null,
      label: r.label || '',
      state: r.state || null,
      expires_on: r.expiresOn,
      status: r.status || 'active',
      note: r.note || '',
      attachments: r.attachments || [],
      created_by: r.createdBy || null,
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
      .select('*').order('expires_on', { ascending: true });
    if (error) { console.warn('renewals load failed', error); return; }
    setState((data || []).map(fromRow));
    // After a fresh read, flip anything past-due-and-still-marked-active over
    // to lapsed in the database. Realtime broadcasts the changes back to the
    // open clients so all UIs stay consistent.
    sweepLapsed();
  }

  async function sweepLapsed() {
    if (!window.sb) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);
    const stale = state.filter((r) =>
      r.status === 'active' && r.expiresOn && r.expiresOn < todayIso);
    if (stale.length === 0) return;
    const ids = stale.map((r) => r.id);
    const { error } = await window.sb.from(TABLE)
      .update({ status: 'lapsed' }).in('id', ids);
    if (error) console.warn('renewals sweep failed', error);
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-renewals')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setState(state.filter((r) => r.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          const row = fromRow(payload.new);
          if (!state.find((r) => r.id === row.id)) {
            setState([row, ...state].sort(byExpires));
          }
        } else if (payload.eventType === 'UPDATE') {
          const row = fromRow(payload.new);
          setState(state.map((r) => r.id === row.id ? row : r).sort(byExpires));
        }
      })
      .subscribe();
  }

  function byExpires(a, b) {
    const ax = a.expiresOn || '9999-12-31';
    const bx = b.expiresOn || '9999-12-31';
    return ax.localeCompare(bx);
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
      const renewal = {
        id: uid(),
        kind: 'contractor_license',
        contractorId: null, contractorName: '',
        schoolId: null, schoolName: '',
        districtId: null, districtName: '',
        label: '', state: '',
        expiresOn: null, status: 'active',
        note: '', attachments: [],
        createdBy: current ? current.id : null,
        createdAt: now, updatedAt: now,
        ...partial,
      };
      // If they're logging a doc that's already expired, jump straight to
      // lapsed — saves a manual click and matches what the sweep would do.
      if (renewal.status === 'active' && renewal.expiresOn) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayIso = today.toISOString().slice(0, 10);
        if (renewal.expiresOn < todayIso) renewal.status = 'lapsed';
      }
      setState([renewal, ...state].sort(byExpires));
      const row = toRow(renewal);
      const { error } = await window.sb.from(TABLE).insert(row);
      if (error) {
        console.warn('renewals.add', error);
        setState(state.filter((r) => r.id !== renewal.id));
        return null;
      }
      return renewal;
    },

    async update(id, patch) {
      const existing = state.find((r) => r.id === id);
      if (!existing) return;
      const next = { ...existing, ...patch, updatedAt: Date.now() };
      setState(state.map((r) => r.id === id ? next : r).sort(byExpires));
      const row = toRow(next);
      delete row.id;
      const { error } = await window.sb.from(TABLE).update(row).eq('id', id);
      if (error) console.warn('renewals.update', error);
    },

    async remove(id) {
      const existing = state.find((r) => r.id === id);
      setState(state.filter((r) => r.id !== id));
      const { error } = await window.sb.from(TABLE).delete().eq('id', id);
      if (error) console.warn('renewals.remove', error);
      if (existing && window.deleteTaskAttachmentFiles) {
        await window.deleteTaskAttachmentFiles(existing.attachments);
      }
    },

    reload: load,
  };
})();

window.useRenewals = function useRenewals() {
  const [s, setS] = React.useState(window.RenewalsStore.get());
  React.useEffect(() => window.RenewalsStore.subscribe(setS), []);
  return s;
};

// Helper: days until expiration (negative = overdue). Returns null if no date.
window.daysUntilRenewal = function daysUntilRenewal(expiresOn) {
  if (!expiresOn) return null;
  const [y, m, d] = expiresOn.split('-').map(Number);
  const exp = new Date(y, m - 1, d).getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((exp - today.getTime()) / 86400000);
};

// Helper: urgency tier label. Returns 'overdue' | 'soon' | 'upcoming' | 'later' | null
window.renewalUrgency = function renewalUrgency(expiresOn) {
  const d = window.daysUntilRenewal(expiresOn);
  if (d === null) return null;
  if (d < 0) return 'overdue';
  if (d <= 30) return 'soon';
  if (d <= 60) return 'upcoming';
  return 'later';
};
