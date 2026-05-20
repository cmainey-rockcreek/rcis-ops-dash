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
    const todos = window.useTodos();

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

    const sortedFiltered = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      let rows = window.RCIS_DATA.CONTRACTORS.filter((c) => {
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
        load:   (c) => c.assigned / Math.max(1, c.cap),
        status: (c) => c.status,
      }[sort.key] || ((c) => c.name);
      rows = [...rows].sort((a, b) => {
        const av = accessor(a), bv = accessor(b);
        if (av < bv) return -dirMul;
        if (av > bv) return  dirMul;
        return 0;
      });
      return rows;
    }, [query, statusFilter, specFilter, openTodosOnly, sort, idsWithOpenTodos]);

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
            <button style={btnPrimary(pal)}>
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
                <ContractorRow key={c.id} c={c} pal={pal} />
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  function ContractorRow({ c, pal }) {
    const free = c.cap - c.assigned;
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
          <CapacityBar assigned={c.assigned} cap={c.cap} track={pal.chipBg} fill={pal.accent} />
          <div style={{ fontSize: 10, color: pal.textFaint, marginTop: 3,
            fontVariantNumeric: 'tabular-nums', display: 'flex', justifyContent: 'space-between' }}>
            <span>{c.assigned}/{c.cap}h</span>
            {free > 0 && <span style={{ color: pal.accent, fontWeight: 600 }}>+{free}h free</span>}
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
    const c = window.getContractor(id);
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
    const free = c.cap - c.assigned;
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
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: pal.text, letterSpacing: -0.3 }}>{c.name}</h1>
            <SpecChip code={c.spec} size="lg" />
            <StatusPill status={c.status} />
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 18,
            marginTop: 6, fontSize: 12.5, color: pal.textSoft,
          }}>
            <Field icon="user" label={c.email} />
            <Field icon="user" label={c.phone} />
            <Field icon="map" label={c.city} />
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
            <Kpi pal={pal} label="Cost"     value={`$${c.rates.hourly}`} sub="/hour" />
            <Kpi pal={pal} label="Bill"     value={`$${c.rates.bill}`}   sub="/hour" />
            <Kpi pal={pal} label="Load"     value={`${c.assigned}h`}     sub={`of ${c.cap}h`} />
            <Kpi pal={pal} label="Free"     value={`${Math.max(0, free)}h`} sub="this week"
                 valueColor={free > 0 ? pal.accent : pal.textFaint} />
            <Kpi pal={pal} label="Revenue"  value={`$${(c.rates.bill * c.assigned * 4).toLocaleString()}`} sub="/month"
                 valueColor={pal.accent} />
            <Kpi pal={pal} label="Margin"   value={`$${((c.rates.bill - c.rates.hourly) * c.assigned * 4).toLocaleString()}`} sub="/month" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnSecondary(pal)}>Edit</button>
            <button style={btnPrimary(pal)}>Assign to school</button>
          </div>
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

  // Capacity summary
  function CapacityCard({ c, pal }) {
    const directTotal = c.assignments.filter((a) => a.status === 'active').reduce((s, a) => s + (a.direct || 0), 0);
    const indirectTotal = c.assignments.filter((a) => a.status === 'active').reduce((s, a) => s + (a.indirect || 0), 0);
    return (
      <Section pal={pal} title="Capacity this week">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <CapacityBar assigned={c.assigned} cap={c.cap} height={10} track={pal.chipBg} fill={pal.accent} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, color: pal.textSoft, fontVariantNumeric: 'tabular-nums' }}>
              <span><b style={{ color: pal.text, fontWeight: 600 }}>{c.assigned}h</b> booked of {c.cap}h cap</span>
              <span style={{ color: pal.accent, fontWeight: 600 }}>{Math.round((c.assigned/c.cap)*100)}%</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, paddingTop: 8, borderTop: `1px solid ${pal.borderSoft}` }}>
          <SplitStat pal={pal} label="Direct therapy" value={`${directTotal}h`} note="face-to-face with students" color={pal.accent} />
          <SplitStat pal={pal} label="Indirect time"  value={`${indirectTotal}h`} note="paperwork, meetings, prep" color="#C98A2C" />
          <SplitStat pal={pal} label="Schools"        value={c.schools} note="active assignments" />
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

  // Schedule grid (4 blocks × 5 days)
  function ScheduleCard({ c, pal }) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const blocks = [
      { name: 'AM',    range: '8 – 11' },
      { name: 'Mid',   range: '11 – 1' },
      { name: 'PM',    range: '1 – 4' },
      { name: 'Late',  range: '4 – 6' },
    ];
    return (
      <Section pal={pal} title="Weekly schedule" action="Edit schedule">
        <div style={{
          display: 'grid',
          gridTemplateColumns: '64px repeat(5, 1fr)',
          gap: 6,
        }}>
          <div />
          {days.map((d) => (
            <div key={d} style={{
              fontSize: 10.5, fontWeight: 600, color: pal.textFaint,
              textAlign: 'center', letterSpacing: 0.4, textTransform: 'uppercase',
            }}>{d}</div>
          ))}
          {blocks.map((b, bi) => (
            <React.Fragment key={b.name}>
              <div style={{
                fontSize: 11, color: pal.textSoft,
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}>
                <span style={{ fontWeight: 600, color: pal.text }}>{b.name}</span>
                <span style={{ fontSize: 10, color: pal.textFaint }}>{b.range}</span>
              </div>
              {days.map((_, di) => {
                const load = (c.schedule[bi] || [])[di] || 0;
                return <ScheduleCell key={di} load={load} pal={pal} />;
              })}
            </React.Fragment>
          ))}
        </div>
        <div style={{
          display: 'flex', gap: 12, fontSize: 10.5, color: pal.textFaint,
          paddingTop: 6, borderTop: `1px solid ${pal.borderSoft}`,
        }}>
          <LegendDot pal={pal} load={0} label="Open" />
          <LegendDot pal={pal} load={1} label="Light" />
          <LegendDot pal={pal} load={2} label="Active" />
          <LegendDot pal={pal} load={3} label="Full" />
        </div>
      </Section>
    );
  }
  function ScheduleCell({ load, pal }) {
    const fills = [
      pal.chipBg,
      pal.accent + '33',
      pal.accent + '88',
      pal.accent,
    ];
    return (
      <div style={{
        height: 32, borderRadius: 5,
        background: fills[load],
        border: `1px solid ${load === 0 ? pal.borderSoft : 'transparent'}`,
      }} />
    );
  }
  function LegendDot({ pal, load, label }) {
    const fills = [pal.chipBg, pal.accent + '33', pal.accent + '88', pal.accent];
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3,
          background: fills[load], border: `1px solid ${load === 0 ? pal.border : 'transparent'}` }} />
        {label}
      </span>
    );
  }

  // Assignments — current + past
  function AssignmentsCard({ c, pal }) {
    const active = c.assignments.filter((a) => a.status === 'active');
    const past   = c.assignments.filter((a) => a.status === 'completed');
    return (
      <Section pal={pal} title="Assignments" badge={c.assignments.length} action="+ Add assignment">
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
          textTransform: 'uppercase', color: pal.textFaint, marginBottom: -4 }}>
          Active · {active.length}
        </div>
        <AssignmentTable rows={active} pal={pal} active />
        {past.length > 0 && (
          <>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
              textTransform: 'uppercase', color: pal.textFaint, marginTop: 6, marginBottom: -4 }}>
              History · {past.length}
            </div>
            <AssignmentTable rows={past} pal={pal} />
          </>
        )}
      </Section>
    );
  }
  function AssignmentTable({ rows, pal, active }) {
    if (!rows.length) {
      return (
        <div style={{ fontSize: 12, color: pal.textFaint, fontStyle: 'italic', padding: '6px 0' }}>None.</div>
      );
    }
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 1.2fr 80px 90px 90px',
        gap: 12, alignItems: 'center',
        fontSize: 12,
      }}>
        <Th pal={pal}>School</Th>
        <Th pal={pal}>District</Th>
        <Th pal={pal} right>Direct</Th>
        <Th pal={pal} right>Indirect</Th>
        <Th pal={pal} right>{active ? 'Since' : 'Dates'}</Th>
        {rows.map((a) => (
          <React.Fragment key={(a.schoolId || a.school) + a.startDate}>
            <div style={{ color: pal.text, fontWeight: 500, minWidth: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.school}</div>
            <div style={{ color: pal.textSoft, minWidth: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.district}</div>
            <div style={{ textAlign: 'right', color: pal.text, fontVariantNumeric: 'tabular-nums' }}>{a.direct}h</div>
            <div style={{ textAlign: 'right', color: pal.textSoft, fontVariantNumeric: 'tabular-nums' }}>{a.indirect}h</div>
            <div style={{ textAlign: 'right', fontSize: 11, color: pal.textFaint }}>
              {active ? formatDate(a.startDate) : `${formatDateShort(a.startDate)} → ${formatDateShort(a.endDate)}`}
            </div>
          </React.Fragment>
        ))}
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

  window.ContractorsListPage = ContractorsListPage;
  window.ContractorDetailPage = ContractorDetailPage;
})();
