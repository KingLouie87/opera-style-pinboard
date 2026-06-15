import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from '@/components/LoginForm';

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/boards');

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <section className="glass w-full max-w-[440px] rounded-[12px] p-6 md:p-8">
        <div className="mb-8">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--accent)]">Pinboard</p>
          <h1 className="text-3xl font-semibold tracking-[-0.06em]">Visuelle Sammlung für alles, was bleiben soll.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Melde dich mit E-Mail und Passwort an. Deine Pins, Medien und Dateien bleiben privat und synchronisiert.</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
