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

    const trimmedEmail = email.trim();
    const supabase = createClient();

    if (password.length < 6) {
      setLoading(false);
      setMessage('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password
      });

      setLoading(false);

      if (error) {
        setMessage('Login fehlgeschlagen. Prüfe E-Mail und Passwort.');
        return;
      }

      router.push('/boards');
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password
    });

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
      <div className="grid grid-cols-2 rounded-2xl bg-black/5 p-1 dark:bg-white/10">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setMessage('');
          }}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            mode === 'login'
              ? 'bg-white text-[var(--text)] shadow-sm dark:bg-white/15'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
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
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            mode === 'register'
              ? 'bg-white text-[var(--text)] shadow-sm dark:bg-white/15'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          Registrieren
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium">
          E-Mail-Adresse
          <input
            required
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[var(--accent)] dark:bg-white/10"
          />
        </label>

        <label className="block text-sm font-medium">
          Passwort
          <input
            required
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Mindestens 6 Zeichen"
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[var(--accent)] dark:bg-white/10"
          />
        </label>

        <button
          disabled={loading}
          className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? mode === 'login'
              ? 'Logge ein ...'
              : 'Erstelle Account ...'
            : mode === 'login'
              ? 'Einloggen'
              : 'Account erstellen'}
        </button>

        {message && (
          <p className="rounded-2xl bg-black/5 p-3 text-sm text-[var(--muted)] dark:bg-white/10">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}