import { redirect } from 'next/navigation';
import { PremiumDashboard } from '@/components/platform/PremiumDashboard';
import { createClient } from '@/lib/supabase/server';

export default async function WorkspacesPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect('/login');

  const [{ data: workspaces }, { data: vaults }, { data: boards }, { data: notebooks }, { data: tasks }, { data: recentItems }] = await Promise.all([
    supabase.from('workspaces').select('*').eq('user_id', user.id).is('archived_at', null).order('position', { ascending: true }),
    supabase.from('vaults').select('*').eq('user_id', user.id).is('archived_at', null).order('updated_at', { ascending: false }).limit(12),
    supabase.from('boards').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(6),
    supabase.from('notebooks').select('*').eq('user_id', user.id).is('archived_at', null).order('updated_at', { ascending: false }).limit(6),
    supabase.from('tasks').select('*').eq('user_id', user.id).neq('status', 'done').order('due_at', { ascending: true, nullsFirst: false }).limit(8),
    supabase.from('vault_items').select('*').eq('user_id', user.id).is('deleted_at', null).order('updated_at', { ascending: false }).limit(10)
  ]);

  return (
    <PremiumDashboard
      userEmail={user.email ?? ''}
      initialWorkspaces={workspaces ?? []}
      initialVaults={vaults ?? []}
      initialBoards={boards ?? []}
      initialNotebooks={notebooks ?? []}
      initialTasks={tasks ?? []}
      initialRecentItems={recentItems ?? []}
    />
  );
}
