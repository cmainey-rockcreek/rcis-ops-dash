// Admin page — team management today; specialty settings will land here next.
// Reads team_profiles via TeamStore and supports inline edits + active toggle.

(function () {
  const { Icon } = window;

  // Eight preset swatches — covers the auth-generated palette plus a couple
  // extras so teammates rarely need a custom hex.
  const COLOR_SWATCHES = [
    '#1FA39A', '#E76B5D', '#1B2956', '#7A5AE0',
    '#C98A2C', '#3E8A57', '#5A6478', '#D14F8F',
  ];

  function AdminPage({ dark = false }) {
    return (
      <window.PageShell dark={dark} activePage="admin"
                        searchPlaceholder="Admin">
        {(pal) => <AdminContent pal={pal} />}
      </window.PageShell>
    );
  }

  function AdminContent({ pal }) {
    return (
      <div style={{
        flex: 1, padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: pal.text, letterSpacing: -0.3 }}>Admin</h1>
          <span style={{ fontSize: 13, color: pal.textSoft }}>Internal settings</span>
        </div>

        <TeamMembersSection pal={pal} />
        <SpecialtySettingsSection pal={pal} />
      </div>
    );
  }

  function TeamMembersSection({ pal }) {
    const profiles = window.useAdminProfiles ? window.useAdminProfiles() : [];
    const sorted = React.useMemo(() => {
      return [...profiles].sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '');
      });
    }, [profiles]);

    const activeCount = sorted.filter((p) => p.active).length;

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
            Team members
          </h3>
          <span style={{
            fontSize: 11, fontWeight: 600, color: pal.textSoft,
            background: pal.chipBg, padding: '1px 7px', borderRadius: 10,
            fontVariantNumeric: 'tabular-nums',
          }}>{activeCount} active · {sorted.length} total</span>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: pal.textFaint }}>
            New teammates appear here after their first sign-in.
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '44px 1.6fr 1.6fr 1fr 70px 110px 90px',
          gap: 12, alignItems: 'center',
          padding: '10px 16px',
          background: pal.cardAlt,
          borderBottom: `1px solid ${pal.border}`,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
          color: pal.textFaint, textTransform: 'uppercase',
        }}>
          <span />
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Initials</span>
          <span>Color</span>
          <span style={{ textAlign: 'right' }}>Active</span>
        </div>

        {sorted.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: pal.textFaint, fontSize: 13 }}>
            No team profiles yet — sign in to populate this list.
          </div>
        ) : (
          sorted.map((p) => <TeamRow key={p.id} p={p} pal={pal} />)
        )}
      </div>
    );
  }

  function TeamRow({ p, pal }) {
    const save = (patch) => window.TeamStore.updateProfile(p.id, patch);
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '44px 1.6fr 1.6fr 1fr 70px 110px 90px',
        gap: 12, alignItems: 'center',
        padding: '10px 16px',
        borderBottom: `1px solid ${pal.borderSoft}`,
        opacity: p.active ? 1 : 0.55,
      }}>
        <span style={{
          width: 32, height: 32, borderRadius: 16,
          background: p.color || pal.chipBg, color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3,
        }}>{p.initials || '··'}</span>

        <EditableCell pal={pal} value={p.name} placeholder="Unnamed"
          onSave={(v) => save({ name: v })} requireNonEmpty />

        <span style={{
          fontSize: 12.5, color: pal.textSoft,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{p.email}</span>

        <EditableCell pal={pal} value={p.role} placeholder="Add role"
          onSave={(v) => save({ role: v })} />

        <EditableCell pal={pal} value={p.initials} placeholder="—"
          monospace maxLen={3}
          onSave={(v) => save({ initials: (v || '').toUpperCase() })} />

        <ColorPicker pal={pal} value={p.color} onSave={(v) => save({ color: v })} />

        <ActiveToggle pal={pal} active={p.active}
          onChange={(v) => save({ active: v })} />
      </div>
    );
  }

  function EditableCell({ pal, value, placeholder, onSave, requireNonEmpty, monospace, maxLen }) {
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(value || '');
    const inputRef = React.useRef(null);

    React.useEffect(() => {
      if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
    }, [editing]);

    const start = () => { setDraft(value || ''); setEditing(true); };
    const commit = () => {
      const next = draft.trim();
      if (requireNonEmpty && !next) { setEditing(false); return; }
      if (next !== (value || '').trim()) onSave(next);
      setEditing(false);
    };
    const cancel = () => { setDraft(value || ''); setEditing(false); };
    const onKey = (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    };

    if (editing) {
      return (
        <input ref={inputRef} value={draft} maxLength={maxLen || undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit} onKeyDown={onKey}
          placeholder={placeholder}
          style={{
            padding: '4px 8px', fontSize: 12.5,
            color: pal.text, background: pal.cardAlt,
            border: `1px solid ${pal.accent}`, borderRadius: 6,
            outline: 'none', fontFamily: monospace ? 'ui-monospace, monospace' : 'inherit',
            width: '100%',
          }}
        />
      );
    }
    const display = value && value.trim().length > 0;
    return (
      <span onClick={start} title="Click to edit"
        style={{
          fontSize: 12.5, fontWeight: 500,
          color: display ? pal.text : pal.textFaint,
          fontStyle: display ? 'normal' : 'italic',
          fontFamily: monospace ? 'ui-monospace, monospace' : 'inherit',
          cursor: 'pointer',
          borderBottom: '1px dashed transparent',
          padding: '2px 0',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          display: 'inline-block', maxWidth: '100%',
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderBottomColor = pal.borderSoft}
        onMouseLeave={(e) => e.currentTarget.style.borderBottomColor = 'transparent'}>
        {display ? value : placeholder}
      </span>
    );
  }

  function ColorPicker({ pal, value, onSave }) {
    const [open, setOpen] = React.useState(false);
    const wrapRef = React.useRef(null);

    React.useEffect(() => {
      if (!open) return undefined;
      const handler = (e) => {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
      <span ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
        <button onClick={() => setOpen((v) => !v)} title="Pick color"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 7px',
            background: 'transparent', border: `1px solid ${pal.border}`,
            borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
            color: pal.textSoft, fontSize: 11.5,
          }}>
          <span style={{
            width: 16, height: 16, borderRadius: 8,
            background: value || pal.chipBg,
            border: `1px solid ${pal.border}`,
          }} />
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5 }}>
            {(value || '').toUpperCase()}
          </span>
        </button>
        {open && (
          <div style={{
            position: 'absolute', top: '110%', left: 0, zIndex: 5,
            padding: 8, display: 'grid', gridTemplateColumns: 'repeat(4, 22px)', gap: 6,
            background: pal.card, border: `1px solid ${pal.border}`, borderRadius: 8,
            boxShadow: '0 8px 20px rgba(0,0,0,.22)',
          }}>
            {COLOR_SWATCHES.map((hex) => (
              <button key={hex} onClick={() => { onSave(hex); setOpen(false); }}
                title={hex}
                style={{
                  width: 22, height: 22, borderRadius: 11,
                  background: hex, cursor: 'pointer',
                  border: hex.toLowerCase() === (value || '').toLowerCase()
                    ? `2px solid ${pal.text}`
                    : `1px solid ${pal.border}`,
                }}
              />
            ))}
          </div>
        )}
      </span>
    );
  }

  function ActiveToggle({ pal, active, onChange }) {
    return (
      <button onClick={() => onChange(!active)}
        title={active ? 'Click to deactivate' : 'Click to activate'}
        style={{
          marginLeft: 'auto',
          width: 36, height: 20, borderRadius: 999,
          background: active ? pal.accent : pal.chipBg,
          border: `1px solid ${active ? pal.accent : pal.border}`,
          position: 'relative', cursor: 'pointer', padding: 0,
          transition: 'background .12s ease',
        }}>
        <span style={{
          position: 'absolute', top: 1, left: active ? 17 : 1,
          width: 16, height: 16, borderRadius: 8,
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,.2)',
          transition: 'left .12s ease',
        }} />
      </button>
    );
  }

  // ─── Specialty settings ──────────────────────────────────────────────────
  // Per-spec indirect ratio + burden $/hr. Edits save on blur and flow
  // immediately through Net Margin everywhere (contractor profile, district
  // profile + Revenue card, Matchmaker shortlist).
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
    const inputRef = React.useRef(null);

    React.useEffect(() => {
      if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
    }, [editing]);

    const start = () => { setDraft(display); setEditing(true); };
    const commit = () => {
      const raw = draft.trim();
      if (raw === '') { setEditing(false); return; }
      const parsed = parse ? parse(raw) : Number(raw);
      if (!Number.isFinite(parsed)) { setEditing(false); return; }
      // Compare in display space — comparing parsed-vs-Number(value) trips
      // false positives whenever displayTransform is lossy (e.g. Math.round
      // for ratios), causing a plain click-then-blur to overwrite a stored
      // 0.305 with 0.31 even though the user typed nothing.
      if (raw !== display) onSave(parsed);
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

  window.AdminPage = AdminPage;
})();
