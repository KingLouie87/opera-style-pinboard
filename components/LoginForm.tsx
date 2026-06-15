'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';

type AuthMode = 'login' | 'register';

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 rounded-[8px] border border-[var(--line)] bg-white/[0.04] p-1">
        {(['login', 'register'] as const).map(item => (
          <button
            key={item}
            type="button"
            onClick={() => { setMode(item); setMessage(''); }}
            className={`rounded-[6px] px-4 py-2 text-sm font-semibold transition ${mode === item ? 'bg-white/[0.14] text-[var(--text)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
          >
            {item === 'login' ? 'Einloggen' : 'Registrieren'}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-[var(--text-soft)]">
          E-Mail-Adresse
          <input required type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" className="field mt-2" />
        </label>
        <label className="block text-sm font-medium text-[var(--text-soft)]">
          Passwort
          <input required type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Mindestens 6 Zeichen" className="field mt-2" />
        </label>
        <button disabled={loading} className="btn-primary w-full px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? 'Bitte warten ...' : mode === 'login' ? 'Einloggen' : 'Account erstellen'}
        </button>
        {message && <p className="rounded-[8px] border border-[var(--line)] bg-white/[0.05] p-3 text-sm leading-6 text-[var(--muted)]">{message}</p>}
      </form>
    </div>
  );
}
