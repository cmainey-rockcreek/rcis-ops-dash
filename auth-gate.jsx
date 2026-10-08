// AuthGate — wraps the whole app. Shows login screen if not signed in,
// a set-password screen if a recovery link signed the user in, otherwise
// renders the children.

(function () {
  function AuthGate({ children }) {
    const auth = window.useAuth();
    if (auth.status === 'loading') return <Splash />;
    if (auth.status === 'out')     return <LoginScreen />;
    if (auth.recovery)             return <SetPasswordScreen />;
    return children;
  }

  function Splash() {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: '#FBF8F3',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(26,24,21,.5)', fontSize: 14,
        fontFamily: '"Public Sans", system-ui, sans-serif',
      }}>
        Loading…
      </div>
    );
  }

  // Shared centered card used by the login and set-password screens.
  function Card({ title, subtitle, children }) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: '#FBF8F3',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Public Sans", system-ui, sans-serif',
        padding: 24,
      }}>
        <div style={{
          width: '100%', maxWidth: 360,
          background: '#fff',
          border: '1px solid rgba(26,24,21,.09)',
          borderRadius: 14,
          padding: 28,
          boxShadow: '0 30px 80px rgba(0,0,0,.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <img src="assets/logo.avif" alt="RCIS" style={{ height: 40, width: 'auto' }} />
          </div>
          <h1 style={{
            margin: 0, fontSize: 18, fontWeight: 600,
            color: '#1A1815', textAlign: 'center', letterSpacing: -0.2,
          }}>{title}</h1>
          <p style={{
            margin: '4px 0 22px', fontSize: 13,
            color: 'rgba(26,24,21,.55)', textAlign: 'center',
          }}>{subtitle}</p>
          {children}
        </div>
      </div>
    );
  }

  function Notice({ kind, children }) {
    const err = kind === 'error';
    return (
      <div style={{
        padding: '8px 11px',
        background: err ? 'rgba(192,78,64,.08)' : 'rgba(31,163,154,.08)',
        border: `1px solid ${err ? 'rgba(192,78,64,.25)' : 'rgba(31,163,154,.25)'}`,
        borderRadius: 7,
        color: err ? '#C04E40' : '#157C75', fontSize: 12,
      }}>{children}</div>
    );
  }

  const INVITE_ONLY_MSG = 'Sign-ups are invite-only. Ask an RCIS admin to add you on the Admin page, then sign in with that same email.';
  // The invite-only guard in handle_new_auth_user (schema.sql) raises inside
  // the auth.users insert; GoTrue reports it as a generic "Database error
  // saving new user" — on the sign-up form and in the fragment that Google
  // sign-in bounces back with.
  const friendly = (msg) => (/database error/i.test(msg) ? INVITE_ONLY_MSG : msg);

  function LoginScreen() {
    const auth = window.useAuth();
    const [mode, setMode] = React.useState('signin'); // 'signin' | 'signup' | 'forgot'
    const [fullName, setFullName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    // A failed redirect sign-in (Google, expired recovery link) lands here
    // with the message carried over from the URL fragment. Seed it into
    // local state so it survives a remount, then drop the shared copy.
    const [error, setError] = React.useState(() => friendly(auth.authError || ''));
    const [info, setInfo] = React.useState('');
    React.useEffect(() => { if (window.clearAuthError) window.clearAuthError(); }, []);

    // Continue with Google navigates away with busy=true. If the user comes
    // back with the Back button the browser may restore this page from the
    // back-forward cache, state included, so re-enable the form.
    React.useEffect(() => {
      const onShow = (e) => { if (e.persisted) setBusy(false); };
      window.addEventListener('pageshow', onShow);
      return () => window.removeEventListener('pageshow', onShow);
    }, []);

    const switchMode = (next) => { setMode(next); setError(''); setInfo(''); };

    const submit = async (e) => {
      e.preventDefault();
      setError(''); setInfo(''); setBusy(true);
      try {
        if (mode === 'signin') {
          await window.signInWithPassword({ email: email.trim(), password });
        } else if (mode === 'signup') {
          await window.signUpWithPassword({ email: email.trim(), password, fullName: fullName.trim() });
          setInfo('Check your email to confirm the account, then sign in.');
        } else {
          await window.requestPasswordReset(email.trim());
          setInfo('Check your email for a link to set a new password.');
        }
      } catch (err) {
        const msg = err.message || String(err);
        setError(mode === 'signup' ? friendly(msg) : msg);
      } finally {
        setBusy(false);
      }
    };

    const google = async () => {
      setError(''); setInfo(''); setBusy(true);
      try {
        await window.signInWithGoogle(); // page navigates away on success
      } catch (err) {
        setError(err.message || String(err));
        setBusy(false);
      }
    };

    const canSubmit = !busy && !!email && (
      mode === 'forgot' ||
      (password.length > 0 && (mode !== 'signup' || !!fullName.trim()))
    );
    const subtitle = mode === 'signin' ? 'Sign in to your team account'
      : mode === 'signup' ? 'Create a team account'
      : 'We will email you a link to set a new password';
    const cta = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Email me a link';

    return (
      <Card title="RCIS Internal Dashboard" subtitle={subtitle}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'signup' && (
            <input type="text" required
              value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              style={inputStyle} />
          )}
          <input type="email" required autoFocus
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            style={inputStyle} />
          {mode !== 'forgot' && (
            <input type="password" required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              style={inputStyle} />
          )}
          {error && <Notice kind="error">{error}</Notice>}
          {info && <Notice kind="info">{info}</Notice>}
          <button type="submit" disabled={!canSubmit} style={primaryButton(busy)}>
            {busy ? '…' : cta}
          </button>
          {mode === 'signin' && (
            <div style={{ textAlign: 'right', fontSize: 12, marginTop: -2 }}>
              <a onClick={() => switchMode('forgot')} style={linkStyle}>Forgot password?</a>
            </div>
          )}
        </form>

        {mode !== 'forgot' && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 12px',
              color: 'rgba(26,24,21,.4)', fontSize: 11,
            }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(26,24,21,.1)' }} />
              or
              <div style={{ flex: 1, height: 1, background: 'rgba(26,24,21,.1)' }} />
            </div>
            <button type="button" onClick={google} disabled={busy} style={{
              width: '100%', height: 40, padding: '0 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: '#fff', color: '#1A1815',
              border: '1px solid rgba(26,24,21,.18)', borderRadius: 8,
              fontSize: 13.5, fontWeight: 600,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
              fontFamily: 'inherit',
            }}>
              <GoogleMark />
              Continue with Google
            </button>
          </>
        )}

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'rgba(26,24,21,.55)' }}>
          {mode === 'signin' && (
            <>Invited by your team? <a onClick={() => switchMode('signup')} style={linkStyle}>Create your account</a></>
          )}
          {mode === 'signup' && (
            <>Already have an account? <a onClick={() => switchMode('signin')} style={linkStyle}>Sign in</a></>
          )}
          {mode === 'forgot' && (
            <>Remembered it? <a onClick={() => switchMode('signin')} style={linkStyle}>Back to sign in</a></>
          )}
        </div>
      </Card>
    );
  }

  // Shown after a recovery link signs the user in, until they save a new
  // password. Signing out is the only other way off this screen.
  function SetPasswordScreen() {
    const auth = window.useAuth();
    const [password, setPassword] = React.useState('');
    const [confirm, setConfirm] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');

    const submit = async (e) => {
      e.preventDefault();
      if (password !== confirm) { setError('Passwords do not match.'); return; }
      setError(''); setBusy(true);
      try {
        await window.updatePassword(password); // AuthGate re-renders into the app
      } catch (err) {
        setError(err.message || String(err));
        setBusy(false);
      }
    };

    return (
      <Card title="Choose a new password" subtitle={auth.user ? `for ${auth.user.email}` : ''}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="password" required minLength={6} autoFocus autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (6+ characters)"
            style={inputStyle} />
          <input type="password" required minLength={6} autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            style={inputStyle} />
          {error && <Notice kind="error">{error}</Notice>}
          <button type="submit" disabled={busy || password.length < 6 || !confirm} style={primaryButton(busy)}>
            {busy ? '…' : 'Save password'}
          </button>
        </form>
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'rgba(26,24,21,.55)' }}>
          <a onClick={() => window.signOut && window.signOut()} style={linkStyle}>Cancel and sign out</a>
        </div>
      </Card>
    );
  }

  function GoogleMark() {
    return (
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
    );
  }

  const primaryButton = (busy) => ({
    marginTop: 4,
    height: 40, padding: '0 16px',
    background: '#157C75', color: '#fff',
    border: 'none', borderRadius: 8,
    fontSize: 13.5, fontWeight: 600,
    cursor: busy ? 'default' : 'pointer',
    opacity: busy ? 0.6 : 1, fontFamily: 'inherit',
  });
  const inputStyle = {
    height: 40, padding: '0 12px',
    background: '#fff', color: '#1A1815',
    border: '1px solid rgba(26,24,21,.15)',
    borderRadius: 8,
    fontSize: 13.5, fontFamily: 'inherit', outline: 'none',
  };
  const linkStyle = {
    color: '#157C75', fontWeight: 600, cursor: 'pointer',
  };

  window.AuthGate = AuthGate;
})();
