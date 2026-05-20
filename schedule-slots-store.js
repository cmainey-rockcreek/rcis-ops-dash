// ScheduleSlotsStore — Supabase-backed contractor time slots.
//
// One row per work block: (contractor_id, slot_date, start_time, end_time,
// optional assignment_id, status, source). The UI buckets these into AM/
// Mid/PM/Late blocks for display; exact times persist.
//
// CSV/XLS import path: each spreadsheet row maps directly to one slot, with
// `source: 'import'` and a shared `import_batch_id` for audit/undo.

window.ScheduleSlotsStore = (() => {
  const CACHE_KEY = 'rcis.schedule_slots.cache.v1';
  const TABLE = 'schedule_slots';

  function fromRow(r) {
    return {
      id: r.id,
      contractorId: r.contractor_id,
      assignmentId: r.assignment_id || null,
      slotDate: r.slot_date,
      startTime: (r.start_time || '').slice(0, 5),   // 'HH:MM'
      endTime:   (r.end_time   || '').slice(0, 5),
      status: r.status || 'scheduled',
      note: r.note || '',
      source: r.source || 'manual',
      importBatchId: r.import_batch_id || null,
      createdBy: r.created_by || null,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    };
  }
  function toRow(s) {
    return {
      id: s.id,                                       // omit on insert; Postgres fills it
      contractor_id: s.contractorId,
      assignment_id: s.assignmentId || null,
      slot_date: s.slotDate,
      start_time: s.startTime,
      end_time: s.endTime,
      status: s.status || 'scheduled',
      note: s.note || '',
      source: s.source || 'manual',
      import_batch_id: s.importBatchId || null,
      created_by: s.createdBy || null,
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
    const { data, error } = await window.sb.from(TABLE).select('*')
      .order('slot_date', { ascending: true }).order('start_time', { ascending: true });
    if (error) { console.warn('slots load failed', error); return; }
    setState((data || []).map(fromRow));
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-schedule-slots')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setState(state.filter((s) => s.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          const row = fromRow(payload.new);
          if (!state.find((s) => s.id === row.id)) setState([...state, row]);
        } else if (payload.eventType === 'UPDATE') {
          const row = fromRow(payload.new);
          setState(state.map((s) => s.id === row.id ? row : s));
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
      return state.filter((s) => s.contractorId === contractorId);
    },

    forContractorWeek(contractorId, weekStartIso) {
      // weekStartIso = Monday date (YYYY-MM-DD). Returns slots Mon-Fri.
      const start = isoToDate(weekStartIso);
      const endIso = dateToIso(addDays(start, 5));   // Sat exclusive
      return state.filter((s) =>
        s.contractorId === contractorId &&
        s.slotDate >= weekStartIso &&
        s.slotDate <  endIso
      );
    },

    async add(partial) {
      const current = window.TeamStore && window.TeamStore.current && window.TeamStore.current();
      const slot = {
        contractorId: null, assignmentId: null,
        slotDate: null, startTime: '08:00', endTime: '11:00',
        status: 'scheduled', note: '',
        source: 'manual', importBatchId: null,
        createdBy: current ? current.id : null,
        ...partial,
      };
      if (!slot.contractorId || !slot.slotDate || !slot.startTime || !slot.endTime) {
        console.warn('slots.add: missing required fields', slot);
        return null;
      }
      const row = toRow(slot);
      delete row.id;
      const { data, error } = await window.sb.from(TABLE).insert(row).select('*').single();
      if (error) {
        console.warn('slots.add', error);
        return null;
      }
      const saved = fromRow(data);
      if (!state.find((s) => s.id === saved.id)) setState([...state, saved]);
      return saved;
    },

    async update(id, patch) {
      const existing = state.find((s) => s.id === id);
      if (!existing) return;
      const next = { ...existing, ...patch, updatedAt: Date.now() };
      setState(state.map((s) => s.id === id ? next : s));
      const row = toRow(next);
      delete row.id;
      const { error } = await window.sb.from(TABLE).update(row).eq('id', id);
      if (error) console.warn('slots.update', error);
    },

    async remove(id) {
      setState(state.filter((s) => s.id !== id));
      const { error } = await window.sb.from(TABLE).delete().eq('id', id);
      if (error) console.warn('slots.remove', error);
    },

    reload: load,
  };
})();

// ─── Date helpers (Mon-start week) ───────────────────────────────────────
// Exposed so the UI can navigate weeks consistently.
function isoToDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function dateToIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(d, n) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}
function startOfWeek(d) {
  // Mon-start. JS getDay(): 0=Sun, 1=Mon … 6=Sat
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(d, diff);
}

window.SchedDates = { isoToDate, dateToIso, addDays, startOfWeek };

// Hours between two 'HH:MM' strings. Used by the UI + the allocation comparison.
window.slotHours = function slotHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0, mins / 60);
};

window.useScheduleSlots = function useScheduleSlots(contractorId) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.ScheduleSlotsStore.subscribe(force), []);
  if (!contractorId) return [];
  return window.ScheduleSlotsStore.forContractor(contractorId);
};
