import { redirect } from 'next/navigation';
import { BoardDashboard } from '@/components/BoardDashboard';
import { createClient } from '@/lib/supabase/server';

export default async function BoardsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect('/login');

  const { data: boards } = await supabase
    .from('boards')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('updated_at', { ascending: false });

  return <BoardDashboard userEmail={userData.user.email ?? ''} initialBoards={boards ?? []} />;
}
