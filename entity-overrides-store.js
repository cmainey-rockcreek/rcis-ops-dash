// SchoolOverridesStore + DistrictOverridesStore — per-record edits on top
// of the mock defaults in data.js / data-schools.js. Same pattern as
// ContractorOverridesStore.
//
// Exposes:
//   window.SchoolOverridesStore  / window.useSchoolOverrides()
//   window.DistrictOverridesStore / window.useDistrictOverrides()
//   window.useSchoolView(s)       window.useDistrictView(d)
//   window.useSchoolsView(rows)   window.useDistrictsView(rows)
//   window.applySchoolOverride(s, map?)
//   window.applyDistrictOverride(d, map?)
//   window.schoolDisplayName(id)
//   window.districtDisplayName(id)

(function () {
  function makeStore({ cacheKey, table, fromRow, toRow, channelName, primaryKey }) {
    let state = {};
    try { state = JSON.parse(localStorage.getItem(cacheKey) || '{}'); } catch (e) {}

    const listeners = new Set();
    const emit = () => listeners.forEach((fn) => fn(state));
    function setState(next) {
      state = next;
      try { localStorage.setItem(cacheKey, JSON.stringify(state)); } catch (e) {}
      emit();
    }

    async function load() {
      if (!window.sb) return;
      const { data, error } = await window.sb.from(table).select('*');
      if (error) { console.warn(`${table} load failed`, error); return; }
      const next = {};
      (data || []).forEach((r) => { const o = fromRow(r); next[o[primaryKey]] = o; });
      setState(next);
    }

    let channel = null;
    function subscribeRealtime() {
      if (!window.sb || channel) return;
      channel = window.sb.channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
          if (payload.eventType === 'DELETE') {
            const next = { ...state };
            delete next[payload.old[primaryKey === 'schoolId' ? 'school_id' : 'district_id']];
            setState(next);
          } else {
            const row = fromRow(payload.new);
            setState({ ...state, [row[primaryKey]]: row });
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

    return {
      get() { return state; },
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      forId(id) { return state[id] || null; },
      async upsert(id, patch) {
        if (!id) return;
        const existing = state[id] || { [primaryKey]: id };
        const next = { ...existing, ...patch, [primaryKey]: id };
        setState({ ...state, [id]: next });
        const row = toRow(next);
        const { error } = await window.sb.from(table)
          .upsert(row, { onConflict: primaryKey === 'schoolId' ? 'school_id' : 'district_id' });
        if (error) console.warn(`${table}.upsert`, error);
      },
      reload: load,
    };
  }

  // ─── School overrides ───────────────────────────────────────────────────
  window.SchoolOverridesStore = makeStore({
    cacheKey: 'rcis.school_overrides.cache.v1',
    table: 'school_overrides',
    channelName: 'rcis-school-overrides',
    primaryKey: 'schoolId',
    fromRow(r) {
      return {
        schoolId: r.school_id,
        name: r.name || null,
        address: r.address || null,
        mainPhone: r.main_phone || null,
        gradeBand: r.grade_band || null,
        students: r.students != null ? Number(r.students) : null,
        updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
      };
    },
    toRow(o) {
      return {
        school_id: o.schoolId,
        name: o.name || null,
        address: o.address || null,
        main_phone: o.mainPhone || null,
        grade_band: o.gradeBand || null,
        students: o.students != null ? o.students : null,
      };
    },
  });

  // ─── District overrides ────────────────────────────────────────────────
  window.DistrictOverridesStore = makeStore({
    cacheKey: 'rcis.district_overrides.cache.v1',
    table: 'district_overrides',
    channelName: 'rcis-district-overrides',
    primaryKey: 'districtId',
    fromRow(r) {
      return {
        districtId: r.district_id,
        name: r.name || null,
        updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
      };
    },
    toRow(o) {
      return {
        district_id: o.districtId,
        name: o.name || null,
      };
    },
  });

  // ─── React hooks ───────────────────────────────────────────────────────
  window.useSchoolOverrides = function useSchoolOverrides() {
    const [s, setS] = React.useState(window.SchoolOverridesStore.get());
    React.useEffect(() => window.SchoolOverridesStore.subscribe(setS), []);
    return s;
  };
  window.useDistrictOverrides = function useDistrictOverrides() {
    const [s, setS] = React.useState(window.DistrictOverridesStore.get());
    React.useEffect(() => window.DistrictOverridesStore.subscribe(setS), []);
    return s;
  };

  // Apply a school override row onto a mock school object.
  window.applySchoolOverride = function applySchoolOverride(s, overridesMap) {
    if (!s) return s;
    const all = overridesMap || (window.SchoolOverridesStore && window.SchoolOverridesStore.get()) || {};
    const o = all[s.id];
    if (!o) return s;
    return {
      ...s,
      name:      o.name      != null ? o.name      : s.name,
      address:   o.address   != null ? o.address   : s.address,
      mainPhone: o.mainPhone != null ? o.mainPhone : s.mainPhone,
      gradeBand: o.gradeBand != null ? o.gradeBand : s.gradeBand,
      students:  o.students  != null ? o.students  : s.students,
    };
  };
  window.applyDistrictOverride = function applyDistrictOverride(d, overridesMap) {
    if (!d) return d;
    const all = overridesMap || (window.DistrictOverridesStore && window.DistrictOverridesStore.get()) || {};
    const o = all[d.id];
    if (!o) return d;
    return {
      ...d,
      name: o.name != null ? o.name : d.name,
    };
  };

  // Single + bulk view hooks (mirror useContractorView / useContractorsView).
  window.useSchoolView = function useSchoolView(s) {
    const all = window.useSchoolOverrides();
    return React.useMemo(() => window.applySchoolOverride(s, all), [s, all]);
  };
  window.useDistrictView = function useDistrictView(d) {
    const all = window.useDistrictOverrides();
    return React.useMemo(() => window.applyDistrictOverride(d, all), [d, all]);
  };
  window.useSchoolsView = function useSchoolsView(rows) {
    const all = window.useSchoolOverrides();
    return React.useMemo(() => {
      if (!Array.isArray(rows)) return rows;
      return rows.map((s) => window.applySchoolOverride(s, all));
    }, [rows, all]);
  };
  window.useDistrictsView = function useDistrictsView(rows) {
    const all = window.useDistrictOverrides();
    return React.useMemo(() => {
      if (!Array.isArray(rows)) return rows;
      return rows.map((d) => window.applyDistrictOverride(d, all));
    }, [rows, all]);
  };

  // Live display-name lookups. Used by resolveLinkedName so renames
  // propagate to task chips, etc.
  window.schoolDisplayName = function schoolDisplayName(id) {
    const base = (window.RCIS_DATA && window.RCIS_DATA.SCHOOLS || []).find((x) => x.id === id);
    if (!base) return null;
    const enriched = window.applySchoolOverride(base);
    return enriched ? enriched.name : null;
  };
  window.districtDisplayName = function districtDisplayName(id) {
    const base = (window.RCIS_DATA && window.RCIS_DATA.DISTRICTS || []).find((x) => x.id === id);
    if (!base) return null;
    const enriched = window.applyDistrictOverride(base);
    return enriched ? enriched.name : null;
  };
})();
