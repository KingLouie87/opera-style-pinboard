import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { createClient } from '@/lib/supabase/server';

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) redirect('/boards');

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="glass-strong w-full max-w-[460px] rounded-[28px] p-7 md:p-9">
        <p className="font-mono text-xs uppercase tracking-[0.36em] text-[var(--accent)]">Private Pinboard</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.06em] text-white">Dein visuelles Board.</h1>
        <p className="mt-4 max-w-sm text-sm leading-7 text-[var(--muted)]">
          Melde dich mit E-Mail und Passwort an. Danach kannst du Boards, Bereiche, Links und Bilder geräteübergreifend nutzen.
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
