import { redirect } from 'next/navigation';
import { NotesShell } from '@/components/notes/NotesShell';
import { createClient } from '@/lib/supabase/server';

export default async function NotesPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect('/login');

  const [{ data: notebooks }, { data: sections }, { data: pages }] = await Promise.all([
    supabase.from('notebooks').select('*').eq('user_id', user.id).is('archived_at', null).order('position', { ascending: true }),
    supabase.from('notebook_sections').select('*').eq('user_id', user.id).is('archived_at', null).order('position', { ascending: true }),
    supabase.from('note_pages').select('*').eq('user_id', user.id).is('archived_at', null).order('position', { ascending: true })
  ]);

  return <NotesShell initialNotebooks={notebooks ?? []} initialSections={sections ?? []} initialPages={pages ?? []} userEmail={user.email ?? ''} />;
}
