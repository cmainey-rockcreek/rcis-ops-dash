// Calm Ops shell — top bar + sidebar + palette.
// Extracted from dashboard-calm.jsx so other pages (Contractors, Schools)
// share the same chrome.

(function () {
  const { OwnerAvatar, Icon } = window;

  // ─── Palette ──────────────────────────────────────────────────────────────
  function calmPalette(dark) {
    return dark ? {
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
    const team = window.RCIS_DATA.TEAM;
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
    const { SPECIALTIES, DISTRICTS } = window.RCIS_DATA;
    const NAV = [
      { key: 'dashboard',   icon: 'grid',   name: 'Overview',     to: '/' },
      { key: 'contractors', icon: 'user',   name: 'Contractors',  to: '/contractors', badge: window.RCIS_DATA.CONTRACTORS.length.toString() },
      { key: 'contacts',    icon: 'user',   name: 'Contacts',     to: '/contacts' },
      { key: 'districts',   icon: 'flag',   name: 'Districts',    to: '/districts',   badge: window.RCIS_DATA.DISTRICTS.length.toString() },
      { key: 'assignments', icon: 'cal',    name: 'Assignments',  to: '/assignments' },
      { key: 'board',       icon: 'list',   name: 'Tasks',        to: '/board' },
      { key: 'renewals',    icon: 'file',   name: 'Renewals',     to: '/renewals',    badge: '5' },
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

        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
            color: pal.railTextFaint, textTransform: 'uppercase',
            padding: '0 10px 8px',
          }}>Filter by district</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {DISTRICTS.map((d) => (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 10px', borderRadius: 6,
                fontSize: 12, color: pal.railTextSoft,
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 14, height: 14, border: `1px solid ${pal.railBorder}`, borderRadius: 3,
                  background: pal.railChipBg, flexShrink: 0,
                }} />
                <span style={{
                  flex: 1, minWidth: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{d.name}</span>
                <span style={{
                  color: pal.railTextFaint, fontSize: 10.5,
                  fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                }}>{d.schools}</span>
              </div>
            ))}
            <div style={{
              padding: '4px 10px', fontSize: 11, color: pal.railTextFaint,
              cursor: 'pointer', marginTop: 2,
            }}>+ 4 more…</div>
          </div>
        </div>

        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
            color: pal.railTextFaint, textTransform: 'uppercase',
            padding: '0 10px 8px',
          }}>Specialty</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '0 8px' }}>
            {SPECIALTIES.map((s) => (
              <span key={s.code} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 8px', borderRadius: 999,
                background: pal.railChipBg,
                color: pal.railTextSoft,
                fontSize: 11, fontWeight: 500,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: s.color }} />
                {s.code}
              </span>
            ))}
          </div>
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
    if (!auth.user) return null;
    return (
      <div>
        <div style={{ color: pal.railText, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {auth.user.email}
        </div>
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
