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
  if (current.count >= 50) return false;
  current.count += 1;
  return true;
}

function absoluteUrl(value: string | undefined | null, base: URL) {
  if (!value) return null;
  try {
    const cleaned = value.trim();
    if (!cleaned || cleaned.startsWith('data:') || cleaned.startsWith('blob:')) return null;
    const url = new URL(cleaned, base);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function srcsetUrls(value: string | undefined | null) {
  if (!value) return [];
  return value
    .split(',')
    .map(part => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function looksLikeUsefulImage(url: string, width?: string, height?: string) {
  const lower = url.toLowerCase();
  if (lower.includes('tracking') || lower.includes('pixel') || lower.includes('spacer') || lower.includes('blank.gif')) return false;
  if (lower.endsWith('.svg') || lower.includes('logo') || lower.includes('favicon')) return false;
  const w = Number(width || 0);
  const h = Number(height || 0);
  if ((w && w < 90) || (h && h < 90)) return false;
  return true;
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

    if (!response.ok) return NextResponse.json({ error: `Website konnte nicht geladen werden (${response.status}).` }, { status: 400 });

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
    const push = (value: string | undefined | null, width?: string, height?: string) => {
      const absolute = absoluteUrl(value, target);
      if (absolute && looksLikeUsefulImage(absolute, width, height) && !imageCandidates.includes(absolute)) imageCandidates.push(absolute);
    };

    push($('meta[property="og:image:secure_url"]').attr('content'), $('meta[property="og:image:width"]').attr('content'), $('meta[property="og:image:height"]').attr('content'));
    push($('meta[property="og:image"]').attr('content'), $('meta[property="og:image:width"]').attr('content'), $('meta[property="og:image:height"]').attr('content'));
    push($('meta[name="twitter:image"]').attr('content'));
    push($('link[rel="image_src"]').attr('href'));

    $('img').each((_, element) => {
      const img = $(element);
      const width = img.attr('width') || img.attr('data-width');
      const height = img.attr('height') || img.attr('data-height');
      push(img.attr('src'), width, height);
      push(img.attr('data-src'), width, height);
      push(img.attr('data-lazy-src'), width, height);
      push(img.attr('data-original'), width, height);
      for (const src of srcsetUrls(img.attr('srcset'))) push(src, width, height);
      for (const src of srcsetUrls(img.attr('data-srcset'))) push(src, width, height);
    });

    $('source').each((_, element) => {
      for (const src of srcsetUrls($(element).attr('srcset'))) push(src);
    });

    const favicon =
      absoluteUrl($('link[rel="apple-touch-icon"]').attr('href'), target) ||
      absoluteUrl($('link[rel="icon"]').attr('href'), target) ||
      absoluteUrl($('link[rel="shortcut icon"]').attr('href'), target) ||
      absoluteUrl('/favicon.ico', target);

    return NextResponse.json({
      url: target.toString(),
      title: title?.trim() || null,
      description: description?.trim() || null,
      favicon,
      images: imageCandidates.slice(0, 48)
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Preview fehlgeschlagen.' }, { status: 400 });
  }
}
