// Tiny hash-based router. Reads location.hash, exposes a useRoute() hook
// that re-renders on hashchange, and a Link component + navigate() helper
// for in-app navigation.
//
// Routes:
//   #/                 → dashboard
//   #/board            → tasks and follow-ups
//   #/contractors      → contractors list
//   #/contractors/c01  → contractor detail
//   #/schools          → schools list
//
// Hash routing avoids any server-side setup — the file works the same
// opened locally, on a static host, or behind an auth proxy later.

(function () {
  function parse(hash) {
    const raw = (hash || '').replace(/^#\/?/, '');
    if (!raw) return { name: 'home', segs: [] };
    const segs = raw.split('/').filter(Boolean);
    if (segs[0] === 'contractors') {
      if (segs.length === 1) return { name: 'contractors', segs };
      return { name: 'contractor', segs, id: segs[1] };
    }
    if (segs[0] === 'contacts') {
      if (segs.length === 1) return { name: 'contacts', segs };
      return { name: 'contact', segs, id: segs[1] };
    }
    if (segs[0] === 'districts') {
      if (segs.length === 1) return { name: 'districts', segs };
      return { name: 'district', segs, id: segs[1] };
    }
    if (segs[0] === 'schools') {
      if (segs.length === 1) return { name: 'schools', segs };
      return { name: 'school', segs, id: segs[1] };
    }
    if (segs[0] === 'board')     return { name: 'board', segs };
    if (segs[0] === 'matchmaker') return { name: 'matchmaker', segs };
    if (segs[0] === 'renewals')  return { name: 'renewals', segs };
    if (segs[0] === 'admin')     return { name: 'admin', segs };
    return { name: 'home', segs: [] };
  }

  function useRoute() {
    const [r, setR] = React.useState(() => parse(window.location.hash));
    React.useEffect(() => {
      const onHash = () => setR(parse(window.location.hash));
      window.addEventListener('hashchange', onHash);
      return () => window.removeEventListener('hashchange', onHash);
    }, []);
    return r;
  }

  function navigate(path) {
    if (!path) path = '/';
    if (path[0] !== '/') path = '/' + path;
    const next = '#' + path;
    if (window.location.hash !== next) window.location.hash = next;
    // After navigation, jump scroll to top — long detail pages otherwise
    // keep you in the middle of nowhere.
    window.scrollTo(0, 0);
  }

  // Link — anchor that uses navigate(). Accepts `to` (path) and a style.
  function Link({ to, style, children, onClick, ...rest }) {
    const handle = (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return; // let new-tab work
      e.preventDefault();
      if (onClick) onClick(e);
      navigate(to);
    };
    return (
      <a href={'#' + (to[0] === '/' ? to : '/' + to)}
         onClick={handle} style={style} {...rest}>{children}</a>
    );
  }

  window.useRoute = useRoute;
  window.navigate = navigate;
  window.Link = Link;
})();
