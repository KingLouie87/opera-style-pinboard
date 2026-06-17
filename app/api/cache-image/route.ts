import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { safeFetch } from '@/lib/url-security';

export const runtime = 'nodejs';

const schema = z.object({ imageUrl: z.string().url() });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const body = schema.parse(await request.json());
  const response = await safeFetch(body.imageUrl, { headers: { accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' } });
  if (!response.ok) return NextResponse.json({ error: 'Bild konnte nicht geladen werden.' }, { status: 400 });
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) return NextResponse.json({ error: 'URL ist kein Bild.' }, { status: 400 });
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > 18 * 1024 * 1024) return NextResponse.json({ error: 'Bild ist zu groß.' }, { status: 400 });

  const input = Buffer.from(arrayBuffer);
  const meta = await sharp(input).metadata();
  const resized = sharp(input).rotate().resize({ width: 2200, withoutEnlargement: true });
  const stats = await resized.clone().resize(1, 1, { fit: 'fill' }).raw().toBuffer();
  const dominant = `#${[stats[0], stats[1], stats[2]].map(value => value.toString(16).padStart(2, '0')).join('')}`;
  const webp = await resized.webp({ quality: 88, smartSubsample: true }).toBuffer();
  const path = `${userData.user.id}/remote-${crypto.randomUUID()}.webp`;

  const { error: uploadError } = await supabase.storage.from('pin-images').upload(path, webp, { contentType: 'image/webp', cacheControl: '31536000' });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  await supabase.from('pin_images').insert({
    user_id: userData.user.id,
    source_type: 'remote-cache',
    original_url: body.imageUrl,
    storage_path: path,
    mime_type: 'image/webp',
    size_bytes: webp.byteLength
  });

  const width = Math.min(meta.width || 2200, 2200);
  const height = meta.width && meta.height && meta.width > 2200 ? Math.round(meta.height * (2200 / meta.width)) : (meta.height || null);

  return NextResponse.json({ image_url: `/api/images/${path}`, image_path: path, dominant_color: dominant, aspect_ratio: width && height ? width / height : null });
}
