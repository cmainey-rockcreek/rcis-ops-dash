// SchedulePage — match coverage gaps to contractor availability.
//
// Two side-by-side panels: gaps on the left, contractors on the right.
// Selecting a gap surfaces the top contractors that match (same specialty
// and a covered state), ranked by free hours and status. Selecting a
// contractor flips it: the gaps panel ranks the top jobs that fit them.
// Each candidate row has a "Create task" button that opens the existing
// TodoEditor pre-filled, so the conversation finishes in the tasks flow.
//
// Operates on the existing mock data in window.RCIS_DATA — no DB writes.

(function () {
  const { SpecChip, PrioDot, Icon } = window;

  const STATUS_LABEL = {
    avail: 'Available',
    partial: 'Partial',
    full: 'Full',
    pto: 'PTO',
  };
  const STATUS_COLOR = (pal) => ({
    avail: '#3E8A57',
    partial: '#C98A2C',
    full: pal.textFaint,
    pto: pal.warn,
  });
  const PRIORITY_LABEL = {
    urgent: 'Urgent',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  const TOP_N = 5;
  const ONSITE_RADIUS_MILES = 100;

  // Flat default bill rate. Each gap carries its own `billRate` on the row;
  // inline edits in the Matchmaker write directly to Supabase via GapsStore.
  const DEFAULT_BILL_RATE = 85;

  function effectiveRate(gap, overrides) {
    const o = overrides && overrides[gap.id];
    if (Number.isFinite(o) && o > 0) return o;
    if (Number.isFinite(gap.billRate) && gap.billRate > 0) return gap.billRate;
    return DEFAULT_BILL_RATE;
  }
  function gapWeeklyRevenue(g, overrides) {
    return Math.round(g.hours * effectiveRate(g, overrides));
  }
  function gapMissedRevenue(g, overrides) {
    const days = daysPosted(g.posted);
    return Math.round(gapWeeklyRevenue(g, overrides) * (days / 7));
  }
  function fmtMoney(n) {
    if (!Number.isFinite(n)) return '$0';
    return '$' + Math.round(n).toLocaleString();
  }

  // City centroids for the metros the mock data uses. Keyed by "City, ST" so
  // the same city name in two states (Charleston SC vs WV) doesn't collide.
  const CITY_COORDS = {
    // VA
    'Reston, VA':       [38.960, -77.357],
    'Fairfax, VA':      [38.847, -77.307],
    'Arlington, VA':    [38.880, -77.103],
    'Richmond, VA':     [37.541, -77.434],
    'Alexandria, VA':   [38.804, -77.047],
    'Vienna, VA':       [38.901, -77.265],
    'Sterling, VA':     [39.006, -77.428],
    'Manassas, VA':     [38.751, -77.475],
    'Leesburg, VA':     [39.116, -77.564],
    // NC
    'Raleigh, NC':      [35.779, -78.639],
    'Charlotte, NC':    [35.227, -80.843],
    'Durham, NC':       [35.994, -78.899],
    'Cary, NC':         [35.792, -78.781],
    'Greensboro, NC':   [36.073, -79.792],
    'Apex, NC':         [35.733, -78.850],
    'Wake Forest, NC':  [35.980, -78.510],
    // MD
    'Bethesda, MD':     [38.984, -77.094],
    'Rockville, MD':    [39.084, -77.153],
    'Silver Spring, MD':[38.991, -77.026],
    'Frederick, MD':    [39.414, -77.410],
    'Gaithersburg, MD': [39.144, -77.202],
    'Potomac, MD':      [39.018, -77.209],
    // SC
    'Charleston, SC':   [32.776, -79.931],
    'Mt. Pleasant, SC': [32.794, -79.863],
    'Columbia, SC':     [34.001, -81.034],
    'Summerville, SC':  [33.018, -80.176],
    // DC
    'Washington, DC':   [38.907, -77.037],
    // WV
    'Morgantown, WV':   [39.629, -79.956],
    'Charleston, WV':   [38.349, -81.633],
  };

  function freeHours(c) {
    return Math.max(0, (c.cap || 0) - (c.assigned || 0));
  }
  function daysPosted(g) {
    if (!g) return 0;
    if (Number.isFinite(g)) return Math.max(0, Math.floor((Date.now() - g) / (24 * 60 * 60 * 1000)));
    if (typeof g === 'string') {
      const m = /^(\d+)d/.exec(g);
      return m ? parseInt(m[1], 10) : 0;
    }
    if (Number.isFinite(g.postedAt)) {
      return Math.max(0, Math.floor((Date.now() - g.postedAt) / (24 * 60 * 60 * 1000)));
    }
    if (typeof g.posted === 'string') {
      const m = /^(\d+)d/.exec(g.posted);
      return m ? parseInt(m[1], 10) : 0;
    }
    return 0;
  }
  function postedLabel(g) {
    const d = daysPosted(g);
    if (d <= 0) return 'today';
    return d + 'd';
  }

  // Contractor city is stored as "Reston, VA" (with state suffix). Schools
  // expose a bare `city` plus a separate `state` — normalize both to the
  // same shape for the coord lookup.
  function contractorKey(c) { return c.city || null; }
  function schoolKey(s) {
    if (!s) return null;
    if (s.city && s.state) return `${s.city}, ${s.state}`;
    return null;
  }

  function haversineMiles(a, b) {
    if (!a || !b) return Infinity;
    const R = 3958.8;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]), lat2 = toRad(b[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function distanceMiles(keyA, keyB) {
    const a = CITY_COORDS[keyA];
    const b = CITY_COORDS[keyB];
    if (!a || !b) return Infinity;
    return haversineMiles(a, b);
  }

  function findSchool(gap) {
    if (!gap) return null;
    const list = (window.RCIS_DATA && window.RCIS_DATA.SCHOOLS) || [];
    if (gap.schoolId) {
      return list.find((s) => s.id === gap.schoolId) || null;
    }
    const name = gap.schoolName || gap.school;
    if (!name) return null;
    return list.find((s) => s.name === name && s.state === gap.state) || null;
  }

  function gapModality(g) { return g.modality || 'onsite'; }
  function contractorModalities(c) {
    return c.modalities && c.modalities.length ? c.modalities : ['tele', 'onsite'];
  }

  // Returns { ok, modality, miles } describing why a contractor matches (or
  // doesn't) on the modality + distance axis. State + specialty are checked
  // separately upstream.
  function modalityFit(contractor, gap) {
    const wanted = gapModality(gap);
    const mods = contractorModalities(contractor);
    const isDistrictWide = gap.scope === 'district' || !gap.schoolId;
    const school = isDistrictWide ? null : findSchool(gap);
    const miles = isDistrictWide ? null : distanceMiles(contractorKey(contractor), schoolKey(school));

    const teleOk = mods.includes('tele');
    // District-wide onsite gaps accept any onsite-capable contractor in the
    // licensed state (state check happens upstream in eligibility). For
    // school-tied onsite gaps the 100-mile rule applies.
    const onsiteOk = mods.includes('onsite') && (
      isDistrictWide || (Number.isFinite(miles) && miles <= ONSITE_RADIUS_MILES)
    );

    if (wanted === 'tele')   return { ok: teleOk,             modality: 'tele',   miles };
    if (wanted === 'onsite') return { ok: onsiteOk,           modality: 'onsite', miles };
    return { ok: teleOk || onsiteOk, modality: teleOk ? 'tele' : 'onsite', miles };
  }

  function eligibleContractors(gap, contractors) {
    return contractors.filter((c) => {
      if (c.spec !== gap.spec) return false;
      if (!(c.states || []).includes(gap.state)) return false;
      return modalityFit(c, gap).ok;
    });
  }
  function eligibleGaps(contractor, gaps) {
    return gaps.filter((g) => {
      if (g.spec !== contractor.spec) return false;
      if (!(contractor.states || []).includes(g.state)) return false;
      return modalityFit(contractor, g).ok;
    });
  }

  function rankContractorForGap(c, gap, fit) {
    const free = freeHours(c);
    let score = 0;
    if (free >= gap.hours) score += 1000;
    score += free * 10;
    const statusBonus = { avail: 30, partial: 15, full: -10, pto: -50 };
    score += statusBonus[c.status] || 0;
    // Onsite matches: prefer closer contractors (linear bonus inside radius).
    if (fit && fit.modality === 'onsite' && Number.isFinite(fit.miles)) {
      score += Math.max(0, ONSITE_RADIUS_MILES - fit.miles) * 0.5;
    }
    return score;
  }
  function rankGapForContractor(g, contractor, fit) {
    const free = freeHours(contractor);
    let score = 0;
    const pri = { urgent: 100, high: 70, medium: 40, low: 10 };
    score += pri[g.priority] || 0;
    if (free > 0 && g.hours <= free) score += 50;
    score += daysPosted(g) * 2;
    if (fit && fit.modality === 'onsite' && Number.isFinite(fit.miles)) {
      score += Math.max(0, ONSITE_RADIUS_MILES - fit.miles) * 0.3;
    }
    return score;
  }

  function modalityLabel(m) {
    if (m === 'tele') return 'Tele';
    if (m === 'onsite') return 'Onsite';
    return 'Either';
  }

  function mapPriorityToTaskPriority(p) {
    if (p === 'urgent' || p === 'high') return 'high';
    if (p === 'low') return 'low';
    return 'medium';
  }

  function SchedulePage({ dark = false }) {
    return (
      <window.PageShell dark={dark} activePage="matchmaker" searchPlaceholder="Matchmaker">
        {(pal) => <ScheduleWorkspace pal={pal} />}
      </window.PageShell>
    );
  }

  function ScheduleWorkspace({ pal }) {
    const allGaps = window.useCoverageGaps ? window.useCoverageGaps() : [];
    const gaps = React.useMemo(() => allGaps.filter((g) => g.status === 'open'), [allGaps]);
    // Wrap contractors through the overrides view so renames/contact edits
    // show up in the Matchmaker rows the moment they save.
    const contractors = window.useContractorsView
      ? window.useContractorsView(window.RCIS_DATA.CONTRACTORS)
      : window.RCIS_DATA.CONTRACTORS;

    const [selectedGapId, setSelectedGapId] = React.useState(null);
    const [selectedContractorId, setSelectedContractorId] = React.useState(null);
    const [editorDraft, setEditorDraft] = React.useState(null);
    const [gapEditor, setGapEditor] = React.useState(null);

    // Bill rate is stored on the gap record now; this setter writes directly
    // to Supabase via GapsStore. localStorage overrides are no longer used.
    const setGapRate = (id, rate) => {
      const r = Number.isFinite(rate) && rate > 0 ? rate : null;
      if (window.GapsStore) window.GapsStore.update(id, { billRate: r });
    };
    const rateOverrides = React.useMemo(() => {
      const out = {};
      for (const g of allGaps) if (g.billRate != null) out[g.id] = g.billRate;
      return out;
    }, [allGaps]);

    const selectedGap = selectedGapId ? gaps.find((g) => g.id === selectedGapId) : null;
    const selectedContractor = selectedContractorId
      ? contractors.find((c) => c.id === selectedContractorId)
      : null;

    const selectGap = (id) => {
      setSelectedContractorId(null);
      setSelectedGapId(id === selectedGapId ? null : id);
    };
    const selectContractor = (id) => {
      setSelectedGapId(null);
      setSelectedContractorId(id === selectedContractorId ? null : id);
    };
    const clearSelection = () => {
      setSelectedGapId(null);
      setSelectedContractorId(null);
    };

    const totalWeeklyPotential = React.useMemo(
      () => gaps.reduce((sum, g) => sum + gapWeeklyRevenue(g, rateOverrides), 0),
      [gaps, rateOverrides],
    );
    const totalAvailableHours = React.useMemo(
      () => contractors.reduce((sum, c) => sum + freeHours(c), 0),
      [contractors],
    );

    const rankedContractors = React.useMemo(() => {
      if (!selectedGap) return null;
      return eligibleContractors(selectedGap, contractors)
        .map((c) => {
          const fit = modalityFit(c, selectedGap);
          return { c, fit, score: rankContractorForGap(c, selectedGap, fit) };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_N);
    }, [selectedGap, contractors]);

    const rankedGaps = React.useMemo(() => {
      if (!selectedContractor) return null;
      return eligibleGaps(selectedContractor, gaps)
        .map((g) => {
          const fit = modalityFit(selectedContractor, g);
          return { g, fit, score: rankGapForContractor(g, selectedContractor, fit) };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_N);
    }, [selectedContractor, gaps]);

    const openTaskDraftFor = (gap, contractor) => {
      const free = freeHours(contractor);
      const fit = modalityFit(contractor, gap);
      const fitText = fit.modality === 'onsite' && Number.isFinite(fit.miles)
        ? `onsite (${Math.round(fit.miles)} mi from ${contractor.city || 'their base'})`
        : 'tele';
      const current = window.TeamStore && window.TeamStore.current && window.TeamStore.current();
      setEditorDraft({
        isNew: true,
        todo: {
          id: null,
          title: `Confirm ${contractor.name} for ${gap.school} · ${gap.hours}h ${gap.spec}`,
          column: 'todo',
          owners: current ? [current.id] : [],
          label: 'Coverage',
          priority: mapPriorityToTaskPriority(gap.priority),
          due: null,
          linkedTo: { type: 'contractor', id: contractor.id, name: contractor.name },
          notes:
            `Coverage gap at ${gap.school} (${gap.district}, ${gap.state}). ` +
            `Needs ${gap.hours}h/wk of ${gap.spec} · ${modalityLabel(gapModality(gap))}. ` +
            `${contractor.name} has ${free}h free (status: ${STATUS_LABEL[contractor.status] || contractor.status}), matched as ${fitText}.` +
            (gap.note ? `\n\nGap note: ${gap.note}` : ''),
          attachments: [],
        },
      });
    };

    const closeEditor = () => setEditorDraft(null);
    const saveEditor = async (patch) => {
      const { id, ...rest } = patch;
      await window.TodosStore.add(rest);
      await window.TodosStore.reload();
      closeEditor();
    };

    return (
      <div style={{
        flex: 1,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, color: pal.text, letterSpacing: -0.3 }}>
              Matchmaker
            </div>
            <div style={{ fontSize: 12.5, color: pal.textSoft, marginTop: 2 }}>
              Match coverage gaps to contractor availability. Click a gap to find a contractor, or a contractor to find a job.
            </div>
          </div>
          {(selectedGap || selectedContractor) && (
            <button onClick={clearSelection} style={{
              marginLeft: 'auto',
              height: 32,
              padding: '0 12px',
              background: 'transparent',
              color: pal.textSoft,
              border: `1px solid ${pal.border}`,
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}>Clear selection</button>
          )}
        </div>

        <OverviewStats
          pal={pal}
          weeklyPotential={totalWeeklyPotential}
          openGaps={gaps.length}
          availableHours={totalAvailableHours}
          contractorCount={contractors.length}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <GapsPanel
            pal={pal}
            gaps={gaps}
            ranked={rankedGaps}
            selectedGapId={selectedGapId}
            selectedContractor={selectedContractor}
            rateOverrides={rateOverrides}
            onChangeRate={setGapRate}
            onSelectGap={selectGap}
            onCreateTask={openTaskDraftFor}
            onEditGap={(g) => setGapEditor({ isNew: false, gap: { ...g } })}
            onLogGap={() => setGapEditor({ isNew: true, gap: {} })}
          />
          <ContractorsPanel
            pal={pal}
            contractors={contractors}
            ranked={rankedContractors}
            selectedContractorId={selectedContractorId}
            selectedGap={selectedGap}
            gapRate={selectedGap ? effectiveRate(selectedGap, rateOverrides) : null}
            onSelectContractor={selectContractor}
            onCreateTask={openTaskDraftFor}
          />
        </div>

        {editorDraft && (
          <window.TodoEditor
            todo={editorDraft.todo}
            pal={pal}
            isNew={editorDraft.isNew}
            onSave={saveEditor}
            onDelete={closeEditor}
            onClose={closeEditor}
          />
        )}

        {gapEditor && (
          <window.GapEditor
            gap={gapEditor.gap}
            pal={pal}
            isNew={gapEditor.isNew}
            onSave={async (patch) => {
              if (gapEditor.isNew) {
                const { id, ...rest } = patch;
                await window.GapsStore.add(rest);
              } else {
                await window.GapsStore.update(gapEditor.gap.id, patch);
              }
              setGapEditor(null);
            }}
            onDelete={async () => {
              await window.GapsStore.remove(gapEditor.gap.id);
              setGapEditor(null);
            }}
            onClose={() => setGapEditor(null)}
          />
        )}
      </div>
    );
  }

  function GapsPanel({ pal, gaps, ranked, selectedGapId, selectedContractor, rateOverrides, onChangeRate, onSelectGap, onCreateTask, onEditGap, onLogGap }) {
    const items = ranked ? ranked : gaps.map((g) => ({ g, fit: null }));
    const isRanked = !!ranked;
    const totalWeekly = (isRanked ? items.map((r) => r.g) : gaps)
      .reduce((sum, g) => sum + gapWeeklyRevenue(g, rateOverrides), 0);
    const moneySuffix = items.length
      ? ` · ${fmtMoney(totalWeekly)}/wk potential`
      : '';
    return (
      <Panel pal={pal}
             title={isRanked ? `Best gaps for ${selectedContractor.name}` : 'Coverage gaps'}
             subtitle={(isRanked
               ? `${items.length} match${items.length === 1 ? '' : 'es'} · same specialty + state, modality OK`
               : `${gaps.length} open`) + moneySuffix}
             action={!isRanked && onLogGap && (
               <button onClick={onLogGap} style={{
                 background: 'transparent', border: 'none',
                 color: pal.accent, fontSize: 12.5, fontWeight: 600,
                 cursor: 'pointer', fontFamily: 'inherit',
                 display: 'inline-flex', alignItems: 'center', gap: 4,
               }}>+ Log gap</button>
             )}>
        {items.length === 0 ? (
          <Empty pal={pal} text={isRanked
            ? 'No open gaps match this contractor on specialty, state, and modality.'
            : 'No coverage gaps.'} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto', paddingRight: 4 }}>
            {items.map(({ g, fit }) => (
              <GapRow
                key={g.id}
                pal={pal}
                gap={g}
                fit={fit}
                rate={effectiveRate(g, rateOverrides)}
                onChangeRate={(r) => onChangeRate(g.id, r)}
                selected={g.id === selectedGapId}
                rankAction={isRanked
                  ? () => onCreateTask(g, selectedContractor)
                  : null}
                onEdit={onEditGap ? () => onEditGap(g) : null}
                onClick={() => onSelectGap(g.id)}
              />
            ))}
          </div>
        )}
      </Panel>
    );
  }

  function ContractorsPanel({ pal, contractors, ranked, selectedContractorId, selectedGap, gapRate, onSelectContractor, onCreateTask }) {
    const items = ranked ? ranked : contractors.map((c) => ({ c, fit: null }));
    const isRanked = !!ranked;
    const totalFree = items.reduce((sum, x) => sum + freeHours(x.c), 0);
    return (
      <Panel pal={pal} title={isRanked ? `Best contractors for ${selectedGap.school}` : 'Contractors'}
             subtitle={(isRanked
               ? `${items.length} match${items.length === 1 ? '' : 'es'} · ${selectedGap.spec} in ${selectedGap.state}, ${modalityLabel(gapModality(selectedGap))}, ${selectedGap.hours}h/wk`
               : `${contractors.length} total`) + ` · ${totalFree}h available`}>
        {items.length === 0 ? (
          <Empty pal={pal} text="No contractors match this gap on specialty, state, and modality." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto', paddingRight: 4 }}>
            {items.map(({ c, fit }) => (
              <ContractorRow
                key={c.id}
                pal={pal}
                contractor={c}
                fit={fit}
                gapRate={isRanked ? gapRate : null}
                neededHours={isRanked ? selectedGap.hours : null}
                selected={c.id === selectedContractorId}
                rankAction={isRanked
                  ? () => onCreateTask(selectedGap, c)
                  : null}
                onClick={() => onSelectContractor(c.id)}
              />
            ))}
          </div>
        )}
      </Panel>
    );
  }

  function OverviewStats({ pal, weeklyPotential, openGaps, availableHours, contractorCount }) {
    const SCHOOL_WEEKS = 36;
    const annual = weeklyPotential * SCHOOL_WEEKS;

    const heroNumber = {
      fontSize: 40,
      fontWeight: 700,
      color: pal.accent,
      letterSpacing: -1,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
    };
    const heroLabel = {
      fontSize: 13,
      fontWeight: 500,
      color: pal.textSoft,
      marginTop: 4,
    };

    return (
      <div style={{
        background: pal.card,
        border: `1px solid ${pal.border}`,
        borderRadius: 10,
        padding: '20px 24px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          alignItems: 'center',
          gap: 24,
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={heroNumber}>{fmtMoney(weeklyPotential)}</div>
            <div style={heroLabel}>weekly potential</div>
          </div>
          <div style={{
            fontSize: 13,
            color: pal.textSoft,
            textAlign: 'center',
            lineHeight: 1.5,
            alignSelf: 'end',
          }}>
            <span style={{ color: pal.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {availableHours.toLocaleString()} hours
            </span>
            <span> on the bench across {contractorCount} contractor{contractorCount === 1 ? '' : 's'} · </span>
            <span style={{ color: pal.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {openGaps} open gap{openGaps === 1 ? '' : 's'}
            </span>
            <span> to fill</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={heroNumber}>{fmtMoney(annual)}</div>
            <div style={heroLabel}>annualized ({SCHOOL_WEEKS}-wk school year)</div>
          </div>
        </div>
      </div>
    );
  }

  function Panel({ pal, title, subtitle, action, children }) {
    return (
      <div style={{
        background: pal.card,
        border: `1px solid ${pal.border}`,
        borderRadius: 10,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: pal.text, letterSpacing: -0.1 }}>{title}</div>
            {subtitle && (
              <div style={{ fontSize: 11.5, color: pal.textFaint, marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
        {children}
      </div>
    );
  }

  function GapRow({ pal, gap, fit, rate, onChangeRate, selected, rankAction, onClick, onEdit }) {
    const wanted = gapModality(gap);
    const weekly = Math.round(gap.hours * rate);
    const isDistrictWide = gap.scope === 'district' || !gap.schoolId;
    const displayName = isDistrictWide
      ? `${gap.districtName} (district-wide)`
      : (gap.schoolName || gap.districtName);
    const districtState = gap.districtName ? `${gap.districtName} · ${gap.state}` : gap.state;
    return (
      <button
        onClick={onClick}
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto auto',
          gap: 10,
          alignItems: 'center',
          padding: '9px 11px',
          width: '100%',
          textAlign: 'left',
          background: selected ? pal.accentSoft : pal.cardAlt,
          border: `1px solid ${selected ? pal.accent : pal.borderSoft}`,
          borderRadius: 7,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <PrioDot prio={gap.priority} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.8, fontWeight: 600, color: pal.text, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {displayName}
          </div>
          <div style={{ fontSize: 11, color: pal.textFaint, marginTop: 2, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{districtState}</span>
            <span style={{ color: pal.textSoft, fontWeight: 600 }}>{gap.hours}h/wk</span>
            <ModalityChip pal={pal} modality={wanted} />
            {fit && (
              <span style={{ color: pal.accent, fontWeight: 700 }}>
                via {fit.modality === 'onsite'
                  ? (Number.isFinite(fit.miles) ? `onsite · ${Math.round(fit.miles)} mi` : 'onsite · district')
                  : 'tele'}
              </span>
            )}
            <span>{PRIORITY_LABEL[gap.priority] || gap.priority} · posted {postedLabel(gap)}</span>
          </div>
        </div>
        <div style={{
          textAlign: 'right',
          minWidth: 116,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: pal.accent, lineHeight: 1.2 }}>
            {fmtMoney(weekly)}/wk
          </div>
          <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
            <RateField rate={rate} onChange={onChangeRate} pal={pal} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SpecChip code={gap.spec} />
          {onEdit && (
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
              title="Edit coverage gap"
              style={{
                width: 26, height: 26, padding: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', color: pal.textFaint,
                border: `1px solid ${pal.border}`, borderRadius: 6,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = pal.text; e.currentTarget.style.borderColor = pal.textFaint; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = pal.textFaint; e.currentTarget.style.borderColor = pal.border; }}>
              <Icon name="settings" size={12} stroke={1.8} />
            </button>
          )}
          {rankAction && (
            <CreateTaskButton pal={pal} onClick={(e) => { e.stopPropagation(); rankAction(); }} />
          )}
        </div>
      </button>
    );
  }

  function ContractorRow({ pal, contractor, fit, gapRate, neededHours, selected, rankAction, onClick }) {
    const free = freeHours(contractor);
    const statusColors = STATUS_COLOR(pal);
    const sColor = statusColors[contractor.status] || pal.textFaint;
    const covers = neededHours == null ? null : (free >= neededHours);
    const mods = contractorModalities(contractor);
    const hourly = (contractor.rates && Number.isFinite(contractor.rates.hourly))
      ? contractor.rates.hourly : null;
    const hasMargin = hourly != null && Number.isFinite(gapRate);
    const marginHr = hasMargin ? (gapRate - hourly) : null;
    const marginWeekly = hasMargin && Number.isFinite(neededHours) ? marginHr * neededHours : null;
    const marginColor = marginHr == null
      ? pal.textSoft
      : marginHr > 0 ? pal.accent : pal.warn;
    return (
      <button
        onClick={onClick}
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto auto',
          gap: 10,
          alignItems: 'center',
          padding: '9px 11px',
          width: '100%',
          textAlign: 'left',
          background: selected ? pal.accentSoft : pal.cardAlt,
          border: `1px solid ${selected ? pal.accent : pal.borderSoft}`,
          borderRadius: 7,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 4, background: sColor }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.8, fontWeight: 600, color: pal.text, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {contractor.name}
          </div>
          <div style={{ fontSize: 11, color: pal.textFaint, marginTop: 2, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{contractor.city || (contractor.states || []).join(', ')}</span>
            <span style={{ color: pal.textSoft, fontWeight: 600 }}>{free}h free of {contractor.cap}</span>
            <span style={{ color: sColor, fontWeight: 700 }}>{STATUS_LABEL[contractor.status] || contractor.status}</span>
            {fit ? (
              <span style={{ color: pal.accent, fontWeight: 700 }}>
                via {fit.modality === 'onsite' && Number.isFinite(fit.miles)
                  ? `onsite · ${Math.round(fit.miles)} mi`
                  : 'tele'}
              </span>
            ) : (
              <span style={{ color: pal.textSoft, fontWeight: 600 }}>
                {mods.map(modalityLabel).join(' + ')}
              </span>
            )}
            {covers != null && (
              <span style={{
                color: covers ? '#3E8A57' : pal.warn,
                fontWeight: 700,
              }}>
                {covers ? 'Fully covers' : 'Partial coverage'}
              </span>
            )}
          </div>
        </div>
        <div style={{
          textAlign: 'right',
          minWidth: hasMargin ? 116 : 64,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {hasMargin ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: marginColor, lineHeight: 1.2 }}>
                {marginHr >= 0 ? '+' : ''}{fmtMoney(marginHr)}/hr
              </div>
              <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 1 }}>
                cost {hourly != null ? fmtMoney(hourly) + '/hr' : '—'}
                {marginWeekly != null && (
                  <> · {marginWeekly >= 0 ? '+' : ''}{fmtMoney(marginWeekly)}/wk</>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: pal.textSoft, fontWeight: 600 }}>
              {hourly != null ? `${fmtMoney(hourly)}/hr` : '—'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SpecChip code={contractor.spec} />
          {rankAction && (
            <CreateTaskButton pal={pal} onClick={(e) => { e.stopPropagation(); rankAction(); }} />
          )}
        </div>
      </button>
    );
  }

  function ModalityChip({ pal, modality }) {
    return (
      <span style={{
        fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
        background: pal.chipBg, color: pal.textSoft,
      }}>{modalityLabel(modality)}</span>
    );
  }

  // Inline-editable hourly bill rate. Click the value to edit, blur or Enter
  // to commit, Escape to cancel. Overrides persist via the workspace store.
  function RateField({ rate, onChange, pal }) {
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(String(rate));
    React.useEffect(() => { setDraft(String(rate)); }, [rate]);

    const commit = () => {
      const n = parseFloat(draft);
      if (Number.isFinite(n) && n > 0) onChange(n);
      else setDraft(String(rate));
      setEditing(false);
    };

    if (editing) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
          onClick={(e) => e.stopPropagation()}>
          <span>$</span>
          <input
            autoFocus
            type="number"
            min="0"
            step="1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') { setDraft(String(rate)); setEditing(false); }
            }}
            style={{
              width: 42,
              padding: '0 2px',
              fontSize: 10.5,
              fontWeight: 700,
              color: pal.text,
              background: pal.cardAlt,
              border: `1px solid ${pal.accent}`,
              borderRadius: 3,
              outline: 'none',
              fontFamily: 'inherit',
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'right',
            }}
          />
          <span>/hr</span>
        </span>
      );
    }
    return (
      <span
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        title="Click to edit hourly bill rate"
        style={{
          cursor: 'pointer',
          color: pal.textSoft,
          fontWeight: 600,
          textDecoration: 'underline',
          textDecorationStyle: 'dotted',
          textDecorationColor: pal.textFaint,
          textUnderlineOffset: 2,
        }}
      >${rate}/hr</span>
    );
  }

  function CreateTaskButton({ pal, onClick }) {
    return (
      <button onClick={onClick} title="Create a task for this match"
        style={{
          height: 26,
          padding: '0 10px',
          background: pal.accent,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 11.5,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}>
        <Icon name="plus" size={11} stroke={2.3} /> Create task
      </button>
    );
  }

  function Empty({ pal, text }) {
    return (
      <div style={{
        padding: '20px 14px',
        textAlign: 'center',
        fontSize: 12.5,
        color: pal.textFaint,
        border: `1px dashed ${pal.border}`,
        borderRadius: 7,
      }}>{text}</div>
    );
  }

  window.SchedulePage = SchedulePage;
})();
