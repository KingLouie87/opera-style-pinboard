import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { safeFetch } from '@/lib/url-security';

export const runtime = 'nodejs';

const schema = z.object({ imageUrl: z.string().url() });

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(8, Math.min(92, Math.round(value)));
}

async function analyzeCoverFocus(input: Buffer) {
  try {
    const width = 96;
    const height = 96;
    const raw = await sharp(input)
      .rotate()
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer();
    let weightedX = 0;
    let weightedY = 0;
    let total = 0;

    const lum = (x: number, y: number) => {
      const index = (y * width + x) * 3;
      return 0.2126 * raw[index] + 0.7152 * raw[index + 1] + 0.0722 * raw[index + 2];
    };

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = (y * width + x) * 3;
        const r = raw[index];
        const g = raw[index + 1];
        const b = raw[index + 2];
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        const edge = Math.abs(lum(x + 1, y) - lum(x - 1, y)) + Math.abs(lum(x, y + 1) - lum(x, y - 1));
        const nx = x / (width - 1);
        const ny = y / (height - 1);
        const centerBias = 1 - Math.min(0.72, Math.hypot(nx - 0.5, ny - 0.42));
        const upperProductBias = 1 + Math.max(0, 0.55 - ny) * 0.22;
        const score = Math.max(0, edge * 1.15 + saturation * 0.32) * Math.max(0.35, centerBias) * upperProductBias;
        if (score > 0) {
          weightedX += nx * score;
          weightedY += ny * score;
          total += score;
        }
      }
    }

    if (total <= 0) return { x: 50, y: 50 };
    return { x: clampPercent((weightedX / total) * 100), y: clampPercent((weightedY / total) * 100) };
  } catch {
    return { x: 50, y: 50 };
  }
}


export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const body = schema.parse(await request.json());
  const target = new URL(body.imageUrl);
  const response = await safeFetch(body.imageUrl, {
    headers: {
      accept: 'image/avif,image/webp,image/apng,image/png,image/jpeg,image/gif,*/*;q=0.8',
      referer: `${target.origin}/`,
      'sec-fetch-dest': 'image',
      'sec-fetch-mode': 'no-cors',
      'sec-fetch-site': 'cross-site',
    }
  });
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
  const focus = await analyzeCoverFocus(input);
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

  return NextResponse.json({ image_url: `/api/images/${path}`, image_path: path, dominant_color: dominant, aspect_ratio: width && height ? width / height : null, cover_focus_x: focus.x, cover_focus_y: focus.y });
}
