// Admin page — team management. Specialty settings (indirect ratio, burden,
// rate bands) live on /financials since they're financial configuration.
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
      </div>
    );
  }

  function TeamMembersSection({ pal }) {
    const profiles = window.useAdminProfiles ? window.useAdminProfiles() : [];
    // Sort: active claimed, then pending invites, then deactivated. The
    // pending tier sits between so a fresh invite stays visible without
    // disappearing into the "inactive" bottom.
    const sorted = React.useMemo(() => {
      const tier = (p) => p.invited ? 1 : (p.active ? 0 : 2);
      return [...profiles].sort((a, b) => {
        const ta = tier(a), tb = tier(b);
        if (ta !== tb) return ta - tb;
        return (a.name || '').localeCompare(b.name || '');
      });
    }, [profiles]);

    const activeCount  = sorted.filter((p) => p.active && !p.invited).length;
    const pendingCount = sorted.filter((p) => p.invited).length;

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
          }}>
            {activeCount} active{pendingCount > 0 ? ` · ${pendingCount} pending` : ''} · {sorted.length} total
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: pal.textFaint }}>
            Pre-add invites below; they link to the auth account on first sign-in.
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
          <span style={{ textAlign: 'right' }}>Status</span>
        </div>

        {sorted.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: pal.textFaint, fontSize: 13 }}>
            No team profiles yet — sign in or pre-add a teammate below.
          </div>
        ) : (
          sorted.map((p) => <TeamRow key={p.id || ('pending:' + p.email)} p={p} pal={pal} />)
        )}

        <InviteForm pal={pal} />
      </div>
    );
  }

  // Pre-add form: name, email, role. Creates a pending team_profiles row;
  // the Postgres handle_new_auth_user trigger will claim it (attach the
  // auth uid, clear the invited flag) the first time the teammate signs
  // up with that email. No system-sent email — share the dashboard URL
  // with them out of band.
  function InviteForm({ pal }) {
    const [draft, setDraft] = React.useState({ name: '', email: '', role: 'Team' });
    const [busy, setBusy]   = React.useState(false);
    const [error, setError] = React.useState(null);
    const [okFlash, setOkFlash] = React.useState(null);

    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
    const reset = () => setDraft({ name: '', email: '', role: 'Team' });

    const canSubmit = !busy
      && draft.email.trim().length > 2
      && draft.email.includes('@');

    const submit = async (e) => {
      if (e && e.preventDefault) e.preventDefault();
      if (!canSubmit) return;
      setBusy(true); setError(null);
      const res = await window.TeamStore.invite(draft);
      setBusy(false);
      if (res && res.error) { setError(res.error); return; }
      setOkFlash(`Invited ${draft.email.trim()}.`);
      reset();
      setTimeout(() => setOkFlash(null), 3500);
    };

    const inputStyle = {
      padding: '6px 10px', fontSize: 12.5,
      color: pal.text, background: pal.cardAlt,
      border: `1px solid ${pal.border}`, borderRadius: 6,
      outline: 'none', fontFamily: 'inherit',
      width: '100%',
    };
    const labelStyle = {
      fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
      color: pal.textFaint, textTransform: 'uppercase', marginBottom: 4,
    };

    return (
      <form onSubmit={submit} style={{
        padding: '14px 16px',
        background: pal.cardAlt,
        borderTop: `1px solid ${pal.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <h4 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: pal.text }}>
            Pre-add teammate
          </h4>
          <span style={{ fontSize: 11, color: pal.textFaint }}>
            They'll link to this profile when they sign up with this email.
          </span>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 1fr 100px',
          gap: 10, alignItems: 'end',
        }}>
          <div>
            <div style={labelStyle}>Name</div>
            <input value={draft.name} placeholder="First Last" style={inputStyle}
              onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div>
            <div style={labelStyle}>Email *</div>
            <input type="email" value={draft.email} placeholder="teammate@rcis.example"
              required style={inputStyle}
              onChange={(e) => set({ email: e.target.value })} />
          </div>
          <div>
            <div style={labelStyle}>Role</div>
            <input value={draft.role} placeholder="Team" style={inputStyle}
              onChange={(e) => set({ role: e.target.value })} />
          </div>
          <button type="submit" disabled={!canSubmit} style={{
            padding: '7px 12px', fontSize: 12.5, fontWeight: 600,
            background: canSubmit ? pal.accent : pal.chipBg,
            color: canSubmit ? '#fff' : pal.textFaint,
            border: 'none', borderRadius: 6,
            cursor: canSubmit ? 'pointer' : 'default',
            fontFamily: 'inherit',
          }}>{busy ? 'Inviting…' : 'Pre-add'}</button>
        </div>
        {error && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: pal.warn }}>{error}</div>
        )}
        {okFlash && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: pal.accent }}>{okFlash}</div>
        )}
      </form>
    );
  }

  function TeamRow({ p, pal }) {
    // Claimed rows update by id; pending rows (no auth uid yet) update
    // by email. Same patch shape — the store fans out internally.
    const save = (patch) => p.invited
      ? window.TeamStore.updatePendingProfile(p.email, patch)
      : window.TeamStore.updateProfile(p.id, patch);
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
          onSave={(v) => save({ role: v })} requireNonEmpty />

        <EditableCell pal={pal} value={p.initials} placeholder="—"
          monospace maxLen={3} requireNonEmpty
          onSave={(v) => save({ initials: (v || '').toUpperCase() })} />

        <ColorPicker pal={pal} value={p.color} onSave={(v) => save({ color: v })} />

        {p.invited
          ? <PendingStatus pal={pal} email={p.email} />
          : <ActiveToggle pal={pal} active={p.active}
              onChange={(v) => save({ active: v })} />}
      </div>
    );
  }

  // Status cell for a pending invite: a "Pending" pill plus a Cancel
  // affordance that deletes the pre-added row. Replaces the Active toggle
  // until the teammate signs up and the row gets claimed.
  function PendingStatus({ pal, email }) {
    const [confirming, setConfirming] = React.useState(false);
    const cancel = () => {
      window.TeamStore.cancelInvite(email);
      setConfirming(false);
    };
    return (
      <span style={{
        marginLeft: 'auto',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        whiteSpace: 'nowrap',
      }}>
        <span title="Awaiting first sign-up with this email"
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
            color: '#C98A2C', background: '#C98A2C22',
            padding: '2px 7px', borderRadius: 10,
            textTransform: 'uppercase',
          }}>Pending</span>
        {confirming ? (
          <span style={{ display: 'inline-flex', gap: 4 }}>
            <button onClick={cancel} title="Confirm cancel"
              style={pendingActionBtn(pal, true)}>Cancel</button>
            <button onClick={() => setConfirming(false)} title="Keep invite"
              style={pendingActionBtn(pal, false)}>Keep</button>
          </span>
        ) : (
          <button onClick={() => setConfirming(true)} title="Cancel invite"
            style={pendingActionBtn(pal, false)}>×</button>
        )}
      </span>
    );
  }
  function pendingActionBtn(pal, danger) {
    return {
      padding: '2px 7px', fontSize: 10.5, fontWeight: 600,
      color: danger ? '#C04E40' : pal.textFaint,
      background: 'transparent',
      border: `1px solid ${danger ? '#C04E40' : pal.border}`,
      borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
    };
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
  window.AdminPage = AdminPage;
})();
