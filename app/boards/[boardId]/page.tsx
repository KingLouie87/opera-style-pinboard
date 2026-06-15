import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PinboardClient } from '@/components/pinboard/PinboardClient';

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const [{ data: board }, { data: sections }, { data: pins }] = await Promise.all([
    supabase.from('boards').select('*').eq('id', boardId).eq('user_id', userData.user.id).is('archived_at', null).is('deleted_at', null).single(),
    supabase.from('board_sections').select('*').eq('board_id', boardId).eq('user_id', userData.user.id).order('position'),
    supabase.from('pins').select('*').eq('board_id', boardId).eq('user_id', userData.user.id).is('deleted_at', null).is('archived_at', null).order('position')
  ]);
  if (!board) notFound();
  return <PinboardClient board={board} initialSections={sections ?? []} initialPins={pins ?? []} userEmail={userData.user.email ?? 'Account'} />;
}
