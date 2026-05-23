// Contractors — list view + detail view.
//
// Routes:
//   /contractors        → list (search, filter, sort, click row)
//   /contractors/:id    → detail (header, schedule, assignments, licenses,
//                          documents, linked todos, notes)
//
// Same Calm Ops palette/shell as the dashboard.

(function () {
  const { OwnerAvatar, SpecChip, StatusPill, CapacityBar, Icon, useRoute, navigate } = window;

  // ─── List Page ────────────────────────────────────────────────────────────
  function ContractorsListPage({ dark = false }) {
    return (
      <window.PageShell dark={dark} activePage="contractors"
                        searchPlaceholder="Search contractors by name, specialty, state…">
        {(pal) => <ContractorsList pal={pal} />}
      </window.PageShell>
    );
  }

  function ContractorsList({ pal }) {
    const [query, setQuery] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState('all');
    const [specFilter, setSpecFilter] = React.useState('all');
    const [openTodosOnly, setOpenTodosOnly] = React.useState(false);
    const [sort, setSort] = React.useState({ key: 'name', dir: 'asc' });
    const [creating, setCreating] = React.useState(false);
    const todos = window.useTodos();

    // Subscribe so newly-created user contractors appear without a refresh.
    const liveCatalog = window.useContractors ? window.useContractors() : window.RCIS_DATA.CONTRACTORS;

    // Set of contractor ids with at least one OPEN (non-done) linked todo.
    const idsWithOpenTodos = React.useMemo(() => {
      const s = new Set();
      for (const t of todos) {
        if (t.column !== 'done' && t.linkedTo && t.linkedTo.type === 'contractor') {
          s.add(t.linkedTo.id);
        }
      }
      return s;
    }, [todos]);

    // Apply contractor_overrides so renames / contact edits show up in
    // the list. Falls back to mock when no override exists.
    const enriched = window.useContractorsView
      ? window.useContractorsView(liveCatalog)
      : liveCatalog;
    // Live booked hours per contractor — replaces the stale c.assigned
    // snapshot so user-created contractors and over-cap contractors render
    // their real load.
    const persistedAssignments = window.useAssignments ? window.useAssignments() : [];
    const bookedById = React.useMemo(() => {
      const out = new Map();
      for (const c of enriched) {
        out.set(c.id, window.bookedHoursFor
          ? window.bookedHoursFor(c, persistedAssignments)
          : (Number(c.assigned) || 0));
      }
      return out;
    }, [enriched, persistedAssignments]);

    const sortedFiltered = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      let rows = enriched.filter((c) => {
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        if (specFilter !== 'all' && c.spec !== specFilter) return false;
        if (openTodosOnly && !idsWithOpenTodos.has(c.id)) return false;
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.spec.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.states.join(',').toLowerCase().includes(q)
        );
      });
      const dirMul = sort.dir === 'asc' ? 1 : -1;
      const accessor = {
        name:   (c) => c.name,
        spec:   (c) => c.spec,
        states: (c) => c.states.join(','),
        load:   (c) => (bookedById.get(c.id) || 0) / Math.max(1, c.cap),
        status: (c) => c.status,
      }[sort.key] || ((c) => c.name);
      rows = [...rows].sort((a, b) => {
        const av = accessor(a), bv = accessor(b);
        if (av < bv) return -dirMul;
        if (av > bv) return  dirMul;
        return 0;
      });
      return rows;
    }, [enriched, query, statusFilter, specFilter, openTodosOnly, sort, idsWithOpenTodos, bookedById]);

    const STATUS_OPTS = [
      { key: 'all',     label: 'All',       color: pal.textSoft },
      { key: 'avail',   label: 'Available', color: '#3E8A57' },
      { key: 'partial', label: 'Partial',   color: '#C98A2C' },
      { key: 'full',    label: 'Full',      color: '#C04E40' },
      { key: 'pto',     label: 'PTO',       color: '#5A6478' },
    ];
    const SPEC_OPTS = [
      { key: 'all', label: 'All' },
      ...window.RCIS_DATA.SPECIALTIES.map((s) => ({ key: s.code, label: s.code, color: s.color })),
    ];

    return (
      <div style={{
        flex: 1, padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: pal.text, letterSpacing: -0.3 }}>Contractors</h1>
          <span style={{ fontSize: 13, color: pal.textSoft }}>
            {sortedFiltered.length} of {window.RCIS_DATA.CONTRACTORS.length}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={btnSecondary(pal)}>
              <Icon name="filter" size={13} stroke={1.8} /> Export CSV
            </button>
            <button onClick={() => setCreating(true)} style={btnPrimary(pal)}>
              <Icon name="plus" size={13} stroke={2.4} /> New contractor
            </button>
          </div>
        </div>

        {/* Filter row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px',
            background: pal.card, border: `1px solid ${pal.border}`,
            borderRadius: 9,
          }}>
            <Icon name="search" size={15} color={pal.textFaint} stroke={1.8} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
                   placeholder="Search by name, specialty, state, email…"
                   style={{
                     flex: 1, border: 'none', outline: 'none',
                     background: 'transparent', color: pal.text,
                     fontSize: 13, fontFamily: 'inherit',
                   }} />
            {query && (
              <button onClick={() => setQuery('')} style={{
                border: 'none', background: 'transparent', color: pal.textFaint,
                cursor: 'pointer', fontSize: 14, padding: '0 4px',
              }}>×</button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <FilterGroup pal={pal} label="Status" options={STATUS_OPTS}
                         value={statusFilter} onChange={setStatusFilter} />
            <FilterGroup pal={pal} label="Specialty" options={SPEC_OPTS}
                         value={specFilter} onChange={setSpecFilter} />
            <button onClick={() => setOpenTodosOnly((v) => !v)} style={{
              padding: '4px 10px', borderRadius: 999,
              border: `1px solid ${openTodosOnly ? pal.accent : pal.border}`,
              background: openTodosOnly ? pal.accentSoft : 'transparent',
              color: openTodosOnly ? pal.accent : pal.textSoft,
              fontSize: 11.5, fontWeight: openTodosOnly ? 600 : 500,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <Icon name="list" size={11} stroke={2} />
              With open todos
              <span style={{
                fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                color: openTodosOnly ? pal.accent : pal.textFaint,
              }}>{idsWithOpenTodos.size}</span>
            </button>
          </div>
        </div>

        {/* Table — its own scroll container so the header + filters stay
            put while you page through long contractor lists. */}
        <div style={{
          background: pal.card, border: `1px solid ${pal.border}`,
          borderRadius: 10,
          flex: 1, minHeight: 0,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '28px 1.8fr 60px 80px 1.5fr 110px',
            gap: 12, alignItems: 'center',
            padding: '10px 14px',
            background: pal.cardAlt,
            borderBottom: `1px solid ${pal.border}`,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
            color: pal.textFaint, textTransform: 'uppercase',
            flexShrink: 0,
          }}>
            <span />
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="name"   label="Name" />
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="spec"   label="Spec" />
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="states" label="States" />
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="load"   label="Capacity" />
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="status" label="Status" />
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {sortedFiltered.length === 0 ? (
              <div style={{
                padding: '40px 14px', textAlign: 'center',
                color: pal.textFaint, fontSize: 13,
              }}>No contractors match your filters.</div>
            ) : (
              sortedFiltered.map((c) => (
                <ContractorRow key={c.id} c={c} pal={pal} booked={bookedById.get(c.id) || 0} />
              ))
            )}
          </div>
        </div>

        {creating && (
          <NewContractorEditor pal={pal}
            onClose={() => setCreating(false)}
            onSave={async (draft) => {
              const created = await window.ContractorsStore.add(draft);
              setCreating(false);
              if (created && created.id) window.navigate(`/contractors/${created.id}`);
            }}
          />
        )}
      </div>
    );
  }

  // ─── New contractor modal ─────────────────────────────────────────────────
  // Captures the identity + rate defaults a new contractor needs to show up
  // in the list, Matchmaker, and Net Margin math. Editable fields (rate
  // tweaks, schedule, contact) continue to flow through contractor_overrides
  // once the record exists, so this modal is intentionally minimal.
  function NewContractorEditor({ pal, onSave, onClose }) {
    const SPECIALTIES = (window.RCIS_DATA && window.RCIS_DATA.SPECIALTIES) || [];
    const STATE_OPTS = ['VA','MD','DC','NC','SC','PA','TN','GA','FL','OH','NY','TX','CA'];
    const [draft, setDraft] = React.useState({
      name: '',
      spec: '',
      cap: 30,
      states: [],
      city: '',
      email: '',
      phone: '',
      payRate: '',
    });
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
      const onKey = (e) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
    const toggleState = (st) => set({
      states: draft.states.includes(st)
        ? draft.states.filter((x) => x !== st)
        : [...draft.states, st],
    });

    const canSave = draft.name.trim().length > 0 && draft.spec.length > 0 && !saving;
    const submit = async () => {
      if (!canSave) return;
      setSaving(true);
      try {
        await onSave({
          name: draft.name.trim(),
          spec: draft.spec,
          cap: Number(draft.cap) || 30,
          states: draft.states,
          city: draft.city.trim() || '',
          email: draft.email.trim() || '',
          phone: draft.phone.trim() || '',
          rates: {
            hourly: draft.payRate !== '' ? Number(draft.payRate) : 0,
          },
        });
      } finally { setSaving(false); }
    };

    const labelStyle = {
      fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: pal.textFaint,
      textTransform: 'uppercase', marginBottom: 4,
    };
    const inputStyle = {
      width: '100%', padding: '7px 10px',
      fontSize: 13, color: pal.text, background: pal.cardAlt,
      border: `1px solid ${pal.border}`, borderRadius: 6,
      outline: 'none', fontFamily: 'inherit',
    };

    return (
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(16,18,22,.55)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40,
      }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          background: pal.card, color: pal.text,
          borderRadius: 12, width: '100%', maxWidth: 520,
          boxShadow: '0 30px 80px rgba(0,0,0,.35), 0 0 0 1px ' + pal.border,
          display: 'flex', flexDirection: 'column',
          fontFamily: '"Public Sans", system-ui, sans-serif',
        }}>
          <div style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${pal.border}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: pal.text }}>
              New contractor
            </div>
            <button onClick={onClose} style={{
              border: 'none', background: 'transparent', color: pal.textFaint,
              cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 4px',
            }}>×</button>
          </div>

          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={labelStyle}>Name *</div>
              <input autoFocus value={draft.name} style={inputStyle}
                placeholder="First Last"
                onChange={(e) => set({ name: e.target.value })} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 80px', gap: 12 }}>
              <div>
                <div style={labelStyle}>Specialty *</div>
                <select value={draft.spec} style={inputStyle}
                  onChange={(e) => set({ spec: e.target.value })}>
                  <option value="">— Pick a specialty —</option>
                  {SPECIALTIES.map((sp) => (
                    <option key={sp.code} value={sp.code}>{sp.code} — {sp.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={labelStyle}>Cap (hrs/wk)</div>
                <input type="number" min="0" step="1" value={draft.cap} style={inputStyle}
                  onChange={(e) => set({ cap: e.target.value })} />
              </div>
            </div>

            <div>
              <div style={labelStyle}>Pay rate ($/hr)</div>
              <input type="number" min="0" step="1" value={draft.payRate} style={inputStyle}
                placeholder="e.g. 70"
                onChange={(e) => set({ payRate: e.target.value })} />
              <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 4 }}>
                Bill rate is set per district on the district profile.
              </div>
            </div>

            <div>
              <div style={labelStyle}>Licensed states</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {STATE_OPTS.map((st) => {
                  const on = draft.states.includes(st);
                  return (
                    <button key={st} onClick={() => toggleState(st)} style={{
                      padding: '4px 10px', borderRadius: 999,
                      border: `1px solid ${on ? pal.accent : pal.border}`,
                      background: on ? pal.accentSoft : 'transparent',
                      color: on ? pal.accent : pal.textSoft,
                      fontSize: 12, fontWeight: on ? 600 : 500,
                      fontFamily: 'ui-monospace, monospace',
                      cursor: 'pointer',
                    }}>{st}</button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={labelStyle}>City</div>
                <input value={draft.city} style={inputStyle}
                  placeholder="Optional"
                  onChange={(e) => set({ city: e.target.value })} />
              </div>
              <div>
                <div style={labelStyle}>Email</div>
                <input value={draft.email} style={inputStyle}
                  placeholder="Optional"
                  onChange={(e) => set({ email: e.target.value })} />
              </div>
            </div>

            <div>
              <div style={labelStyle}>Phone</div>
              <input value={draft.phone} style={inputStyle}
                placeholder="Optional"
                onChange={(e) => set({ phone: e.target.value })} />
            </div>
          </div>

          <div style={{
            padding: '12px 18px',
            borderTop: `1px solid ${pal.border}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 11.5, color: pal.textFaint }}>
              {canSave ? '' : 'Name + specialty required'}
            </span>
            <span style={{ marginLeft: 'auto' }} />
            <button onClick={onClose} style={btnSecondary(pal)}>Cancel</button>
            <button onClick={submit} disabled={!canSave} style={{
              ...btnPrimary(pal),
              background: canSave ? pal.accent : pal.chipBg,
              color: canSave ? '#fff' : pal.textFaint,
              cursor: canSave ? 'pointer' : 'default',
            }}>{saving ? 'Saving…' : 'Create contractor'}</button>
          </div>
        </div>
      </div>
    );
  }

  function ContractorRow({ c, pal, booked }) {
    const cap = Number(c.cap) || 0;
    const bookedNum = Number.isFinite(booked) ? booked : (Number(c.assigned) || 0);
    const free = Math.max(0, cap - bookedNum);
    const over = bookedNum > cap ? (bookedNum - cap) : 0;
    const initials = c.name.split(' ').map((p) => p[0]).join('').slice(0, 2);
    return (
      <window.Link to={`/contractors/${c.id}`} style={{
        display: 'grid',
        gridTemplateColumns: '28px 1.8fr 60px 80px 1.5fr 110px',
        gap: 12, alignItems: 'center',
        padding: '10px 14px',
        borderBottom: `1px solid ${pal.borderSoft}`,
        textDecoration: 'none', color: 'inherit',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = pal.cardAlt}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <span style={{
          width: 28, height: 28, borderRadius: 14,
          background: window.specColor(c.spec) + '22',
          color: window.specColor(c.spec),
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, letterSpacing: 0.3, flexShrink: 0,
        }}>{initials}</span>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: pal.text, fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
          <div style={{ fontSize: 11, color: pal.textFaint, marginTop: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</div>
        </div>

        <SpecChip code={c.spec} />

        <div style={{ fontSize: 12, color: pal.textSoft, fontFamily: 'ui-monospace, monospace' }}>
          {c.states.join(', ')}
        </div>

        <div>
          <CapacityBar assigned={bookedNum} cap={cap} track={pal.chipBg} fill={pal.accent} />
          <div style={{ fontSize: 10, color: pal.textFaint, marginTop: 3,
            fontVariantNumeric: 'tabular-nums', display: 'flex', justifyContent: 'space-between' }}>
            <span>{bookedNum}/{cap}h</span>
            {over > 0
              ? <span style={{ color: pal.warn, fontWeight: 600 }}>over by {over}h</span>
              : free > 0 && <span style={{ color: pal.accent, fontWeight: 600 }}>+{free}h free</span>}
          </div>
        </div>

        <StatusPill status={c.status} compact />
      </window.Link>
    );
  }

  function SortHeader({ pal, sort, setSort, k, label, right }) {
    const active = sort.key === k;
    const onClick = () => {
      if (sort.key === k) setSort({ key: k, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
      else setSort({ key: k, dir: 'asc' });
    };
    return (
      <span onClick={onClick} style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        cursor: 'pointer',
        color: active ? pal.text : 'inherit',
        justifyContent: right ? 'flex-end' : 'flex-start',
      }}>
        {label}
        <span style={{ fontSize: 9, opacity: active ? 1 : 0.4 }}>
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '▲'}
        </span>
      </span>
    );
  }

  function FilterGroup({ pal, label, options, value, onChange }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: pal.textFaint,
          textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {options.map((opt) => {
            const on = value === opt.key;
            return (
              <button key={opt.key} onClick={() => onChange(opt.key)} style={{
                padding: '3px 9px', borderRadius: 999,
                border: `1px solid ${on ? pal.accent : pal.border}`,
                background: on ? pal.accentSoft : 'transparent',
                color: on ? pal.accent : pal.textSoft,
                fontSize: 11.5, fontWeight: on ? 600 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                {opt.color && (
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: opt.color }} />
                )}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function btnPrimary(pal) {
    return {
      height: 30, padding: '0 12px', borderRadius: 7,
      background: pal.accent, color: '#fff', border: 'none',
      fontSize: 12.5, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', gap: 5,
      cursor: 'pointer', fontFamily: 'inherit',
    };
  }
  function btnSecondary(pal) {
    return {
      height: 30, padding: '0 12px', borderRadius: 7,
      background: 'transparent', color: pal.textSoft,
      border: `1px solid ${pal.border}`,
      fontSize: 12.5, fontWeight: 500,
      display: 'inline-flex', alignItems: 'center', gap: 5,
      cursor: 'pointer', fontFamily: 'inherit',
    };
  }

  // ─── Detail Page ──────────────────────────────────────────────────────────
  function ContractorDetailPage({ dark = false, id }) {
    return (
      <window.PageShell dark={dark} activePage="contractors">
        {(pal) => <ContractorDetail pal={pal} id={id} />}
      </window.PageShell>
    );
  }

  function ContractorDetail({ pal, id }) {
    // Subscribe so newly-created contractors render the moment their store
    // load completes (otherwise navigating straight to /contractors/:id
    // right after creation would briefly hit the NotFound branch).
    if (window.useContractors) window.useContractors();
    const base = window.getContractor(id);
    // Layer Supabase overrides (pay/bill rate, edited schedule) on top of the
    // mock defaults. Persisted assignments are merged in via the AssignmentsCard.
    const c = window.useContractorView ? window.useContractorView(base) : base;
    if (!c) return <NotFound pal={pal} id={id} />;

    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Crumb */}
        <div style={{
          padding: '14px 24px 0', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: pal.textSoft,
        }}>
          <window.Link to="/contractors" style={{ color: pal.textSoft, textDecoration: 'none', fontWeight: 500 }}>
            ← Contractors
          </window.Link>
          <span style={{ color: pal.textFaint }}>/</span>
          <span style={{ color: pal.text, fontWeight: 500 }}>{c.name}</span>
        </div>

        {/* Header */}
        <ContractorHeader c={c} pal={pal} />

        <div style={{
          padding: '0 24px 32px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)',
          gap: 16,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <CapacityCard c={c} pal={pal} />
            <ScheduleCard c={c} pal={pal} />
            <AssignmentsCard c={c} pal={pal} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <LinkedTodosCard c={c} pal={pal} />
            <ContractorRenewalsCard c={c} pal={pal} kind="contractor_license"
              title="Licenses" addLabel="+ Add license" />
            <ContractorRenewalsCard c={c} pal={pal} kind="contractor_insurance"
              title="Liability insurance" addLabel="+ Add policy" />
            <ContractorRenewalsCard c={c} pal={pal} kind="contractor_background"
              title="Background check" addLabel="+ Add" />
            <DocumentsCard c={c} pal={pal} />
            <NotesCard c={c} pal={pal} />
          </div>
        </div>
      </div>
    );
  }

  function NotFound({ pal, id }) {
    return (
      <div style={{ flex: 1, padding: 40, color: pal.textSoft }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: pal.text }}>Contractor not found</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>No contractor with id <code>{id}</code>.</div>
        <window.Link to="/contractors" style={{ color: pal.accent, fontWeight: 500, marginTop: 12, display: 'inline-block' }}>← Back to contractors</window.Link>
      </div>
    );
  }

  function ContractorHeader({ c, pal }) {
    const initials = c.name.split(' ').map((p) => p[0]).join('').slice(0, 2);
    // Pull merged assignments so revenue/margin update live with edits.
    const assignments = window.useContractorAssignments
      ? window.useContractorAssignments(c)
      : (c.assignments || []);
    const F = window.ContractorFinancials || {};
    // Bill rate now flows from the district rate card per row; `pay` is
    // still a contractor-level default since the contractor's pay rate
    // does not vary by district. `spec` lets effectiveBill fall back to
    // the per-spec default when a district hasn't filled out its card.
    const defaults = { pay: c.rates && c.rates.hourly, spec: c.spec };
    // Subscribe so header KPIs re-derive when any district rate card changes.
    if (window.useDistrictRateCards) window.useDistrictRateCards();
    // Annualized at the 36-week school year — matches the Matchmaker page so
    // both views agree on what the same hours/rates earn over a contract.
    // Subscribe so Net Margin re-renders when admin edits a burden value.
    if (window.useSpecSettings) window.useSpecSettings();
    const annualRev   = F.annualRevenue ? F.annualRevenue(assignments, defaults) : 0;
    const marginHr    = F.marginPerHour ? F.marginPerHour(assignments, defaults)  : 0;
    const netMarginHr = F.netMarginPerHour ? F.netMarginPerHour(assignments, defaults) : marginHr;
    const fmt         = F.formatUSD || ((n) => `$${(n || 0).toLocaleString()}`);
    // Live booked hours from active mock + persisted rows — replaces the
    // stale c.assigned mock snapshot so the Load KPI matches the
    // CapacityCard below and the contractors-list capacity bar.
    const booked = F.activeRows && F.weeklyHours
      ? F.activeRows(assignments).reduce((s, a) => s + F.weeklyHours(a), 0)
      : (Number(c.assigned) || 0);
    return (
      <div style={{ padding: '14px 24px 4px', display: 'flex', alignItems: 'flex-start', gap: 18 }}>
        <span style={{
          width: 54, height: 54, borderRadius: 27,
          background: window.specColor(c.spec),
          color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, letterSpacing: 0.3, flexShrink: 0,
        }}>{initials}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <EditableContractorName pal={pal} value={c.name}
              onSave={(v) => window.ContractorOverridesStore.upsert(c.id, { name: v })} />
            <SpecChip code={c.spec} size="lg" />
            <StatusPill status={c.status} />
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 18,
            marginTop: 6, fontSize: 12.5, color: pal.textSoft,
          }}>
            <EditableContactField pal={pal} icon="user" placeholder="Add email"
              value={c.email}
              onSave={(v) => window.ContractorOverridesStore.upsert(c.id, { email: v })} />
            <EditableContactField pal={pal} icon="user" placeholder="Add phone"
              value={c.phone}
              onSave={(v) => window.ContractorOverridesStore.upsert(c.id, { phone: v })} />
            <EditableContactField pal={pal} icon="map" placeholder="Add city"
              value={c.city}
              onSave={(v) => window.ContractorOverridesStore.upsert(c.id, { city: v })} />
            <Field label="NPI" value={c.npi} pal={pal} />
            <Field label="Hired" value={formatDate(c.hireDate)} pal={pal} />
            <Field label="Schools" value={`${c.schools}`} pal={pal} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{
            display: 'flex', gap: 18, padding: '10px 14px',
            background: pal.card, border: `1px solid ${pal.border}`, borderRadius: 9,
          }}>
            <EditableRateKpi pal={pal} label="Pay Rate"
              value={c.rates.hourly}
              onSave={(v) => window.ContractorOverridesStore.upsert(c.id, { payRate: v })} />
            <Kpi pal={pal} label="Load"     value={`${booked}h`}     sub={`of ${c.cap}h`} />
            <Kpi pal={pal} label="Revenue"     value={fmt(annualRev)} sub="/year"
                 valueColor={pal.accent} />
            <Kpi pal={pal} label="Gross Margin" value={fmt(marginHr, { cents: true })} sub="/hour"
                 valueColor={marginHr >= 0 ? pal.text : pal.warn} />
            <Kpi pal={pal} label="Net Margin"   value={fmt(netMarginHr, { cents: true })} sub="/hour"
                 valueColor={netMarginHr >= 0 ? pal.text : pal.warn} />
          </div>
        </div>
      </div>
    );
  }

  // Inline-editable pay/bill rate cell. Click value to edit; Enter/blur saves.
  function EditableRateKpi({ pal, label, value, onSave }) {
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(String(value || ''));
    const inputRef = React.useRef(null);

    React.useEffect(() => {
      if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
    }, [editing]);

    const startEdit = () => { setDraft(String(value || '')); setEditing(true); };
    const commit = () => {
      const num = Number(draft);
      if (Number.isFinite(num) && num !== Number(value)) onSave(num);
      setEditing(false);
    };
    const cancel = () => setEditing(false);
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    };

    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, color: pal.textFaint, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, justifyContent: 'center' }}>
          {editing ? (
            <>
              <span style={{ fontSize: 13, color: pal.textFaint }}>$</span>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ''))}
                onBlur={commit}
                onKeyDown={onKey}
                style={{
                  width: 56, padding: '0 4px',
                  background: pal.cardAlt, border: `1px solid ${pal.accent}`, borderRadius: 5,
                  color: pal.text, fontFamily: 'inherit',
                  fontSize: 17, fontWeight: 600,
                  letterSpacing: -0.3, fontVariantNumeric: 'tabular-nums',
                  textAlign: 'center', outline: 'none',
                }}
              />
              <span style={{ fontSize: 10, color: pal.textFaint }}>/hour</span>
            </>
          ) : (
            <>
              <span onClick={startEdit}
                title="Click to edit"
                style={{
                  fontSize: 17, fontWeight: 600, color: pal.text,
                  letterSpacing: -0.3, fontVariantNumeric: 'tabular-nums',
                  cursor: 'pointer', borderBottom: `1px dashed ${pal.borderSoft}`,
                  paddingBottom: 1,
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderBottomColor = pal.accent}
                onMouseLeave={(e) => e.currentTarget.style.borderBottomColor = pal.borderSoft}>
                ${value}
              </span>
              <span style={{ fontSize: 10, color: pal.textFaint }}>/hour</span>
            </>
          )}
        </div>
      </div>
    );
  }
  function Field({ icon, label, value, pal }) {
    if (value) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: pal && pal.textFaint, textTransform: 'uppercase' }}>{label}</span>
          <span style={{ color: pal && pal.text, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {icon && <Icon name={icon} size={12} stroke={1.8} />}
        {label}
      </span>
    );
  }

  // Inline-editable contact field used in the contractor header. Click to
  // edit, Enter or blur to save, Escape to cancel.
  function EditableContactField({ pal, icon, value, placeholder, onSave }) {
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(value || '');
    const inputRef = React.useRef(null);

    React.useEffect(() => {
      if (editing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [editing]);

    const startEdit = () => { setDraft(value || ''); setEditing(true); };
    const commit = () => {
      const next = draft.trim();
      if (next !== (value || '').trim()) onSave(next || null);
      setEditing(false);
    };
    const cancel = () => { setDraft(value || ''); setEditing(false); };
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    };

    if (editing) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {icon && <Icon name={icon} size={12} stroke={1.8} />}
          <input
            ref={inputRef}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKey}
            style={{
              padding: '1px 5px',
              fontSize: 12.5, color: pal.text,
              background: pal.cardAlt,
              border: `1px solid ${pal.accent}`, borderRadius: 4,
              outline: 'none', fontFamily: 'inherit',
              minWidth: 140,
            }}
          />
        </span>
      );
    }

    const display = value && value.trim().length > 0;
    return (
      <span onClick={startEdit}
        title="Click to edit"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          cursor: 'pointer',
          borderBottom: `1px dashed transparent`,
          paddingBottom: 1,
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderBottomColor = pal.borderSoft}
        onMouseLeave={(e) => e.currentTarget.style.borderBottomColor = 'transparent'}>
        {icon && <Icon name={icon} size={12} stroke={1.8} />}
        <span style={{ color: display ? 'inherit' : pal.textFaint, fontStyle: display ? 'normal' : 'italic' }}>
          {display ? value : placeholder}
        </span>
      </span>
    );
  }

  // Editable contractor name (h1 in the header). Same click-to-edit pattern
  // as EditableContactField but styled like a heading; refuses to save empty.
  function EditableContractorName({ pal, value, onSave }) {
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(value || '');
    const inputRef = React.useRef(null);

    React.useEffect(() => {
      if (editing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [editing]);

    const startEdit = () => { setDraft(value || ''); setEditing(true); };
    const commit = () => {
      const next = draft.trim();
      if (!next) { setEditing(false); return; }   // never save blank
      if (next !== (value || '').trim()) onSave(next);
      setEditing(false);
    };
    const cancel = () => { setDraft(value || ''); setEditing(false); };
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    };

    if (editing) {
      return (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          style={{
            margin: 0,
            padding: '2px 6px',
            fontSize: 22, fontWeight: 600, color: pal.text,
            letterSpacing: -0.3,
            background: pal.cardAlt,
            border: `1px solid ${pal.accent}`, borderRadius: 6,
            outline: 'none', fontFamily: 'inherit',
            minWidth: 260,
          }}
        />
      );
    }
    return (
      <h1 onClick={startEdit}
        title="Click to edit"
        style={{
          margin: 0,
          fontSize: 22, fontWeight: 600, color: pal.text, letterSpacing: -0.3,
          cursor: 'pointer',
          borderBottom: `1px dashed transparent`,
          paddingBottom: 1,
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderBottomColor = pal.borderSoft}
        onMouseLeave={(e) => e.currentTarget.style.borderBottomColor = 'transparent'}>
        {value || 'Unnamed contractor'}
      </h1>
    );
  }
  function Kpi({ pal, label, value, sub, valueColor }) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, color: pal.textFaint, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, justifyContent: 'center' }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: valueColor || pal.text, letterSpacing: -0.3, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
          {sub && <span style={{ fontSize: 10, color: pal.textFaint }}>{sub}</span>}
        </div>
      </div>
    );
  }

  // Generic section card
  function Section({ pal, title, badge, action, children }) {
    return (
      <div style={{
        background: pal.card, border: `1px solid ${pal.border}`,
        borderRadius: 10, padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: pal.text, letterSpacing: 0 }}>{title}</h3>
          {badge != null && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: pal.textSoft,
              background: pal.chipBg, padding: '1px 7px', borderRadius: 10,
              fontVariantNumeric: 'tabular-nums',
            }}>{badge}</span>
          )}
          {action && <span style={{ marginLeft: 'auto', fontSize: 12, color: pal.accent, cursor: 'pointer', fontWeight: 500 }}>{action}</span>}
        </div>
        {children}
      </div>
    );
  }

  // Capacity summary — sums merged active assignments (mock + persisted) so
  // adding a new assignment via "+ Add assignment" immediately updates the
  // direct/indirect totals and the capacity bar. Booked hours is the sum
  // across both sources (no longer adds c.assigned — that's the stale mock
  // snapshot, and persisted rows would double-count otherwise).
  function CapacityCard({ c, pal }) {
    const all = window.useContractorAssignments
      ? window.useContractorAssignments(c)
      : (c.assignments || []);
    const activeRows = all.filter((a) => a.status === 'active');
    const directTotal   = activeRows.reduce((s, a) => s + (Number(a.direct)   || 0), 0);
    const indirectTotal = activeRows.reduce((s, a) => s + (Number(a.indirect) || 0), 0);
    const schoolsCount  = new Set(activeRows.map((a) => a.schoolId || a.school || a.districtId || '')).size;
    const booked = directTotal + indirectTotal;
    const pct = c.cap > 0 ? Math.round((booked / c.cap) * 100) : 0;
    return (
      <Section pal={pal} title="Capacity this week">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <CapacityBar assigned={booked} cap={c.cap} height={10} track={pal.chipBg} fill={pal.accent} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, color: pal.textSoft, fontVariantNumeric: 'tabular-nums' }}>
              <span><b style={{ color: pal.text, fontWeight: 600 }}>{booked}h</b> booked of {c.cap}h cap</span>
              <span style={{ color: pal.accent, fontWeight: 600 }}>{pct}%</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, paddingTop: 8, borderTop: `1px solid ${pal.borderSoft}` }}>
          <SplitStat pal={pal} label="Direct therapy" value={`${directTotal}h`} note="face-to-face with students" color={pal.accent} />
          <SplitStat pal={pal} label="Indirect time"  value={`${indirectTotal}h`} note="paperwork, meetings, prep" color="#C98A2C" />
          <SplitStat pal={pal} label="Schools"        value={schoolsCount || c.schools} note="active assignments" />
        </div>
      </Section>
    );
  }
  function SplitStat({ pal, label, value, note, color }) {
    return (
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          {color && <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />}
          <span style={{ fontSize: 15, fontWeight: 600, color: pal.text, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
          <span style={{ fontSize: 11, color: pal.textFaint, fontWeight: 500 }}>{label}</span>
        </div>
        {note && <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 1 }}>{note}</div>}
      </div>
    );
  }

  // ─── Schedule (slot-based, week-navigable) ───────────────────────────────
  // Each scheduled time block is a row in schedule_slots: contractor + exact
  // date + start/end time + optional assignment_id. The card shows the week
  // currently in view, bucketing slots into AM/Mid/PM/Late columns for a
  // quick read. The data model is row-per-slot so a CSV/XLS import lands as
  // straight inserts when we wire that path in.
  const SCHEDULE_DAYS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const SCHEDULE_BLOCKS = [
    { key: 'AM',   label: 'AM',   range: '8–11',  start: '08:00', end: '11:00' },
    { key: 'Mid',  label: 'Mid',  range: '11–1',  start: '11:00', end: '13:00' },
    { key: 'PM',   label: 'PM',   range: '1–4',   start: '13:00', end: '16:00' },
    { key: 'Late', label: 'Late', range: '4–6',   start: '16:00', end: '18:00' },
  ];

  function ScheduleCard({ c, pal }) {
    const [weekStartIso, setWeekStartIso] = React.useState(() =>
      window.SchedDates.dateToIso(window.SchedDates.startOfWeek(new Date())));
    const slots = window.useScheduleSlots ? window.useScheduleSlots(c.id) : [];
    const weekStartDate = window.SchedDates.isoToDate(weekStartIso);
    const weekEndDate   = window.SchedDates.addDays(weekStartDate, 4);

    const weekSlots = React.useMemo(() => {
      const endIso = window.SchedDates.dateToIso(window.SchedDates.addDays(weekStartDate, 5));
      return slots.filter((s) => s.slotDate >= weekStartIso && s.slotDate < endIso);
    }, [slots, weekStartIso]);

    const allAssignments = window.useContractorAssignments
      ? window.useContractorAssignments(c)
      : (c.assignments || []);
    const activeAssignments = React.useMemo(
      () => allAssignments.filter((a) => a.status === 'active' && a.source === 'supabase'),
      [allAssignments]);

    const [editor, setEditor] = React.useState(null);
    const openNew = (dayIdx, blockIdx) => {
      const block = SCHEDULE_BLOCKS[blockIdx];
      const date = window.SchedDates.dateToIso(window.SchedDates.addDays(weekStartDate, dayIdx));
      setEditor({
        isNew: true,
        slot: {
          contractorId: c.id,
          assignmentId: activeAssignments[0] ? activeAssignments[0]._id : null,
          slotDate: date,
          startTime: block.start,
          endTime: block.end,
          status: 'scheduled',
          note: '',
        },
      });
    };
    const openEdit = (slot) => setEditor({ isNew: false, slot: { ...slot } });
    const close = () => setEditor(null);
    const save = async (patch) => {
      if (editor.isNew) await window.ScheduleSlotsStore.add(patch);
      else              await window.ScheduleSlotsStore.update(editor.slot.id, patch);
      close();
    };
    const del = async () => {
      if (editor && editor.slot && editor.slot.id) {
        await window.ScheduleSlotsStore.remove(editor.slot.id);
      }
      close();
    };

    const shift = (n) => {
      const d = window.SchedDates.addDays(weekStartDate, n * 7);
      setWeekStartIso(window.SchedDates.dateToIso(d));
    };
    const goToday = () => {
      const d = window.SchedDates.startOfWeek(new Date());
      setWeekStartIso(window.SchedDates.dateToIso(d));
    };

    const action = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => shift(-1)} title="Previous week" style={schedNavBtn(pal)}>‹</button>
        <span style={{ fontSize: 11.5, color: pal.textSoft, fontWeight: 500,
          fontVariantNumeric: 'tabular-nums', minWidth: 124, textAlign: 'center' }}>
          {formatWeekRange(weekStartDate, weekEndDate)}
        </span>
        <button onClick={() => shift(1)} title="Next week" style={schedNavBtn(pal)}>›</button>
        <button onClick={goToday} style={{
          marginLeft: 4, padding: '3px 8px',
          background: 'transparent', color: pal.accent,
          border: `1px solid ${pal.border}`, borderRadius: 5,
          fontSize: 10.5, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Today</button>
      </div>
    );

    return (
      <>
        <Section pal={pal} title="Weekly schedule" action={action}>
          <WeeklySlotGrid weekStart={weekStartDate} slots={weekSlots}
            assignments={activeAssignments} pal={pal}
            onCellClick={openNew} onSlotClick={openEdit} />
          <AllocationCheck weekSlots={weekSlots} assignments={activeAssignments} pal={pal} />
        </Section>
        {editor && (
          <SlotEditor slot={editor.slot} isNew={editor.isNew}
            assignments={activeAssignments} pal={pal}
            onSave={save} onDelete={del} onClose={close} />
        )}
      </>
    );
  }

  function schedNavBtn(pal) {
    return {
      width: 22, height: 22, padding: 0,
      background: 'transparent', color: pal.textSoft,
      border: `1px solid ${pal.border}`, borderRadius: 5,
      fontSize: 14, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit',
    };
  }
  function formatWeekRange(start, end) {
    const sameMonth = start.getMonth() === end.getMonth();
    const fmtFull = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (sameMonth) return `${fmtFull(start)} – ${end.getDate()}`;
    return `${fmtFull(start)} – ${fmtFull(end)}`;
  }

  // 5-day × 4-block grid. Each cell renders the slots whose start_time falls
  // inside that block. Click empty cell to add; click slot pill to edit.
  function WeeklySlotGrid({ weekStart, slots, assignments, pal, onCellClick, onSlotClick }) {
    const byCell = React.useMemo(() => {
      const grid = SCHEDULE_DAYS.map(() => SCHEDULE_BLOCKS.map(() => []));
      slots.forEach((s) => {
        const date = window.SchedDates.isoToDate(s.slotDate);
        const dayIdx = Math.floor((date - weekStart) / 86400000);
        if (dayIdx < 0 || dayIdx > 4) return;
        const start = s.startTime || '00:00';
        const end   = s.endTime   || start;
        // Place the slot in every block its [start, end) range overlaps.
        // Two intervals overlap iff start < otherEnd && end > otherStart.
        let placed = false;
        SCHEDULE_BLOCKS.forEach((b, bi) => {
          if (start < b.end && end > b.start) {
            grid[dayIdx][bi].push(s);
            placed = true;
          }
        });
        // Fallback for slots entirely outside our 8AM–6PM window — pin to
        // the nearest block so they don't vanish silently.
        if (!placed) {
          const idx = start < SCHEDULE_BLOCKS[0].start ? 0 : SCHEDULE_BLOCKS.length - 1;
          grid[dayIdx][idx].push(s);
        }
      });
      // Sort slots inside each cell by start_time.
      grid.forEach((col) => col.forEach((arr) => arr.sort((a, b) => a.startTime.localeCompare(b.startTime))));
      return grid;
    }, [weekStart, slots]);

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '64px repeat(5, 1fr)',
        gap: 4,
      }}>
        <div />
        {SCHEDULE_DAYS.map((d, di) => {
          const dt = window.SchedDates.addDays(weekStart, di);
          return (
            <div key={d} style={{
              fontSize: 10.5, fontWeight: 600, color: pal.textFaint,
              textAlign: 'center', letterSpacing: 0.4, textTransform: 'uppercase',
              padding: '2px 0',
            }}>
              <div>{d}</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: pal.textFaint,
                textTransform: 'none', letterSpacing: 0, fontVariantNumeric: 'tabular-nums' }}>
                {dt.getMonth() + 1}/{dt.getDate()}
              </div>
            </div>
          );
        })}
        {SCHEDULE_BLOCKS.map((b, bi) => (
          <React.Fragment key={b.key}>
            <div style={{
              fontSize: 11, color: pal.textSoft,
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <span style={{ fontWeight: 600, color: pal.text }}>{b.label}</span>
              <span style={{ fontSize: 10, color: pal.textFaint }}>{b.range}</span>
            </div>
            {SCHEDULE_DAYS.map((_, di) => (
              <SlotCell key={di} slots={byCell[di][bi]} assignments={assignments} pal={pal}
                onEmptyClick={() => onCellClick(di, bi)} onSlotClick={onSlotClick} />
            ))}
          </React.Fragment>
        ))}
      </div>
    );
  }

  function SlotCell({ slots, assignments, pal, onEmptyClick, onSlotClick }) {
    if (!slots || slots.length === 0) {
      return (
        <div onClick={onEmptyClick} title="Click to add a slot"
          style={{
            minHeight: 38, borderRadius: 5,
            background: pal.chipBg,
            border: `1px dashed ${pal.borderSoft}`,
            cursor: 'pointer', userSelect: 'none',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = pal.accent}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = pal.borderSoft}
        />
      );
    }
    return (
      <div onClick={onEmptyClick} title="Click empty space to add another"
        style={{
          minHeight: 38, borderRadius: 5,
          padding: 3, display: 'flex', flexDirection: 'column', gap: 2,
          background: pal.cardAlt,
          border: `1px solid ${pal.borderSoft}`,
          cursor: 'pointer',
        }}>
        {slots.map((s) => (
          <SlotPill key={s.id} slot={s} assignments={assignments} pal={pal}
            onClick={(e) => { e.stopPropagation(); onSlotClick(s); }} />
        ))}
      </div>
    );
  }

  function slotColor(slot, assignments, pal) {
    if (slot.status === 'pto')       return '#C98A2C';
    if (slot.status === 'cancelled') return pal.textFaint;
    const a = assignments.find((x) => x._id === slot.assignmentId);
    if (!a) return pal.textSoft;
    return window.specColor ? window.specColor(a.spec || '') : pal.accent;
  }
  function slotLabel(slot, assignments) {
    if (slot.status === 'pto')       return 'PTO';
    if (slot.status === 'cancelled') return 'Cancelled';
    const a = assignments.find((x) => x._id === slot.assignmentId);
    if (a && a.school)   return a.school;
    if (a && a.district) return a.district;
    return 'Open block';
  }
  function SlotPill({ slot, assignments, pal, onClick }) {
    const color = slotColor(slot, assignments, pal);
    const label = slotLabel(slot, assignments);
    return (
      <button onClick={onClick}
        title={`${slot.startTime}–${slot.endTime} · ${label}${slot.note ? ' · ' + slot.note : ''}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '2px 6px',
          background: color + '22',
          border: `1px solid ${color}55`,
          borderRadius: 4,
          color: pal.text, fontSize: 10.5, fontWeight: 500,
          textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
          minHeight: 18, lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: color, fontWeight: 600, flexShrink: 0 }}>
          {slot.startTime}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{label}</span>
      </button>
    );
  }

  // ─── Allocated vs. scheduled hours per assignment (this week) ───────────
  function AllocationCheck({ weekSlots, assignments, pal }) {
    if (!assignments || assignments.length === 0) return null;
    const rows = assignments.map((a) => {
      const allocated = (Number(a.direct) || 0);
      const scheduled = weekSlots
        .filter((s) => s.assignmentId === a._id && s.status === 'scheduled')
        .reduce((sum, s) => sum + window.slotHours(s.startTime, s.endTime), 0);
      const diff = scheduled - allocated;
      let tone = pal.textSoft, label = `${scheduled}h / ${allocated}h`;
      if (diff < -0.01)       { tone = '#C98A2C'; label = `${scheduled}h / ${allocated}h · ${(-diff).toFixed(1)}h short`; }
      else if (diff > 0.01)   { tone = '#E76B5D'; label = `${scheduled}h / ${allocated}h · ${diff.toFixed(1)}h over`; }
      else if (allocated > 0) { tone = '#3E8A57'; label = `${scheduled}h / ${allocated}h · matched`; }
      const name = a.school || a.district || a.spec || 'Assignment';
      return { id: a._id, name, label, tone };
    });

    return (
      <div style={{
        marginTop: 8, paddingTop: 8,
        borderTop: `1px solid ${pal.borderSoft}`,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          textTransform: 'uppercase', color: pal.textFaint }}>
          Allocated vs. scheduled this week
        </div>
        {rows.map((r) => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 11.5,
          }}>
            <span style={{ flex: 1, color: pal.text, fontWeight: 500,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
            <span style={{ color: r.tone, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{r.label}</span>
          </div>
        ))}
      </div>
    );
  }

  // ─── SlotEditor modal ────────────────────────────────────────────────────
  function SlotEditor({ slot, isNew, assignments, pal, onSave, onDelete, onClose }) {
    const [draft, setDraft] = React.useState({
      contractorId: null, assignmentId: null,
      slotDate: '', startTime: '08:00', endTime: '11:00',
      status: 'scheduled', note: '',
      ...slot,
    });
    const s = modalStyles(pal);

    React.useEffect(() => {
      const onKey = (e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    });

    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
    const STATUS_PILLS = [
      { key: 'scheduled', label: 'Scheduled', color: '#3E8A57' },
      { key: 'pto',       label: 'PTO',       color: '#C98A2C' },
      { key: 'cancelled', label: 'Cancelled', color: '#E76B5D' },
    ];

    const handleSave = () => {
      if (!draft.slotDate || !draft.startTime || !draft.endTime) return;
      if (draft.endTime <= draft.startTime) return;
      onSave({ ...draft });
    };
    const totalHours = window.slotHours(draft.startTime, draft.endTime);

    return (
      <div style={s.backdrop} onClick={onClose}>
        <div style={s.modal} onClick={(e) => e.stopPropagation()}>
          <div style={s.header}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: pal.text }}>
              {isNew ? 'Add schedule slot' : 'Edit schedule slot'}
            </div>
            <button onClick={onClose} style={s.btnIcon}>×</button>
          </div>
          <div style={s.body}>
            <div>
              <div style={s.label}>Date</div>
              <input type="date" style={s.input}
                value={draft.slotDate || ''}
                onChange={(e) => set({ slotDate: e.target.value })} />
            </div>
            <div style={s.row}>
              <div>
                <div style={s.label}>Start time</div>
                <input type="time" step="900" style={s.input}
                  value={draft.startTime}
                  onChange={(e) => set({ startTime: e.target.value })} />
              </div>
              <div>
                <div style={{ ...s.label, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ flex: 1 }}>End time</span>
                  {totalHours > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 500, color: pal.textFaint,
                      textTransform: 'none', letterSpacing: 0 }}>{totalHours.toFixed(2)}h</span>
                  )}
                </div>
                <input type="time" step="900" style={s.input}
                  value={draft.endTime}
                  onChange={(e) => set({ endTime: e.target.value })} />
              </div>
            </div>
            <div>
              <div style={s.label}>Assignment</div>
              <select style={s.input}
                value={draft.assignmentId || ''}
                onChange={(e) => set({ assignmentId: e.target.value || null })}>
                <option value="">No assignment / general</option>
                {assignments.map((a) => (
                  <option key={a._id} value={a._id}>
                    {(a.school || a.district || 'Assignment')}{a.spec ? ` · ${a.spec}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={s.label}>Status</div>
              <div style={s.pillRow}>
                {STATUS_PILLS.map((p) => (
                  <div key={p.key}
                    style={s.pill(draft.status === p.key, p.color)}
                    onClick={() => set({ status: p.key })}>{p.label}</div>
                ))}
              </div>
            </div>
            <div>
              <div style={s.label}>Notes</div>
              <textarea rows={2} style={{ ...s.input, resize: 'vertical', minHeight: 50 }}
                placeholder="Covering for Sarah · session focus · etc."
                value={draft.note || ''} onChange={(e) => set({ note: e.target.value })} />
            </div>
          </div>
          <div style={s.footer}>
            {!isNew && (
              <button style={s.btnDanger}
                onClick={() => { if (confirm('Delete this slot?')) onDelete(); }}>Delete</button>
            )}
            <span style={{ flex: 1 }} />
            <button style={s.btnSecondary} onClick={onClose}>Cancel</button>
            <button style={s.btnPrimary} onClick={handleSave}>
              {isNew ? 'Add slot' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Assignments — merges mock seed assignments (read-only) with persisted
  // Supabase rows. "+ Add assignment" opens AssignmentEditor; persisted rows
  // are click-to-edit. Capacity calc upstream now sums hours from both.
  function AssignmentsCard({ c, pal }) {
    const all = window.useContractorAssignments
      ? window.useContractorAssignments(c)
      : (c.assignments || []);
    const active = all.filter((a) => a.status === 'active');
    const past   = all.filter((a) => a.status === 'completed');
    const [editor, setEditor] = React.useState(null);

    const openNew = () => setEditor({
      isNew: true,
      assignment: {
        contractorId: c.id,
        contractorName: c.name,
        spec: c.spec || '',
        payRate: c.rates ? c.rates.hourly : null,
        startDate: new Date().toISOString().slice(0, 10),
        status: 'active',
      },
    });
    const openEdit = (a) => {
      // Only persisted assignments are editable; mock ones are read-only.
      if (a.source !== 'supabase' || !a._id) return;
      const full = window.AssignmentsStore.get().find((x) => x.id === a._id);
      if (!full) return;
      setEditor({ isNew: false, assignment: { ...full } });
    };
    const close = () => setEditor(null);
    const save = async (patch) => {
      if (editor.isNew) {
        const { id, ...rest } = patch;
        await window.AssignmentsStore.add(rest);
      } else {
        await window.AssignmentsStore.update(editor.assignment.id, patch);
      }
      close();
    };
    const del = async () => {
      if (editor && editor.assignment && editor.assignment.id) {
        await window.AssignmentsStore.remove(editor.assignment.id);
      }
      close();
    };

    const addBtn = (
      <button onClick={openNew} style={{
        background: 'transparent', border: 'none',
        color: pal.accent, fontSize: 12, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit', padding: 0,
      }}>+ Add assignment</button>
    );

    return (
      <>
        <Section pal={pal} title="Assignments" badge={all.length} action={addBtn}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
            textTransform: 'uppercase', color: pal.textFaint, marginBottom: -4 }}>
            Active · {active.length}
          </div>
          <AssignmentTable rows={active} pal={pal} active onRowClick={openEdit} />
          {past.length > 0 && (
            <>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
                textTransform: 'uppercase', color: pal.textFaint, marginTop: 6, marginBottom: -4 }}>
                History · {past.length}
              </div>
              <AssignmentTable rows={past} pal={pal} onRowClick={openEdit} />
            </>
          )}
        </Section>
        {editor && (
          <AssignmentEditor
            assignment={editor.assignment}
            isNew={editor.isNew}
            pal={pal}
            onSave={save}
            onDelete={del}
            onClose={close}
          />
        )}
      </>
    );
  }
  function AssignmentTable({ rows, pal, active, onRowClick }) {
    if (!rows.length) {
      return (
        <div style={{ fontSize: 12, color: pal.textFaint, fontStyle: 'italic', padding: '6px 0' }}>None.</div>
      );
    }
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 1.2fr 70px 70px 70px 90px',
        gap: 10, alignItems: 'center',
        fontSize: 12,
      }}>
        <Th pal={pal}>School</Th>
        <Th pal={pal}>District</Th>
        <Th pal={pal} right>Direct</Th>
        <Th pal={pal} right>Indirect</Th>
        <Th pal={pal} right>Bill</Th>
        <Th pal={pal} right>{active ? 'Since' : 'Dates'}</Th>
        {rows.map((a, i) => {
          const editable = a.source === 'supabase' && a._id;
          const key = (a._id || a.schoolId || a.school || 'row') + ':' + (a.startDate || i);
          const onClick = editable && onRowClick ? () => onRowClick(a) : null;
          const attachCount = Array.isArray(a.attachments) ? a.attachments.length : 0;
          const baseRow = {
            color: pal.text, fontWeight: 500, minWidth: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            cursor: onClick ? 'pointer' : 'default',
          };
          return (
            <React.Fragment key={key}>
              <div onClick={onClick} style={{ ...baseRow, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.school || (a.districtName ? `${a.districtName} (district-wide)` : '—')}
                </span>
                {attachCount > 0 && (
                  <span title={`${attachCount} attachment${attachCount === 1 ? '' : 's'}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 2,
                      flexShrink: 0, fontSize: 10, fontWeight: 600,
                      color: pal.textSoft, padding: '1px 5px', borderRadius: 3,
                      background: pal.chipBg,
                    }}>
                    <Icon name="file" size={9.5} stroke={2} />
                    {attachCount}
                  </span>
                )}
                {a.source === 'mock' && (
                  <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700,
                    color: pal.textFaint, background: pal.chipBg,
                    padding: '1px 5px', borderRadius: 3, letterSpacing: 0.4 }}>SEED</span>
                )}
              </div>
              <div onClick={onClick} style={{ ...baseRow, color: pal.textSoft, fontWeight: 400 }}>{a.district || '—'}</div>
              <div onClick={onClick} style={{ ...baseRow, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{a.direct}h</div>
              <div onClick={onClick} style={{ ...baseRow, textAlign: 'right', color: pal.textSoft, fontVariantNumeric: 'tabular-nums' }}>{a.indirect}h</div>
              <div onClick={onClick} style={{ ...baseRow, textAlign: 'right', color: pal.textSoft, fontVariantNumeric: 'tabular-nums' }}>
                {(() => {
                  // Bill rate is derived from the district rate card (or
                  // per-spec default) — same resolution effectiveBill uses
                  // for revenue math, so what the user sees matches what
                  // the rollups computed.
                  const F = window.ContractorFinancials;
                  const r = F && F.effectiveBill ? F.effectiveBill(a, 0, a.spec) : 0;
                  return r > 0 ? `$${Math.round(r)}` : '—';
                })()}
              </div>
              <div onClick={onClick} style={{ ...baseRow, textAlign: 'right', fontSize: 11, color: pal.textFaint }}>
                {active ? formatDate(a.startDate) : `${formatDateShort(a.startDate)} → ${formatDateShort(a.endDate)}`}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  // ─── Assignment editor modal ──────────────────────────────────────────────
  function AssignmentEditor({ assignment, isNew, pal, onSave, onDelete, onClose }) {
    // Subscribe so the "auto · N% of direct" label and autoIndirect math
    // pick up admin edits to the per-spec ratio while this modal is open.
    if (window.useSpecSettings) window.useSpecSettings();
    const [draft, setDraft] = React.useState({
      id: null,
      contractorId: null, contractorName: '',
      schoolId: null, schoolName: '',
      districtId: null, districtName: '',
      spec: '',
      directHours: 0, indirectHours: 0, indirectOverride: false,
      payRate: null,
      startDate: '', endDate: '',
      status: 'active', note: '',
      attachments: [],
      ...assignment,
    });
    const [scopeOpen, setScopeOpen] = React.useState(!draft.schoolName && !draft.districtName);
    const [scopeQuery, setScopeQuery] = React.useState('');
    const scopeBoxRef = React.useRef(null);
    const s = modalStyles(pal);

    React.useEffect(() => {
      if (!scopeOpen) return;
      const onMouseDown = (e) => {
        if (scopeBoxRef.current && !scopeBoxRef.current.contains(e.target)) setScopeOpen(false);
      };
      document.addEventListener('mousedown', onMouseDown);
      return () => document.removeEventListener('mousedown', onMouseDown);
    }, [scopeOpen]);

    React.useEffect(() => {
      const onKey = (e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    });

    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

    const scopeOptions = React.useMemo(() => {
      const q = scopeQuery.trim().toLowerCase();
      const match = (str) => !q || (str || '').toLowerCase().includes(q);
      const out = [];
      const districts = (window.RCIS_DATA && window.RCIS_DATA.DISTRICTS) || [];
      const schools = (window.RCIS_DATA && window.RCIS_DATA.SCHOOLS) || [];
      districts.forEach((d) => {
        if (match(d.name) || match(d.state)) {
          out.push({ type: 'district', id: d.id, name: d.name, state: d.state, sub: `${d.state} · district-wide` });
        }
      });
      schools.forEach((s) => {
        const dist = districts.find((d) => d.id === s.district);
        const distName = dist ? dist.name : '';
        if (match(s.name) || match(s.state) || match(distName)) {
          out.push({
            type: 'school', id: s.id, name: s.name, state: s.state,
            districtId: s.district || null, districtName: distName,
            sub: `${distName} · ${s.state}`,
          });
        }
      });
      return out.slice(0, 30);
    }, [scopeQuery]);

    const pickScope = (opt) => {
      if (opt.type === 'school') {
        set({
          schoolId: opt.id, schoolName: opt.name,
          districtId: opt.districtId, districtName: opt.districtName,
        });
      } else {
        set({
          schoolId: null, schoolName: '',
          districtId: opt.id, districtName: opt.name,
        });
      }
      setScopeOpen(false);
      setScopeQuery('');
    };
    const clearScope = () => {
      set({ schoolId: null, schoolName: '', districtId: null, districtName: '' });
      setScopeOpen(true);
      setScopeQuery('');
    };
    const ownerLabel = draft.schoolName || draft.districtName;
    const ownerSub = draft.schoolName
      ? `${draft.districtName || 'School'}`
      : draft.districtName ? 'District-wide' : '';

    const SPECIALTIES = (window.RCIS_DATA && window.RCIS_DATA.SPECIALTIES) || [];
    const STATUSES = [
      { key: 'active',    label: 'Active',    color: '#3E8A57' },
      { key: 'completed', label: 'Completed', color: '#7A8290' },
    ];

    const handleSave = () => {
      if (!ownerLabel) { setScopeOpen(true); return; }
      if (!draft.startDate) return;
      const direct = Number(draft.directHours) || 0;
      // Server-side re-derives, but normalize here so the UI shows the same
      // value the moment it saves.
      const indirect = draft.indirectOverride
        ? (Number(draft.indirectHours) || 0)
        : window.AssignmentsStore.autoIndirect(direct, draft.spec);
      onSave({
        ...draft,
        directHours:   direct,
        indirectHours: indirect,
        payRate:  draft.payRate != null && draft.payRate !== '' ? Number(draft.payRate) : null,
      });
    };

    return (
      <div style={s.backdrop} onClick={onClose}>
        <div style={s.modal} onClick={(e) => e.stopPropagation()}>
          <div style={s.header}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: pal.text }}>
              {isNew ? 'Add assignment' : 'Edit assignment'}
            </div>
            <button onClick={onClose} style={s.btnIcon}>×</button>
          </div>
          <div style={s.body}>
            {/* Scope picker */}
            <div>
              <div style={s.label}>School or district</div>
              {ownerLabel && !scopeOpen ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: pal.cardAlt,
                  border: `1px solid ${pal.border}`, borderRadius: 7,
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
                    padding: '3px 6px', borderRadius: 4,
                    background: (draft.schoolName ? '#E76B5D22' : pal.accent + '22'),
                    color: (draft.schoolName ? '#E76B5D' : pal.accent),
                  }}>{draft.schoolName ? 'SCHOOL' : 'DISTRICT'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: pal.text, fontWeight: 600, fontSize: 13 }}>{ownerLabel}</div>
                    <div style={{ color: pal.textFaint, fontSize: 11, marginTop: 1 }}>{ownerSub}</div>
                  </div>
                  <button onClick={clearScope}
                    style={{ ...s.btnSecondary, padding: '4px 9px', fontSize: 11.5 }}>Change</button>
                </div>
              ) : (
                <div ref={scopeBoxRef}>
                  <input autoFocus style={s.input}
                    placeholder="Search a school or district…"
                    value={scopeQuery}
                    onChange={(e) => { setScopeQuery(e.target.value); setScopeOpen(true); }}
                    onFocus={() => setScopeOpen(true)} />
                  {scopeOpen && (
                    <div style={{
                      marginTop: 6, maxHeight: 220, overflowY: 'auto',
                      background: pal.cardAlt, border: `1px solid ${pal.border}`, borderRadius: 7,
                    }}>
                      {scopeOptions.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: 12.5, color: pal.textFaint }}>No matches.</div>
                      ) : scopeOptions.map((opt) => (
                        <div key={opt.type + opt.id} onClick={() => pickScope(opt)} style={{
                          display: 'flex', alignItems: 'center', gap: 9,
                          padding: '7px 11px', cursor: 'pointer', fontSize: 13,
                          borderBottom: `1px solid ${pal.borderSoft}`,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = pal.chipBg}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <span style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
                            padding: '3px 6px', borderRadius: 4,
                            background: opt.type === 'school' ? '#E76B5D22' : pal.accent + '22',
                            color: opt.type === 'school' ? '#E76B5D' : pal.accent,
                          }}>{opt.type === 'school' ? 'SCH' : 'DIST'}</span>
                          <span style={{ flex: 1, color: pal.text, fontWeight: 500 }}>{opt.name}</span>
                          <span style={{ color: pal.textFaint, fontSize: 11 }}>{opt.sub}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Specialty */}
            <div>
              <div style={s.label}>Specialty / role</div>
              <select style={s.input} value={draft.spec || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft((d) => ({
                    ...d,
                    spec: v,
                    indirectHours: d.indirectOverride
                      ? d.indirectHours
                      : window.AssignmentsStore.autoIndirect(d.directHours, v),
                  }));
                }}>
                <option value="">—</option>
                {SPECIALTIES.map((sp) => (
                  <option key={sp.code} value={sp.code}>{sp.code} — {sp.name}</option>
                ))}
              </select>
            </div>

            {/* Hours — indirect auto-calcs at 25% of direct until overridden. */}
            <div style={s.row}>
              <div>
                <div style={s.label}>Direct hours / week</div>
                <input type="number" min="0" step="0.5" style={s.input}
                  value={draft.directHours}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft((d) => ({
                      ...d,
                      directHours: v,
                      indirectHours: d.indirectOverride
                        ? d.indirectHours
                        : (window.AssignmentsStore.autoIndirect(v, d.spec)),
                    }));
                  }} />
              </div>
              <div>
                <div style={{ ...s.label, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ flex: 1 }}>
                    {draft.indirectOverride ? 'Override indirect hours' : 'Indirect hours / week'}
                  </span>
                  {draft.indirectOverride ? (
                    <button onClick={() => {
                      setDraft((d) => ({
                        ...d,
                        indirectOverride: false,
                        indirectHours: window.AssignmentsStore.autoIndirect(d.directHours, d.spec),
                      }));
                    }} style={{
                      background: 'transparent', border: 'none',
                      color: pal.accent, fontSize: 10.5, fontWeight: 600,
                      textTransform: 'none', letterSpacing: 0,
                      cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                    }}>Reset to auto</button>
                  ) : (
                    <span style={{
                      fontSize: 10, fontWeight: 500, color: pal.textFaint,
                      textTransform: 'none', letterSpacing: 0,
                    }}>auto · {Math.round((window.indirectRatioFor ? window.indirectRatioFor(draft.spec) : 0.25) * 100)}% of direct</span>
                  )}
                </div>
                <input type="number" min="0" step="0.25"
                  style={{
                    ...s.input,
                    background: draft.indirectOverride ? pal.cardAlt : (pal.chipBg || pal.cardAlt),
                    color: draft.indirectOverride ? pal.text : pal.textSoft,
                  }}
                  value={draft.indirectHours}
                  onChange={(e) => set({ indirectHours: e.target.value, indirectOverride: true })}
                  onFocus={(e) => { if (!draft.indirectOverride) e.target.select(); }} />
              </div>
            </div>

            {/* Pay rate (bill rate is now derived from the district rate card). */}
            <div>
              <div style={s.label}>Pay rate ($ / hr)</div>
              <input type="number" min="0" step="1" style={s.input}
                value={draft.payRate == null ? '' : draft.payRate}
                onChange={(e) => set({ payRate: e.target.value })}
                placeholder="Contractor default" />
              <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 4 }}>
                Bill rate comes from the {draft.districtName || 'district'} rate card.
              </div>
            </div>

            {/* Dates */}
            <div style={s.row}>
              <div>
                <div style={s.label}>Start date</div>
                <input type="date" style={s.input}
                  value={draft.startDate || ''} onChange={(e) => set({ startDate: e.target.value })} />
              </div>
              <div>
                <div style={s.label}>End date <span style={{ textTransform: 'none', fontWeight: 500 }}>· optional</span></div>
                <input type="date" style={s.input}
                  value={draft.endDate || ''} onChange={(e) => set({ endDate: e.target.value })} />
              </div>
            </div>

            {/* Status */}
            <div>
              <div style={s.label}>Status</div>
              <div style={s.pillRow}>
                {STATUSES.map((st) => (
                  <div key={st.key}
                    style={s.pill(draft.status === st.key, st.color)}
                    onClick={() => set({ status: st.key })}>{st.label}</div>
                ))}
              </div>
            </div>

            {/* Assignment documents & links */}
            <AssignmentAttachments
              attachments={draft.attachments || []}
              onChange={(next) => set({ attachments: next })}
              pal={pal}
            />

            {/* Notes */}
            <div>
              <div style={s.label}>Notes</div>
              <textarea rows={2} style={{ ...s.input, resize: 'vertical', minHeight: 56 }}
                placeholder="Caseload context, schedule notes…"
                value={draft.note || ''} onChange={(e) => set({ note: e.target.value })} />
            </div>
          </div>
          <div style={s.footer}>
            {!isNew && (
              <button style={s.btnDanger}
                onClick={() => { if (confirm('Delete this assignment?')) onDelete(); }}>Delete</button>
            )}
            <span style={{ flex: 1 }} />
            <button style={s.btnSecondary} onClick={onClose}>Cancel</button>
            <button style={s.btnPrimary} onClick={handleSave}>
              {isNew ? 'Add assignment' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  function Th({ pal, children, right }) {
    return (
      <div style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6,
        color: pal.textFaint, textTransform: 'uppercase',
        textAlign: right ? 'right' : 'left',
        borderBottom: `1px solid ${pal.borderSoft}`,
        paddingBottom: 6,
      }}>{children}</div>
    );
  }

  // ─── Assignment documents & links ────────────────────────────────────────
  // Reuses window.attachmentHelpers (same Supabase Storage bucket as task /
  // renewal attachments). Each attachment also supports inline notes so the
  // team can tag what each doc is (e.g. "signed addendum", "IEP roster").
  function AssignmentAttachments({ attachments, onChange, pal }) {
    const helpers = window.attachmentHelpers || {};
    const KIND_META = helpers.KIND_META || {};
    const [adding, setAdding] = React.useState(false);
    const [url, setUrl] = React.useState('');
    const [name, setName] = React.useState('');
    const [linkNotes, setLinkNotes] = React.useState('');
    const [uploading, setUploading] = React.useState(null);
    const [uploadError, setUploadError] = React.useState(null);
    const urlRef = React.useRef(null);
    const fileInputRef = React.useRef(null);

    React.useEffect(() => { if (adding && urlRef.current) urlRef.current.focus(); }, [adding]);

    const resetLink = () => { setAdding(false); setUrl(''); setName(''); setLinkNotes(''); };
    const commitLink = () => {
      const trimmed = url.trim();
      if (!trimmed) return;
      const finalName = name.trim() || (helpers.defaultAttachmentName ? helpers.defaultAttachmentName(trimmed) : trimmed);
      const kind = helpers.detectAttachmentKind ? helpers.detectAttachmentKind(trimmed, finalName) : 'link';
      onChange([...attachments, {
        id: helpers.attachmentId ? helpers.attachmentId() : 'a' + Date.now(),
        kind, url: trimmed, name: finalName,
        notes: linkNotes.trim(),
        addedAt: Date.now(),
        source: 'link',
      }]);
      resetLink();
    };

    const triggerFilePicker = () => {
      setUploadError(null);
      if (fileInputRef.current) fileInputRef.current.click();
    };
    const onFileSelected = async (event) => {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (!file) return;
      const problem = helpers.validateUpload ? helpers.validateUpload(file) : null;
      if (problem) { setUploadError(problem); return; }
      setUploading(file.name);
      setUploadError(null);
      try {
        const att = await helpers.uploadAttachmentFile(file);
        onChange([...attachments, { ...att, notes: '' }]);
      } catch (err) {
        console.warn('assignment upload failed', err);
        setUploadError((err && err.message) ? err.message : 'Upload failed.');
      } finally {
        setUploading(null);
      }
    };

    const remove = async (id) => {
      const target = attachments.find((a) => a.id === id);
      onChange(attachments.filter((a) => a.id !== id));
      if (target && target.storagePath && helpers.deleteAttachmentFile) {
        await helpers.deleteAttachmentFile(target);
      }
    };

    const updateNotes = (id, notes) => {
      onChange(attachments.map((a) => a.id === id ? { ...a, notes } : a));
    };

    const openAttachment = (a) => {
      if (a.source === 'upload' && helpers.openUploadedAttachment) {
        helpers.openUploadedAttachment(a);
      } else if (a.url) {
        window.open(a.url, '_blank', 'noreferrer');
      }
    };

    return (
      <div>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
          textTransform: 'uppercase', color: pal.textFaint, marginBottom: 5,
        }}>
          Assignment documents &amp; links
          <span style={{ textTransform: 'none', fontWeight: 500, color: pal.textFaint, marginLeft: 6 }}>
            · tied to this assignment only
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attachments.map((a) => {
            const meta = KIND_META[a.kind] || KIND_META.link || { abbr: 'LINK', full: 'Link', color: pal.textSoft };
            const isUpload = a.source === 'upload';
            const sub = isUpload
              ? `${meta.full} · ${helpers.formatBytes ? helpers.formatBytes(a.size) : ''}`
              : `${meta.full}${a.url ? ' · ' + hostOf(a.url) : ''}`;
            return (
              <div key={a.id} style={{
                display: 'flex', flexDirection: 'column', gap: 4,
                padding: '7px 10px',
                background: pal.cardAlt,
                border: `1px solid ${pal.border}`, borderRadius: 7,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 44, padding: '3px 7px',
                    background: meta.color + '20', color: meta.color,
                    fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6,
                    borderRadius: 4, fontFamily: 'ui-monospace, monospace',
                  }}>{meta.abbr}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); openAttachment(a); }}
                      style={{
                        fontSize: 12.5, color: pal.text, fontWeight: 500,
                        textDecoration: 'none', display: 'block',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        background: 'transparent', border: 'none', padding: 0,
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = pal.accent}
                      onMouseLeave={(e) => e.currentTarget.style.color = pal.text}>
                      {a.name}
                    </button>
                    <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 1,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
                  </div>
                  <button onClick={() => remove(a.id)} title="Remove"
                    style={{
                      border: 'none', background: 'transparent',
                      color: pal.textFaint, fontSize: 16, lineHeight: 1,
                      cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = pal.warn; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = pal.textFaint; }}>×</button>
                </div>
                <input
                  placeholder="Notes (optional)"
                  value={a.notes || ''}
                  onChange={(e) => updateNotes(a.id, e.target.value)}
                  style={{
                    width: '100%', padding: '4px 8px',
                    fontSize: 11.5, color: pal.textSoft,
                    background: pal.card,
                    border: `1px solid ${pal.borderSoft}`, borderRadius: 5,
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>
            );
          })}

          {adding ? (
            <div style={{
              padding: 10, background: pal.cardAlt,
              border: `1px dashed ${pal.border}`, borderRadius: 7,
              display: 'flex', flexDirection: 'column', gap: 7,
            }}>
              <input
                ref={urlRef}
                placeholder="Paste URL — share link to PDF, contract, IEP…"
                value={url} onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitLink(); } if (e.key === 'Escape') resetLink(); }}
                style={{
                  width: '100%', padding: '7px 10px',
                  fontSize: 12.5, color: pal.text, background: pal.card,
                  border: `1px solid ${pal.border}`, borderRadius: 6,
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              <input
                placeholder="Display name (optional)"
                value={name} onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px',
                  fontSize: 12.5, color: pal.text, background: pal.card,
                  border: `1px solid ${pal.border}`, borderRadius: 6,
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              <input
                placeholder="Notes (optional)"
                value={linkNotes} onChange={(e) => setLinkNotes(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px',
                  fontSize: 12.5, color: pal.text, background: pal.card,
                  border: `1px solid ${pal.border}`, borderRadius: 6,
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 7 }}>
                <span style={{ flex: 1 }} />
                <button onClick={resetLink}
                  style={{
                    padding: '0 12px',
                    background: 'transparent', color: pal.textSoft,
                    border: `1px solid ${pal.border}`, borderRadius: 6,
                    fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Cancel</button>
                <button onClick={commitLink} disabled={!url.trim()}
                  style={{
                    padding: '0 14px',
                    background: url.trim() ? pal.accent : pal.chipBg,
                    color: url.trim() ? '#fff' : pal.textFaint,
                    border: 'none', borderRadius: 6,
                    fontSize: 12, fontWeight: 600,
                    cursor: url.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
                  }}>Add link</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={triggerFilePicker} disabled={!!uploading}
                style={dashedBtn(pal, !!uploading)}>
                <Icon name="file" size={12} stroke={2} />
                {uploading ? `Uploading ${uploading}…` : 'Upload file'}
              </button>
              <button onClick={() => setAdding(true)} disabled={!!uploading}
                style={dashedBtn(pal, !!uploading)}>
                <Icon name="plus" size={12} stroke={2.4} /> Add link
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={helpers.UPLOAD_ACCEPT || '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt'}
            onChange={onFileSelected}
            style={{ display: 'none' }}
          />
          {uploadError && (
            <div style={{
              fontSize: 11.5, color: pal.warn,
              padding: '6px 10px',
              border: `1px solid ${pal.warn}`,
              borderRadius: 6, marginTop: 2,
            }}>{uploadError}</div>
          )}
        </div>
      </div>
    );
  }
  function dashedBtn(pal, disabled) {
    return {
      flex: 1, padding: '8px 12px',
      background: 'transparent',
      color: disabled ? pal.textFaint : pal.textSoft,
      border: `1px dashed ${pal.border}`,
      borderRadius: 7,
      fontSize: 12.5, fontWeight: 500,
      cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    };
  }
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch (e) { return ''; }
  }

  // Contractor renewals — one card per kind (license / insurance / background)
  // backed by RenewalsStore. Rows are clickable to edit; "+ Add" opens the
  // editor pre-filled with this contractor + the chosen kind.
  function ContractorRenewalsCard({ c, pal, kind, title, addLabel }) {
    const renewals = window.useRenewals ? window.useRenewals() : [];
    const rows = React.useMemo(() => {
      return renewals
        .filter((r) => r.contractorId === c.id && r.kind === kind)
        .sort((a, b) => {
          const ax = a.expiresOn || '9999-12-31';
          const bx = b.expiresOn || '9999-12-31';
          return ax.localeCompare(bx);
        });
    }, [renewals, c.id, kind]);

    const [editor, setEditor] = React.useState(null);
    const openNew = () => setEditor({
      isNew: true,
      renewal: {
        kind,
        contractorId: c.id,
        contractorName: c.name,
        state: kind === 'contractor_license' ? ((c.states || [])[0] || '') : '',
      },
    });
    const openEdit = (r) => setEditor({ isNew: false, renewal: { ...r } });
    const close = () => setEditor(null);
    const save = async (patch) => {
      if (editor.isNew) {
        const { id, ...rest } = patch;
        await window.RenewalsStore.add(rest);
      } else {
        await window.RenewalsStore.update(editor.renewal.id, patch);
      }
      close();
    };
    const del = async () => {
      await window.RenewalsStore.remove(editor.renewal.id);
      close();
    };

    const addBtn = (
      <button onClick={openNew} style={{
        background: 'transparent', border: 'none',
        color: pal.accent, fontSize: 12, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit', padding: 0,
      }}>{addLabel}</button>
    );

    return (
      <>
        <Section pal={pal} title={title} badge={rows.length} action={addBtn}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {rows.length === 0 && (
              <div style={{ fontSize: 12, color: pal.textFaint, fontStyle: 'italic',
                padding: '4px 0' }}>
                None tracked yet.
              </div>
            )}
            {rows.map((r, i) => {
              const days = window.daysUntilRenewal(r.expiresOn);
              const tone = days == null ? pal.textSoft
                         : days < 0    ? '#E76B5D'
                         : days < 30   ? '#C98A2C'
                         : days < 60   ? pal.accent
                                       : pal.textSoft;
              const dateLabel = r.expiresOn ? formatDate(r.expiresOn) : '—';
              const daysLabel = days == null ? '—'
                              : days < 0    ? `${Math.abs(days)}d over`
                              : days === 0  ? 'today'
                              : `${days}d`;
              return (
                <button key={r.id} onClick={() => openEdit(r)} style={{
                  display: 'grid',
                  gridTemplateColumns: r.state ? '40px 1fr auto' : '1fr auto',
                  gap: 10, alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: i < rows.length - 1 ? `1px solid ${pal.borderSoft}` : 'none',
                  fontSize: 12.5, textAlign: 'left',
                  background: 'transparent', border: 'none', width: '100%',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {r.state && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: pal.text,
                      fontFamily: 'ui-monospace, monospace',
                      background: pal.chipBg, padding: '3px 7px', borderRadius: 4, textAlign: 'center',
                    }}>{r.state}</span>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: pal.text, fontWeight: 500,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.label || (kind === 'contractor_license' ? 'License' : kind === 'contractor_insurance' ? 'Policy' : 'Background check')}
                    </div>
                    {(r.status && r.status !== 'active') && (
                      <div style={{ fontSize: 11, color: pal.textFaint, marginTop: 1,
                        textTransform: 'capitalize' }}>{r.status}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11.5, color: tone, fontWeight: 600 }}>{daysLabel}</div>
                    <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{dateLabel}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>
        {editor && (
          <window.RenewalEditor
            renewal={editor.renewal}
            pal={pal}
            isNew={editor.isNew}
            onSave={save}
            onDelete={del}
            onClose={close}
          />
        )}
      </>
    );
  }

  // Linked todos (todos whose linkedTo points at this contractor)
  function LinkedTodosCard({ c, pal }) {
    const todos = window.useTodos();
    const linked = React.useMemo(
      () => todos.filter((t) => t.linkedTo && t.linkedTo.type === 'contractor' && t.linkedTo.id === c.id),
      [todos, c.id],
    );
    const open = linked.filter((t) => t.column !== 'done');
    const done = linked.filter((t) => t.column === 'done');

    return (
      <Section pal={pal} title="Open todos" badge={open.length} action={open.length || done.length ? 'Open board →' : null}>
        {open.length === 0 && (
          <div style={{ fontSize: 12, color: pal.textFaint, fontStyle: 'italic' }}>
            No open todos for {c.name.split(' ')[0]}.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {open.map((t) => <MiniTodo key={t.id} t={t} pal={pal} />)}
        </div>
        {done.length > 0 && (
          <details style={{ marginTop: 6 }}>
            <summary style={{ fontSize: 11.5, color: pal.textSoft, cursor: 'pointer', userSelect: 'none' }}>
              Show {done.length} completed
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {done.map((t) => <MiniTodo key={t.id} t={t} pal={pal} faded />)}
            </div>
          </details>
        )}
      </Section>
    );
  }
  function MiniTodo({ t, pal, faded }) {
    const PRIO = { high: '#D97757', medium: '#C98A2C', low: '#7A8290' };
    return (
      <div style={{
        padding: '8px 10px',
        background: pal.cardAlt,
        border: `1px solid ${pal.borderSoft}`,
        borderLeft: `3px solid ${PRIO[t.priority]}`,
        borderRadius: 6,
        opacity: faded ? 0.6 : 1,
      }}>
        <div style={{ fontSize: 12.5, color: pal.text, fontWeight: 500,
          textDecoration: t.column === 'done' ? 'line-through' : 'none' }}>{t.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, fontSize: 10.5 }}>
          <span style={{ fontWeight: 600, color: pal.textSoft, padding: '1px 6px', borderRadius: 3, background: pal.chipBg }}>{t.label}</span>
          <span style={{ fontWeight: 600, color: pal.textFaint, textTransform: 'capitalize' }}>{t.column}</span>
          {t.due && <span style={{ color: pal.textFaint, fontVariantNumeric: 'tabular-nums' }}>{formatDateShort(t.due)}</span>}
          <span style={{ marginLeft: 'auto', display: 'flex' }}>
            {t.owners.map((id, i) => (
              <span key={id} style={{ marginLeft: i === 0 ? 0 : -4 }}>
                <OwnerAvatar id={id} size={16} ring={pal.cardAlt} />
              </span>
            ))}
          </span>
        </div>
      </div>
    );
  }

  // Documents — backed by DocumentsStore. Supports both link adds and real
  // file uploads to the task-attachments bucket via window.attachmentHelpers.
  // When a PDF is uploaded, we run pdf-parse on it; if it looks like a license
  // / insurance / background check, we offer to log a renewal from it.
  function DocumentsCard({ c, pal }) {
    const helpers = window.attachmentHelpers || {};
    const docs = window.useDocuments ? window.useDocuments('contractor', c.id) : [];
    const sorted = React.useMemo(() => [...docs].sort((a, b) => b.addedAt - a.addedAt), [docs]);
    const [adding, setAdding] = React.useState(false);
    const [url, setUrl] = React.useState('');
    const [name, setName] = React.useState('');
    const [uploading, setUploading] = React.useState(null);
    const [parsing, setParsing] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [renewalPrompt, setRenewalPrompt] = React.useState(null);
    const [renewalEditor, setRenewalEditor] = React.useState(null);
    const fileInputRef = React.useRef(null);

    const KIND_META = helpers.KIND_META || {};

    const resetLink = () => { setAdding(false); setUrl(''); setName(''); };
    const commitLink = async () => {
      const trimmed = url.trim();
      if (!trimmed) return;
      const finalName = name.trim() || (helpers.defaultAttachmentName ? helpers.defaultAttachmentName(trimmed) : trimmed);
      const kind = helpers.detectAttachmentKind ? helpers.detectAttachmentKind(trimmed, finalName) : 'link';
      await window.DocumentsStore.add({
        scope: 'contractor', scopeId: c.id, kind, url: trimmed, name: finalName,
      });
      resetLink();
    };

    const triggerFilePicker = () => {
      setError(null);
      if (fileInputRef.current) fileInputRef.current.click();
    };
    const onFileSelected = async (event) => {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (!file) return;
      setUploading(file.name);
      setError(null);
      // Parallel: run the PDF parser (if applicable) while the upload happens.
      const parsePromise = (file.type === 'application/pdf' || /\.pdf$/i.test(file.name))
        && window.parsePdfForRenewal
        ? (setParsing(true), window.parsePdfForRenewal(file).catch(() => null))
        : Promise.resolve(null);
      let uploadedDoc = null;
      try {
        uploadedDoc = await window.DocumentsStore.addUpload({
          scope: 'contractor', scopeId: c.id, file,
        });
      } catch (err) {
        console.warn('doc upload failed', err);
        setError((err && err.message) ? err.message : 'Upload failed.');
      } finally {
        setUploading(null);
      }
      const parsed = await parsePromise;
      setParsing(false);
      // Only show the prompt if we found at least an expiration date — that's
      // the actionable signal. Other fields without a date are noise.
      if (parsed && parsed.expiresOn) {
        setRenewalPrompt({ ...parsed, sourceFile: file.name, uploadedDoc });
      }
    };

    // When user accepts the prompt, open the renewal editor pre-filled with
    // extracted fields AND the just-uploaded document as the first attachment.
    const acceptRenewalPrompt = () => {
      if (!renewalPrompt) return;
      // Guess kind from label keywords; default to license.
      const lab = (renewalPrompt.label || '').toLowerCase();
      let kind = 'contractor_license';
      if (/liability|malpractice|insurance|hpso|cmf/.test(lab)) kind = 'contractor_insurance';
      else if (/background|fingerprint|bia|clearance/.test(lab)) kind = 'contractor_background';

      // Re-shape the uploaded doc into an attachment row the renewal can use.
      const att = renewalPrompt.uploadedDoc ? [{
        id: (window.attachmentHelpers && window.attachmentHelpers.attachmentId)
              ? window.attachmentHelpers.attachmentId() : 'a' + Date.now(),
        kind: renewalPrompt.uploadedDoc.kind,
        name: renewalPrompt.uploadedDoc.name,
        storagePath: renewalPrompt.uploadedDoc.storagePath,
        size: renewalPrompt.uploadedDoc.size,
        mime: renewalPrompt.uploadedDoc.mime,
        source: 'upload',
        addedAt: Date.now(),
      }] : [];

      setRenewalEditor({
        isNew: true,
        renewal: {
          kind,
          contractorId: c.id,
          contractorName: c.name,
          state: renewalPrompt.state || (kind === 'contractor_license' ? ((c.states || [])[0] || '') : ''),
          label: renewalPrompt.label || '',
          expiresOn: renewalPrompt.expiresOn || '',
          attachments: att,
        },
      });
      setRenewalPrompt(null);
    };
    const dismissRenewalPrompt = () => setRenewalPrompt(null);
    const closeRenewalEditor = () => setRenewalEditor(null);
    const saveRenewalEditor = async (patch) => {
      const { id, ...rest } = patch;
      await window.RenewalsStore.add(rest);
      closeRenewalEditor();
    };
    const deleteRenewalEditor = async () => {
      if (renewalEditor && renewalEditor.renewal && renewalEditor.renewal.id) {
        await window.RenewalsStore.remove(renewalEditor.renewal.id);
      }
      closeRenewalEditor();
    };

    const removeDoc = async (d) => {
      if (!confirm(`Delete "${d.name}"?`)) return;
      await window.DocumentsStore.remove(d.id);
    };

    const actionBtn = (
      <button onClick={triggerFilePicker} disabled={!!uploading} style={{
        background: 'transparent', border: 'none',
        color: pal.accent, fontSize: 12, fontWeight: 600,
        cursor: uploading ? 'default' : 'pointer', fontFamily: 'inherit', padding: 0,
      }}>{uploading ? `Uploading…` : '+ Upload'}</button>
    );

    return (
      <>
      <Section pal={pal} title="Documents" badge={sorted.length} action={actionBtn}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {parsing && (
            <div style={{
              fontSize: 11.5, color: pal.textSoft,
              padding: '6px 10px',
              border: `1px dashed ${pal.border}`, borderRadius: 6,
            }}>Reading document for renewal details…</div>
          )}

          {renewalPrompt && (
            <div style={{
              padding: '10px 12px',
              background: pal.accentSoft || (pal.accent + '12'),
              border: `1px solid ${pal.accent}40`,
              borderRadius: 8,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                textTransform: 'uppercase', color: pal.accent }}>
                Looks like a renewal — log it?
              </div>
              <div style={{ fontSize: 12.5, color: pal.text, lineHeight: 1.5 }}>
                {renewalPrompt.expiresOn && (<div><b>Expires:</b> {renewalPrompt.expiresOn}</div>)}
                {renewalPrompt.state && (<div><b>State:</b> {renewalPrompt.state}</div>)}
                {renewalPrompt.label && (<div><b>License / type:</b> {renewalPrompt.label}</div>)}
                {renewalPrompt.licenseNumber && (<div><b>Number:</b> {renewalPrompt.licenseNumber}</div>)}
                <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 3 }}>
                  Extracted from {renewalPrompt.sourceFile}. Confidence {Math.round((renewalPrompt.confidence || 0) * 100)}%.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                <button onClick={acceptRenewalPrompt}
                  style={{
                    padding: '6px 12px',
                    background: pal.accent, color: '#fff',
                    border: 'none', borderRadius: 6,
                    fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>Log renewal</button>
                <button onClick={dismissRenewalPrompt}
                  style={{
                    padding: '6px 10px',
                    background: 'transparent', color: pal.textSoft,
                    border: `1px solid ${pal.border}`, borderRadius: 6,
                    fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>Not a renewal</button>
              </div>
            </div>
          )}

          {sorted.length === 0 && !adding && (
            <div style={{ fontSize: 12, color: pal.textFaint, fontStyle: 'italic',
              padding: '4px 0' }}>
              No documents yet. Upload a PDF or paste a share link.
            </div>
          )}
          {sorted.map((d) => {
            const meta = KIND_META[d.kind] || { abbr: 'FILE', full: 'File', color: pal.textSoft };
            const isUpload = d.source === 'upload';
            const sub = isUpload
              ? `${meta.full} · ${helpers.formatBytes ? helpers.formatBytes(d.size) : ''} · added ${formatDate(new Date(d.addedAt).toISOString().slice(0, 10))}`
              : `${meta.full} · added ${formatDate(new Date(d.addedAt).toISOString().slice(0, 10))}`;
            const open = (e) => {
              e.preventDefault();
              window.DocumentsStore.open(d);
            };
            return (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px',
                background: pal.cardAlt,
                border: `1px solid ${pal.borderSoft}`, borderRadius: 7,
              }}>
                <span style={{
                  flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 42, padding: '3px 7px',
                  background: meta.color + '20', color: meta.color,
                  fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6,
                  borderRadius: 4, fontFamily: 'ui-monospace, monospace',
                }}>{meta.abbr}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={d.url || '#'} onClick={open} style={{
                    fontSize: 12.5, color: pal.text, fontWeight: 500,
                    textDecoration: 'none', display: 'block',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{d.name}</a>
                  <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
                </div>
                <button onClick={() => removeDoc(d)} title="Delete document"
                  style={{
                    border: 'none', background: 'transparent',
                    color: pal.textFaint, fontSize: 16, lineHeight: 1,
                    cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = pal.warn; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = pal.textFaint; }}>×</button>
              </div>
            );
          })}

          {adding && (
            <div style={{
              padding: 10, background: pal.cardAlt,
              border: `1px dashed ${pal.border}`, borderRadius: 7,
              display: 'flex', flexDirection: 'column', gap: 7,
            }}>
              <input autoFocus
                placeholder="Paste URL — Google Doc, Drive, Dropbox…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitLink(); } if (e.key === 'Escape') resetLink(); }}
                style={{
                  width: '100%', padding: '7px 10px',
                  fontSize: 12.5, color: pal.text, background: pal.card,
                  border: `1px solid ${pal.border}`, borderRadius: 6,
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 7 }}>
                <input
                  placeholder="Display name (optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitLink(); } if (e.key === 'Escape') resetLink(); }}
                  style={{
                    flex: 1, padding: '7px 10px',
                    fontSize: 12.5, color: pal.text, background: pal.card,
                    border: `1px solid ${pal.border}`, borderRadius: 6,
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <button onClick={resetLink}
                  style={{
                    padding: '0 12px',
                    background: 'transparent', color: pal.textSoft,
                    border: `1px solid ${pal.border}`, borderRadius: 6,
                    fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Cancel</button>
                <button onClick={commitLink} disabled={!url.trim()}
                  style={{
                    padding: '0 14px',
                    background: url.trim() ? pal.accent : pal.chipBg,
                    color: url.trim() ? '#fff' : pal.textFaint,
                    border: 'none', borderRadius: 6,
                    fontSize: 12, fontWeight: 600,
                    cursor: url.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
                  }}>Add link</button>
              </div>
            </div>
          )}

          {!adding && (
            <button onClick={() => setAdding(true)} style={{
              padding: '6px 10px',
              background: 'transparent', color: pal.textSoft,
              border: `1px dashed ${pal.border}`, borderRadius: 7,
              fontSize: 11.5, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>+ Add link instead</button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={helpers.UPLOAD_ACCEPT || '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt'}
            onChange={onFileSelected}
            style={{ display: 'none' }}
          />
          {error && (
            <div style={{
              fontSize: 11.5, color: pal.warn,
              padding: '6px 10px',
              border: `1px solid ${pal.warn}`, borderRadius: 6,
              marginTop: 2,
            }}>{error}</div>
          )}
        </div>
      </Section>

      {renewalEditor && (
        <window.RenewalEditor
          renewal={renewalEditor.renewal}
          pal={pal}
          isNew={renewalEditor.isNew}
          onSave={saveRenewalEditor}
          onDelete={deleteRenewalEditor}
          onClose={closeRenewalEditor}
        />
      )}
      </>
    );
  }

  // Notes (placeholder for now — same UX pattern as todo notes; per-contractor
  // notes persist to localStorage so they survive refreshes even before we
  // wire a real backend).
  function NotesCard({ c, pal }) {
    return <window.NotesSection pal={pal} scope="contractor" scopeId={c.id}
      placeholder={`Anything worth remembering about ${c.name.split(' ')[0]} — preferences, history, quirks…`} />;
  }

  // ─── helpers ──────────────────────────────────────────────────────────────
  function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y) return '—';
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function formatDateShort(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y) return '—';
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function daysUntil(iso) {
    if (!iso) return 0;
    const [y, m, d] = iso.split('-').map(Number);
    const ms = new Date(y, m - 1, d).getTime() - Date.now();
    return Math.round(ms / 86400000);
  }

  // Shared modal chrome — used by ScheduleEditor and AssignmentEditor.
  function modalStyles(pal) {
    return {
      backdrop: {
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(16,18,22,.55)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40,
      },
      modal: {
        background: pal.card, color: pal.text,
        borderRadius: 14, width: '100%', maxWidth: 560,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 30px 80px rgba(0,0,0,.35), 0 0 0 1px ' + pal.border,
        overflow: 'hidden',
        fontFamily: '"Public Sans", system-ui, sans-serif',
      },
      header: {
        padding: '14px 20px',
        borderBottom: `1px solid ${pal.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
      },
      body: {
        padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto',
      },
      label: {
        fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: pal.textFaint, marginBottom: 5,
      },
      input: {
        width: '100%', padding: '8px 11px',
        fontSize: 14, color: pal.text,
        background: pal.cardAlt,
        border: `1px solid ${pal.border}`, borderRadius: 7,
        outline: 'none', fontFamily: 'inherit', lineHeight: 1.4,
      },
      row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
      pillRow: { display: 'flex', gap: 6 },
      pill: (on, color) => ({
        flex: 1, minHeight: 32, padding: '6px 8px',
        fontSize: 12, fontWeight: 600,
        textAlign: 'center', whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 7,
        border: `1px solid ${on ? color : pal.border}`,
        background: on ? color + '18' : 'transparent',
        color: on ? color : pal.textSoft,
        cursor: 'pointer', userSelect: 'none',
      }),
      footer: {
        padding: '12px 20px',
        borderTop: `1px solid ${pal.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
      },
      btnPrimary: {
        padding: '8px 16px',
        background: pal.accent, color: '#fff',
        border: 'none', borderRadius: 7,
        fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
      },
      btnSecondary: {
        padding: '8px 14px',
        background: 'transparent', color: pal.textSoft,
        border: `1px solid ${pal.border}`, borderRadius: 7,
        fontSize: 13, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit',
      },
      btnDanger: {
        padding: '8px 14px',
        background: 'transparent', color: pal.warn,
        border: `1px solid ${pal.warn}40`, borderRadius: 7,
        fontSize: 13, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit',
      },
      btnIcon: {
        width: 28, height: 28, padding: 0,
        background: 'transparent', color: pal.textSoft,
        border: 'none', borderRadius: 6,
        fontSize: 18, lineHeight: 1, cursor: 'pointer',
      },
    };
  }

  window.ContractorsListPage = ContractorsListPage;
  window.ContractorDetailPage = ContractorDetailPage;
})();
