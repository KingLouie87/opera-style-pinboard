import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { parseHttpUrl, safeFetch } from '@/lib/url-security';

export const runtime = 'nodejs';

const schema = z.object({ url: z.string().min(4).max(2048) });
const rate = new Map<string, { count: number; reset: number }>();

function checkRateLimit(userId: string) {
  const now = Date.now();
  const current = rate.get(userId);
  if (!current || current.reset < now) {
    rate.set(userId, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (current.count >= 40) return false;
  current.count += 1;
  return true;
}

function absoluteUrl(value: string | undefined, base: URL) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  if (!checkRateLimit(userData.user.id)) return NextResponse.json({ error: 'Zu viele Preview-Anfragen. Bitte kurz warten.' }, { status: 429 });

  try {
    const body = schema.parse(await request.json());
    const target = parseHttpUrl(body.url);
    const response = await safeFetch(target.toString());

    if (!response.ok) {
      return NextResponse.json({ error: `Website konnte nicht geladen werden (${response.status}).` }, { status: 400 });
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return NextResponse.json({ error: 'Die URL liefert kein HTML-Dokument.' }, { status: 400 });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').first().text() ||
      null;
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      null;

    const imageCandidates: string[] = [];
    const push = (value: string | undefined) => {
      const absolute = absoluteUrl(value, target);
      if (absolute && !imageCandidates.includes(absolute)) imageCandidates.push(absolute);
    };

    push($('meta[property="og:image:secure_url"]').attr('content'));
    push($('meta[property="og:image"]').attr('content'));
    push($('meta[name="twitter:image"]').attr('content'));
    push($('link[rel="image_src"]').attr('href'));
    $('img').each((_, element) => {
      const src = $(element).attr('src') || $(element).attr('data-src') || $(element).attr('data-lazy-src');
      push(src);
    });

    const favicon =
      absoluteUrl($('link[rel="icon"]').attr('href'), target) ||
      absoluteUrl($('link[rel="shortcut icon"]').attr('href'), target) ||
      absoluteUrl('/favicon.ico', target);

    return NextResponse.json({
      url: target.toString(),
      title: title?.trim() || null,
      description: description?.trim() || null,
      favicon,
      images: imageCandidates.slice(0, 24)
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Preview fehlgeschlagen.' }, { status: 400 });
  }
}
