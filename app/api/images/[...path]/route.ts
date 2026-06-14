import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const storagePath = path.join('/');
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  if (!storagePath.startsWith(`${userData.user.id}/`)) return NextResponse.json({ error: 'Nicht erlaubt.' }, { status: 403 });

  const { data, error } = await supabase.storage.from('pin-images').download(storagePath);
  if (error || !data) return NextResponse.json({ error: 'Bild nicht gefunden.' }, { status: 404 });

  return new NextResponse(data.stream(), {
    headers: {
      'content-type': data.type || 'application/octet-stream',
      'cache-control': 'private, max-age=86400'
    }
  });
}
