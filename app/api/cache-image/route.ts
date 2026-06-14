import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { parseHttpUrl, safeFetch } from '@/lib/url-security';

export const runtime = 'nodejs';

const schema = z.object({ imageUrl: z.string().min(4).max(4096) });
const MAX_IMAGE_SIZE = 6 * 1024 * 1024;

function extensionFromContentType(contentType: string) {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('avif')) return 'avif';
  return 'jpg';
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  try {
    const body = schema.parse(await request.json());
    const url = parseHttpUrl(body.imageUrl);
    const response = await safeFetch(url.toString(), { headers: { accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.7' } });

    if (!response.ok) return NextResponse.json({ error: `Bild konnte nicht geladen werden (${response.status}).` }, { status: 400 });

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return NextResponse.json({ error: 'Die Datei ist kein Bild.' }, { status: 400 });

    const length = Number(response.headers.get('content-length') || '0');
    if (length > MAX_IMAGE_SIZE) return NextResponse.json({ error: 'Das Bild ist zu groß. Maximal 6 MB.' }, { status: 400 });

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) return NextResponse.json({ error: 'Das Bild ist zu groß. Maximal 6 MB.' }, { status: 400 });

    const extension = extensionFromContentType(contentType);
    const path = `${userData.user.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('pin-images').upload(path, arrayBuffer, {
      contentType,
      upsert: false,
      cacheControl: '31536000'
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabase.from('pin_images').insert({
      user_id: userData.user.id,
      source_type: 'remote-cache',
      original_url: url.toString(),
      storage_path: path,
      mime_type: contentType,
      size_bytes: arrayBuffer.byteLength
    });

    return NextResponse.json({ path, imageUrl: `/api/images/${path}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bild konnte nicht gespeichert werden.' }, { status: 400 });
  }
}
