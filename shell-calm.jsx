// Calm Ops shell — top bar + sidebar + palette.
// Extracted from dashboard-calm.jsx so other pages (Contractors, Schools)
// share the same chrome.

(function () {
  const { OwnerAvatar, Icon } = window;

  // ─── Palette ──────────────────────────────────────────────────────────────
  function calmPalette(dark) {
    return dark ? {
      dark: true,
      page: '#15171C',
      card: '#1D2026',
      cardAlt: '#23262D',
      border: 'rgba(255,255,255,.08)',
      borderSoft: 'rgba(255,255,255,.05)',
      text: '#EDECE8',
      textSoft: 'rgba(237,236,232,.62)',
      textFaint: 'rgba(237,236,232,.38)',
      accent: '#2BBFB5',
      accentSoft: 'rgba(43,191,181,.15)',
      warn: '#E76B5D',
      warnSoft: 'rgba(231,107,93,.15)',
      chipBg: 'rgba(255,255,255,.05)',
      headerBg: '#1D2026',
      railBg: '#0F1116',
      railText: '#F4F0E8',
      railTextSoft: 'rgba(244,240,232,.65)',
      railTextFaint: 'rgba(244,240,232,.4)',
      railBorder: 'rgba(255,255,255,.07)',
      railChipBg: 'rgba(255,255,255,.05)',
      railActiveBg: 'rgba(43,191,181,.18)',
      railActiveText: '#3FD4CA',
      railHover: 'rgba(255,255,255,.04)',
      inputBg: 'rgba(255,255,255,.04)',
    } : {
      dark: false,
      page: '#FBF8F3',
      card: '#FFFFFF',
      cardAlt: '#FAF7F1',
      border: 'rgba(26,24,21,.09)',
      borderSoft: 'rgba(26,24,21,.05)',
      text: '#1A1815',
      textSoft: 'rgba(26,24,21,.6)',
      textFaint: 'rgba(26,24,21,.38)',
      accent: '#157C75',
      accentSoft: 'rgba(31,163,154,.12)',
      warn: '#C04E40',
      warnSoft: 'rgba(231,107,93,.12)',
      chipBg: 'rgba(26,24,21,.04)',
      headerBg: '#FFFFFF',
      railBg: '#1B2956',
      railText: '#F4F0E8',
      railTextSoft: 'rgba(244,240,232,.72)',
      railTextFaint: 'rgba(244,240,232,.45)',
      railBorder: 'rgba(255,255,255,.08)',
      railChipBg: 'rgba(255,255,255,.07)',
      railActiveBg: 'rgba(255,255,255,.12)',
      railActiveText: '#FFFFFF',
      railHover: 'rgba(255,255,255,.06)',
      inputBg: '#FFFFFF',
    };
  }

  // ─── Top Bar ──────────────────────────────────────────────────────────────
  function CalmTopBar({ pal, searchPlaceholder }) {
    const team = window.useTeam();
    return (
      <div style={{
        height: 56, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 20px',
        background: pal.headerBg,
        borderBottom: `1px solid ${pal.border}`,
      }}>
        <window.Link to="/" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          minWidth: 200, textDecoration: 'none',
        }}>
          <img src="assets/logo.avif" alt="RCIS" style={{ height: 28, width: 'auto' }} />
        </window.Link>
        <GlobalSearch pal={pal} placeholder={searchPlaceholder} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => window.navigate('/board')} style={{
            height: 32, padding: '0 12px', borderRadius: 8,
            background: pal.accent, color: '#fff', border: 'none',
            fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer',
          }}>
            <Icon name="plus" size={14} stroke={2.2}/> New task
          </button>
          <button onClick={() => window.toggleDark && window.toggleDark()}
            title={pal.dark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={pal.dark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: 32, height: 32, padding: 0, borderRadius: 8,
              background: 'transparent', color: pal.textSoft,
              border: `1px solid ${pal.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = pal.text; e.currentTarget.style.borderColor = pal.textFaint; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = pal.textSoft; e.currentTarget.style.borderColor = pal.border; }}>
            <Icon name={pal.dark ? 'sun' : 'moon'} size={15} stroke={1.8} />
          </button>
          <div style={{ width: 1, height: 22, background: pal.border, margin: '0 4px' }} />
          <div style={{ display: 'flex' }} title={team.map((t) => t.name).join(', ')}>
            {team.slice(0, 5).map((t, i) => (
              <div key={t.id} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                <OwnerAvatar id={t.id} size={26} ring={pal.headerBg} />
              </div>
            ))}
            {team.length > 5 && (
              <span style={{
                marginLeft: -6,
                width: 26, height: 26, borderRadius: 13,
                background: pal.chipBg, color: pal.textSoft,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10.5, fontWeight: 700,
                border: `2px solid ${pal.headerBg}`,
                fontVariantNumeric: 'tabular-nums',
              }}>+{team.length - 5}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Global search ────────────────────────────────────────────────────────
  // Searches across contractors, schools, districts, contacts, and tasks.
  // ⌘K (or Ctrl+K) focuses; Esc clears; Enter on a result navigates.
  // Click outside or navigate closes the dropdown.
  function GlobalSearch({ pal, placeholder }) {
    const [query, setQuery] = React.useState('');
    const [focused, setFocused] = React.useState(false);
    const [activeIdx, setActiveIdx] = React.useState(0);
    const inputRef = React.useRef(null);
    const wrapRef = React.useRef(null);

    // Subscribe to live stores so newly-added rows appear in results.
    const liveContractors = window.useContractors ? window.useContractors() : window.RCIS_DATA.CONTRACTORS;
    const contacts = window.useContacts ? window.useContacts() : [];
    const todos    = window.useTodos    ? window.useTodos()    : [];
    if (window.useSchoolOverrides)   window.useSchoolOverrides();
    if (window.useDistrictOverrides) window.useDistrictOverrides();
    if (window.useContractorOverrides) window.useContractorOverrides();

    // ⌘K / Ctrl+K focuses the input from anywhere.
    React.useEffect(() => {
      const onKey = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          if (inputRef.current) inputRef.current.focus();
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Close dropdown on outside click.
    React.useEffect(() => {
      if (!focused) return undefined;
      const onClick = (e) => {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) setFocused(false);
      };
      document.addEventListener('mousedown', onClick);
      return () => document.removeEventListener('mousedown', onClick);
    }, [focused]);

    const q = query.trim().toLowerCase();

    const results = React.useMemo(() => {
      if (!q) return [];
      const max = 5;
      const out = [];

      // Contractors — apply overrides so renames are searchable.
      const contractorsList = window.applyContractorOverride
        ? liveContractors.map((c) => window.applyContractorOverride(c) || c)
        : liveContractors;
      contractorsList.forEach((c) => {
        if (out.filter((r) => r.kind === 'contractor').length >= max) return;
        const hay = `${c.name} ${c.spec} ${(c.states || []).join(',')} ${c.email || ''} ${c.city || ''}`.toLowerCase();
        if (hay.includes(q)) {
          out.push({
            kind: 'contractor', id: c.id,
            title: c.name,
            subtitle: `${c.spec} · ${(c.states || []).join(', ')}${c.city ? ' · ' + c.city : ''}`,
            to: `/contractors/${c.id}`,
            color: window.specColor ? window.specColor(c.spec) : pal.accent,
          });
        }
      });

      // Schools — apply overrides for renames.
      const SCHOOLS = (window.RCIS_DATA && window.RCIS_DATA.SCHOOLS) || [];
      SCHOOLS.forEach((s) => {
        if (out.filter((r) => r.kind === 'school').length >= max) return;
        const view = window.applySchoolOverride ? window.applySchoolOverride(s) : s;
        const hay = `${view.name} ${view.state}`.toLowerCase();
        if (hay.includes(q)) {
          out.push({
            kind: 'school', id: s.id,
            title: view.name,
            subtitle: view.state,
            to: `/schools/${s.id}`,
          });
        }
      });

      // Districts.
      const DISTRICTS = (window.RCIS_DATA && window.RCIS_DATA.DISTRICTS) || [];
      DISTRICTS.forEach((d) => {
        if (out.filter((r) => r.kind === 'district').length >= max) return;
        const view = window.applyDistrictOverride ? window.applyDistrictOverride(d) : d;
        const hay = `${view.name} ${view.state}`.toLowerCase();
        if (hay.includes(q)) {
          out.push({
            kind: 'district', id: d.id,
            title: view.name,
            subtitle: view.state,
            to: `/districts/${d.id}`,
          });
        }
      });

      // Contacts.
      contacts.forEach((ct) => {
        if (out.filter((r) => r.kind === 'contact').length >= max) return;
        const hay = `${ct.name} ${ct.role || ''} ${ct.organization || ''} ${ct.email || ''}`.toLowerCase();
        if (hay.includes(q)) {
          out.push({
            kind: 'contact', id: ct.id,
            title: ct.name,
            subtitle: [ct.role, ct.organization].filter(Boolean).join(' · ') || '—',
            to: `/contacts/${ct.id}`,
          });
        }
      });

      // Tasks — title + label.
      todos.forEach((t) => {
        if (out.filter((r) => r.kind === 'task').length >= max) return;
        const hay = `${t.title} ${t.label || ''}`.toLowerCase();
        if (hay.includes(q)) {
          out.push({
            kind: 'task', id: t.id,
            title: t.title,
            subtitle: `${t.label || 'Task'} · ${t.column}`,
            to: `/board`,
          });
        }
      });

      // Sort by section order (kind precedence) but preserve in-section order.
      const ORDER = { contractor: 1, school: 2, district: 3, contact: 4, task: 5 };
      out.sort((a, b) => (ORDER[a.kind] || 9) - (ORDER[b.kind] || 9));
      return out;
    }, [q, liveContractors, contacts, todos, pal.accent]);

    React.useEffect(() => { setActiveIdx(0); }, [q]);

    const choose = (r) => {
      setQuery('');
      setFocused(false);
      window.navigate(r.to);
    };

    const onKeyDown = (e) => {
      if (!results.length) {
        if (e.key === 'Escape') { setQuery(''); inputRef.current && inputRef.current.blur(); }
        return;
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => (i + 1) % results.length); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => (i - 1 + results.length) % results.length); }
      else if (e.key === 'Enter')     { e.preventDefault(); choose(results[activeIdx]); }
      else if (e.key === 'Escape')    { setQuery(''); setFocused(false); inputRef.current && inputRef.current.blur(); }
    };

    // Group results by kind for sectioned rendering.
    const grouped = React.useMemo(() => {
      const g = { contractor: [], school: [], district: [], contact: [], task: [] };
      results.forEach((r) => { (g[r.kind] || (g[r.kind] = [])).push(r); });
      return g;
    }, [results]);

    const KIND_LABEL = {
      contractor: 'Contractors',
      school: 'Schools',
      district: 'Districts',
      contact: 'Contacts',
      task: 'Tasks',
    };

    let runningIdx = -1; // running index across sections so arrow keys match `results`

    return (
      <div ref={wrapRef} style={{
        flex: 1, maxWidth: 460, position: 'relative',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 32, padding: '0 12px',
          background: pal.chipBg,
          border: `1px solid ${focused ? pal.accent : pal.border}`,
          borderRadius: 8,
          transition: 'border-color .12s ease',
        }}>
          <Icon name="search" size={14} color={pal.textFaint} stroke={1.8} />
          <input ref={inputRef}
            value={query}
            placeholder={placeholder || 'Search contractors, schools, contacts, tasks…'}
            onChange={(e) => { setQuery(e.target.value); setFocused(true); }}
            onFocus={() => setFocused(true)}
            onKeyDown={onKeyDown}
            style={{
              flex: 1, height: '100%',
              border: 'none', outline: 'none',
              background: 'transparent', color: pal.text,
              fontSize: 13, fontFamily: 'inherit',
              minWidth: 0,
            }}
          />
          {query ? (
            <button onClick={() => { setQuery(''); inputRef.current && inputRef.current.focus(); }}
              style={{
                border: 'none', background: 'transparent', color: pal.textFaint,
                cursor: 'pointer', fontSize: 14, padding: '0 4px',
              }}>×</button>
          ) : (
            <span style={{
              fontSize: 11, color: pal.textFaint,
              border: `1px solid ${pal.border}`, padding: '1px 5px', borderRadius: 4,
              fontFamily: 'ui-monospace, monospace',
            }}>⌘K</span>
          )}
        </div>

        {focused && q && (
          <div style={{
            position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 60,
            background: pal.card,
            border: `1px solid ${pal.border}`,
            borderRadius: 10,
            boxShadow: '0 14px 40px rgba(0,0,0,.22)',
            maxHeight: '70vh', overflowY: 'auto',
            padding: 6,
          }}>
            {results.length === 0 ? (
              <div style={{ padding: '14px 12px', fontSize: 12.5, color: pal.textFaint, fontStyle: 'italic' }}>
                No matches for “{query}”.
              </div>
            ) : (
              Object.keys(grouped).map((kind) => {
                const items = grouped[kind] || [];
                if (!items.length) return null;
                return (
                  <div key={kind} style={{ marginBottom: 4 }}>
                    <div style={{
                      padding: '6px 10px 2px',
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
                      color: pal.textFaint, textTransform: 'uppercase',
                    }}>{KIND_LABEL[kind]} · {items.length}</div>
                    {items.map((r) => {
                      runningIdx += 1;
                      const idx = runningIdx;
                      const on = idx === activeIdx;
                      return (
                        <div key={`${r.kind}-${r.id}`}
                          onMouseEnter={() => setActiveIdx(idx)}
                          onMouseDown={(e) => { e.preventDefault(); choose(r); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '7px 10px',
                            borderRadius: 7,
                            background: on ? pal.accentSoft : 'transparent',
                            cursor: 'pointer',
                          }}>
                          <KindBadge kind={r.kind} pal={pal} color={r.color} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 12.5, color: pal.text, fontWeight: 500,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{r.title}</div>
                            <div style={{
                              fontSize: 11, color: pal.textFaint, marginTop: 1,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{r.subtitle}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }

  function KindBadge({ kind, pal, color }) {
    const META = {
      contractor: { abbr: 'CON', label: 'Contractor' },
      school:     { abbr: 'SCH', label: 'School' },
      district:   { abbr: 'DIST', label: 'District' },
      contact:    { abbr: 'CT',  label: 'Contact' },
      task:       { abbr: 'TSK', label: 'Task' },
    };
    const m = META[kind] || { abbr: '·' };
    const swatch = color || pal.accent;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 38, padding: '2px 6px',
        background: swatch + '20', color: swatch,
        fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6,
        borderRadius: 4, fontFamily: 'ui-monospace, monospace',
        flexShrink: 0,
      }}>{m.abbr}</span>
    );
  }

  // ─── Sidebar ──────────────────────────────────────────────────────────────
  function CalmSidebar({ pal, activePage }) {
    // Subscribe so the sidebar badges + counts update live with the stores.
    const renewals = window.useRenewals ? window.useRenewals() : [];
    const liveContractors = window.useContractors ? window.useContractors() : window.RCIS_DATA.CONTRACTORS;
    const contacts = window.useContacts ? window.useContacts() : [];
    const renewalsBadge = React.useMemo(() => {
      if (!renewals.length) return null;
      const n = renewals.filter((r) => {
        if (r.status === 'lapsed') return false;
        const u = window.renewalUrgency && window.renewalUrgency(r.expiresOn);
        return u === 'overdue' || u === 'soon' || u === 'upcoming';
      }).length;
      return n > 0 ? String(n) : null;
    }, [renewals]);

    const NAV = [
      { key: 'home',        icon: 'grid',   name: 'Home',         to: '/' },
      { key: 'contractors', icon: 'user',   name: 'Contractors',  to: '/contractors', badge: String(liveContractors.length) },
      { key: 'contacts',    icon: 'user',   name: 'Contacts',     to: '/contacts',    badge: contacts.length ? String(contacts.length) : null },
      { key: 'districts',   icon: 'flag',   name: 'Districts',    to: '/districts',   badge: String(window.RCIS_DATA.DISTRICTS.length) },
      { key: 'matchmaker',  icon: 'cal',    name: 'Matchmaker',   to: '/matchmaker' },
      { key: 'board',       icon: 'list',   name: 'Tasks',        to: '/board' },
      { key: 'renewals',    icon: 'file',   name: 'Renewals',     to: '/renewals',    badge: renewalsBadge },
      { key: 'financials',  icon: 'file',   name: 'Financials',   to: '/financials' },
      { key: 'admin',       icon: 'settings', name: 'Admin',      to: '/admin' },
    ];
    return (
      <div style={{
        width: 224, flexShrink: 0,
        background: pal.railBg,
        borderRight: `1px solid ${pal.railBorder}`,
        padding: '18px 12px',
        display: 'flex', flexDirection: 'column', gap: 18,
        overflow: 'hidden',
      }}>
        <div>
          {NAV.map((n) => {
            const isActive = n.key === activePage;
            return (
              <window.Link key={n.key} to={n.to} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px', borderRadius: 7,
                background: isActive ? pal.railActiveBg : 'transparent',
                color: isActive ? pal.railActiveText : pal.railTextSoft,
                fontSize: 13, fontWeight: isActive ? 600 : 500,
                marginBottom: 1, textDecoration: 'none',
              }}>
                <Icon name={n.icon} size={15} stroke={isActive ? 2 : 1.7} />
                <span style={{ flex: 1 }}>{n.name}</span>
                {n.badge && (
                  <span style={{
                    fontSize: 11, fontWeight: 500,
                    color: pal.railTextFaint, fontVariantNumeric: 'tabular-nums',
                  }}>{n.badge}</span>
                )}
              </window.Link>
            );
          })}
        </div>

        <div style={{
          marginTop: 'auto', padding: '12px 10px 4px',
          borderTop: `1px solid ${pal.railBorder}`,
          color: pal.railTextFaint, fontSize: 11,
        }}>
          <SignedInAs pal={pal} />
        </div>
      </div>
    );
  }

  // ─── Page wrapper — provides palette, top bar, sidebar, content area ──────
  function PageShell({ dark = false, activePage, searchPlaceholder, children }) {
    const pal = calmPalette(dark);
    return (
      <div style={{
        width: '100%', minHeight: '100vh', height: '100vh',
        background: pal.page, color: pal.text,
        fontFamily: '"Public Sans", "Söhne", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        fontSize: 13, lineHeight: 1.4,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <CalmTopBar pal={pal} searchPlaceholder={searchPlaceholder} />
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <CalmSidebar pal={pal} activePage={activePage} />
          {children(pal)}
        </div>
      </div>
    );
  }

  function SignedInAs({ pal }) {
    const auth = window.useAuth ? window.useAuth() : { user: null };
    if (window.useTeam) window.useTeam();
    const current = window.TeamStore && window.TeamStore.current();
    if (!auth.user) return null;
    return (
      <div>
        <div style={{ color: pal.railText, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {(current && current.name) || auth.user.email}
        </div>
        {current && current.email && current.name !== current.email && (
          <div style={{ color: pal.railTextFaint, fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {current.email}
          </div>
        )}
        <a onClick={() => window.signOut && window.signOut()} style={{
          color: pal.railTextFaint, fontSize: 11, cursor: 'pointer', marginTop: 4, display: 'inline-block',
        }}>Sign out</a>
      </div>
    );
  }

  window.calmPalette = calmPalette;
  window.CalmTopBar = CalmTopBar;
  window.CalmSidebar = CalmSidebar;
  window.PageShell = PageShell;
})();
