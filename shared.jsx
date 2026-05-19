// Shared theme + tokens for RCIS Dashboard variations.
// Provides: ThemeContext, useTheme(), brand tokens, specialty color lookup,
// owner avatar, status pill, and a couple of layout primitives.

window.RCIS_BRAND = {
  teal:  '#1FA39A',
  tealDark: '#157C75',
  tealSoft: '#D7EEEC',
  coral: '#E76B5D',
  coralDark: '#C04E40',
  coralSoft: '#FBE2DD',
  navy:  '#1B2956',
  navyDark: '#0E193A',
  navySoft: '#DDE3F0',
  cream: '#FBF8F3',
  creamDeep: '#F3EFE6',
  ink:   '#1A1815',
};

// Each style picks its palette via ThemeContext.
window.RCIS_ThemeContext = React.createContext({ dark: false, palette: {} });
window.useRCISTheme = () => React.useContext(window.RCIS_ThemeContext);

window.specColor = (code) => {
  const m = (window.RCIS_DATA.SPECIALTIES || []).find((s) => s.code === code);
  return m ? m.color : '#888';
};
window.specName = (code) => {
  const m = (window.RCIS_DATA.SPECIALTIES || []).find((s) => s.code === code);
  return m ? m.name : code;
};
window.teamMember = (id) => (window.RCIS_DATA.TEAM || []).find((t) => t.id === id) || { name: '?', initials: '?', color: '#888' };

// Tiny avatar with initials. Size adapts.
window.OwnerAvatar = function OwnerAvatar({ id, size = 22, title, ring }) {
  const t = window.teamMember(id);
  return (
    <span
      title={title || t.name}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: '50%',
        background: t.color, color: '#fff',
        fontSize: Math.round(size * 0.42), fontWeight: 700, letterSpacing: 0.2,
        boxShadow: ring ? `0 0 0 2px ${ring}` : 'none',
        flexShrink: 0,
      }}
    >{t.initials}</span>
  );
};

// Specialty chip pill.
window.SpecChip = function SpecChip({ code, size = 'sm', filled = false }) {
  const c = window.specColor(code);
  const isLarge = size === 'lg';
  if (filled) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center',
        padding: isLarge ? '3px 8px' : '2px 6px',
        borderRadius: 4,
        fontSize: isLarge ? 11 : 10,
        fontWeight: 700, letterSpacing: 0.5,
        background: c, color: '#fff',
        lineHeight: 1.2,
      }}>{code}</span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: isLarge ? '3px 9px 3px 7px' : '2px 7px 2px 5px',
      borderRadius: 999,
      fontSize: isLarge ? 11 : 10,
      fontWeight: 600, letterSpacing: 0.3,
      background: `${c}1A`, color: c,
      lineHeight: 1.2,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: c }} />
      {code}
    </span>
  );
};

// Status pill (avail/full/pto/partial).
window.StatusPill = function StatusPill({ status, compact = false }) {
  const map = {
    avail:   { txt: 'Available', dot: '#3E8A57', bg: '#E5F1EA' },
    full:    { txt: 'Full',      dot: '#C04E40', bg: '#FBE2DD' },
    partial: { txt: 'Partial',   dot: '#C98A2C', bg: '#F8ECD3' },
    pto:     { txt: 'Out / PTO', dot: '#5A6478', bg: '#E5E7EC' },
  };
  const s = map[status] || map.avail;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: compact ? '1px 6px' : '2px 8px',
      borderRadius: 999, background: s.bg, color: '#3a3a3a',
      fontSize: compact ? 10 : 11, fontWeight: 600,
      lineHeight: 1.2,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: s.dot }} />
      {s.txt}
    </span>
  );
};

// Priority dot.
window.PrioDot = function PrioDot({ prio }) {
  const m = { urgent: '#C04E40', high: '#D97757', medium: '#C98A2C', low: '#7A8290' };
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: 4,
      background: m[prio] || '#999', flexShrink: 0,
    }} />
  );
};

// Capacity bar — small horizontal fill.
window.CapacityBar = function CapacityBar({ assigned, cap, height = 6, track, fill }) {
  const pct = cap > 0 ? Math.min(100, (assigned / cap) * 100) : 0;
  const fillColor = fill || (pct >= 100 ? '#C04E40' : pct >= 85 ? '#C98A2C' : '#1FA39A');
  return (
    <div style={{
      width: '100%', height, borderRadius: height,
      background: track || 'rgba(0,0,0,.06)', overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%', background: fillColor,
        borderRadius: height, transition: 'width .25s',
      }} />
    </div>
  );
};

// Placeholder mini-sparkline using a single SVG polyline.
window.MiniSpark = function MiniSpark({ values, color = '#1FA39A', w = 80, h = 24 }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
                strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

// Weekly hours grid — Mon-Fri x 4 time blocks. Cells colored by load.
window.WeekGrid = function WeekGrid({ schedule, cellSize = 14, gap = 3, palette }) {
  const days = ['M','T','W','R','F'];
  const blocks = ['AM','MID','PM','LATE'];
  const colorFor = (v) => {
    if (v === 0) return palette?.empty || 'rgba(0,0,0,.05)';
    if (v === 1) return palette?.light || '#D7EEEC';
    if (v === 2) return palette?.mid || '#9CDAD5';
    return palette?.full || '#1FA39A';
  };
  return (
    <div style={{ display: 'grid', gap, gridTemplateColumns: `repeat(${days.length}, ${cellSize}px)` }}>
      {blocks.map((b, bi) => days.map((d, di) => (
        <div key={`${b}-${d}`} style={{
          width: cellSize, height: cellSize, borderRadius: 3,
          background: colorFor(schedule[bi]?.[di] ?? 0),
        }} />
      )))}
    </div>
  );
};

// A small generic icon set (stroke-based, minimal).
window.Icon = function Icon({ name, size = 16, color = 'currentColor', stroke = 1.6 }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6" /><path d="M16 16l4 4" /></>,
    bell:   <><path d="M6 14V10a6 6 0 0112 0v4l2 2H4l2-2z" /><path d="M10 19a2 2 0 004 0" /></>,
    plus:   <><path d="M12 5v14M5 12h14" /></>,
    chev:   <><path d="M6 9l6 6 6-6" /></>,
    chevr:  <><path d="M9 18l6-6-6-6" /></>,
    grid:   <><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></>,
    user:   <><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0116 0"/></>,
    school: <><path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M5 11v6a7 7 0 0014 0v-6"/></>,
    cal:    <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>,
    list:   <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    pin:    <><path d="M12 2v8m0 0l-4 4h8l-4-4zM12 14v8"/></>,
    file:   <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/></>,
    flag:   <><path d="M4 21V4h12l-2 4 2 4H4"/></>,
    flame:  <><path d="M12 22a6 6 0 006-6c0-4-3-5-3-9 0-2-1-3-3-3 0 5-6 6-6 12a6 6 0 006 6z"/></>,
    check:  <><path d="M4 12l5 5L20 6"/></>,
    filter: <><path d="M3 5h18l-7 9v6l-4-2v-4z"/></>,
    map:    <><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v16M15 6v16"/></>,
    dot:    <><circle cx="12" cy="12" r="3" /></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.2-1.6l2-1.5-2-3.4-2.4.9a7 7 0 00-2.8-1.6L13 2h-4l-.6 2.8a7 7 0 00-2.8 1.6l-2.4-.9-2 3.4 2 1.5A7 7 0 003 12a7 7 0 00.2 1.6l-2 1.5 2 3.4 2.4-.9a7 7 0 002.8 1.6L9 22h4l.6-2.8a7 7 0 002.8-1.6l2.4.9 2-3.4-2-1.5c.1-.5.2-1 .2-1.6z"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
         style={{ display: 'block', flexShrink: 0 }}>
      {paths[name] || paths.dot}
    </svg>
  );
};

// Returns a relative time string from a 'posted' label already in days.
window.daysAgo = (s) => s;

// Each artboard's "frozen" date — Friday, May 16 2025 (Fri morning vibe).
window.RCIS_TODAY = 'Friday, May 16';
