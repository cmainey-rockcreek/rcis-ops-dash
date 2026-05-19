// AuthGate — wraps the whole app. Shows login screen if not signed in,
// otherwise renders the children.

(function () {
  function AuthGate({ children }) {
    const auth = window.useAuth();
    if (auth.status === 'loading') return <Splash />;
    if (auth.status === 'out')     return <LoginScreen />;
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

  function LoginScreen() {
    const [mode, setMode] = React.useState('signin'); // 'signin' | 'signup'
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const [info, setInfo] = React.useState('');

    const submit = async (e) => {
      e.preventDefault();
      setError(''); setInfo(''); setBusy(true);
      try {
        if (mode === 'signin') {
          await window.signInWithPassword({ email: email.trim(), password });
        } else {
          await window.signUpWithPassword({ email: email.trim(), password });
          setInfo('Check your email to confirm the account, then sign in.');
        }
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        setBusy(false);
      }
    };

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
          }}>RCIS Internal Dashboard</h1>
          <p style={{
            margin: '4px 0 22px', fontSize: 13,
            color: 'rgba(26,24,21,.55)', textAlign: 'center',
          }}>{mode === 'signin' ? 'Sign in to your team account' : 'Create a team account'}</p>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="email" required autoFocus
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              style={inputStyle} />
            <input type="password" required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              style={inputStyle} />
            {error && (
              <div style={{
                padding: '8px 11px', background: 'rgba(192,78,64,.08)',
                border: '1px solid rgba(192,78,64,.25)', borderRadius: 7,
                color: '#C04E40', fontSize: 12,
              }}>{error}</div>
            )}
            {info && (
              <div style={{
                padding: '8px 11px', background: 'rgba(31,163,154,.08)',
                border: '1px solid rgba(31,163,154,.25)', borderRadius: 7,
                color: '#157C75', fontSize: 12,
              }}>{info}</div>
            )}
            <button type="submit" disabled={busy || !email || !password.length} style={{
              marginTop: 4,
              height: 40, padding: '0 16px',
              background: '#157C75', color: '#fff',
              border: 'none', borderRadius: 8,
              fontSize: 13.5, fontWeight: 600,
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.6 : 1, fontFamily: 'inherit',
            }}>{busy ? '…' : (mode === 'signin' ? 'Sign in' : 'Create account')}</button>
          </form>

          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'rgba(26,24,21,.55)' }}>
            {mode === 'signin' ? (
              <>First time? <a onClick={() => { setMode('signup'); setError(''); setInfo(''); }}
                style={linkStyle}>Create an account</a></>
            ) : (
              <>Already have an account? <a onClick={() => { setMode('signin'); setError(''); setInfo(''); }}
                style={linkStyle}>Sign in</a></>
            )}
          </div>
        </div>
      </div>
    );
  }

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
