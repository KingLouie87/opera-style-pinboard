import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { parseHttpUrl, safeFetch } from '@/lib/url-security';
import { autoTags, inferMediaKind, youtubeEmbed } from '@/lib/media';

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
  if (current.count >= 60) return false;
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
  return value.split(',').map(part => part.trim().split(/\s+/)[0]).filter(Boolean);
}

function looksUseful(url: string, width?: string, height?: string) {
  const lower = url.toLowerCase();
  if (lower.includes('tracking') || lower.includes('pixel') || lower.includes('spacer') || lower.includes('blank')) return false;
  if (lower.includes('sprite') || lower.includes('favicon') || lower.endsWith('.svg')) return false;
  const w = Number(width || 0);
  const h = Number(height || 0);
  if ((w && w < 120) || (h && h < 90)) return false;
  return true;
}

function sourceName(url: URL) {
  return url.hostname.replace(/^www\./, '');
}

function niceTitleFromUrl(url: URL) {
  const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || sourceName(url));
  return last.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || sourceName(url);
}

function previewFallback(target: URL, reason?: string, contentType: string | null = null) {
  const cleanDisplayUrl = new URL(target.toString());
  cleanDisplayUrl.search = '';
  cleanDisplayUrl.hash = '';
  const mediaKind = youtubeEmbed(target.toString()) ? 'video' : inferMediaKind(target.toString(), contentType ?? '', null);
  return NextResponse.json({
    url: target.toString(),
    title: niceTitleFromUrl(target),
    description: reason ? `Automatische Vorschau eingeschränkt: ${reason}. Der Link kann trotzdem gespeichert und manuell ergänzt werden.` : null,
    favicon: absoluteUrl('/favicon.ico', target),
    source: sourceName(target),
    mediaKind,
    contentType,
    suggestedTags: autoTags(`${sourceName(target)} ${target.pathname}`).slice(0, 7),
    images: [],
    videoEmbedUrl: youtubeEmbed(target.toString()),
    previewWarning: reason ?? null,
    displayUrl: cleanDisplayUrl.toString()
  });
}

async function fetchWithFallbacks(target: URL) {
  const candidates: URL[] = [target];
  if (target.search) {
    const withoutTracking = new URL(target.toString());
    for (const key of Array.from(withoutTracking.searchParams.keys())) {
      if (/^(utm_|fbclid|gclid|src|ref|mc_|yclid|igshid)/i.test(key)) withoutTracking.searchParams.delete(key);
    }
    if (withoutTracking.toString() !== target.toString()) candidates.push(withoutTracking);
    const withoutQuery = new URL(target.toString());
    withoutQuery.search = '';
    if (!candidates.some(item => item.toString() === withoutQuery.toString())) candidates.push(withoutQuery);
  }

  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const response = await safeFetch(candidate.toString());
      lastResponse = response;
      if (response.ok) return { response, base: candidate };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastResponse) return { response: lastResponse, base: target };
  throw lastError instanceof Error ? lastError : new Error('Preview fehlgeschlagen');
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  if (!checkRateLimit(userData.user.id)) return NextResponse.json({ error: 'Zu viele Preview-Anfragen. Bitte kurz warten.' }, { status: 429 });

  let target: URL;
  try {
    const body = schema.parse(await request.json());
    target = parseHttpUrl(body.url);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ungültige URL.' }, { status: 400 });
  }

  try {
    const { response, base } = await fetchWithFallbacks(target);
    const contentType = response.headers.get('content-type') ?? '';

    if (!response.ok) {
      const message = response.status === 403
        ? 'Die Website blockiert automatische Vorschauen mit 403. Manuelles Speichern bleibt möglich'
        : `Website konnte nicht vollständig geladen werden (${response.status}). Manuelles Speichern bleibt möglich`;

      // Some protected sites still return a readable HTML error page that contains
      // a useful title, canonical URL or image metadata. Parse that body before
      // falling back to a plain domain-only pin so difficult URLs still feel useful.
      if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
        try {
          const html = await response.clone().text();
          const $ = cheerio.load(html);
          const title = $('meta[property="og:title"]').attr('content') || $('meta[name="twitter:title"]').attr('content') || $('title').first().text() || niceTitleFromUrl(target);
          const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || $('meta[name="twitter:description"]').attr('content') || null;
          const images: string[] = [];
          const push = (value: string | undefined | null) => {
            const absolute = absoluteUrl(value, target);
            if (absolute && looksUseful(absolute) && !images.includes(absolute)) images.push(absolute);
          };
          push($('meta[property="og:image:secure_url"]').attr('content'));
          push($('meta[property="og:image"]').attr('content'));
          push($('meta[name="twitter:image"]').attr('content'));
          push($('link[rel="image_src"]').attr('href'));
          const favicon = absoluteUrl($('link[rel="apple-touch-icon"]').attr('href'), target) || absoluteUrl($('link[rel="icon"]').attr('href'), target) || absoluteUrl('/favicon.ico', target);
          return NextResponse.json({
            url: target.toString(),
            title: title?.trim() || niceTitleFromUrl(target),
            description: description?.trim() || message,
            favicon,
            source: sourceName(target),
            mediaKind: youtubeEmbed(target.toString()) ? 'video' : inferMediaKind(target.toString(), contentType, null),
            contentType,
            suggestedTags: autoTags(`${title ?? ''} ${description ?? ''} ${sourceName(target)} ${target.pathname}`).slice(0, 7),
            images: images.slice(0, 20),
            videoEmbedUrl: youtubeEmbed(target.toString()),
            previewWarning: message
          });
        } catch {
          // fall through to domain fallback
        }
      }
      return previewFallback(target, message, contentType);
    }

    const mediaKindFromHeader = inferMediaKind(target.toString(), contentType, null);
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return NextResponse.json({
        url: target.toString(),
        title: niceTitleFromUrl(target),
        description: null,
        favicon: absoluteUrl('/favicon.ico', target),
        source: sourceName(target),
        mediaKind: mediaKindFromHeader,
        contentType,
        suggestedTags: autoTags(`${sourceName(target)} ${target.pathname}`).slice(0, 7),
        images: [],
        videoEmbedUrl: youtubeEmbed(target.toString())
      });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const pageBase = base ?? target;
    const title = $('meta[property="og:title"]').attr('content') || $('meta[name="twitter:title"]').attr('content') || $('title').first().text() || null;
    const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || $('meta[name="twitter:description"]').attr('content') || null;
    const ogType = $('meta[property="og:type"]').attr('content') || '';
    const images: string[] = [];
    const push = (value: string | undefined | null, width?: string, height?: string) => {
      const absolute = absoluteUrl(value, pageBase);
      if (absolute && looksUseful(absolute, width, height) && !images.includes(absolute)) images.push(absolute);
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
    $('source').each((_, element) => srcsetUrls($(element).attr('srcset')).forEach(src => push(src)));

    const favicon = absoluteUrl($('link[rel="apple-touch-icon"]').attr('href'), pageBase) || absoluteUrl($('link[rel="icon"]').attr('href'), pageBase) || absoluteUrl($('link[rel="shortcut icon"]').attr('href'), pageBase) || absoluteUrl('/favicon.ico', target);
    const mediaKind = youtubeEmbed(target.toString()) || ogType.includes('video') ? 'video' : inferMediaKind(target.toString(), contentType, null);
    const suggestedTags = autoTags(`${title ?? ''} ${description ?? ''} ${sourceName(target)} ${target.pathname}`).slice(0, 7);

    return NextResponse.json({
      url: target.toString(),
      title: title?.trim() || niceTitleFromUrl(target),
      description: description?.trim() || null,
      favicon,
      source: sourceName(target),
      mediaKind,
      contentType,
      suggestedTags,
      images: images.slice(0, 60),
      videoEmbedUrl: youtubeEmbed(target.toString())
    });
  } catch (error) {
    return previewFallback(target, error instanceof Error ? error.message : 'Preview fehlgeschlagen');
  }
}
