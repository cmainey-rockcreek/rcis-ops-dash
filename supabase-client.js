// Supabase client wrapper.
//
// One shared client across the app. Exposes:
//   window.sb              – Supabase client
//   window.useAuth()       – React hook → { user, session, status }
//   window.signInWithPassword({email, password})
//   window.signUpWithPassword({email, password, fullName})
//   window.signOut()
//
// We're using email+password (not magic link) because it's the simplest
// path for a small team working inside an iframe-based dev preview. Magic
// links require configuring redirect URLs in Supabase which is a pain to
// maintain when the preview URL changes. The user can switch later.

(function () {
  if (!window.supabase || !window.SUPABASE_CONFIG) {
    console.error('Supabase library or config missing');
    return;
  }
  const { url, publishableKey } = window.SUPABASE_CONFIG;
  const client = window.supabase.createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  window.sb = client;

  // ── Auth state shared across the app ───────────────────────────────────
  // status: 'loading' | 'in' | 'out'
  let state = { user: null, session: null, status: 'loading' };
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(state));

  client.auth.getSession().then(({ data }) => {
    state = {
      user: data.session ? data.session.user : null,
      session: data.session,
      status: data.session ? 'in' : 'out',
    };
    emit();
  });

  client.auth.onAuthStateChange((_event, session) => {
    state = {
      user: session ? session.user : null,
      session,
      status: session ? 'in' : 'out',
    };
    emit();
  });

  window.useAuth = function useAuth() {
    const [s, setS] = React.useState(state);
    React.useEffect(() => {
      listeners.add(setS);
      setS(state);
      return () => { listeners.delete(setS); };
    }, []);
    return s;
  };

  window.signInWithPassword = async ({ email, password }) => {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user && window.TeamStore) await window.TeamStore.ensureCurrentProfile(data.user);
  };

  window.signUpWithPassword = async ({ email, password, fullName }) => {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: (fullName || '').trim() },
      },
    });
    if (error) throw error;
    if (data.user && data.session && window.TeamStore) await window.TeamStore.ensureCurrentProfile(data.user);
  };

  window.signOut = async () => {
    await client.auth.signOut();
  };
})();
