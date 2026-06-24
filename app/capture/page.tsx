import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CaptureClient } from '@/components/pinboard/CaptureClient';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default async function CapturePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    const target = new URLSearchParams();
    const url = firstParam(params.url);
    const title = firstParam(params.title);
    const text = firstParam(params.text);
    const image = firstParam(params.image);
    if (url) target.set('url', url);
    if (title) target.set('title', title);
    if (text) target.set('text', text);
    if (image) target.set('image', image);
    redirect(`/login?next=/capture${target.toString() ? `?${target.toString()}` : ''}`);
  }

  const [{ data: boards }, { data: sections }, { data: pins }] = await Promise.all([
    supabase.from('boards').select('*').eq('user_id', userData.user.id).is('archived_at', null).is('deleted_at', null).order('updated_at', { ascending: false }),
    supabase.from('board_sections').select('*').eq('user_id', userData.user.id).order('position'),
    supabase.from('pins').select('*').eq('user_id', userData.user.id).is('deleted_at', null).is('archived_at', null).order('position')
  ]);

  return <CaptureClient
    boards={boards ?? []}
    sections={sections ?? []}
    pins={pins ?? []}
    userEmail={userData.user.email ?? 'Account'}
    initialUrl={firstParam(params.url)}
    initialTitle={firstParam(params.title)}
    initialDescription={firstParam(params.text)}
    initialImageUrl={firstParam(params.image)}
  />;
}
