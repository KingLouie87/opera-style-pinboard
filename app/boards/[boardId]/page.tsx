import { notFound, redirect } from 'next/navigation';
import { PinboardClient } from '@/components/pinboard/PinboardClient';
import { createClient } from '@/lib/supabase/server';

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) redirect('/login');

  const { data: board } = await supabase
    .from('boards')
    .select('*')
    .eq('id', boardId)
    .eq('user_id', user.id)
    .single();

  if (!board) notFound();

  const { data: sections } = await supabase
    .from('board_sections')
    .select('*')
    .eq('board_id', boardId)
    .eq('user_id', user.id)
    .order('position', { ascending: true });

  const { data: pins } = await supabase
    .from('pins')
    .select('*')
    .eq('board_id', boardId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('position', { ascending: true });

  return <PinboardClient board={board} initialSections={sections ?? []} initialPins={pins ?? []} userEmail={user.email ?? ''} />;
}
