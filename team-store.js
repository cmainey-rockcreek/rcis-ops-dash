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
      active: row.active !== false,
      invited: row.invited === true,
      source: 'live',
    };
  }

  function allMembers() {
    // Pending invites have id=null until the teammate signs up, so dedup
    // keys fall back to email for those rows.
    const byKey = new Map();
    profiles.forEach((m) => byKey.set(m.id || ('pending:' + m.email), m));
    FALLBACK_TEAM.forEach((m) => {
      if (!byKey.has(m.id)) byKey.set(m.id, m);
    });
    return Array.from(byKey.values());
  }

  function assignableMembers() {
    // Only fall back to the prototype team when nothing has ever loaded
    // from Supabase. If profiles loaded but every row is inactive (an
    // admin has deactivated everyone), return an empty list rather than
    // surfacing mock IDs that would fail the team_profiles FK on insert.
    // Pending invites are excluded — they have no auth uid yet, so they
    // can't own a todo or comment.
    if (!profiles.length) return FALLBACK_TEAM;
    return profiles.filter((p) => p.active && !p.invited);
  }

  // All persisted profiles regardless of `active` — admin page edits this.
  function liveProfiles() {
    return profiles.slice();
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
      .select('id,email,full_name,role,initials,color,active,invited')
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
      .select('id,full_name,initials,color,role,active')
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
    };
    // Only set active on first insert — preserve any admin deactivation on
    // subsequent sign-ins. (The /admin Active toggle lives in this column;
    // forcing active:true here used to silently undo deactivations.)
    if (!existing) payload.active = true;

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
    if (kind === 'all') return allMembers();
    if (kind === 'admin') return liveProfiles();
    return assignableMembers();
  }

  // Optimistic patch on a profile row (name, role, initials, color, active).
  // Lets the admin page do inline edits without re-fetching after each save.
  // Pending rows (id null) update via updatePendingProfile below — the
  // admin UI uses that path so name/role/initials/color edits work before
  // the teammate has signed up.
  async function updateProfile(id, patch) {
    if (!id || !window.sb) return;
    const fields = {};
    if (patch.name != null)     fields.full_name = patch.name;
    if (patch.role != null)     fields.role     = patch.role;
    if (patch.initials != null) fields.initials = patch.initials;
    if (patch.color != null)    fields.color    = patch.color;
    if (patch.active != null)   fields.active   = !!patch.active;
    if (Object.keys(fields).length === 0) return;

    profiles = profiles.map((p) => p.id === id ? { ...p, ...patch } : p);
    publish();

    const { error } = await window.sb.from('team_profiles').update(fields).eq('id', id);
    if (error) {
      console.warn('team_profiles.update', error.message || error);
      load();
    }
  }

  // Pending rows have no id yet; edits key off email. Same shape as
  // updateProfile so the Admin page can use a single save handler.
  async function updatePendingProfile(email, patch) {
    if (!email || !window.sb) return;
    const fields = {};
    if (patch.name != null)     fields.full_name = patch.name;
    if (patch.role != null)     fields.role     = patch.role;
    if (patch.initials != null) fields.initials = patch.initials;
    if (patch.color != null)    fields.color    = patch.color;
    if (patch.active != null)   fields.active   = !!patch.active;
    if (Object.keys(fields).length === 0) return;

    profiles = profiles.map((p) =>
      (p.invited && p.email === email) ? { ...p, ...patch } : p);
    publish();

    const { error } = await window.sb.from('team_profiles')
      .update(fields).eq('email', email).eq('invited', true);
    if (error) {
      console.warn('team_profiles.update pending', error.message || error);
      load();
    }
  }

  // Pre-add a teammate from the Admin page. Creates a pending row with
  // no auth uid; the handle_new_auth_user trigger will claim it by email
  // when the person signs up. Returns { error } on validation or DB
  // failure so the caller can surface a message.
  async function invite({ name, email, role }) {
    if (!window.sb) return { error: 'Offline.' };
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) return { error: 'Email looks invalid.' };
    // Duplicate guard — email is unique; surface a friendly message
    // rather than a Postgres error.
    if (profiles.some((p) => (p.email || '').toLowerCase() === cleanEmail)) {
      return { error: 'A teammate with that email already exists.' };
    }
    const cleanName_ = cleanName(name) || nameFromEmail(cleanEmail);
    const row = {
      email: cleanEmail,
      full_name: cleanName_,
      role: (role || 'Team').trim() || 'Team',
      initials: initialsFor(cleanName_, cleanEmail),
      color: colorFor(cleanEmail),
      active: true,
      invited: true,
    };
    const { error } = await window.sb.from('team_profiles').insert(row);
    if (error) {
      console.warn('team_profiles.invite', error.message || error);
      return { error: error.message || String(error) };
    }
    // Realtime push will refresh the list; force a reload for the
    // current session in case the realtime channel is slow to fire.
    await load();
    return { ok: true };
  }

  // Cancel a pending invite (delete the row). Permitted by RLS only for
  // pending rows (id null, invited true) — claimed profiles can't be
  // deleted through the app.
  async function cancelInvite(email) {
    if (!email || !window.sb) return;
    const cleanEmail = String(email).trim().toLowerCase();
    profiles = profiles.filter((p) => !(p.invited && (p.email || '').toLowerCase() === cleanEmail));
    publish();
    const { error } = await window.sb.from('team_profiles')
      .delete().eq('email', cleanEmail).eq('invited', true);
    if (error) {
      console.warn('team_profiles.cancelInvite', error.message || error);
      load();
    }
  }

  window.TeamStore = {
    all: allMembers,
    assignable: assignableMembers,
    profiles: liveProfiles,
    current: currentMember,
    reload: load,
    ensureCurrentProfile,
    updateProfile,
    updatePendingProfile,
    invite,
    cancelInvite,
  };
  window.useTeam = () => useMembers('assignable');
  window.useAllTeam = () => useMembers('all');
  window.useAdminProfiles = () => useMembers('admin');

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
