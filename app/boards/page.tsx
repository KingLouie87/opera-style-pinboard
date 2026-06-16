import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BoardDashboard } from '@/components/BoardDashboard';

export default async function BoardsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');
  const { data: boards } = await supabase.from('boards').select('*').eq('user_id', userData.user.id).is('archived_at', null).is('deleted_at', null).order('board_position', { ascending: true }).order('updated_at', { ascending: false });
  return <BoardDashboard boards={boards ?? []} userEmail={userData.user.email ?? 'Account'} />;
}
