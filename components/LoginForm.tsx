'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

type AuthMode = 'login' | 'register';

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const supabase = createClient();
    const trimmedEmail = email.trim();

    if (password.length < 6) {
      setLoading(false);
      setMessage('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      setLoading(false);
      if (error) {
        setMessage('Login fehlgeschlagen. Bitte E-Mail und Passwort prüfen.');
        return;
      }
      router.push('/boards');
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email: trimmedEmail, password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (!data.session) {
      setMessage('Account wurde erstellt. Falls E-Mail-Bestätigung aktiv ist, bestätige bitte dein Postfach.');
      return;
    }
    router.push('/boards');
    router.refresh();
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setMessage('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
    setGoogleLoading(false);
    if (error) setMessage('Google Login konnte nicht gestartet werden. Prüfe später die Supabase OAuth-Konfiguration.');
  }

  return (
    <div className="login-form-shell">
      <div className="login-mode-tabs" role="tablist" aria-label="Anmeldemodus">
        {(['login', 'register'] as const).map(item => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            onClick={() => { setMode(item); setMessage(''); }}
            className={mode === item ? 'active' : ''}
          >
            {item === 'login' ? 'Login' : 'Sign up'}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="login-form">
        <label>
          <span>Email</span>
          <input required type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="Enter your email" />
        </label>

        <label>
          <span>Password</span>
          <div className="login-password-field">
            <input required type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Mindestens 6 Zeichen" />
            <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>

        <div className="login-row">
          <label className="remember-check">
            <input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />
            <span>Remember me</span>
          </label>
          <button type="button" className="login-link" onClick={() => setMessage('Passwort-Reset kann im nächsten Schritt über Supabase ergänzt werden.')}>Forgot password?</button>
        </div>

        <button disabled={loading} className="login-primary-button">
          {loading ? 'Bitte warten ...' : mode === 'login' ? 'Log In' : 'Account erstellen'}
        </button>

        <div className="login-divider"><span />Or<span /></div>

        <button type="button" disabled={googleLoading} onClick={signInWithGoogle} className="google-login-button">
          <strong>G</strong>
          {googleLoading ? 'Google wird geöffnet ...' : 'Sign In with Google'}
        </button>

        {message && <p className="login-message">{message}</p>}
      </form>
    </div>
  );
}
