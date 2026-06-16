import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from '@/components/LoginForm';

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/boards');

  return (
    <main className="login-screen">
      <div className="login-bg-svg" aria-hidden="true" />
      <section className="login-panel" aria-label="Pinboard Login">
        <div className="login-logo-orbit" aria-hidden="true"><span /></div>
        <div className="login-copy">
          <p>Pinboard</p>
          <h1>Welcome back!</h1>
          <span>Melde dich an und öffne deine visuellen Sammlungen, Boards und gespeicherten Inspirationen.</span>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
