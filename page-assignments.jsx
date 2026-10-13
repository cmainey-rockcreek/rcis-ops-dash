// AssignmentsPage — every assignment in the company on one page, so the
// team can answer "which schools have which contractors" without opening
// each contractor. Reads through window.useAllAssignments (mock seeds +
// persisted rows, one shape) and opens the same AssignmentEditor the
// contractor page uses, so there is still only one editor.
//
// Route: #/assignments
//
// Two layouts behind a header toggle:
//   By school — sections ordered by district, then school. District-wide
//               assignments get their own "<District> · district-wide"
//               section, placed first within that district.
//   Table     — one flat sortable row per assignment.
// Filters (search, specialty, district, show-completed) apply to both.
// No pay or bill rate columns — weekly gross margin only.

(function () {
  const { SpecChip, Icon } = window;

  function AssignmentsPage({ dark = false }) {
    return (
      <window.PageShell dark={dark} activePage="assignments"
                        searchPlaceholder="Search contractors, schools, contacts, tasks…">
        {(pal) => <AssignmentsList pal={pal} />}
      </window.PageShell>
    );
  }

  const GROUPED_COLS = '2.2fr 70px 80px 95px 95px 110px';
  const FLAT_COLS    = '1.7fr 1.7fr 70px 80px 95px 95px 110px';

  function AssignmentsList({ pal }) {
    const rows = window.useAllAssignments ? window.useAllAssignments() : [];
    const [view, setView] = React.useState('grouped'); // 'grouped' | 'table'
    const [query, setQuery] = React.useState('');
    const [specFilter, setSpecFilter] = React.useState('all');
    const [districtFilter, setDistrictFilter] = React.useState('all');
    const [showCompleted, setShowCompleted] = React.useState(false);
    const [sort, setSort] = React.useState({ key: 'place', dir: 'asc' });
    const [editor, setEditor] = React.useState(null);
    const [picking, setPicking] = React.useState(false);

    const F = window.ContractorFinancials;
    const fmt = (F && F.formatUSD) || ((n) => `$${Math.round(Number(n) || 0).toLocaleString()}`);

    const districts = window.useDistrictsView
      ? window.useDistrictsView((window.RCIS_DATA && window.RCIS_DATA.DISTRICTS) || [])
      : ((window.RCIS_DATA && window.RCIS_DATA.DISTRICTS) || []);

    // Attach the derived money + hours once per row. Margin is computed per
    // row (not across the set) because default pay differs per contractor.
    // weeklyMargin() only counts active rows, so completed rows get null
    // and render as "—" rather than a misleading $0. Same for a row whose
    // bill rate can't be resolved (no district rate card and no spec
    // default yet): the contractor page shows "—" for its Bill column in
    // that case, and a margin of "−pay" would be noise, not information.
    const enriched = React.useMemo(() => rows.map((r) => {
      const weeklyHours = (Number(r.direct) || 0) + (Number(r.indirect) || 0);
      const bill = (F && F.effectiveBill) ? F.effectiveBill(r, 0, r.spec) : 0;
      const weeklyMargin = (r.status === 'active' && bill > 0 && F && F.weeklyMargin)
        ? F.weeklyMargin([r], { pay: r.defaultPay, spec: r.spec })
        : null;
      const place = r.schoolName || (r.districtName ? `${r.districtName} · district-wide` : '—');
      return { ...r, weeklyHours, weeklyMargin, place };
    }), [rows, F]);

    const visible = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      return enriched.filter((r) => {
        if (!showCompleted && r.status !== 'active') return false;
        if (specFilter !== 'all' && r.spec !== specFilter) return false;
        if (districtFilter !== 'all' && r.districtId !== districtFilter) return false;
        if (!q) return true;
        return `${r.contractorName} ${r.schoolName} ${r.districtName}`.toLowerCase().includes(q);
      });
    }, [enriched, query, specFilter, districtFilter, showCompleted]);

    // Grouped view: one section per school, or per district for
    // district-wide rows. Ordered by district name, then district-wide
    // first, then school name. Contractors alphabetical within a section.
    const groups = React.useMemo(() => {
      const map = new Map();
      for (const r of visible) {
        const key = r.schoolId ? 's:' + r.schoolId : 'd:' + (r.districtId || 'none');
        if (!map.has(key)) {
          map.set(key, {
            key,
            districtWide: !r.schoolId,
            schoolName: r.schoolName,
            districtName: r.districtName,
            rows: [],
          });
        }
        map.get(key).rows.push(r);
      }
      const out = [...map.values()];
      out.sort((a, b) => {
        const d = (a.districtName || '').localeCompare(b.districtName || '');
        if (d) return d;
        if (a.districtWide !== b.districtWide) return a.districtWide ? -1 : 1;
        return (a.schoolName || '').localeCompare(b.schoolName || '');
      });
      out.forEach((g) => g.rows.sort((a, b) => (a.contractorName || '').localeCompare(b.contractorName || '')));
      return out;
    }, [visible]);

    // Flat view: sortable.
    const sortedFlat = React.useMemo(() => {
      const dirMul = sort.dir === 'asc' ? 1 : -1;
      const accessor = {
        contractor: (r) => r.contractorName || '',
        spec:       (r) => r.spec || '',
        place:      (r) => `${r.districtName || ''} ${r.place}`,
        direct:     (r) => r.direct,
        indirect:   (r) => r.indirect,
        start:      (r) => r.startDate || '',
        end:        (r) => r.endDate || '',
        margin:     (r) => (r.weeklyMargin == null ? -Infinity : r.weeklyMargin),
      }[sort.key] || ((r) => r.place);
      return [...visible].sort((a, b) => {
        const av = accessor(a), bv = accessor(b);
        if (av < bv) return -dirMul;
        if (av > bv) return  dirMul;
        return (a.contractorName || '').localeCompare(b.contractorName || '');
      });
    }, [visible, sort]);

    // Totals over visible *active* rows only — completed rows carry no
    // weekly hours or margin in any rollup elsewhere in the app.
    const totals = React.useMemo(() => {
      const active = visible.filter((r) => r.status === 'active');
      return {
        count: active.length,
        hours: active.reduce((s, r) => s + r.weeklyHours, 0),
        margin: active.reduce((s, r) => s + (r.weeklyMargin || 0), 0),
        // Rows with no resolvable bill rate contribute nothing to margin;
        // say so rather than present a partial sum as the whole.
        unpriced: active.filter((r) => r.weeklyMargin == null).length,
      };
    }, [visible]);

    // ── Edit / new / delete — same handlers as AssignmentsCard on the
    //    contractor page, so both entry points behave identically.
    const openEdit = (r) => {
      if (r.source !== 'supabase' || !r._id) return;
      const full = window.AssignmentsStore.get().find((x) => x.id === r._id);
      if (!full) return;
      setEditor({ isNew: false, assignment: { ...full } });
    };
    const openNewFor = (c) => {
      setPicking(false);
      setEditor({
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

    // ── CSV of exactly what is on screen, in display order.
    const exportCSV = () => {
      if (!window.downloadCSV) return;
      const header = ['Contractor', 'Specialty', 'School', 'District', 'Scope',
        'Direct h', 'Indirect h', 'Weekly h', 'Start', 'End', 'Status',
        'Weekly margin', 'Source'];
      const order = view === 'grouped' ? groups.flatMap((g) => g.rows) : sortedFlat;
      const data = order.map((r) => [
        r.contractorName, r.spec,
        r.schoolId ? r.schoolName : '',
        r.districtName || '',
        r.schoolId ? 'school' : 'district-wide',
        r.direct, r.indirect, r.weeklyHours,
        r.startDate || '', r.endDate || '',
        r.status,
        r.weeklyMargin == null ? '' : Math.round(r.weeklyMargin),
        r.source === 'mock' ? 'seed' : 'supabase',
      ]);
      window.downloadCSV(`assignments-${new Date().toISOString().slice(0, 10)}.csv`, header, data);
    };

    const SPEC_OPTS = [
      { key: 'all', label: 'All' },
      ...((window.RCIS_DATA && window.RCIS_DATA.SPECIALTIES) || []).map((s) => ({ key: s.code, label: s.code, color: s.color })),
    ];
    const cols = view === 'grouped' ? GROUPED_COLS : FLAT_COLS;
    // Count completed rows that the *other* filters would show, so the chip
    // never promises rows that toggling it won't reveal.
    const completedCount = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      return enriched.filter((r) => {
        if (r.status === 'active') return false;
        if (specFilter !== 'all' && r.spec !== specFilter) return false;
        if (districtFilter !== 'all' && r.districtId !== districtFilter) return false;
        if (!q) return true;
        return `${r.contractorName} ${r.schoolName} ${r.districtName}`.toLowerCase().includes(q);
      }).length;
    }, [enriched, query, specFilter, districtFilter]);

    return (
      <div style={{
        flex: 1, padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        overflow: 'hidden', minHeight: 0,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: pal.text, letterSpacing: -0.3 }}>Assignments</h1>
          <span style={{ fontSize: 13, color: pal.textSoft, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {totals.count} active · {formatHours(totals.hours)} h/week · {fmt(totals.margin)} weekly margin
            {totals.unpriced > 0 && (
              <span title="These rows have no district rate card and no specialty default bill rate yet, so their margin is not included.">
                {' '}· {totals.unpriced} without a bill rate
              </span>
            )}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <ViewToggle pal={pal} value={view} onChange={setView} />
            <button onClick={exportCSV} style={btnSecondary(pal)} title="Download the rows currently shown">
              <Icon name="file" size={13} stroke={1.8} /> Export CSV
            </button>
            <button onClick={() => setPicking(true)} style={btnPrimary(pal)}>
              <Icon name="plus" size={13} stroke={2.4} /> New assignment
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px',
            background: pal.card, border: `1px solid ${pal.border}`,
            borderRadius: 9,
          }}>
            <Icon name="search" size={15} color={pal.textFaint} stroke={1.8} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
                   placeholder="Search by contractor, school, or district…"
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
            <FilterGroup pal={pal} label="Specialty" options={SPEC_OPTS}
                         value={specFilter} onChange={setSpecFilter} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: pal.textFaint,
                textTransform: 'uppercase', letterSpacing: 0.5 }}>District</span>
              <select value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)} style={{
                height: 26, padding: '0 8px', borderRadius: 999,
                border: `1px solid ${districtFilter !== 'all' ? pal.accent : pal.border}`,
                background: districtFilter !== 'all' ? pal.accentSoft : pal.inputBg,
                color: districtFilter !== 'all' ? pal.accent : pal.textSoft,
                fontSize: 11.5, fontWeight: districtFilter !== 'all' ? 600 : 500,
                fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
                maxWidth: 260,
              }}>
                <option value="all">All districts</option>
                {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <button onClick={() => setShowCompleted((v) => !v)} style={{
              padding: '4px 10px', borderRadius: 999,
              border: `1px solid ${showCompleted ? pal.accent : pal.border}`,
              background: showCompleted ? pal.accentSoft : 'transparent',
              color: showCompleted ? pal.accent : pal.textSoft,
              fontSize: 11.5, fontWeight: showCompleted ? 600 : 500,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <Icon name="check" size={11} stroke={2} />
              Show completed
              <span style={{
                fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                color: showCompleted ? pal.accent : pal.textFaint,
              }}>{completedCount}</span>
            </button>
          </div>
        </div>

        {/* Table card — its own scroll container so header + filters stay put. */}
        <div style={{
          background: pal.card, border: `1px solid ${pal.border}`,
          borderRadius: 10,
          flex: 1, minHeight: 0,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: cols,
            gap: 12, alignItems: 'center',
            padding: '10px 14px',
            background: pal.cardAlt,
            borderBottom: `1px solid ${pal.border}`,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
            color: pal.textFaint, textTransform: 'uppercase',
            flexShrink: 0,
          }}>
            {view === 'grouped' ? (
              <>
                <span>Contractor</span>
                <span style={{ textAlign: 'right' }}>Direct</span>
                <span style={{ textAlign: 'right' }}>Indirect</span>
                <span style={{ textAlign: 'right' }}>Start</span>
                <span style={{ textAlign: 'right' }}>End</span>
                <span style={{ textAlign: 'right' }}>Wk margin</span>
              </>
            ) : (
              <>
                <SortHeader pal={pal} sort={sort} setSort={setSort} k="contractor" label="Contractor" />
                <SortHeader pal={pal} sort={sort} setSort={setSort} k="place"      label="School / District" />
                <SortHeader pal={pal} sort={sort} setSort={setSort} k="direct"     label="Direct" right />
                <SortHeader pal={pal} sort={sort} setSort={setSort} k="indirect"   label="Indirect" right />
                <SortHeader pal={pal} sort={sort} setSort={setSort} k="start"      label="Start" right />
                <SortHeader pal={pal} sort={sort} setSort={setSort} k="end"        label="End" right />
                <SortHeader pal={pal} sort={sort} setSort={setSort} k="margin"     label="Wk margin" right />
              </>
            )}
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {visible.length === 0 ? (
              <div style={{ padding: '40px 14px', textAlign: 'center', color: pal.textFaint, fontSize: 13 }}>
                {rows.length === 0 ? 'No assignments yet.' : 'No assignments match your filters.'}
              </div>
            ) : view === 'grouped' ? (
              groups.map((g, gi) => (
                <div key={g.key} style={{ borderTop: gi === 0 ? 'none' : `1px solid ${pal.borderSoft}` }}>
                  <div style={{
                    padding: '10px 14px 4px',
                    display: 'flex', alignItems: 'baseline', gap: 6,
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
                    color: pal.textFaint, textTransform: 'uppercase',
                    whiteSpace: 'nowrap', overflow: 'hidden',
                  }}>
                    <span style={{ color: pal.textSoft, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {g.districtWide ? (g.districtName || 'No district') : (g.schoolName || 'Unknown school')}
                    </span>
                    <span>·</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {g.districtWide ? 'district-wide' : (g.districtName || 'No district')}
                    </span>
                    <span>·</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{g.rows.length}</span>
                  </div>
                  {g.rows.map((r) => (
                    <AssignmentRow key={r.key} r={r} pal={pal} cols={cols} flat={false} fmt={fmt} onClick={openEdit} />
                  ))}
                  <div style={{ height: 6 }} />
                </div>
              ))
            ) : (
              sortedFlat.map((r) => (
                <AssignmentRow key={r.key} r={r} pal={pal} cols={cols} flat fmt={fmt} onClick={openEdit} />
              ))
            )}
          </div>
        </div>

        {picking && (
          <ContractorPickerModal pal={pal} onPick={openNewFor} onClose={() => setPicking(false)} />
        )}
        {editor && window.AssignmentEditor && (
          <window.AssignmentEditor
            assignment={editor.assignment}
            isNew={editor.isNew}
            pal={pal}
            onSave={save}
            onDelete={del}
            onClose={close}
          />
        )}
      </div>
    );
  }

  // ─── One row (both views) ─────────────────────────────────────────────────
  function AssignmentRow({ r, pal, cols, flat, fmt, onClick }) {
    const editable = r.source === 'supabase' && !!r._id;
    const dim = r.status !== 'active';
    const [hover, setHover] = React.useState(false);
    const cell = {
      minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      fontSize: 12.5, color: pal.text,
    };
    const num = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
    return (
      <div
        onClick={editable ? () => onClick(r) : undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={editable ? 'Open assignment' : 'Seed data — read-only'}
        style={{
          display: 'grid', gridTemplateColumns: cols,
          gap: 12, alignItems: 'center',
          padding: '7px 14px',
          background: hover && editable ? pal.cardAlt : 'transparent',
          cursor: editable ? 'pointer' : 'default',
          opacity: dim ? 0.55 : 1,
        }}>
        <div style={{ ...cell, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ContractorAvatar name={r.contractorName} spec={r.spec} size={24} />
          <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {r.contractorName || '—'}
          </span>
          {r.spec && <SpecChip code={r.spec} />}
          {r.attachmentCount > 0 && (
            <span title={`${r.attachmentCount} attachment${r.attachmentCount === 1 ? '' : 's'}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 2,
                flexShrink: 0, fontSize: 10, fontWeight: 600,
                color: pal.textSoft, padding: '1px 5px', borderRadius: 3,
                background: pal.chipBg,
              }}>
              <Icon name="file" size={9.5} stroke={2} />
              {r.attachmentCount}
            </span>
          )}
          {r.source === 'mock' && (
            <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700,
              color: pal.textFaint, background: pal.chipBg,
              padding: '1px 5px', borderRadius: 3, letterSpacing: 0.4 }}>SEED</span>
          )}
        </div>
        {flat && (
          <div style={{ ...cell, display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.place}</span>
            {r.schoolId && r.districtName && (
              <span style={{ fontSize: 11, color: pal.textFaint, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.districtName}</span>
            )}
          </div>
        )}
        <div style={num}>{formatHours(r.direct)}h</div>
        <div style={{ ...num, color: pal.textSoft }}>{formatHours(r.indirect)}h</div>
        <div style={{ ...num, fontSize: 11.5, color: pal.textFaint }}>{formatDateShort(r.startDate)}</div>
        <div style={{ ...num, fontSize: 11.5, color: pal.textFaint }}>{r.endDate ? formatDateShort(r.endDate) : '—'}</div>
        <div style={{ ...num, fontWeight: 600, color: r.weeklyMargin == null ? pal.textFaint : (r.weeklyMargin < 0 ? pal.warn : pal.text) }}>
          {r.weeklyMargin == null ? '—' : fmt(r.weeklyMargin)}
        </div>
      </div>
    );
  }

  // ─── Contractor picker — step one of "New assignment" ─────────────────────
  // The editor is contractor-scoped (it cannot move an assignment between
  // contractors), so pick the contractor first and open the editor
  // prefilled exactly the way the contractor page's "+ Add assignment" does.
  function ContractorPickerModal({ pal, onPick, onClose }) {
    const catalog = window.useContractors
      ? window.useContractors()
      : ((window.RCIS_DATA && window.RCIS_DATA.CONTRACTORS) || []);
    const list = window.useContractorsView ? window.useContractorsView(catalog) : catalog;
    const [q, setQ] = React.useState('');
    const s = window.assignmentModalStyles ? window.assignmentModalStyles(pal) : fallbackModalStyles(pal);

    React.useEffect(() => {
      const onKey = (e) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const matches = React.useMemo(() => {
      const t = q.trim().toLowerCase();
      return list
        .filter((c) => !t || `${c.name} ${c.spec} ${(c.states || []).join(' ')} ${c.city || ''}`.toLowerCase().includes(t))
        .slice(0, 60);
    }, [list, q]);

    return (
      <div style={s.backdrop} onClick={onClose}>
        <div style={{ ...s.modal, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
          <div style={s.header}>
            <div style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>New assignment</div>
            <button style={s.btnIcon} onClick={onClose} aria-label="Close">×</button>
          </div>
          <div style={{ ...s.body, gap: 10 }}>
            <div>
              <div style={s.label}>Contractor</div>
              <input autoFocus style={s.input} value={q} onChange={(e) => setQ(e.target.value)}
                     placeholder="Search by name, specialty, state…" />
            </div>
            <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {matches.length === 0 ? (
                <div style={{ padding: '14px 10px', fontSize: 12.5, color: pal.textFaint, fontStyle: 'italic' }}>
                  No contractors match.
                </div>
              ) : matches.map((c) => (
                <PickRow key={c.id} c={c} pal={pal} onPick={onPick} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  function PickRow({ c, pal, onPick }) {
    const [hover, setHover] = React.useState(false);
    return (
      <div onClick={() => onPick(c)}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
          background: hover ? pal.accentSoft : 'transparent',
        }}>
        <ContractorAvatar name={c.name} spec={c.spec} size={26} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: pal.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
          <div style={{ fontSize: 11, color: pal.textFaint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[(c.states || []).join(', '), c.city].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
        {c.spec && <SpecChip code={c.spec} />}
      </div>
    );
  }

  // ─── Small UI pieces ──────────────────────────────────────────────────────
  function ContractorAvatar({ name, spec, size = 24 }) {
    const color = window.specColor ? window.specColor(spec) : '#888';
    const initials = (name || '').split(/\s+/).filter(Boolean).slice(0, 2)
      .map((w) => w[0].toUpperCase()).join('') || '?';
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: '50%',
        background: color + '22', color,
        fontSize: Math.round(size * 0.38), fontWeight: 700, letterSpacing: 0.2,
        flexShrink: 0,
      }}>{initials}</span>
    );
  }

  function ViewToggle({ pal, value, onChange }) {
    const opts = [{ k: 'grouped', label: 'By school' }, { k: 'table', label: 'Table' }];
    return (
      <div role="group" aria-label="Layout" style={{
        display: 'inline-flex', height: 30, borderRadius: 7, overflow: 'hidden',
        border: `1px solid ${pal.border}`,
      }}>
        {opts.map((o, i) => {
          const on = o.k === value;
          return (
            <button key={o.k} onClick={() => onChange(o.k)} style={{
              padding: '0 12px', border: 'none',
              borderLeft: i === 0 ? 'none' : `1px solid ${pal.border}`,
              background: on ? pal.accentSoft : 'transparent',
              color: on ? pal.accent : pal.textSoft,
              fontSize: 12.5, fontWeight: on ? 600 : 500,
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>{o.label}</button>
          );
        })}
      </div>
    );
  }

  // Copied from page-contractors.jsx (file-private there), as the other
  // list pages do.
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
      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    };
  }
  function btnSecondary(pal) {
    return {
      height: 30, padding: '0 12px', borderRadius: 7,
      background: 'transparent', color: pal.textSoft,
      border: `1px solid ${pal.border}`,
      fontSize: 12.5, fontWeight: 500,
      display: 'inline-flex', alignItems: 'center', gap: 5,
      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    };
  }
  function fallbackModalStyles(pal) {
    return {
      backdrop: { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(16,18,22,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 },
      modal: { background: pal.card, color: pal.text, borderRadius: 14, width: '100%',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
      header: { padding: '14px 20px', borderBottom: `1px solid ${pal.border}`, display: 'flex', alignItems: 'center', gap: 10 },
      body: { padding: '16px 20px', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
      label: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: pal.textFaint, marginBottom: 5 },
      input: { width: '100%', padding: '8px 11px', fontSize: 14, color: pal.text, background: pal.cardAlt,
        border: `1px solid ${pal.border}`, borderRadius: 7, outline: 'none', fontFamily: 'inherit' },
      btnIcon: { width: 28, height: 28, padding: 0, background: 'transparent', color: pal.textSoft,
        border: 'none', borderRadius: 6, fontSize: 18, lineHeight: 1, cursor: 'pointer' },
    };
  }
  function formatHours(n) {
    const v = Number(n) || 0;
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '');
  }
  function formatDateShort(iso) {
    if (!iso) return '—';
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y) return '—';
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  window.AssignmentsPage = AssignmentsPage;
})();
