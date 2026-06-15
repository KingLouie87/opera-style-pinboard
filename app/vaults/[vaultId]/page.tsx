import { notFound, redirect } from 'next/navigation';
import { VaultWorkspace } from '@/components/platform/VaultWorkspace';
import { createClient } from '@/lib/supabase/server';

export default async function VaultPage({ params }: { params: Promise<{ vaultId: string }> }) {
  const { vaultId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect('/login');

  const [{ data: vault }, { data: items }, { data: tasks }] = await Promise.all([
    supabase.from('vaults').select('*').eq('id', vaultId).eq('user_id', user.id).single(),
    supabase.from('vault_items').select('*').eq('vault_id', vaultId).eq('user_id', user.id).is('deleted_at', null).order('position', { ascending: true }),
    supabase.from('tasks').select('*').eq('vault_id', vaultId).eq('user_id', user.id).order('created_at', { ascending: false })
  ]);

  if (!vault) notFound();

  return <VaultWorkspace vault={vault} initialItems={items ?? []} initialTasks={tasks ?? []} userEmail={user.email ?? ''} />;
}
