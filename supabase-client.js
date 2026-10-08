// Supabase client wrapper.
//
// One shared client across the app. Exposes:
//   window.sb                     – Supabase client
//   window.useAuth()              – React hook → { user, session, status, recovery, authError }
//   window.signInWithPassword({email, password})
//   window.signUpWithPassword({email, password, fullName})
//   window.signInWithGoogle()     – OAuth redirect; invite-only still applies
//   window.requestPasswordReset(email)
//   window.updatePassword(password)
//   window.signOut()
//
// Ways in: email+password, and Google ("Continue with Google"). Both land on
// the same team_profiles row — Supabase links a Google identity to an
// existing user when the verified emails match, and a brand-new Google user
// goes through the same invite-only trigger as a password sign-up.
//
// Redirect-based flows (Google, password recovery) return to the page with
// the result in the URL fragment. The client consumes a successful
// `#access_token=…` fragment itself and clears it; a failed one
// (`#error=…&error_description=…`) is left in place, so we read and clear
// it here before the client boots and surface it on the login screen.

(function () {
  if (!window.supabase || !window.SUPABASE_CONFIG) {
    console.error('Supabase library or config missing');
    return;
  }
  const { url, publishableKey, googleHostedDomain } = window.SUPABASE_CONFIG;

  // Where redirect flows come back to. Origin + '/' rather than the full
  // href so a stale in-app hash route never ends up in the redirect URL.
  const RETURN_URL = window.location.origin + '/';
  // Set while a recovery link has signed the user in but they have not yet
  // chosen a new password. The recovery session itself is persisted in
  // localStorage by the client, so the flag lives there too — every tab
  // shows the set-password screen until the password is saved or the user
  // signs out.
  const RECOVERY_KEY = 'rcis.auth.recovery';

  function readErrorFragment() {
    const hash = window.location.hash || '';
    if (!/(^#|&)error(_description)?=/.test(hash)) return '';
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const code = params.get('error_code') || '';
    const msg = code === 'otp_expired'
      ? 'That link has expired or was already used. Request a new one.'
      : (params.get('error_description') || params.get('error') || 'Sign-in failed.');
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    return msg;
  }
  // Must run before createClient so the client never sees the error fragment.
  const authError = readErrorFragment();

  let recovery = /[#&]type=recovery(&|$)/.test(window.location.hash || '');
  try { if (localStorage.getItem(RECOVERY_KEY) === '1') recovery = true; } catch (_) {}
  const setRecovery = (on) => {
    recovery = on;
    try {
      if (on) localStorage.setItem(RECOVERY_KEY, '1');
      else localStorage.removeItem(RECOVERY_KEY);
    } catch (_) {}
  };
  if (recovery) setRecovery(true);

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
  // recovery: true while a recovery-link session must set a new password
  // authError: message carried over from a failed redirect sign-in
  let state = { user: null, session: null, status: 'loading', recovery, authError };
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(state));
  const setSession = (session) => {
    state = {
      user: session ? session.user : null,
      session,
      status: session ? 'in' : 'out',
      recovery: session ? recovery : false,
      authError: state.authError,
    };
    emit();
  };

  client.auth.getSession().then(({ data }) => setSession(data.session));

  client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    if (event === 'SIGNED_OUT' || !session) setRecovery(false);
    setSession(session);
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

  window.clearAuthError = () => {
    if (!state.authError) return;
    state = { ...state, authError: '' };
    emit();
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

  // Redirects to Google; the page unloads. The result arrives on the way
  // back via detectSessionInUrl (success) or readErrorFragment (failure).
  window.signInWithGoogle = async () => {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: RETURN_URL,
        queryParams: googleHostedDomain ? { hd: googleHostedDomain } : undefined,
      },
    });
    if (error) throw error;
  };

  window.requestPasswordReset = async (email) => {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: RETURN_URL });
    if (error) throw error;
  };

  // Used both by the set-password screen after a recovery link and by
  // "Change password" on /admin. Adds a password identity to a Google-only
  // account, which is fine — it just becomes a second way in.
  window.updatePassword = async (password) => {
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    setRecovery(false);
    state = { ...state, recovery: false };
    emit();
  };

  window.signOut = async () => {
    setRecovery(false);
    await client.auth.signOut();
  };
})();
