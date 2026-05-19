// Schools / Districts pages.
//
// Routes:
//   /schools         → list (all schools, filterable by district / state, search)
//   /schools/:id     → detail (header, contract, contractors, gaps, todos, docs, notes)
//
// Same Calm Ops palette/shell as contractors.

(function () {
  const { OwnerAvatar, SpecChip, CapacityBar, Icon } = window;

  // ─── List Page ────────────────────────────────────────────────────────────
  function SchoolsListPage({ dark = false }) {
    return (
      <window.PageShell dark={dark} activePage="schools"
                        searchPlaceholder="Search schools by name, district, state…">
        {(pal) => <SchoolsList pal={pal} />}
      </window.PageShell>
    );
  }

  function SchoolsList({ pal }) {
    const [query, setQuery] = React.useState('');
    const [districtFilter, setDistrictFilter] = React.useState('all');
    const [coverageFilter, setCoverageFilter] = React.useState(false); // unfilled only
    const [openTodosOnly, setOpenTodosOnly] = React.useState(false);
    const [sort, setSort] = React.useState({ key: 'name', dir: 'asc' });
    const todos = window.useTodos();

    // Schools with at least one open todo linked to them OR their district.
    const idsWithOpenTodos = React.useMemo(() => {
      const s = new Set();
      for (const t of todos) {
        if (t.column === 'done' || !t.linkedTo) continue;
        if (t.linkedTo.type === 'school')   s.add('s:' + t.linkedTo.id);
        if (t.linkedTo.type === 'district') s.add('d:' + t.linkedTo.id);
      }
      return s;
    }, [todos]);

    const idsWithGaps = React.useMemo(() => {
      const m = {};
      for (const g of window.RCIS_DATA.COVERAGE_GAPS) {
        // Coverage gaps record school name (not id) — match by name.
        const sch = window.RCIS_DATA.SCHOOLS.find((s) => g.school.startsWith(s.name.split(' ')[0]) && s.state === g.state);
        if (sch) m[sch.id] = true;
      }
      return m;
    }, []);

    const sortedFiltered = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      let rows = window.RCIS_DATA.SCHOOLS.filter((s) => {
        if (districtFilter !== 'all' && s.district !== districtFilter) return false;
        if (coverageFilter && !idsWithGaps[s.id]) return false;
        if (openTodosOnly && !idsWithOpenTodos.has('s:' + s.id) && !idsWithOpenTodos.has('d:' + s.district)) return false;
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          s.districtName.toLowerCase().includes(q) ||
          s.state.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q)
        );
      });
      const dirMul = sort.dir === 'asc' ? 1 : -1;
      const accessor = {
        name:       (s) => s.name,
        district:   (s) => s.districtName,
        state:      (s) => s.state,
        band:       (s) => s.gradeBand,
        students:   (s) => s.students,
        coverage:   (s) => (s.contractors || []).length,
      }[sort.key] || ((s) => s.name);
      rows = [...rows].sort((a, b) => {
        const av = accessor(a), bv = accessor(b);
        if (av < bv) return -dirMul;
        if (av > bv) return  dirMul;
        return 0;
      });
      return rows;
    }, [query, districtFilter, coverageFilter, openTodosOnly, sort, idsWithOpenTodos, idsWithGaps]);

    const DISTRICT_OPTS = [
      { key: 'all', label: 'All districts' },
      ...window.RCIS_DATA.DISTRICTS.map((d) => ({ key: d.id, label: d.name })),
    ];

    return (
      <div style={{
        flex: 1, padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: pal.text, letterSpacing: -0.3 }}>Schools</h1>
          <span style={{ fontSize: 13, color: pal.textSoft }}>
            {sortedFiltered.length} of {window.RCIS_DATA.SCHOOLS.length}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={btnSecondary(pal)}>
              <Icon name="filter" size={13} stroke={1.8} /> Export CSV
            </button>
            <button style={btnPrimary(pal)}>
              <Icon name="plus" size={13} stroke={2.4} /> Add school
            </button>
          </div>
        </div>

        {/* District selector */}
        <DistrictSelect pal={pal} value={districtFilter} onChange={setDistrictFilter} />

        {/* Search + filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px',
            background: pal.card, border: `1px solid ${pal.border}`,
            borderRadius: 9,
          }}>
            <Icon name="search" size={15} color={pal.textFaint} stroke={1.8} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
                   placeholder="Search by school, district, state, city…"
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
            <button onClick={() => setCoverageFilter((v) => !v)} style={chipBtn(pal, coverageFilter)}>
              <Icon name="flame" size={11} stroke={2} />
              Unfilled coverage
            </button>
            <button onClick={() => setOpenTodosOnly((v) => !v)} style={chipBtn(pal, openTodosOnly)}>
              <Icon name="list" size={11} stroke={2} />
              With open todos
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{
          background: pal.card, border: `1px solid ${pal.border}`,
          borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '28px 2fr 1.4fr 60px 70px 70px 1fr',
            gap: 12, alignItems: 'center',
            padding: '10px 14px',
            background: pal.cardAlt,
            borderBottom: `1px solid ${pal.border}`,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
            color: pal.textFaint, textTransform: 'uppercase',
          }}>
            <span />
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="name"     label="School" />
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="district" label="District" />
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="state"    label="State" />
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="band"     label="Band" />
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="students" label="Students" right />
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="coverage" label="Coverage" />
          </div>

          {sortedFiltered.length === 0 ? (
            <div style={{
              padding: '40px 14px', textAlign: 'center',
              color: pal.textFaint, fontSize: 13,
            }}>No schools match your filters.</div>
          ) : (
            sortedFiltered.map((s) => (
              <SchoolRow key={s.id} s={s} pal={pal} hasGap={!!idsWithGaps[s.id]} />
            ))
          )}
        </div>
      </div>
    );
  }

  function DistrictSelect({ pal, value, onChange }) {
    const ds = window.RCIS_DATA.DISTRICTS;
    const totalSchools = ds.reduce((sum, d) => sum + d.schools, 0);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: pal.textFaint,
          textTransform: 'uppercase', letterSpacing: 0.5,
        }}>District</span>
        <div style={{ position: 'relative' }}>
          <select value={value} onChange={(e) => onChange(e.target.value)}
                  style={{
                    appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                    height: 30, padding: '0 28px 0 12px',
                    background: pal.card,
                    border: `1px solid ${pal.border}`, borderRadius: 7,
                    color: pal.text, fontSize: 12.5, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                    minWidth: 220,
                  }}>
            <option value="all">All districts ({totalSchools} schools)</option>
            {ds.map((d) => (
              <option key={d.id} value={d.id}>{d.name} · {d.state} ({d.schools})</option>
            ))}
          </select>
          <span style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            pointerEvents: 'none', color: pal.textFaint, fontSize: 9,
          }}>▼</span>
        </div>
      </div>
    );
  }

  function DistrictStrip({ pal, value, onChange }) {
    const ds = window.RCIS_DATA.DISTRICTS;
    const totalSchools = ds.reduce((sum, d) => sum + d.schools, 0);
    return (
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto',
        paddingBottom: 4,
      }}>
        <DistrictChip pal={pal} on={value === 'all'}
          onClick={() => onChange('all')}
          name="All districts" count={totalSchools} />
        {ds.map((d) => (
          <DistrictChip key={d.id} pal={pal} on={value === d.id}
            onClick={() => onChange(d.id)}
            name={d.name} state={d.state} count={d.schools} />
        ))}
      </div>
    );
  }
  function DistrictChip({ pal, on, onClick, name, state, count }) {
    return (
      <button onClick={onClick} style={{
        flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        padding: '7px 12px',
        background: on ? pal.accentSoft : pal.card,
        border: `1px solid ${on ? pal.accent : pal.border}`,
        borderRadius: 9,
        color: on ? pal.accent : pal.text,
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      }}>
        <span style={{ fontSize: 12, fontWeight: on ? 700 : 600, whiteSpace: 'nowrap' }}>{name}</span>
        <span style={{ fontSize: 10.5, color: on ? pal.accent : pal.textFaint, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
          {state ? `${state} · ` : ''}{count} schools
        </span>
      </button>
    );
  }

  function SchoolRow({ s, pal, hasGap }) {
    const contractors = s.contractors || [];
    return (
      <window.Link to={`/schools/${s.id}`} style={{
        display: 'grid',
        gridTemplateColumns: '28px 2fr 1.4fr 60px 70px 70px 1fr',
        gap: 12, alignItems: 'center',
        padding: '10px 14px',
        borderBottom: `1px solid ${pal.borderSoft}`,
        textDecoration: 'none', color: 'inherit',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = pal.cardAlt}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <span style={{
          width: 28, height: 28, borderRadius: 6,
          background: pal.accentSoft, color: pal.accent,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name="school" size={14} stroke={2} />
        </span>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13.5, color: pal.text, fontWeight: 500,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
            {hasGap && (
              <span title="Has open coverage gap" style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 0.4, color: pal.warn,
                background: pal.warnSoft, padding: '1px 5px', borderRadius: 3,
                flexShrink: 0,
              }}>GAP</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: pal.textFaint, marginTop: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.city}, {s.state}</div>
        </div>

        <div style={{ fontSize: 12, color: pal.textSoft, minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.districtName}</div>

        <div style={{ fontSize: 12, color: pal.textSoft, fontFamily: 'ui-monospace, monospace' }}>{s.state}</div>

        <div style={{ fontSize: 12, color: pal.textSoft }}>{s.gradeBand}</div>

        <div style={{ textAlign: 'right', fontSize: 12, color: pal.textSoft, fontVariantNumeric: 'tabular-nums' }}>
          {s.students.toLocaleString()}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {contractors.length === 0 ? (
            <span style={{ fontSize: 11, color: pal.warn, fontWeight: 600 }}>No coverage</span>
          ) : (
            <>
              <div style={{ display: 'flex' }}>
                {contractors.slice(0, 4).map((c, i) => (
                  <span key={c.contractorId} style={{
                    marginLeft: i === 0 ? 0 : -6,
                    width: 22, height: 22, borderRadius: 11,
                    background: window.specColor(c.spec),
                    color: '#fff',
                    boxShadow: `0 0 0 1.5px ${pal.card}`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8.5, fontWeight: 700, letterSpacing: 0.2,
                  }} title={c.name}>
                    {c.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                  </span>
                ))}
              </div>
              {contractors.length > 4 && (
                <span style={{ fontSize: 11, color: pal.textFaint, fontVariantNumeric: 'tabular-nums' }}>
                  +{contractors.length - 4}
                </span>
              )}
              <span style={{ fontSize: 11, color: pal.textSoft, marginLeft: 4, fontVariantNumeric: 'tabular-nums' }}>
                {contractors.length} contractor{contractors.length === 1 ? '' : 's'}
              </span>
            </>
          )}
        </div>
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
              }}>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  function chipBtn(pal, on) {
    return {
      padding: '4px 10px', borderRadius: 999,
      border: `1px solid ${on ? pal.accent : pal.border}`,
      background: on ? pal.accentSoft : 'transparent',
      color: on ? pal.accent : pal.textSoft,
      fontSize: 11.5, fontWeight: on ? 600 : 500,
      cursor: 'pointer', fontFamily: 'inherit',
      display: 'inline-flex', alignItems: 'center', gap: 5,
    };
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
  function SchoolDetailPage({ dark = false, id }) {
    return (
      <window.PageShell dark={dark} activePage="schools">
        {(pal) => <SchoolDetail pal={pal} id={id} />}
      </window.PageShell>
    );
  }

  function SchoolDetail({ pal, id }) {
    const s = window.getSchool(id);
    if (!s) {
      return (
        <div style={{ flex: 1, padding: 40, color: pal.textSoft }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: pal.text }}>School not found</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>No school with id <code>{id}</code>.</div>
          <window.Link to="/schools" style={{ color: pal.accent, fontWeight: 500, marginTop: 12, display: 'inline-block' }}>← Back to schools</window.Link>
        </div>
      );
    }
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{
          padding: '14px 24px 0', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: pal.textSoft,
        }}>
          <window.Link to="/schools" style={{ color: pal.textSoft, textDecoration: 'none', fontWeight: 500 }}>
            ← Schools
          </window.Link>
          <span style={{ color: pal.textFaint }}>/</span>
          <span style={{ color: pal.text, fontWeight: 500 }}>{s.name}</span>
        </div>

        <SchoolHeader s={s} pal={pal} />

        <div style={{
          padding: '0 24px 32px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)',
          gap: 16,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <ContractorsCard s={s} pal={pal} />
            <CoverageGapsCard s={s} pal={pal} />
            <ContactsCard s={s} pal={pal} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <LinkedTodosCard s={s} pal={pal} />
            <ContractCard s={s} pal={pal} />
            <DocumentsCard s={s} pal={pal} />
            <NotesCard s={s} pal={pal} />
          </div>
        </div>
      </div>
    );
  }

  function SchoolHeader({ s, pal }) {
    const contractors = s.contractors || [];
    const totalHours = contractors.reduce((sum, c) => sum + c.hoursPerWeek, 0);
    return (
      <div style={{ padding: '14px 24px 4px', display: 'flex', alignItems: 'flex-start', gap: 18 }}>
        <span style={{
          width: 54, height: 54, borderRadius: 10,
          background: pal.accentSoft, color: pal.accent,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name="school" size={26} stroke={1.8} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: pal.text, letterSpacing: -0.3 }}>{s.name}</h1>
            <span style={{
              fontSize: 11, fontWeight: 700, color: pal.text,
              padding: '3px 8px', borderRadius: 5, background: pal.chipBg, letterSpacing: 0.3,
            }}>{s.gradeBand}</span>
          </div>
          <div style={{ fontSize: 13, color: pal.textSoft, marginTop: 4 }}>
            <window.Link to="/schools" style={{ color: pal.textSoft, textDecoration: 'none', fontWeight: 500 }}>
              {s.districtName}
            </window.Link>
            {' · '}{s.state}
            {' · '}{s.students.toLocaleString()} students
          </div>
          <div style={{ fontSize: 12, color: pal.textFaint, marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>{s.address}</span>
            <span>📞 {s.mainPhone}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{
            display: 'flex', gap: 18, padding: '10px 14px',
            background: pal.card, border: `1px solid ${pal.border}`, borderRadius: 9,
          }}>
            <Kpi pal={pal} label="Contractors" value={contractors.length} sub={contractors.length === 1 ? 'active' : 'active'} />
            <Kpi pal={pal} label="Hours"       value={`${totalHours}h`} sub="per week" />
            <Kpi pal={pal} label="Contract"    value={s.contract.status} sub={`${s.contract.termYears}yr term`} valueColor={pal.accent} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnSecondary(pal)}>Edit</button>
            <button style={btnPrimary(pal)}>Assign contractor</button>
          </div>
        </div>
      </div>
    );
  }

  function Kpi({ pal, label, value, sub, valueColor }) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, color: pal.textFaint, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, justifyContent: 'center' }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: valueColor || pal.text, letterSpacing: -0.3, fontVariantNumeric: 'tabular-nums', textTransform: 'capitalize' }}>{value}</span>
          {sub && <span style={{ fontSize: 10, color: pal.textFaint }}>{sub}</span>}
        </div>
      </div>
    );
  }

  function Section({ pal, title, badge, action, children }) {
    return (
      <div style={{
        background: pal.card, border: `1px solid ${pal.border}`,
        borderRadius: 10, padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: pal.text }}>{title}</h3>
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

  function ContractorsCard({ s, pal }) {
    const list = s.contractors || [];
    return (
      <Section pal={pal} title="Contractors at this school" badge={list.length} action="+ Assign">
        {list.length === 0 ? (
          <div style={{ fontSize: 12.5, color: pal.textFaint, fontStyle: 'italic' }}>
            No contractors currently assigned.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '36px 1.5fr 60px 80px 80px 80px',
              gap: 12, alignItems: 'center',
              fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6,
              color: pal.textFaint, textTransform: 'uppercase',
              borderBottom: `1px solid ${pal.borderSoft}`,
              paddingBottom: 6,
            }}>
              <span />
              <span>Name</span>
              <span>Spec</span>
              <span style={{ textAlign: 'right' }}>Direct</span>
              <span style={{ textAlign: 'right' }}>Indirect</span>
              <span style={{ textAlign: 'right' }}>Since</span>
            </div>
            {list.map((c) => (
              <window.Link key={c.contractorId} to={`/contractors/${c.contractorId}`} style={{
                display: 'grid', gridTemplateColumns: '36px 1.5fr 60px 80px 80px 80px',
                gap: 12, alignItems: 'center',
                padding: '8px 0',
                textDecoration: 'none', color: 'inherit',
                borderBottom: `1px solid ${pal.borderSoft}`,
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 14,
                  background: window.specColor(c.spec),
                  color: '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                }}>{c.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
                <span style={{ color: pal.text, fontWeight: 500, fontSize: 13 }}>{c.name}</span>
                <SpecChip code={c.spec} />
                <span style={{ textAlign: 'right', fontSize: 12, color: pal.text, fontVariantNumeric: 'tabular-nums' }}>{c.direct}h</span>
                <span style={{ textAlign: 'right', fontSize: 12, color: pal.textSoft, fontVariantNumeric: 'tabular-nums' }}>{c.indirect}h</span>
                <span style={{ textAlign: 'right', fontSize: 11, color: pal.textFaint }}>{formatDateShort(c.startDate)}</span>
              </window.Link>
            ))}
          </div>
        )}
      </Section>
    );
  }

  function CoverageGapsCard({ s, pal }) {
    const gaps = window.RCIS_DATA.COVERAGE_GAPS.filter((g) =>
      g.school.startsWith(s.name.split(' ')[0]) && g.state === s.state
    );
    return (
      <Section pal={pal} title="Open coverage" badge={gaps.length} action={gaps.length ? '+ Add gap' : null}>
        {gaps.length === 0 ? (
          <div style={{ fontSize: 12.5, color: pal.textFaint, fontStyle: 'italic' }}>
            No open coverage gaps at this school. 🎉
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gaps.map((g) => (
              <div key={g.id} style={{
                padding: '10px 12px',
                background: g.priority === 'urgent' ? pal.warnSoft : pal.cardAlt,
                border: `1px solid ${g.priority === 'urgent' ? pal.warn + '40' : pal.borderSoft}`,
                borderRadius: 7,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <SpecChip code={g.spec} filled />
                <div style={{ flex: 1, fontSize: 12.5, color: pal.text }}>
                  <span style={{ fontWeight: 600 }}>{g.hours}h / wk</span>
                  <span style={{ color: pal.textSoft }}> · open {g.posted}</span>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                  color: g.priority === 'urgent' ? pal.warn : pal.textSoft,
                }}>{g.priority}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    );
  }

  function ContactsCard({ s, pal }) {
    return <window.ContactsSection pal={pal} scope="school" scopeId={s.id} />;
  }

  function ContractCard({ s, pal }) {
    const k = s.contract;
    const days = daysUntil(k.renewalDate);
    const tone = days < 30 ? pal.warn : days < 120 ? '#C98A2C' : pal.accent;
    return (
      <Section pal={pal} title="Contract">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
          <Row pal={pal} label="Status"     value={k.status} capitalize />
          <Row pal={pal} label="PO #"       value={k.poNumber} mono />
          <Row pal={pal} label="Term"       value={`${k.termYears} year${k.termYears > 1 ? 's' : ''}`} />
          <Row pal={pal} label="Signed"     value={formatDate(k.msaSignedDate)} />
          <Row pal={pal} label="Renews"
               valueNode={
                 <span style={{ color: tone, fontWeight: 600 }}>
                   {formatDate(k.renewalDate)}
                   <span style={{ color: pal.textFaint, fontWeight: 500, marginLeft: 6 }}>
                     ({days < 0 ? 'expired' : `${days}d`})
                   </span>
                 </span>
               } />
        </div>
      </Section>
    );
  }
  function Row({ pal, label, value, valueNode, mono, capitalize }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: pal.textFaint, fontWeight: 500 }}>{label}</span>
        <span style={{
          color: pal.text, fontWeight: 500,
          textAlign: 'right',
          fontFamily: mono ? 'ui-monospace, monospace' : 'inherit',
          textTransform: capitalize ? 'capitalize' : 'none',
        }}>{valueNode || value}</span>
      </div>
    );
  }

  function LinkedTodosCard({ s, pal }) {
    const todos = window.useTodos();
    const linked = React.useMemo(
      () => todos.filter((t) => t.linkedTo && (
        (t.linkedTo.type === 'school' && t.linkedTo.id === s.id) ||
        (t.linkedTo.type === 'district' && t.linkedTo.id === s.district)
      )),
      [todos, s.id, s.district],
    );
    const open = linked.filter((t) => t.column !== 'done');
    const done = linked.filter((t) => t.column === 'done');
    return (
      <Section pal={pal} title="Open todos" badge={open.length} action={open.length || done.length ? 'Open board →' : null}>
        {open.length === 0 ? (
          <div style={{ fontSize: 12.5, color: pal.textFaint, fontStyle: 'italic' }}>
            No open todos linked to this school or district.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {open.map((t) => <MiniTodo key={t.id} t={t} pal={pal} />)}
          </div>
        )}
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

  function DocumentsCard({ s, pal }) {
    return <window.DocumentsSection pal={pal} scope="school" scopeId={s.id} />;
  }

  function NotesCard({ s, pal }) {
    return <window.NotesSection pal={pal} scope="school" scopeId={s.id}
      placeholder={`Anything worth knowing about ${s.name} — quirks, preferences, history…`} />;
  }

  // helpers
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
    return Math.round((new Date(y, m - 1, d).getTime() - Date.now()) / 86400000);
  }

  window.SchoolsListPage = SchoolsListPage;
  window.SchoolDetailPage = SchoolDetailPage;
})();
