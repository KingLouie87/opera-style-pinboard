import { LoginForm } from '@/components/LoginForm';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) redirect('/boards');

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="glass-strong w-full max-w-md rounded-[2rem] p-8 shadow-soft">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.32em] text-[var(--accent)]">Private Pinboard</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Dein visuelles Board.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Melde dich mit E-Mail und Passwort an. Danach kannst du Boards, Bereiche, Links und Bilder geräteübergreifend nutzen.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
