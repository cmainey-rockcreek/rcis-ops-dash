// AssignmentsStore — Supabase-backed contractor → school/district placements.
// Mock seed assignments live in data-contractors.js and are merged on read.
// Same realtime + cold-cache pattern as RenewalsStore.

window.AssignmentsStore = (() => {
  const CACHE_KEY = 'rcis.assignments.cache.v1';
  const TABLE = 'assignments';

  function uid() {
    return 'as' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // Round to the nearest quarter-hour — keeps indirect tidy at 0.0/0.25/0.5/…
  function roundQuarter(n) {
    return Math.round((Number(n) || 0) * 4) / 4;
  }

  // Auto-calc rule shared with the UI: a per-specialty ratio (default 0.25)
  // applied to direct hours, rounded to 0.25. Pass the assignment's spec code
  // to pick up an admin-set override; one-arg callers still get the legacy
  // 25% fallback.
  const INDIRECT_RATIO = 0.25;
  function ratioForSpec(specCode) {
    if (window.indirectRatioFor) return window.indirectRatioFor(specCode);
    return INDIRECT_RATIO;
  }
  function autoIndirect(directHours, specCode) {
    return roundQuarter((Number(directHours) || 0) * ratioForSpec(specCode));
  }

  function fromRow(r) {
    return {
      id: r.id,
      contractorId: r.contractor_id,
      contractorName: r.contractor_name || '',
      schoolId: r.school_id || null,
      schoolName: r.school_name || '',
      districtId: r.district_id || null,
      districtName: r.district_name || '',
      spec: r.spec || '',
      directHours: Number(r.direct_hours) || 0,
      indirectHours: Number(r.indirect_hours) || 0,
      indirectOverride: !!r.indirect_override,
      payRate: r.pay_rate != null ? Number(r.pay_rate) : null,
      startDate: r.start_date || null,
      endDate: r.end_date || null,
      status: r.status || 'active',
      note: r.note || '',
      attachments: Array.isArray(r.attachments) ? r.attachments : [],
      schedule: Array.isArray(r.schedule) ? r.schedule : [],
      createdBy: r.created_by || null,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
      source: 'supabase',
    };
  }
  function toRow(a) {
    return {
      id: a.id,
      contractor_id: a.contractorId,
      contractor_name: a.contractorName || null,
      school_id: a.schoolId || null,
      school_name: a.schoolName || null,
      district_id: a.districtId || null,
      district_name: a.districtName || null,
      spec: a.spec || null,
      direct_hours: a.directHours || 0,
      indirect_hours: a.indirectHours || 0,
      indirect_override: !!a.indirectOverride,
      pay_rate: a.payRate != null ? a.payRate : null,
      start_date: a.startDate || null,
      end_date: a.endDate || null,
      status: a.status || 'active',
      note: a.note || '',
      attachments: Array.isArray(a.attachments) ? a.attachments : [],
      schedule: Array.isArray(a.schedule) ? a.schedule : [],
      created_by: a.createdBy || null,
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
      .select('*').order('start_date', { ascending: false });
    if (error) { console.warn('assignments load failed', error); return; }
    setState((data || []).map(fromRow));
  }

  let channel = null;
  function subscribeRealtime() {
    if (!window.sb || channel) return;
    channel = window.sb.channel('rcis-assignments')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setState(state.filter((a) => a.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          const row = fromRow(payload.new);
          if (!state.find((a) => a.id === row.id)) setState([row, ...state]);
        } else if (payload.eventType === 'UPDATE') {
          const row = fromRow(payload.new);
          setState(state.map((a) => a.id === row.id ? row : a));
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
      return state.filter((a) => a.contractorId === contractorId);
    },

    async add(partial) {
      const now = Date.now();
      const current = window.TeamStore && window.TeamStore.current && window.TeamStore.current();
      const a = {
        id: uid(),
        contractorId: null, contractorName: '',
        schoolId: null, schoolName: '',
        districtId: null, districtName: '',
        spec: '',
        directHours: 0, indirectHours: 0, indirectOverride: false,
        payRate: null,
        startDate: null, endDate: null,
        status: 'active', note: '',
        attachments: [],
        schedule: [],
        createdBy: current ? current.id : null,
        createdAt: now, updatedAt: now,
        source: 'supabase',
        ...partial,
      };
      // If indirect wasn't overridden, derive it from direct × per-spec ratio.
      if (!a.indirectOverride) {
        a.indirectHours = autoIndirect(a.directHours, a.spec);
      }
      // If user picks an end date in the past, mark completed on save.
      if (a.endDate) {
        const today = new Date().toISOString().slice(0, 10);
        if (a.endDate < today && a.status === 'active') a.status = 'completed';
      }
      setState([a, ...state]);
      // Make sure SpecSettingsStore has had a chance to load before we
      // persist the auto-derived indirect — otherwise a cold start would
      // bake in the 0.25 default and ignore the admin-configured ratio.
      if (window.SpecSettingsStore && window.SpecSettingsStore.ready) {
        await window.SpecSettingsStore.ready();
        if (!a.indirectOverride) {
          a.indirectHours = autoIndirect(a.directHours, a.spec);
        }
      }
      const row = toRow(a);
      const { error } = await window.sb.from(TABLE).insert(row);
      if (error) {
        console.warn('assignments.add', error);
        setState(state.filter((x) => x.id !== a.id));
        return null;
      }
      return a;
    },

    async update(id, patch) {
      const existing = state.find((a) => a.id === id);
      if (!existing) return;
      const next = { ...existing, ...patch, updatedAt: Date.now() };
      // Re-derive indirect from direct unless user has overridden.
      if (!next.indirectOverride) {
        next.indirectHours = autoIndirect(next.directHours, next.spec);
      }
      if (next.endDate) {
        const today = new Date().toISOString().slice(0, 10);
        if (next.endDate < today && next.status === 'active') next.status = 'completed';
      }
      setState(state.map((a) => a.id === id ? next : a));
      // Same cold-start guard as add(): make sure the persisted indirect
      // uses the current per-spec ratio, not the 0.25 default.
      if (window.SpecSettingsStore && window.SpecSettingsStore.ready) {
        await window.SpecSettingsStore.ready();
        if (!next.indirectOverride) {
          next.indirectHours = autoIndirect(next.directHours, next.spec);
        }
      }
      const row = toRow(next);
      delete row.id;
      const { error } = await window.sb.from(TABLE).update(row).eq('id', id);
      if (error) console.warn('assignments.update', error);
    },

    async remove(id) {
      setState(state.filter((a) => a.id !== id));
      const { error } = await window.sb.from(TABLE).delete().eq('id', id);
      if (error) console.warn('assignments.remove', error);
    },

    reload: load,

    // Shared with the editor + financials so the rule lives in one place.
    INDIRECT_RATIO,
    autoIndirect,
    ratioForSpec,
  };
})();

window.useAssignments = function useAssignments() {
  const [s, setS] = React.useState(window.AssignmentsStore.get());
  React.useEffect(() => window.AssignmentsStore.subscribe(setS), []);
  return s;
};

// Combined view: mock assignments from a contractor record + persisted ones.
// Persisted always wins on id collision (which shouldn't happen — mock has
// no id). Returns objects shaped like the mock format so existing UI keeps
// working: { schoolId, school, district, state, startDate, endDate,
// hoursPerWeek, direct, indirect, status, payRate?, _id?, source,
// attachments? }.
window.useContractorAssignments = function useContractorAssignments(c) {
  const persisted = window.useAssignments();
  // Subscribe so admin's per-spec ratio edits flow through to indirect /
  // revenue / margin instead of being trapped behind the memo.
  const specSettings = window.useSpecSettings ? window.useSpecSettings() : null;
  // Subscribe so a district rate-card edit re-derives downstream margin
  // numbers (effectiveBill reads window.rateCardFor at call time, but
  // consumers only re-run when this array's identity changes).
  const rateCards = window.useDistrictRateCards ? window.useDistrictRateCards() : null;
  return React.useMemo(() => {
    const schools = (window.RCIS_DATA && window.RCIS_DATA.SCHOOLS) || [];
    const lookupDistrict = (schoolId) => {
      if (!schoolId) return null;
      const s = schools.find((x) => x.id === schoolId);
      return s ? s.district : null;
    };
    // Mock seed rows don't carry a spec — borrow the contractor's so Net
    // Margin can subtract burden the same way it does for real assignments.
    // Derive districtId from schoolId so effectiveBill can look up the
    // rate card.
    const mock = (c && c.assignments) ? c.assignments.map((m) => ({
      ...m,
      spec: m.spec || (c && c.spec) || '',
      districtId: m.districtId || lookupDistrict(m.schoolId) || null,
      source: 'mock',
    })) : [];
    const real = persisted.filter((a) => a.contractorId === (c && c.id)).map((a) => {
      const direct = Number(a.directHours) || 0;
      // Re-derive at render time using the current per-spec ratio; the
      // stored indirect_hours is just a cache of "last computed."
      const indirect = a.indirectOverride
        ? (Number(a.indirectHours) || 0)
        : window.AssignmentsStore.autoIndirect(direct, a.spec);
      return {
        _id: a.id,
        schoolId: a.schoolId || null,
        school: a.schoolName || '',
        districtId: a.districtId || lookupDistrict(a.schoolId) || null,
        district: a.districtName || '',
        state: '',
        startDate: a.startDate || '',
        endDate: a.endDate || null,
        hoursPerWeek: direct + indirect,
        direct, indirect,
        indirectOverride: a.indirectOverride,
        payRate: a.payRate,
        status: a.status || 'active',
        spec: a.spec || '',
        attachments: Array.isArray(a.attachments) ? a.attachments : [],
        schedule: Array.isArray(a.schedule) ? a.schedule : [],
        source: 'supabase',
      };
    });
    return [...real, ...mock];
  }, [c, persisted, specSettings, rateCards]);
};

// Live "booked hours this week" for a contractor: sums active mock + active
// persisted assignments, applying the per-spec auto-indirect ratio to
// persisted rows unless they carry an explicit override. The contractor
// detail page's CapacityCard, the home CapacityNow widget, the Matchmaker
// free-hours rank, and the contractors-list capacity bars all use this so
// the numbers agree everywhere — and so a user-created contractor (whose
// mock `c.assigned` snapshot is 0) reflects real assignments instead of
// always looking fully free.
//
// Pass the persisted-assignments array in (don't subscribe inside) so React
// callers can drive their own re-render via useAssignments().
window.bookedHoursFor = function bookedHoursFor(c, persistedAssignments) {
  if (!c) return 0;
  let booked = 0;
  for (const m of (c.assignments || [])) {
    if ((m && m.status || 'active') !== 'active') continue;
    const direct = Number(m && m.direct) || 0;
    const indirect = Number(m && m.indirect) || 0;
    const fallback = Number(m && m.hoursPerWeek) || 0;
    booked += (direct || indirect) ? (direct + indirect) : fallback;
  }
  const persisted = Array.isArray(persistedAssignments) ? persistedAssignments : [];
  for (const a of persisted) {
    if (a.contractorId !== c.id) continue;
    if ((a.status || 'active') !== 'active') continue;
    const direct = Number(a.directHours) || 0;
    const indirect = a.indirectOverride
      ? (Number(a.indirectHours) || 0)
      : (window.AssignmentsStore && window.AssignmentsStore.autoIndirect
          ? window.AssignmentsStore.autoIndirect(direct, a.spec || c.spec)
          : 0);
    booked += direct + indirect;
  }
  return booked;
};

// Company-wide view: every assignment across every contractor, mock seeds
// and persisted rows alike, flattened to one shape so the /assignments
// master page (and anything else that wants "all placements") doesn't
// re-implement the merge in useContractorAssignments.
//
// Pure. `persisted` is AssignmentsStore.get(), `contractors` is the live
// RCIS_DATA.CONTRACTORS catalog, `overridesMap` is
// ContractorOverridesStore.get(). Names resolve through the live display
// helpers (so renames show up) and fall back to the stored snapshot.
// Saved rows whose contractor is no longer in the catalog are still
// emitted, so nothing silently disappears from the page.
//
// Row shape:
//   { key, _id, source('mock'|'supabase'), contractorId, contractorName,
//     spec, schoolId, schoolName, districtId, districtName, state,
//     direct, indirect, indirectOverride, payRate, defaultPay,
//     startDate, endDate, status, attachmentCount }
window.allAssignmentRows = function allAssignmentRows(persisted, contractors, overridesMap) {
  const out = [];
  const list = Array.isArray(contractors) ? contractors : [];
  const apply = window.applyContractorOverride || ((c) => c);
  const enrichedById = new Map();
  for (const c of list) {
    if (c && c.id) enrichedById.set(c.id, apply(c, overridesMap) || c);
  }
  // Resolve names and school→district once per call via Maps rather than
  // a linear find per row: this runs in the sidebar on every page whenever
  // any of its stores ticks, and real data is ~250 schools × hundreds of
  // rows.
  const SCHOOLS = (window.RCIS_DATA && window.RCIS_DATA.SCHOOLS) || [];
  const DISTRICTS = (window.RCIS_DATA && window.RCIS_DATA.DISTRICTS) || [];
  const applySchool = window.applySchoolOverride || ((s) => s);
  const applyDistrict = window.applyDistrictOverride || ((d) => d);
  const schoolById = new Map();
  for (const s of SCHOOLS) if (s && s.id) schoolById.set(s.id, applySchool(s) || s);
  const districtById = new Map();
  for (const d of DISTRICTS) if (d && d.id) districtById.set(d.id, applyDistrict(d) || d);
  const districtIdFor = (row) => {
    if (row.districtId) return row.districtId;
    const s = row.schoolId ? schoolById.get(row.schoolId) : null;
    return (s && s.district) || null;
  };
  const schoolName = (id, fallback) => {
    const s = id ? schoolById.get(id) : null;
    return (s && s.name) || fallback || '';
  };
  const districtName = (id, fallback) => {
    const d = id ? districtById.get(id) : null;
    return (d && d.name) || fallback || '';
  };
  const defaultPayFor = (c) => (c && c.rates && Number.isFinite(Number(c.rates.hourly)))
    ? Number(c.rates.hourly) : 0;
  const autoIndirect = window.AssignmentsStore && window.AssignmentsStore.autoIndirect
    ? window.AssignmentsStore.autoIndirect : (() => 0);

  // Persisted rows first so they're easy to spot in debugging; the page
  // re-sorts anyway.
  for (const a of (Array.isArray(persisted) ? persisted : [])) {
    const c = enrichedById.get(a.contractorId) || null;
    const spec = a.spec || (c && c.spec) || '';
    const direct = Number(a.directHours) || 0;
    const indirect = a.indirectOverride
      ? (Number(a.indirectHours) || 0)
      : autoIndirect(direct, spec);
    const districtId = a.districtId || districtIdFor({ schoolId: a.schoolId }) || null;
    out.push({
      key: 's:' + a.id,
      _id: a.id,
      source: 'supabase',
      contractorId: a.contractorId,
      contractorName: (c && c.name) || a.contractorName || '',
      spec,
      schoolId: a.schoolId || null,
      schoolName: schoolName(a.schoolId, a.schoolName),
      districtId,
      districtName: districtName(districtId, a.districtName),
      state: '',
      direct, indirect,
      indirectOverride: !!a.indirectOverride,
      payRate: a.payRate != null ? Number(a.payRate) : null,
      defaultPay: defaultPayFor(c),
      startDate: a.startDate || '',
      endDate: a.endDate || null,
      status: a.status || 'active',
      attachmentCount: Array.isArray(a.attachments) ? a.attachments.length : 0,
    });
  }

  for (const c of enrichedById.values()) {
    const mocks = Array.isArray(c.assignments) ? c.assignments : [];
    mocks.forEach((m, i) => {
      if (!m) return;
      const districtId = m.districtId || districtIdFor({ schoolId: m.schoolId }) || null;
      const direct = Number(m.direct) || 0;
      const indirect = Number(m.indirect) || 0;
      const fallback = Number(m.hoursPerWeek) || 0;
      out.push({
        key: 'm:' + c.id + ':' + (m.schoolId || 'x') + ':' + (m.startDate || '') + ':' + i,
        _id: null,
        source: 'mock',
        contractorId: c.id,
        contractorName: c.name || '',
        spec: m.spec || c.spec || '',
        schoolId: m.schoolId || null,
        schoolName: schoolName(m.schoolId, m.school),
        districtId,
        districtName: districtName(districtId, m.district),
        state: m.state || '',
        direct: (direct || indirect) ? direct : fallback,
        indirect,
        indirectOverride: false,
        payRate: null,
        defaultPay: defaultPayFor(c),
        startDate: m.startDate || '',
        endDate: m.endDate || null,
        status: m.status || 'active',
        attachmentCount: 0,
      });
    });
  }
  return out;
};

// Hook form of the above. Subscribes to every store that can change a
// row's name, hours, or money so the page re-renders on teammate edits:
// assignments, the contractor catalog, contractor overrides (renames +
// pay), spec settings (indirect ratio), district rate cards (bill), and
// school / district overrides (renames).
window.useAllAssignments = function useAllAssignments() {
  const persisted = window.useAssignments();
  const contractors = window.useContractors
    ? window.useContractors()
    : ((window.RCIS_DATA && window.RCIS_DATA.CONTRACTORS) || []);
  const overrides = window.useContractorOverrides ? window.useContractorOverrides() : null;
  const specSettings = window.useSpecSettings ? window.useSpecSettings() : null;
  const rateCards = window.useDistrictRateCards ? window.useDistrictRateCards() : null;
  const schoolOv = window.useSchoolOverrides ? window.useSchoolOverrides() : null;
  const districtOv = window.useDistrictOverrides ? window.useDistrictOverrides() : null;
  return React.useMemo(
    () => window.allAssignmentRows(persisted, contractors, overrides || undefined),
    [persisted, contractors, overrides, specSettings, rateCards, schoolOv, districtOv],
  );
};
