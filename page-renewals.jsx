// RenewalsPage — central list of every contractor license / insurance /
// client contract that expires. Filters by kind + status, search by owner /
// label / state. Rows are click-to-edit (opens RenewalEditor). New renewals
// from the "+ Log renewal" button.

(function () {
  const { Icon } = window;

  function RenewalsPage({ dark = false }) {
    return (
      <window.PageShell dark={dark} activePage="renewals"
                        searchPlaceholder="Search renewals…">
        {(pal) => <RenewalsList pal={pal} />}
      </window.PageShell>
    );
  }

  function RenewalsList({ pal }) {
    const renewals = window.useRenewals();
    const [query, setQuery] = React.useState('');
    const [kindFilter, setKindFilter] = React.useState('all'); // all|contractor|client
    const [statusFilter, setStatusFilter] = React.useState('open'); // open|all
    const [editor, setEditor] = React.useState(null);

    // Group counts by urgency for the header tiles
    const buckets = React.useMemo(() => {
      const out = { overdue: 0, soon: 0, upcoming: 0, later: 0, total: renewals.length };
      renewals.forEach((r) => {
        const u = window.renewalUrgency(r.expiresOn);
        if (u && out[u] != null) out[u] += 1;
      });
      return out;
    }, [renewals]);

    const rows = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      return renewals
        .filter((r) => {
          if (kindFilter === 'contractor') return r.kind === 'contractor_license' || r.kind === 'contractor_insurance';
          if (kindFilter === 'client')     return r.kind === 'client_contract';
          return true;
        })
        .filter((r) => statusFilter === 'all' ? true : r.status !== 'lapsed')
        .filter((r) => {
          if (!q) return true;
          const owner = r.contractorName || r.schoolName || r.districtName || '';
          return (
            owner.toLowerCase().includes(q) ||
            (r.label || '').toLowerCase().includes(q) ||
            (r.state || '').toLowerCase().includes(q) ||
            (r.note || '').toLowerCase().includes(q)
          );
        })
        .sort((a, b) => {
          const ax = a.expiresOn || '9999-12-31';
          const bx = b.expiresOn || '9999-12-31';
          return ax.localeCompare(bx);
        });
    }, [renewals, query, kindFilter, statusFilter]);

    const counts = React.useMemo(() => ({
      all: renewals.length,
      contractor: renewals.filter((r) => r.kind !== 'client_contract').length,
      client: renewals.filter((r) => r.kind === 'client_contract').length,
    }), [renewals]);

    const KIND_OPTS = [
      { key: 'all',        label: 'All',         count: counts.all },
      { key: 'contractor', label: 'Contractor',  count: counts.contractor },
      { key: 'client',     label: 'Client',      count: counts.client },
    ];

    const openNew = () => setEditor({ renewal: null, isNew: true });
    const openEdit = (r) => setEditor({ renewal: { ...r }, isNew: false });
    const close = () => setEditor(null);
    const save = (patch) => {
      if (editor.isNew) {
        const { id, ...rest } = patch;
        window.RenewalsStore.add(rest);
      } else {
        window.RenewalsStore.update(editor.renewal.id, patch);
      }
      close();
    };
    const del = () => {
      window.RenewalsStore.remove(editor.renewal.id);
      close();
    };

    return (
      <div style={{
        flex: 1, padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: pal.text, letterSpacing: -0.3 }}>Renewals</h1>
          <span style={{ fontSize: 13, color: pal.textSoft }}>{rows.length} of {renewals.length}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={openNew} style={btnPrimary(pal)}>
              <Icon name="plus" size={13} stroke={2.4} /> Log renewal
            </button>
          </div>
        </div>

        {/* Urgency overview tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <UrgencyTile pal={pal} label="Overdue"        count={buckets.overdue}  tone="#E76B5D" />
          <UrgencyTile pal={pal} label="Due in 30d"     count={buckets.soon}     tone="#C98A2C" />
          <UrgencyTile pal={pal} label="Due in 60d"     count={buckets.upcoming} tone={pal.accent} />
          <UrgencyTile pal={pal} label="Beyond 60d"     count={buckets.later}    tone={pal.textSoft} />
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px',
          background: pal.card, border: `1px solid ${pal.border}`, borderRadius: 9,
        }}>
          <Icon name="search" size={15} color={pal.textFaint} stroke={1.8} />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="Search by contractor, school, license type, state…"
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

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {KIND_OPTS.map((opt) => {
            const on = kindFilter === opt.key;
            return (
              <button key={opt.key} onClick={() => setKindFilter(opt.key)} style={{
                padding: '4px 10px', borderRadius: 999,
                border: `1px solid ${on ? pal.accent : pal.border}`,
                background: on ? pal.accentSoft : 'transparent',
                color: on ? pal.accent : pal.textSoft,
                fontSize: 11.5, fontWeight: on ? 600 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                {opt.label}
                <span style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: on ? pal.accent : pal.textFaint }}>{opt.count}</span>
              </button>
            );
          })}
          <span style={{ width: 1, height: 14, background: pal.border, margin: '0 4px' }} />
          {[
            { key: 'open', label: 'Hide lapsed' },
            { key: 'all',  label: 'Show all' },
          ].map((opt) => {
            const on = statusFilter === opt.key;
            return (
              <button key={opt.key} onClick={() => setStatusFilter(opt.key)} style={{
                padding: '4px 10px', borderRadius: 999,
                border: `1px solid ${on ? pal.accent : pal.border}`,
                background: on ? pal.accentSoft : 'transparent',
                color: on ? pal.accent : pal.textSoft,
                fontSize: 11.5, fontWeight: on ? 600 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{opt.label}</button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{
          background: pal.card, border: `1px solid ${pal.border}`,
          borderRadius: 10, overflow: 'hidden',
        }}>
          {rows.length === 0 ? (
            <div style={{ padding: '40px 14px', textAlign: 'center',
              color: pal.textFaint, fontSize: 13 }}>
              {renewals.length === 0
                ? 'No renewals yet. Log your first one to start tracking.'
                : 'No renewals match these filters.'}
            </div>
          ) : (
            <>
              <RenewalHeaderRow pal={pal} />
              {rows.map((r) => <RenewalRow key={r.id} r={r} pal={pal} onClick={() => openEdit(r)} />)}
            </>
          )}
        </div>

        {editor && (
          <window.RenewalEditor
            renewal={editor.renewal} isNew={editor.isNew}
            pal={pal} onSave={save} onDelete={del} onClose={close}
          />
        )}
      </div>
    );
  }

  function UrgencyTile({ pal, label, count, tone }) {
    return (
      <div style={{
        background: pal.card,
        border: `1px solid ${pal.border}`,
        borderLeft: `3px solid ${tone}`,
        borderRadius: 9,
        padding: '10px 14px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
          textTransform: 'uppercase', color: pal.textFaint }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: tone,
          marginTop: 2, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5 }}>{count}</div>
      </div>
    );
  }

  function RenewalHeaderRow({ pal }) {
    const cell = {
      fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4,
      textTransform: 'uppercase', color: pal.textFaint,
    };
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '110px 1.6fr 1.4fr 110px 120px 80px',
        gap: 12, alignItems: 'center',
        padding: '10px 14px',
        background: pal.cardAlt,
        borderBottom: `1px solid ${pal.border}`,
      }}>
        <div style={cell}>Type</div>
        <div style={cell}>Owner</div>
        <div style={cell}>Label</div>
        <div style={cell}>State</div>
        <div style={cell}>Expires</div>
        <div style={{ ...cell, textAlign: 'right' }}>Status</div>
      </div>
    );
  }

  function RenewalRow({ r, pal, onClick }) {
    const kindMeta = window.renewalKindMeta ? window.renewalKindMeta(r.kind) : { label: r.kind, color: pal.accent };
    const status = (window.RENEWAL_STATUSES || []).find((s) => s.key === r.status) || { label: r.status, color: pal.textSoft };
    const urgency = window.renewalUrgency(r.expiresOn);
    const days = window.daysUntilRenewal(r.expiresOn);

    const owner = r.contractorName || r.schoolName || r.districtName || '—';
    const ownerSub = r.contractorName
      ? (r.state ? `Contractor · ${r.state}` : 'Contractor')
      : r.schoolName
        ? `${r.districtName || 'School'} · ${r.state || ''}`
        : `District · ${r.state || ''}`;

    const expiresColor = urgency === 'overdue' ? '#E76B5D'
                       : urgency === 'soon'    ? '#C98A2C'
                       : pal.text;
    const expiresSub = days == null
      ? '—'
      : days < 0  ? `${Math.abs(days)}d overdue`
      : days === 0 ? 'today'
      : `in ${days}d`;

    return (
      <div onClick={onClick} style={{
        display: 'grid',
        gridTemplateColumns: '110px 1.6fr 1.4fr 110px 120px 80px',
        gap: 12, alignItems: 'center',
        padding: '11px 14px',
        borderBottom: `1px solid ${pal.borderSoft}`,
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = pal.cardAlt}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: kindMeta.color,
          background: kindMeta.color + '18',
          padding: '4px 8px', borderRadius: 4, textAlign: 'center',
          whiteSpace: 'nowrap',
        }}>{shortKind(r.kind)}</span>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: pal.text, fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{owner}</div>
          <div style={{ fontSize: 11, color: pal.textFaint, marginTop: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ownerSub}</div>
        </div>

        <div style={{ minWidth: 0, fontSize: 12.5, color: pal.textSoft,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label || '—'}</div>

        <div style={{ fontSize: 12, color: pal.textSoft,
          fontVariantNumeric: 'tabular-nums' }}>{r.state || '—'}</div>

        <div>
          <div style={{ fontSize: 12.5, color: expiresColor, fontWeight: 600,
            fontVariantNumeric: 'tabular-nums' }}>{formatDate(r.expiresOn)}</div>
          <div style={{ fontSize: 10.5, color: pal.textFaint, marginTop: 1 }}>{expiresSub}</div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3,
            color: status.color,
            background: status.color + '18',
            padding: '3px 8px', borderRadius: 999,
          }}>{status.label}</span>
        </div>
      </div>
    );
  }

  function shortKind(k) {
    if (k === 'contractor_license')   return 'License';
    if (k === 'contractor_insurance') return 'Insurance';
    if (k === 'client_contract')      return 'Contract';
    return k;
  }
  function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

  window.RenewalsPage = RenewalsPage;
})();
