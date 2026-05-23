// FinancialsPage — financial what-ifs and configuration.
// Two sections today:
//   1. Margin Calculator — live what-if for evaluating new deals. Inputs
//      flow through ContractorFinancials so the math agrees with every
//      margin display in the app (contractor profile, district profile,
//      Matchmaker, home Revenue tile).
//   2. Specialty Settings — per-spec indirect ratio + burden $/hr +
//      default pay/bill bands. Edits flow live to Net Margin everywhere.
//      Moved here from /admin: this is financial configuration, and Admin
//      stays focused on people and access.

(function () {
  const { Icon } = window;

  function FinancialsPage({ dark = false }) {
    return (
      <window.PageShell dark={dark} activePage="financials"
                        searchPlaceholder="Financials">
        {(pal) => <FinancialsContent pal={pal} />}
      </window.PageShell>
    );
  }

  function FinancialsContent({ pal }) {
    return (
      <div style={{
        flex: 1, padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: pal.text, letterSpacing: -0.3 }}>Financials</h1>
          <span style={{ fontSize: 13, color: pal.textSoft }}>Margin calculator and per-specialty configuration</span>
        </div>

        <MarginCalculatorSection pal={pal} />
        <SpecialtySettingsSection pal={pal} />
      </div>
    );
  }

  // ─── Margin Calculator ───────────────────────────────────────────────────
  // Live what-if. Nothing saved. Construct a single synthetic assignment row
  // and run it through ContractorFinancials so the numbers match every
  // other margin display in the app (rather than re-implementing the math).
  function MarginCalculatorSection({ pal }) {
    // Subscribe so changing a per-spec burden or indirect ratio in the
    // Specialty Settings card below re-derives the calculator output live.
    if (window.useSpecSettings) window.useSpecSettings();

    const SPECS = (window.RCIS_DATA && window.RCIS_DATA.SPECIALTIES) || [];
    const F = window.ContractorFinancials;
    const fmt = (F && F.formatUSD) || ((n) => `$${Math.round(Number(n) || 0).toLocaleString()}`);
    const WEEKS_PER_YEAR = (F && F.WEEKS_PER_SCHOOL_YEAR) || 36;

    const [draft, setDraft] = React.useState({
      billRate: 110,
      payRate: 70,
      spec: SPECS[0] ? SPECS[0].code : 'SLP',
      directHours: 20,
      indirectHours: 5,
      indirectOverride: false,
    });
    const set = (patch) => setDraft((d) => {
      const next = { ...d, ...patch };
      // Auto-derive indirect from direct × per-spec ratio unless the
      // user has explicitly overridden it. Mirrors AssignmentEditor.
      const directChanged  = 'directHours' in patch;
      const specChanged    = 'spec'        in patch;
      if (!next.indirectOverride && (directChanged || specChanged)
          && window.AssignmentsStore && window.AssignmentsStore.autoIndirect) {
        next.indirectHours = window.AssignmentsStore.autoIndirect(
          Number(next.directHours) || 0,
          next.spec,
        );
      }
      return next;
    });

    const bill = Number(draft.billRate) || 0;
    const pay  = Number(draft.payRate)  || 0;
    const direct   = Number(draft.directHours)   || 0;
    const indirect = Number(draft.indirectHours) || 0;
    const burden = window.burdenFor ? Number(window.burdenFor(draft.spec)) || 0 : 0;

    // One synthetic active row, then defer to ContractorFinancials so the
    // math stays consistent with what the contractor profile + district
    // rollup compute.
    const row = {
      direct, indirect, status: 'active',
      spec: draft.spec, billRate: bill, payRate: pay,
    };
    const defaults = { pay, spec: draft.spec };
    const grossPerHr = F ? F.marginPerHour([row], defaults) : (bill - pay);
    const netPerHr   = F ? F.netMarginPerHour([row], defaults) : (bill - pay - burden);
    const weeklyHours = direct + indirect;
    const weeklyRev   = F ? F.weeklyRevenue([row], defaults) : (bill * weeklyHours);
    const weeklyPay   = F ? F.weeklyPay([row], defaults) : (pay * weeklyHours);
    const weeklyGross = F ? F.weeklyMargin([row], defaults) : (weeklyRev - weeklyPay);
    const weeklyNet   = F ? F.weeklyNetMargin([row], defaults) : (weeklyGross - burden * weeklyHours);
    const annualGross = weeklyGross * WEEKS_PER_YEAR;
    const annualNet   = weeklyNet   * WEEKS_PER_YEAR;
    const grossPct = weeklyRev > 0 ? Math.round((weeklyGross / weeklyRev) * 100) : 0;
    const netPct   = weeklyRev > 0 ? Math.round((weeklyNet   / weeklyRev) * 100) : 0;
    const netColor = netPerHr >= 0 ? pal.text : pal.warn;

    const ratioPct = window.indirectRatioFor
      ? Math.round(Number(window.indirectRatioFor(draft.spec)) * 100)
      : 25;

    return (
      <div style={{
        background: pal.card, border: `1px solid ${pal.border}`,
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px',
          borderBottom: `1px solid ${pal.border}`,
        }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: pal.text }}>
            Margin calculator
          </h3>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: pal.textFaint }}>
            What-if only — nothing saved.
          </span>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)',
          gap: 18, padding: 18,
        }}>
          {/* Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field pal={pal} label="Bill rate ($ / hr)">
                <NumInput pal={pal} value={draft.billRate} min="0" step="1"
                  onChange={(v) => set({ billRate: v })} />
              </Field>
              <Field pal={pal} label="Pay rate ($ / hr)">
                <NumInput pal={pal} value={draft.payRate} min="0" step="1"
                  onChange={(v) => set({ payRate: v })} />
              </Field>
            </div>

            <Field pal={pal} label="Specialty"
                   hint="Drives burden ($/hr) and the auto-indirect ratio.">
              <select value={draft.spec}
                onChange={(e) => set({ spec: e.target.value })}
                style={inputStyle(pal)}>
                {SPECS.map((sp) => (
                  <option key={sp.code} value={sp.code}>{sp.code} — {sp.name}</option>
                ))}
              </select>
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field pal={pal} label="Direct hours / week">
                <NumInput pal={pal} value={draft.directHours} min="0" step="0.25"
                  onChange={(v) => set({ directHours: v })} />
              </Field>
              <Field pal={pal}
                     labelNode={(
                       <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                         <span style={{ flex: 1 }}>
                           {draft.indirectOverride ? 'Indirect (override)' : 'Indirect hours / week'}
                         </span>
                         {draft.indirectOverride ? (
                           <button onClick={() => setDraft((d) => ({
                             ...d,
                             indirectOverride: false,
                             indirectHours: window.AssignmentsStore
                               ? window.AssignmentsStore.autoIndirect(Number(d.directHours) || 0, d.spec)
                               : 0,
                           }))} style={resetBtn(pal)}>Reset to auto</button>
                         ) : (
                           <span style={{
                             fontSize: 10, fontWeight: 500, color: pal.textFaint,
                             textTransform: 'none', letterSpacing: 0,
                           }}>auto · {ratioPct}% of direct</span>
                         )}
                       </span>
                     )}>
                <input type="number" min="0" step="0.25"
                  value={draft.indirectHours}
                  onChange={(e) => set({ indirectHours: e.target.value, indirectOverride: true })}
                  style={{
                    ...inputStyle(pal),
                    background: draft.indirectOverride ? pal.cardAlt : (pal.chipBg || pal.cardAlt),
                    color: draft.indirectOverride ? pal.text : pal.textSoft,
                  }} />
              </Field>
            </div>

            <div style={{
              fontSize: 11.5, color: pal.textFaint, lineHeight: 1.5,
              paddingTop: 10, borderTop: `1px solid ${pal.borderSoft}`,
            }}>
              Burden for <b style={{ color: pal.textSoft, fontWeight: 600 }}>{draft.spec}</b>: <b style={{ color: pal.textSoft, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(burden, { cents: true })}/hr</b>.
              Direct and indirect hours are both billed at the same rate, so net subtracts burden × total weekly hours — same convention as the contractor and district margin views.
            </div>
          </div>

          {/* Outputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            }}>
              <Stat pal={pal} label="Gross margin / hour"
                value={fmt(grossPerHr, { cents: true })}
                sub={`${grossPct}% of bill`} />
              <Stat pal={pal} label="Net margin / hour"
                value={fmt(netPerHr, { cents: true })} valueColor={netColor}
                sub={`${netPct}% of bill`} />
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            }}>
              <Stat pal={pal} label="Weekly gross"
                value={fmt(weeklyGross)}
                sub={`${weeklyHours}h × ${fmt(grossPerHr, { cents: true })}`} />
              <Stat pal={pal} label="Weekly net"
                value={fmt(weeklyNet)} valueColor={netColor}
                sub={`after ${fmt(burden * weeklyHours)} burden`} />
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            }}>
              <Stat pal={pal} label="Annualized gross"
                value={fmt(annualGross)} valueColor={pal.accent}
                sub={`${WEEKS_PER_YEAR}-week school year`} />
              <Stat pal={pal} label="Annualized net"
                value={fmt(annualNet)} valueColor={netColor}
                sub={`${WEEKS_PER_YEAR}-week school year`} />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 11.5, color: pal.textFaint,
              paddingTop: 10, borderTop: `1px solid ${pal.borderSoft}`,
            }}>
              <span>Weekly revenue: <b style={{ color: pal.textSoft, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(weeklyRev)}</b></span>
              <span>Weekly pay: <b style={{ color: pal.textSoft, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(weeklyPay)}</b></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function Field({ pal, label, labelNode, hint, children }) {
    return (
      <div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
          color: pal.textFaint, textTransform: 'uppercase', marginBottom: 4,
        }}>
          {labelNode || label}
        </div>
        {children}
        {hint && (
          <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 4 }}>
            {hint}
          </div>
        )}
      </div>
    );
  }

  function NumInput({ pal, value, min, step, onChange }) {
    return (
      <input type="number" min={min} step={step}
        value={value == null ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle(pal)} />
    );
  }

  function Stat({ pal, label, value, sub, valueColor }) {
    return (
      <div style={{
        background: pal.cardAlt, border: `1px solid ${pal.borderSoft}`,
        borderRadius: 8, padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6,
          color: pal.textFaint, textTransform: 'uppercase',
        }}>{label}</div>
        <div style={{
          fontSize: 19, fontWeight: 600, letterSpacing: -0.3,
          color: valueColor || pal.text,
          fontVariantNumeric: 'tabular-nums',
        }}>{value}</div>
        {sub && (
          <div style={{ fontSize: 10.5, color: pal.textFaint, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>
        )}
      </div>
    );
  }

  function inputStyle(pal) {
    return {
      width: '100%', padding: '7px 10px',
      fontSize: 13, color: pal.text, background: pal.cardAlt,
      border: `1px solid ${pal.border}`, borderRadius: 6,
      outline: 'none', fontFamily: 'inherit',
    };
  }
  function resetBtn(pal) {
    return {
      background: 'transparent', border: 'none',
      color: pal.accent, fontSize: 10.5, fontWeight: 600,
      textTransform: 'none', letterSpacing: 0,
      cursor: 'pointer', padding: 0, fontFamily: 'inherit',
    };
  }

  // ─── Specialty settings ──────────────────────────────────────────────────
  // Lifted from /admin: per-spec indirect ratio + burden $/hr. Edits save
  // on blur and flow immediately through Net Margin everywhere (contractor
  // profile, district profile + Revenue card, Matchmaker shortlist, and
  // the calculator above).
  function SpecialtySettingsSection({ pal }) {
    const settings = window.useSpecSettings ? window.useSpecSettings() : {};
    const SPECS = (window.RCIS_DATA && window.RCIS_DATA.SPECIALTIES) || [];
    const DEFAULT_RATIO  = (window.SpecSettingsStore && window.SpecSettingsStore.DEFAULT_INDIRECT_RATIO) || 0.25;
    const DEFAULT_BURDEN = (window.SpecSettingsStore && window.SpecSettingsStore.DEFAULT_BURDEN) || 0;

    return (
      <div style={{
        background: pal.card, border: `1px solid ${pal.border}`,
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px',
          borderBottom: `1px solid ${pal.border}`,
        }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: pal.text }}>
            Specialty settings
          </h3>
          <span style={{
            fontSize: 11, fontWeight: 600, color: pal.textSoft,
            background: pal.chipBg, padding: '1px 7px', borderRadius: 10,
            fontVariantNumeric: 'tabular-nums',
          }}>{SPECS.length} specs</span>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: pal.textFaint }}>
            Edits flow live to Net Margin across the app.
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '60px 1.4fr 110px 130px',
          gap: 12, alignItems: 'center',
          padding: '10px 16px',
          background: pal.cardAlt,
          borderBottom: `1px solid ${pal.border}`,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
          color: pal.textFaint, textTransform: 'uppercase',
        }}>
          <span>Code</span>
          <span>Specialty</span>
          <span style={{ textAlign: 'right' }}>Indirect %</span>
          <span style={{ textAlign: 'right' }} title="Burden per billable hour: the fully-loaded cost beyond pay rate — taxes, insurance, admin overhead.">
            Burden $/hr
          </span>
        </div>

        {SPECS.map((sp) => {
          const s = settings[sp.code] || {};
          const ratio  = s.indirectRatio          != null ? s.indirectRatio          : DEFAULT_RATIO;
          const burden = s.burdenPerBillableHour  != null ? s.burdenPerBillableHour  : DEFAULT_BURDEN;
          return (
            <div key={sp.code} style={{
              display: 'grid',
              gridTemplateColumns: '60px 1.4fr 110px 130px',
              gap: 12, alignItems: 'center',
              padding: '10px 16px',
              borderBottom: `1px solid ${pal.borderSoft}`,
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '3px 8px', borderRadius: 5,
                background: (sp.color || pal.accent) + '20',
                color: sp.color || pal.accent,
                fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
                width: 'fit-content',
              }}>{sp.code}</span>
              <span style={{ fontSize: 12.5, color: pal.text }}>{sp.name}</span>
              <NumberCell pal={pal} value={ratio} step="1" min="0" max="200"
                suffix="%" displayTransform={(v) => `${Math.round(Number(v) * 100)}`}
                parse={(v) => Number(v) / 100}
                title="Indirect hours auto-derive as direct × this ratio."
                onSave={(next) => window.SpecSettingsStore.upsert(sp.code, { indirectRatio: next })} />
              <NumberCell pal={pal} value={burden} step="0.01" min="0"
                prefix="$"
                title="Burden per billable hour: the fully-loaded cost beyond pay rate — taxes, insurance, admin overhead."
                onSave={(next) => window.SpecSettingsStore.upsert(sp.code, { burdenPerBillableHour: next })} />
            </div>
          );
        })}
      </div>
    );
  }

  // Inline-edit numeric cell. Click value to edit; Enter / blur saves; Esc
  // cancels. `displayTransform` + `parse` let the cell show "25" while the
  // underlying value is 0.25, for the ratio column.
  function NumberCell({ pal, value, onSave, step, min, max, prefix, suffix, displayTransform, parse, title }) {
    const display = displayTransform ? displayTransform(value) : String(value);
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(display);
    const startValueRef = React.useRef(null);
    const inputRef = React.useRef(null);

    React.useEffect(() => {
      if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
    }, [editing]);

    const start = () => {
      startValueRef.current = value;
      setDraft(display);
      setEditing(true);
    };
    const commit = () => {
      const raw = draft.trim();
      if (raw === '') { setEditing(false); return; }
      const parsed = parse ? parse(raw) : Number(raw);
      if (!Number.isFinite(parsed)) { setEditing(false); return; }
      // Compare in display space — comparing parsed-vs-Number(value) trips
      // false positives whenever displayTransform is lossy (e.g. Math.round
      // for ratios), causing a plain click-then-blur to overwrite a stored
      // 0.305 with 0.31 even though the user typed nothing.
      if (raw !== display) {
        // Conflict probe: if value changed under us mid-edit (a teammate's
        // realtime update arrived between click and blur), log a warning
        // so the surprise overwrite is at least debuggable. Trusted-team
        // policy stays last-write-wins.
        if (startValueRef.current != null && Number(value) !== Number(startValueRef.current)) {
          console.warn('NumberCell: value changed mid-edit; saving anyway',
            { startValue: startValueRef.current, currentValue: value, newValue: parsed });
        }
        onSave(parsed);
      }
      setEditing(false);
    };
    const cancel = () => { setDraft(display); setEditing(false); };
    const onKey = (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    };

    if (editing) {
      return (
        <span style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}>
          {prefix && <span style={{ fontSize: 12, color: pal.textFaint }}>{prefix}</span>}
          <input ref={inputRef} type="number" step={step || 'any'} min={min} max={max}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit} onKeyDown={onKey}
            style={{
              padding: '4px 8px', fontSize: 12.5,
              color: pal.text, background: pal.cardAlt,
              border: `1px solid ${pal.accent}`, borderRadius: 6,
              outline: 'none', fontFamily: 'ui-monospace, monospace',
              textAlign: 'right', width: 80,
            }}
          />
          {suffix && <span style={{ fontSize: 12, color: pal.textFaint }}>{suffix}</span>}
        </span>
      );
    }
    return (
      <span onClick={start} title={title || 'Click to edit'}
        style={{
          display: 'inline-flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 3,
          marginLeft: 'auto', padding: '3px 8px',
          fontSize: 12.5, color: pal.text, fontWeight: 500,
          fontFamily: 'ui-monospace, monospace',
          cursor: 'pointer',
          border: '1px dashed transparent', borderRadius: 5,
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = pal.borderSoft}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}>
        {prefix && <span style={{ color: pal.textFaint }}>{prefix}</span>}
        <span>{display}</span>
        {suffix && <span style={{ color: pal.textFaint }}>{suffix}</span>}
      </span>
    );
  }

  window.FinancialsPage = FinancialsPage;
})();
