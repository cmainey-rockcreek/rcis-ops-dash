// TeamStore - reads Supabase Auth-backed team profiles for task ownership.
// Falls back to the prototype team while the database is empty or unavailable.

(function () {
  const FALLBACK_TEAM = ((window.RCIS_DATA && window.RCIS_DATA.TEAM) || []).map((m) => ({
    ...m,
    source: 'mock',
  }));
  const COLORS = ['#1FA39A', '#E76B5D', '#1B2956', '#7A5AE0', '#C98A2C', '#3E8A57', '#5A6478'];

  let profiles = [];
  let loaded = false;
  let currentUser = null;
  let subscription = null;
  const listeners = new Set();

  const emit = () => listeners.forEach((fn) => fn());
  const cleanName = (value) => String(value || '').trim().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ');
  const titleCase = (value) => cleanName(value).replace(/\b\w/g, (c) => c.toUpperCase());
  const nameFromEmail = (email) => titleCase(String(email || '').split('@')[0] || 'Team Member');

  function initialsFor(name, email) {
    const parts = cleanName(name || nameFromEmail(email)).split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0] || 'TM').slice(0, 2).toUpperCase();
  }

  function colorFor(idOrEmail) {
    const seed = String(idOrEmail || '');
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    return COLORS[Math.abs(hash) % COLORS.length];
  }

  function normalize(row) {
    const name = cleanName(row.full_name) || nameFromEmail(row.email);
    return {
      id: row.id,
      email: row.email || '',
      name,
      role: row.role || 'Team',
      initials: row.initials || initialsFor(name, row.email),
      color: row.color || colorFor(row.id || row.email),
      source: 'live',
    };
  }

  function allMembers() {
    const byId = new Map();
    profiles.forEach((m) => byId.set(m.id, m));
    FALLBACK_TEAM.forEach((m) => {
      if (!byId.has(m.id)) byId.set(m.id, m);
    });
    return Array.from(byId.values());
  }

  function assignableMembers() {
    return profiles.length ? profiles : FALLBACK_TEAM;
  }

  function currentMember() {
    if (!currentUser) return null;
    return allMembers().find((m) => m.id === currentUser.id) || normalize({
      id: currentUser.id,
      email: currentUser.email,
      full_name: currentUser.user_metadata && (currentUser.user_metadata.full_name || currentUser.user_metadata.name),
    });
  }

  function publish() {
    if (window.RCIS_DATA) window.RCIS_DATA.TEAM = allMembers();
    loaded = true;
    emit();
  }

  async function load() {
    if (!window.sb) {
      publish();
      return;
    }
    const { data, error } = await window.sb
      .from('team_profiles')
      .select('id,email,full_name,role,initials,color,active')
      .eq('active', true)
      .order('full_name', { ascending: true });

    if (error) {
      console.warn('Team profiles unavailable; using prototype team.', error.message || error);
      profiles = [];
      publish();
      return;
    }

    profiles = (data || []).map(normalize);
    publish();
  }

  async function ensureCurrentProfile(user) {
    if (!window.sb || !user) return;
    currentUser = user;

    const metadataName = user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name);
    const { data: existing, error: readError } = await window.sb
      .from('team_profiles')
      .select('id,full_name,initials,color,role')
      .eq('id', user.id)
      .maybeSingle();

    if (readError && readError.code !== 'PGRST116') {
      console.warn('Could not read current team profile.', readError.message || readError);
      return;
    }

    const existingName = existing && cleanName(existing.full_name);
    const emailLocal = cleanName(String(user.email || '').split('@')[0]);
    const fullName = cleanName(metadataName) ||
      (!existingName || existingName.toLowerCase() === emailLocal.toLowerCase() ? nameFromEmail(user.email) : existingName);
    const payload = {
      id: user.id,
      email: user.email || '',
      full_name: fullName,
      role: (existing && existing.role) || 'Team',
      initials: (existing && existing.initials) || initialsFor(fullName, user.email),
      color: (existing && existing.color) || colorFor(user.id),
      active: true,
    };

    const { error } = await window.sb.from('team_profiles').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Could not save current team profile.', error.message || error);
      return;
    }
    await load();
  }

  function subscribeRealtime() {
    if (!window.sb || subscription) return;
    subscription = window.sb
      .channel('team_profiles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_profiles' }, () => load())
      .subscribe();
  }

  function useMembers(kind) {
    const [, setTick] = React.useState(0);
    React.useEffect(() => {
      const listener = () => setTick((n) => n + 1);
      listeners.add(listener);
      if (!loaded) load();
      return () => { listeners.delete(listener); };
    }, []);
    return kind === 'all' ? allMembers() : assignableMembers();
  }

  window.TeamStore = {
    all: allMembers,
    assignable: assignableMembers,
    current: currentMember,
    reload: load,
    ensureCurrentProfile,
  };
  window.useTeam = () => useMembers('assignable');
  window.useAllTeam = () => useMembers('all');

  if (window.sb) {
    window.sb.auth.getSession().then(({ data }) => {
      currentUser = data.session ? data.session.user : null;
      subscribeRealtime();
      if (currentUser) ensureCurrentProfile(currentUser);
      else load();
    });

    window.sb.auth.onAuthStateChange((_event, session) => {
      currentUser = session ? session.user : null;
      if (currentUser) ensureCurrentProfile(currentUser);
      else {
        profiles = [];
        publish();
      }
    });
  } else {
    publish();
  }
})();
