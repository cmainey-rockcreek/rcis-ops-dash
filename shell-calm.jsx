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
    const team = window.useTeam ? window.useTeam() : window.RCIS_DATA.TEAM;
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
        <div style={{
          flex: 1, maxWidth: 460,
          display: 'flex', alignItems: 'center', gap: 8,
          height: 32, padding: '0 12px',
          background: pal.chipBg,
          border: `1px solid ${pal.border}`,
          borderRadius: 8,
        }}>
          <Icon name="search" size={14} color={pal.textFaint} stroke={1.8} />
          <span style={{ fontSize: 13, color: pal.textFaint }}>
            {searchPlaceholder || 'Search contractors, schools, todos…'}
          </span>
          <span style={{
            marginLeft: 'auto', fontSize: 11, color: pal.textFaint,
            border: `1px solid ${pal.border}`, padding: '1px 5px', borderRadius: 4,
            fontFamily: 'ui-monospace, monospace',
          }}>⌘K</span>
        </div>
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
          <div style={{ display: 'flex' }}>
            {team.map((t, i) => (
              <div key={t.id} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                <OwnerAvatar id={t.id} size={26} ring={pal.headerBg} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Sidebar ──────────────────────────────────────────────────────────────
  function CalmSidebar({ pal, activePage }) {
    // Subscribe to renewals so the sidebar badge updates live with the store.
    const renewals = window.useRenewals ? window.useRenewals() : [];
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
      { key: 'contractors', icon: 'user',   name: 'Contractors',  to: '/contractors', badge: window.RCIS_DATA.CONTRACTORS.length.toString() },
      { key: 'contacts',    icon: 'user',   name: 'Contacts',     to: '/contacts' },
      { key: 'districts',   icon: 'flag',   name: 'Districts',    to: '/districts',   badge: window.RCIS_DATA.DISTRICTS.length.toString() },
      { key: 'matchmaker',  icon: 'cal',    name: 'Matchmaker',   to: '/matchmaker' },
      { key: 'board',       icon: 'list',   name: 'Tasks',        to: '/board' },
      { key: 'renewals',    icon: 'file',   name: 'Renewals',     to: '/renewals',    badge: renewalsBadge },
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
