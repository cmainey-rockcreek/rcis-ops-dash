// Districts page — list + detail. Most deals are done at the district level,
// so this is the primary "client" entity. Schools live inside a district.

(function () {
  const { Icon, SpecChip, OwnerAvatar, CapacityBar } = window;

  // ─── Compute district-level rollups ───────────────────────────────────────
  // Returns { schools, students, contractorIds:Set, contractors:[{...}],
  // weeklyHours, annualRevenue, annualMargin, gaps:[] }.
  // Annualized at the 36-week school year (ContractorFinancials.WEEKS_PER_SCHOOL_YEAR)
  // so this rollup agrees with the contractor profile + Matchmaker views.
  function rollup(districtId) {
    const schools = window.RCIS_DATA.SCHOOLS.filter((s) => s.district === districtId);
    const contractorIds = new Set();
    const byContractor = {};
    let students = 0, weeklyHours = 0;
    let annualRevenue = 0, annualMargin = 0;
    const WEEKS = (window.ContractorFinancials && window.ContractorFinancials.WEEKS_PER_SCHOOL_YEAR) || 36;

    for (const s of schools) {
      students += s.students || 0;
      for (const cov of s.contractors || []) {
        contractorIds.add(cov.contractorId);
        const c = window.getContractor(cov.contractorId);
        if (!c) continue;
        weeklyHours += cov.hoursPerWeek || 0;
        // Roll the contractor's bill/pay into annual revenue/margin per
        // school × 36-week school year.
        annualRevenue += (c.rates.bill || 0) * (cov.hoursPerWeek || 0) * WEEKS;
        annualMargin  += ((c.rates.bill || 0) - (c.rates.hourly || 0)) * (cov.hoursPerWeek || 0) * WEEKS;

        if (!byContractor[cov.contractorId]) {
          byContractor[cov.contractorId] = {
            id: c.id, name: c.name, spec: c.spec,
            schoolCount: 0, hoursPerWeek: 0,
          };
        }
        byContractor[cov.contractorId].schoolCount += 1;
        byContractor[cov.contractorId].hoursPerWeek += cov.hoursPerWeek || 0;
      }
    }

    const gaps = window.RCIS_DATA.COVERAGE_GAPS.filter((g) => {
      const sch = schools.find((s) => g.school.startsWith(s.name.split(' ')[0]) && s.state === g.state);
      return !!sch;
    });

    return {
      schools,
      students,
      contractors: Object.values(byContractor).sort((a, b) => b.hoursPerWeek - a.hoursPerWeek),
      weeklyHours,
      annualRevenue: Math.round(annualRevenue),
      annualMargin: Math.round(annualMargin),
      gaps,
    };
  }

  // ─── List Page ────────────────────────────────────────────────────────────
  function DistrictsListPage({ dark = false }) {
    return (
      <window.PageShell dark={dark} activePage="districts"
                        searchPlaceholder="Search districts by name or state…">
        {(pal) => <DistrictsList pal={pal} />}
      </window.PageShell>
    );
  }

  function DistrictsList({ pal }) {
    const [query, setQuery] = React.useState('');
    const [sort, setSort] = React.useState({ key: 'name', dir: 'asc' });

    const rows = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      const all = window.RCIS_DATA.DISTRICTS
        .filter((d) => !q || d.name.toLowerCase().includes(q) || d.state.toLowerCase().includes(q))
        .map((d) => ({ ...d, _r: rollup(d.id) }));

      const dirMul = sort.dir === 'asc' ? 1 : -1;
      const acc = {
        name:     (d) => d.name,
        state:    (d) => d.state,
        schools:  (d) => d._r.schools.length || d.schools,
        students: (d) => d._r.students,
        revenue:  (d) => d._r.annualRevenue,
      }[sort.key] || ((d) => d.name);
      return [...all].sort((a, b) => {
        const av = acc(a), bv = acc(b);
        if (av < bv) return -dirMul;
        if (av > bv) return  dirMul;
        return 0;
      });
    }, [query, sort]);

    const totals = React.useMemo(() => {
      let students = 0, revenue = 0, contractors = new Set();
      for (const d of rows) {
        students += d._r.students;
        revenue += d._r.annualRevenue;
        for (const c of d._r.contractors) contractors.add(c.id);
      }
      return { students, revenue, contractors: contractors.size };
    }, [rows]);

    return (
      <div style={{
        flex: 1, padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: pal.text, letterSpacing: -0.3 }}>Districts</h1>
          <span style={{ fontSize: 13, color: pal.textSoft }}>
            {rows.length} of {window.RCIS_DATA.DISTRICTS.length}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={btnSecondary(pal)}>
              <Icon name="filter" size={13} stroke={1.8} /> Export CSV
            </button>
            <button style={btnPrimary(pal)}>
              <Icon name="plus" size={13} stroke={2.4} /> Add district
            </button>
          </div>
        </div>

        {/* Rollup strip */}
        <div style={{ display: 'flex', gap: 10 }}>
          <RollupTile pal={pal} label="Monthly revenue" value={`$${totals.revenue.toLocaleString()}`} accent />
          <RollupTile pal={pal} label="Total students"  value={totals.students.toLocaleString()} />
          <RollupTile pal={pal} label="Contractors deployed" value={totals.contractors} />
          <RollupTile pal={pal} label="Districts"       value={rows.length} />
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px',
          background: pal.card, border: `1px solid ${pal.border}`,
          borderRadius: 9,
        }}>
          <Icon name="search" size={15} color={pal.textFaint} stroke={1.8} />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="Search by district name or state…"
                 style={{
                   flex: 1, border: 'none', outline: 'none',
                   background: 'transparent', color: pal.text,
                   fontSize: 13, fontFamily: 'inherit',
                 }} />
        </div>

        {/* Table */}
        <div style={{
          background: pal.card, border: `1px solid ${pal.border}`,
          borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '32px 2fr 60px 90px 100px 1.2fr 140px',
            gap: 12, alignItems: 'center',
            padding: '10px 14px',
            background: pal.cardAlt,
            borderBottom: `1px solid ${pal.border}`,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
            color: pal.textFaint, textTransform: 'uppercase',
          }}>
            <span />
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="name"     label="District" />
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="state"    label="State" />
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="schools"  label="Schools"  right />
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="students" label="Students" right />
            <span>Contractors</span>
            <SortHeader pal={pal} sort={sort} setSort={setSort} k="revenue"  label="Monthly rev." right />
          </div>

          {rows.map((d) => <DistrictRow key={d.id} d={d} pal={pal} />)}
        </div>
      </div>
    );
  }

  function RollupTile({ pal, label, value, accent }) {
    return (
      <div style={{
        flex: 1, padding: '12px 14px',
        background: pal.card,
        border: `1px solid ${pal.border}`,
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.9,
          color: pal.textFaint, textTransform: 'uppercase' }}>{label}</div>
        <div style={{
          fontSize: 24, fontWeight: 600,
          color: accent ? pal.accent : pal.text,
          letterSpacing: -0.5, lineHeight: 1.1, marginTop: 4,
          fontVariantNumeric: 'tabular-nums',
        }}>{value}</div>
      </div>
    );
  }

  function DistrictRow({ d, pal }) {
    const r = d._r;
    const scount = r.schools.length || d.schools;
    return (
      <window.Link to={`/districts/${d.id}`} style={{
        display: 'grid',
        gridTemplateColumns: '32px 2fr 60px 90px 100px 1.2fr 140px',
        gap: 12, alignItems: 'center',
        padding: '12px 14px',
        borderBottom: `1px solid ${pal.borderSoft}`,
        textDecoration: 'none', color: 'inherit',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = pal.cardAlt}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <span style={{
          width: 32, height: 32, borderRadius: 7,
          background: pal.accentSoft, color: pal.accent,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="school" size={16} stroke={2} />
        </span>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: pal.text, fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
          {r.gaps.length > 0 && (
            <div style={{ fontSize: 11, color: pal.warn, marginTop: 2, fontWeight: 500 }}>
              {r.gaps.length} open coverage gap{r.gaps.length === 1 ? '' : 's'}
            </div>
          )}
        </div>

        <span style={{ fontSize: 12, color: pal.textSoft, fontFamily: 'ui-monospace, monospace' }}>{d.state}</span>

        <span style={{ textAlign: 'right', fontSize: 12.5, color: pal.text, fontWeight: 500,
          fontVariantNumeric: 'tabular-nums' }}>{scount}</span>

        <span style={{ textAlign: 'right', fontSize: 12, color: pal.textSoft,
          fontVariantNumeric: 'tabular-nums' }}>{r.students.toLocaleString()}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {r.contractors.length === 0 ? (
            <span style={{ fontSize: 11, color: pal.textFaint }}>—</span>
          ) : (
            <>
              <div style={{ display: 'flex' }}>
                {r.contractors.slice(0, 5).map((c, i) => (
                  <span key={c.id} style={{
                    marginLeft: i === 0 ? 0 : -6,
                    width: 22, height: 22, borderRadius: 11,
                    background: window.specColor(c.spec), color: '#fff',
                    boxShadow: `0 0 0 1.5px ${pal.card}`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8.5, fontWeight: 700,
                  }} title={c.name}>{c.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
                ))}
              </div>
              <span style={{ fontSize: 11, color: pal.textSoft, marginLeft: 4, fontVariantNumeric: 'tabular-nums' }}>
                {r.contractors.length}
              </span>
            </>
          )}
        </div>

        <span style={{ textAlign: 'right', fontSize: 14, color: pal.accent, fontWeight: 600,
          fontVariantNumeric: 'tabular-nums' }}>
          ${r.annualRevenue.toLocaleString()}
        </span>
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
  function DistrictDetailPage({ dark = false, id }) {
    return (
      <window.PageShell dark={dark} activePage="districts">
        {(pal) => <DistrictDetail pal={pal} id={id} />}
      </window.PageShell>
    );
  }

  function DistrictDetail({ pal, id }) {
    const d = window.RCIS_DATA.DISTRICTS.find((x) => x.id === id);
    if (!d) {
      return (
        <div style={{ flex: 1, padding: 40, color: pal.textSoft }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: pal.text }}>District not found</div>
          <window.Link to="/districts" style={{ color: pal.accent, fontWeight: 500, marginTop: 12, display: 'inline-block' }}>← Back to districts</window.Link>
        </div>
      );
    }
    const r = rollup(d.id);

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{
          padding: '14px 24px 0', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: pal.textSoft,
        }}>
          <window.Link to="/districts" style={{ color: pal.textSoft, textDecoration: 'none', fontWeight: 500 }}>
            ← Districts
          </window.Link>
          <span style={{ color: pal.textFaint }}>/</span>
          <span style={{ color: pal.text, fontWeight: 500 }}>{d.name}</span>
        </div>

        <DistrictHeader d={d} r={r} pal={pal} />

        <div style={{
          padding: '0 24px 32px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)',
          gap: 16,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <SchoolsInDistrict r={r} pal={pal} />
            <window.ContactsSection pal={pal} scope="district" scopeId={d.id} />
            <ContractorsAcross r={r} pal={pal} />
            <DistrictGapsCard d={d} pal={pal} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <RevenueCard r={r} pal={pal} />
            <LinkedTodosCard d={d} pal={pal} />
            <ContractCard d={d} pal={pal} />
            <window.DocumentsSection pal={pal} scope="district" scopeId={d.id} />
            <NotesCard d={d} pal={pal} />
          </div>
        </div>
      </div>
    );
  }

  function DistrictHeader({ d, r, pal }) {
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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: pal.text, letterSpacing: -0.3 }}>{d.name}</h1>
          <div style={{ fontSize: 13, color: pal.textSoft, marginTop: 4 }}>
            {d.state}
            {' · '}{r.schools.length} school{r.schools.length === 1 ? '' : 's'}
            {' · '}{r.students.toLocaleString()} students
            {' · '}{r.contractors.length} active contractor{r.contractors.length === 1 ? '' : 's'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{
            display: 'flex', gap: 18, padding: '10px 14px',
            background: pal.card, border: `1px solid ${pal.border}`, borderRadius: 9,
          }}>
            <Kpi pal={pal} label="Schools"  value={r.schools.length} />
            <Kpi pal={pal} label="Hours"    value={`${r.weeklyHours}h`} sub="per week" />
            <Kpi pal={pal} label="Revenue"  value={`$${r.annualRevenue.toLocaleString()}`} sub="/year" valueColor={pal.accent} />
            <Kpi pal={pal} label="Margin"   value={`$${r.annualMargin.toLocaleString()}`} sub="/year" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnSecondary(pal)}>Edit</button>
            <button style={btnPrimary(pal)}>+ Add school</button>
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
          <span style={{ fontSize: 17, fontWeight: 600, color: valueColor || pal.text, letterSpacing: -0.3, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
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

  function SchoolsInDistrict({ r, pal }) {
    return (
      <Section pal={pal} title="Schools in this district" badge={r.schools.length} action="+ Add school">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '24px 2fr 70px 80px 90px 1fr',
            gap: 12, alignItems: 'center',
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6,
            color: pal.textFaint, textTransform: 'uppercase',
            borderBottom: `1px solid ${pal.borderSoft}`, paddingBottom: 6,
          }}>
            <span />
            <span>School</span>
            <span>Band</span>
            <span style={{ textAlign: 'right' }}>Students</span>
            <span style={{ textAlign: 'right' }}>Hours / wk</span>
            <span>Contractors</span>
          </div>
          {r.schools.map((s) => {
            const hours = (s.contractors || []).reduce((sum, c) => sum + c.hoursPerWeek, 0);
            return (
              <window.Link key={s.id} to={`/schools/${s.id}`} style={{
                display: 'grid', gridTemplateColumns: '24px 2fr 70px 80px 90px 1fr',
                gap: 12, alignItems: 'center',
                padding: '9px 0',
                borderBottom: `1px solid ${pal.borderSoft}`,
                textDecoration: 'none', color: 'inherit',
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 5,
                  background: pal.accentSoft, color: pal.accent,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="school" size={11} stroke={2} />
                </span>
                <span style={{ fontSize: 12.5, color: pal.text, fontWeight: 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                <span style={{ fontSize: 11, color: pal.textSoft }}>{s.gradeBand}</span>
                <span style={{ textAlign: 'right', fontSize: 12, color: pal.textSoft, fontVariantNumeric: 'tabular-nums' }}>{s.students.toLocaleString()}</span>
                <span style={{ textAlign: 'right', fontSize: 12, color: hours > 0 ? pal.text : pal.warn,
                  fontWeight: hours > 0 ? 500 : 600, fontVariantNumeric: 'tabular-nums' }}>
                  {hours > 0 ? `${hours}h` : 'No coverage'}
                </span>
                <div style={{ display: 'flex' }}>
                  {(s.contractors || []).slice(0, 4).map((c, i) => (
                    <span key={c.contractorId} style={{
                      marginLeft: i === 0 ? 0 : -5,
                      width: 20, height: 20, borderRadius: 10,
                      background: window.specColor(c.spec), color: '#fff',
                      boxShadow: `0 0 0 1.5px ${pal.card}`,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, fontWeight: 700,
                    }} title={c.name}>{c.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
                  ))}
                </div>
              </window.Link>
            );
          })}
        </div>
      </Section>
    );
  }

  function ContractorsAcross({ r, pal }) {
    return (
      <Section pal={pal} title="Contractors across this district" badge={r.contractors.length}>
        {r.contractors.length === 0 ? (
          <div style={{ fontSize: 12.5, color: pal.textFaint, fontStyle: 'italic' }}>
            No contractors currently assigned to schools in this district.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {r.contractors.map((c) => (
              <window.Link key={c.id} to={`/contractors/${c.id}`} style={{
                display: 'grid', gridTemplateColumns: '36px 1.5fr 60px 1fr 80px',
                gap: 12, alignItems: 'center',
                padding: '8px 0',
                borderBottom: `1px solid ${pal.borderSoft}`,
                textDecoration: 'none', color: 'inherit',
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 14,
                  background: window.specColor(c.spec), color: '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                }}>{c.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
                <span style={{ fontSize: 13, color: pal.text, fontWeight: 500 }}>{c.name}</span>
                <SpecChip code={c.spec} />
                <span style={{ fontSize: 11.5, color: pal.textSoft }}>
                  {c.schoolCount} school{c.schoolCount === 1 ? '' : 's'} in district
                </span>
                <span style={{ textAlign: 'right', fontSize: 12, color: pal.text, fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums' }}>{c.hoursPerWeek}h / wk</span>
              </window.Link>
            ))}
          </div>
        )}
      </Section>
    );
  }

  function DistrictGapsCard({ d, pal }) {
    const all = window.useCoverageGaps ? window.useCoverageGaps() : [];
    const gaps = React.useMemo(
      () => all.filter((g) => g.status === 'open' && g.districtId === d.id),
      [all, d.id],
    );
    const [editor, setEditor] = React.useState(null);

    const openLogDistrict = () => setEditor({
      isNew: true,
      gap: {
        scope: 'district',
        schoolId: null,
        schoolName: null,
        districtId: d.id,
        districtName: d.name,
        state: d.state,
      },
    });
    const openEdit = (g) => setEditor({ isNew: false, gap: { ...g } });
    const closeEditor = () => setEditor(null);
    const saveEditor = async (patch) => {
      if (editor.isNew) {
        const { id, ...rest } = patch;
        await window.GapsStore.add(rest);
      } else {
        await window.GapsStore.update(editor.gap.id, patch);
      }
      closeEditor();
    };
    const deleteEditor = async () => {
      await window.GapsStore.remove(editor.gap.id);
      closeEditor();
    };

    const logAction = (
      <button onClick={openLogDistrict} style={{
        background: 'transparent', border: 'none',
        color: pal.accent, fontSize: 12, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit', padding: 0,
      }}>+ Log district-wide gap</button>
    );

    return (
      <>
        <Section pal={pal} title="Open coverage" badge={gaps.length} action={logAction}>
          {gaps.length === 0 ? (
            <div style={{ fontSize: 12.5, color: pal.textFaint, fontStyle: 'italic' }}>
              No open coverage gaps in this district.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gaps.map((g) => {
                const where = g.scope === 'district'
                  ? `${g.districtName} (district-wide)`
                  : g.schoolName;
                return (
                  <button key={g.id} onClick={() => openEdit(g)} style={{
                    padding: '10px 12px',
                    background: g.priority === 'urgent' ? pal.warnSoft : pal.cardAlt,
                    border: `1px solid ${g.priority === 'urgent' ? pal.warn + '40' : pal.borderSoft}`,
                    borderRadius: 7,
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', textAlign: 'left',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    <SpecChip code={g.spec} filled />
                    <div style={{ flex: 1, fontSize: 12.5, color: pal.text }}>
                      <span style={{ fontWeight: 600 }}>{where}</span>
                      <span style={{ color: pal.textSoft }}> · {g.hours}h / wk · open {districtGapPostedLabel(g)}</span>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                      color: g.priority === 'urgent' ? pal.warn : pal.textSoft,
                    }}>{g.priority}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Section>
        {editor && window.GapEditor && (
          <window.GapEditor
            gap={editor.gap}
            pal={pal}
            isNew={editor.isNew}
            onSave={saveEditor}
            onDelete={deleteEditor}
            onClose={closeEditor}
          />
        )}
      </>
    );
  }

  function districtGapPostedLabel(g) {
    if (!g || !g.postedAt) return 'today';
    const days = Math.floor((Date.now() - g.postedAt) / (24 * 60 * 60 * 1000));
    if (days <= 0) return 'today';
    return `${days}d`;
  }

  function RevenueCard({ r, pal }) {
    const marginPct = r.annualRevenue > 0 ? Math.round((r.annualMargin / r.annualRevenue) * 100) : 0;
    return (
      <Section pal={pal} title="Revenue">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
              color: pal.textFaint, textTransform: 'uppercase' }}>Annualized</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3 }}>
              <span style={{ fontSize: 24, fontWeight: 600, color: pal.accent,
                letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>
                ${r.annualRevenue.toLocaleString()}
              </span>
              <span style={{ fontSize: 11.5, color: pal.textFaint }}>
                margin ${r.annualMargin.toLocaleString()} ({marginPct}%)
              </span>
            </div>
          </div>
          <div style={{
            fontSize: 10.5, color: pal.textFaint, paddingTop: 10,
            borderTop: `1px solid ${pal.borderSoft}`, lineHeight: 1.5,
          }}>
            Each active contractor's <b>bill rate × hours / week × 36-week school year</b>.
            Matches the contractor profile and Matchmaker views.
          </div>
        </div>
      </Section>
    );
  }

  function LinkedTodosCard({ d, pal }) {
    const todos = window.useTodos();
    const linked = React.useMemo(
      () => todos.filter((t) => t.linkedTo && t.linkedTo.type === 'district' && t.linkedTo.id === d.id),
      [todos, d.id],
    );
    const open = linked.filter((t) => t.column !== 'done');
    const done = linked.filter((t) => t.column === 'done');
    const PRIO = { high: '#D97757', medium: '#C98A2C', low: '#7A8290' };
    const Mini = ({ t, faded }) => (
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
    return (
      <Section pal={pal} title="Open todos" badge={open.length}>
        {open.length === 0 ? (
          <div style={{ fontSize: 12.5, color: pal.textFaint, fontStyle: 'italic' }}>
            No open todos linked to this district.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {open.map((t) => <Mini key={t.id} t={t} />)}
          </div>
        )}
        {done.length > 0 && (
          <details style={{ marginTop: 6 }}>
            <summary style={{ fontSize: 11.5, color: pal.textSoft, cursor: 'pointer' }}>
              Show {done.length} completed
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {done.map((t) => <Mini key={t.id} t={t} faded />)}
            </div>
          </details>
        )}
      </Section>
    );
  }

  function ContractCard({ d, pal }) {
    // Districts don't yet have their own contract record; show a placeholder
    // until we wire one. Derive a faux MSA date from the first school.
    return (
      <Section pal={pal} title="Contract">
        <div style={{ fontSize: 12.5, color: pal.textFaint, lineHeight: 1.5 }}>
          District-level MSA tracking not wired yet. For now, each school in this
          district carries its own contract record — open a school to see it.
        </div>
      </Section>
    );
  }

  function NotesCard({ d, pal }) {
    return <window.NotesSection pal={pal} scope="district" scopeId={d.id}
      placeholder={`Notes about ${d.name} — main contacts, contract quirks, history…`} />;
  }

  window.DistrictsListPage = DistrictsListPage;
  window.DistrictDetailPage = DistrictDetailPage;
})();
