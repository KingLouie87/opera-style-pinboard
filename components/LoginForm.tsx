'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`
      }
    });

    setLoading(false);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Login-Link wurde verschickt. Prüfe dein Postfach.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        E-Mail-Adresse
        <input
          required
          type="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          placeholder="name@example.com"
          className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none transition focus:border-[var(--accent)] dark:bg-white/10"
        />
      </label>
      <button
        disabled={loading}
        className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Sende Link ...' : 'Magic Link senden'}
      </button>
      {message && <p className="rounded-2xl bg-black/5 p-3 text-sm text-[var(--muted)] dark:bg-white/10">{message}</p>}
    </form>
  );
}
