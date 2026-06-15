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
        setMessage('Login fehlgeschlagen. Prüfe E-Mail und Passwort.');
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
      setMessage('Account erstellt. Falls E-Mail-Bestätigung aktiv ist, bestätige bitte dein Postfach.');
      return;
    }

    router.push('/boards');
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 rounded-[7px] border border-[var(--line)] bg-white/[0.045] p-1">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setMessage('');
          }}
          className={`rounded-[7px] px-4 py-2 text-sm font-semibold transition ${
            mode === 'login' ? 'bg-white/[0.14] text-white shadow-sm' : 'text-[var(--muted)] hover:text-white'
          }`}
        >
          Einloggen
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setMessage('');
          }}
          className={`rounded-[7px] px-4 py-2 text-sm font-semibold transition ${
            mode === 'register' ? 'bg-white/[0.14] text-white shadow-sm' : 'text-[var(--muted)] hover:text-white'
          }`}
        >
          Registrieren
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-[var(--text-soft)]">
          E-Mail-Adresse
          <input
            required
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            className="field mt-2"
          />
        </label>

        <label className="block text-sm font-medium text-[var(--text-soft)]">
          Passwort
          <input
            required
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Mindestens 6 Zeichen"
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="field mt-2"
          />
        </label>

        <button disabled={loading} className="btn-primary w-full px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? (mode === 'login' ? 'Logge ein ...' : 'Erstelle Account ...') : mode === 'login' ? 'Einloggen' : 'Account erstellen'}
        </button>

        {message && <p className="rounded-[7px] border border-[var(--line)] bg-white/[0.055] p-3 text-sm text-[var(--text-soft)]">{message}</p>}
      </form>
    </div>
  );
}
