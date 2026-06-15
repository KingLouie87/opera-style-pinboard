import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ArchiveView } from '@/components/pinboard/ArchiveView';

export default async function ArchivePage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const [{ data: boards }, { data: pins }] = await Promise.all([
    supabase.from('boards').select('*').eq('user_id', userData.user.id).is('deleted_at', null).not('archived_at', 'is', null).order('archived_at', { ascending: false }),
    supabase.from('pins').select('*').eq('user_id', userData.user.id).is('deleted_at', null).not('archived_at', 'is', null).order('archived_at', { ascending: false })
  ]);

  return <ArchiveView boards={boards ?? []} pins={pins ?? []} />;
}
