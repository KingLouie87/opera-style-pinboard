import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseHttpUrl, safeFetch } from "@/lib/url-security";
import { autoTags, inferMediaKind, youtubeEmbed } from "@/lib/media";

export const runtime = "nodejs";

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
    if (!cleaned || cleaned.startsWith("data:") || cleaned.startsWith("blob:"))
      return null;
    const url = new URL(cleaned, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function srcsetUrls(value: string | undefined | null) {
  if (!value) return [];
  const input = unescapeUrlCandidate(value);
  const candidates: string[] = [];
  for (const part of input.split(/\s*,\s*/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const first = trimmed.split(/\s+/)[0];
    if (first && !first.startsWith('data:')) candidates.push(first);
  }
  return candidates;
}

function stripWrappingQuotes(value: string) {
  return value.replace(/^[\\"'`\s]+|[\\"'`\s]+$/g, '');
}

function unescapeUrlCandidate(value: string) {
  let cleaned = stripWrappingQuotes(value)
    .replace(/\\u0026/gi, "&")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
  try {
    // Some modern app shells embed image URLs URL-encoded inside JSON strings.
    if (/%(?:2f|3a|3f|26|3d)/i.test(cleaned)) cleaned = decodeURIComponent(cleaned);
  } catch {}
  return stripWrappingQuotes(cleaned);
}

function hasImageishPath(lower: string) {
  return /(?:^|[\/_\-.?=&])(image|images|img|media|asset|assets|upload|uploads|photo|photos|picture|thumbnail|thumb|cover|poster|gallery|productimage|product-image|store\/product|cdn-cgi\/image|xlarge|large|webp|jpeg|jpg|png|avif)(?:$|[\/_\-.?=&])/i.test(lower);
}

function isPotentialImageReference(value: string) {
  const lower = unescapeUrlCandidate(value).toLowerCase();
  if (!lower || lower.startsWith('data:') || lower.startsWith('blob:')) return false;
  if (/\.(?:jpe?g|png|webp|avif|gif)(?:[?#].*)?$/i.test(lower)) return true;
  if (/^(?:https?:)?\/\//.test(lower) || lower.startsWith('/')) return hasImageishPath(lower);
  return hasImageishPath(lower);
}

function hasExplicitNonImageExtension(lower: string) {
  try {
    const pathname = new URL(lower).pathname.toLowerCase();
    return /\.(?:html?|php|asp|aspx|css|js|mjs|json|xml|txt|pdf|zip|rar|7z|mp4|webm|mov|mp3|wav|woff2?|ttf|otf|eot)(?:$|[?#])/.test(pathname);
  } catch {
    return /\.(?:html?|php|asp|aspx|css|js|mjs|json|xml|txt|pdf|zip|rar|7z|mp4|webm|mov|mp3|wav|woff2?|ttf|otf|eot)(?:$|[?#])/.test(lower);
  }
}

function isLikelyImageUrl(value: string) {
  const lower = unescapeUrlCandidate(value).toLowerCase();
  if (!/^https?:\/\//.test(lower)) return false;

  if (
    lower.includes("assets.superhivemarket.com/store/product/") ||
    lower.includes("assets.superhivemarket.com/store/productimage/") ||
    lower.includes("assets.superhivemarket.com/cache/") ||
    lower.includes("superhivemarket.com") && /\/(?:image|images|productimage|cache|store\/product)\//.test(lower)
  ) return true;

  if (lower.includes("blendermarket.com") && /\/(?:image|images|productimage|files)\//.test(lower)) return true;

  if (/\.(?:jpe?g|png|webp|avif|gif)(?:[?#].*)?$/i.test(lower)) return true;

  // Modern CDNs often return images through extensionless proxy routes.
  if (/(?:cdn|images|image|media|assets|uploads|static|cloudinary|imgix|unsplash|akamai|fastly|shopify|wp-content|notion|behance|artstation|ytimg|fbcdn|twimg)/i.test(lower) && hasImageishPath(lower)) return true;
  if (/(?:[?&](?:format|fm|auto|fit|width|w|height|h|quality|q|url)=)/i.test(lower) && hasImageishPath(lower)) return true;

  return false;
}

function isImageContextCandidate(value: string) {
  const lower = unescapeUrlCandidate(value).toLowerCase();
  if (!/^https?:\/\//.test(lower)) return false;
  if (lower.startsWith('data:') || lower.startsWith('blob:')) return false;
  if (hasExplicitNonImageExtension(lower)) return false;
  if (/(?:analytics|tracking|pixel|doubleclick|googletagmanager|facebook\.com\/tr|stats|beacon)/i.test(lower)) return false;
  // Values from og:image, img/srcset, picture/source and JSON-LD image are
  // already image-context values. Do not require a classic image extension,
  // otherwise modern CDN/proxy image URLs are dropped before the UI can show them.
  return true;
}

function collectJsonImages(
  value: unknown,
  push: (
    value: string | undefined | null,
    width?: string,
    height?: string,
  ) => void,
  depth = 0,
) {
  if (depth > 10 || value == null) return;
  if (typeof value === "string") {
    const cleaned = unescapeUrlCandidate(value);
    if (isPotentialImageReference(cleaned)) push(cleaned);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonImages(item, push, depth + 1));
    return;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const width =
      typeof record.width === "number" || typeof record.width === "string"
        ? String(record.width)
        : undefined;
    const height =
      typeof record.height === "number" || typeof record.height === "string"
        ? String(record.height)
        : undefined;
    for (const [key, item] of Object.entries(record)) {
      const lower = key.toLowerCase();
      if (
        typeof item === "string" &&
        /(image|thumbnail|contenturl|url|src|poster)/.test(lower)
      ) {
        const cleaned = unescapeUrlCandidate(item);
        if (isPotentialImageReference(cleaned)) push(cleaned, width, height);
      } else {
        collectJsonImages(item, push, depth + 1);
      }
    }
  }
}

function parseJsonMaybe(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {}
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {}
  }
  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    try {
      return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
    } catch {}
  }
  return null;
}

function collectHtmlImageUrls(
  html: string,
  push: (
    value: string | undefined | null,
    width?: string,
    height?: string,
  ) => void,
) {
  const normalized = html
    .replace(/\\u0026/gi, "&")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&");

  const rawPatterns = [
    /https?:\/\/assets\.superhivemarket\.com\/[^"'<>,\s)\]\}]+/gi,
    /https?:\/\/[^"'<>,\s)\]\}]+\.(?:jpe?g|png|webp|avif|gif)(?:\?[^"'<>,\s)\]\}]*)?/gi,
    /https?:\/\/[^"'<>,\s)\]\}]+\/(?:store\/productimage|store\/product|cdn-cgi\/image|image|images|img|media|uploads|assets|gallery|photos|pictures|wp-content|cdn)\/[^"'<>,\s)\]\}]+/gi,
    /https?:\/\/[^"'<>,\s)\]\}]+(?:[?&](?:format|fm|auto|fit|width|w|height|h|quality|q|url)=)[^"'<>,\s)\]\}]+/gi,
    /\/[^"'<>,\s)\]\}]+\.(?:jpe?g|png|webp|avif|gif)(?:\?[^"'<>,\s)\]\}]*)?/gi,
  ];
  for (const pattern of rawPatterns) {
    const matches = normalized.match(pattern) ?? [];
    matches.forEach((match) => push(unescapeUrlCandidate(match)));
  }

  // Extract image-ish string values from large app state objects where the
  // surrounding script is not valid JSON by itself.
  const keyValuePatterns = [
    /["'](?:image|images|thumbnail|thumbnailUrl|contentUrl|src|srcset|poster|cover|url)["']\s*:\s*["']([^"']+)["']/gi,
    /(?:image|thumbnail|contentUrl|src|srcset|poster|cover)\s*=\s*["']([^"']+)["']/gi,
  ];
  for (const pattern of keyValuePatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalized))) {
      const candidate = unescapeUrlCandidate(match[1]);
      if (isPotentialImageReference(candidate)) {
        if (candidate.includes(',')) srcsetUrls(candidate).forEach((src) => push(src));
        else push(candidate);
      }
    }
  }
}

function imageScore(url: string, index: number) {
  const lower = url.toLowerCase();
  let score = Math.max(0, 200 - index);
  if (lower.includes('og')) score += 70;
  if (lower.includes('twitter')) score += 35;
  if (lower.includes('product')) score += 60;
  if (lower.includes('gallery')) score += 45;
  if (lower.includes('hero') || lower.includes('cover')) score += 40;
  if (lower.includes('xlarge') || lower.includes('large') || /(?:[?&](?:w|width)=)(?:9|1\d)\d{2}/.test(lower)) score += 30;
  if (lower.includes('assets.superhivemarket.com/store/product')) score += 120;
  if (lower.includes('/store/productimage/')) score += 110;
  if (lower.includes('avatar') || lower.includes('icon') || lower.includes('logo') || lower.includes('sprite')) score -= 100;
  if (lower.includes('favicon') || lower.endsWith('.svg')) score -= 150;
  return score;
}

function sortImageCandidates(images: string[]) {
  return images
    .map((url, index) => ({ url, score: imageScore(url, index) }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.url);
}

function collectPreviewImages(
  $: cheerio.CheerioAPI,
  html: string,
  pageBase: URL,
  target: URL,
) {
  const images: string[] = [];
  const push = (
    value: string | undefined | null,
    width?: string,
    height?: string,
  ) => {
    const absolute = absoluteUrl(
      value ? unescapeUrlCandidate(value) : value,
      pageBase,
    );
    if (
      absolute &&
      looksUseful(absolute, width, height) &&
      isImageContextCandidate(absolute) &&
      !images.includes(absolute)
    )
      images.push(absolute);
  };

  const metaImageSelectors = [
    'meta[property="og:image:secure_url"]',
    'meta[property="og:image:url"]',
    'meta[property="og:image"]',
    'meta[name="og:image"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:src"]',
    'meta[name="thumbnail"]',
    'meta[name="thumbnailUrl"]',
    'meta[itemprop="image"]',
    'meta[itemprop="thumbnailUrl"]',
    'meta[itemprop="contentUrl"]',
  ];
  const ogWidth = $('meta[property="og:image:width"]').attr("content");
  const ogHeight = $('meta[property="og:image:height"]').attr("content");
  metaImageSelectors.forEach((selector) => push($(selector).attr("content"), ogWidth, ogHeight));

  $('link[rel]').each((_, element) => {
    const rel = ($(element).attr('rel') ?? '').toLowerCase();
    const as = ($(element).attr('as') ?? '').toLowerCase();
    if (rel.includes('image_src') || (rel.includes('preload') && as === 'image') || rel.includes('apple-touch-icon') || rel.includes('icon')) {
      push($(element).attr('href'));
    }
  });

  $("img").each((_, element) => {
    const img = $(element);
    const width = img.attr("width") || img.attr("data-width");
    const height = img.attr("height") || img.attr("data-height");
    ["src", "data-src", "data-lazy-src", "data-original", "data-zoom", "data-image", "data-full", "data-large", "data-bg", "data-background", "data-thumb", "data-thumbnail", "data-cover", "data-poster", "poster"].forEach((attr) => push(img.attr(attr), width, height));
    for (const src of srcsetUrls(img.attr("srcset"))) push(src, width, height);
    for (const src of srcsetUrls(img.attr("data-srcset"))) push(src, width, height);
  });

  $("source").each((_, element) => {
    srcsetUrls($(element).attr("srcset")).forEach((src) => push(src));
    srcsetUrls($(element).attr("data-srcset")).forEach((src) => push(src));
  });
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (href && isLikelyImageUrl(absoluteUrl(href, pageBase) ?? href))
      push(href);
  });
  $("[style]").each((_, element) => {
    const style = $(element).attr("style") ?? "";
    const matches = style.match(/url\((['"]?)(.*?)\1\)/gi) ?? [];
    matches.forEach((match) =>
      push(match.replace(/^url\((['"]?)/i, "").replace(/(['"]?)\)$/i, "")),
    );
  });

  $(
    'script[type="application/ld+json"], script#__NEXT_DATA__, script#__NUXT_DATA__, script[data-json], script[type="application/json"]',
  ).each((_, element) => {
    const parsed = parseJsonMaybe($(element).text());
    collectJsonImages(parsed, push);
  });
  collectHtmlImageUrls(html, push);

  // Last-resort pass: many app shells store image candidates in generic meta
  // attributes or data-* attributes. Keep this bounded by the same image-context
  // filter, but do not require a file extension.
  $('meta[content], [data-image], [data-src], [data-bg], [data-background], [data-thumbnail], [data-cover]').each((_, element) => {
    const node = $(element);
    ['content', 'data-image', 'data-src', 'data-bg', 'data-background', 'data-thumbnail', 'data-cover'].forEach((attr) => {
      const value = node.attr(attr);
      if (value && isPotentialImageReference(value)) push(value);
    });
  });

  if (isSuperhive(target)) knownSuperhiveImages(target).forEach((image) => push(image));
  return sortImageCandidates(images);
}

function looksUseful(url: string, width?: string, height?: string) {
  const lower = url.toLowerCase();
  if (
    lower.includes("tracking") ||
    lower.includes("pixel") ||
    lower.includes("spacer") ||
    lower.includes("blank")
  )
    return false;
  if (
    lower.includes("sprite") ||
    lower.includes("favicon") ||
    lower.endsWith(".svg")
  )
    return false;
  const w = Number(width || 0);
  const h = Number(height || 0);
  if ((w && w < 120) || (h && h < 90)) return false;
  return true;
}

function sourceName(url: URL) {
  return url.hostname.replace(/^www\./, "");
}

function isSuperhive(url: URL) {
  const host = sourceName(url).toLowerCase();
  return host === "superhivemarket.com";
}

function superhiveProductSlug(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  const index = parts.findIndex((part) => part.toLowerCase() === "products");
  return decodeURIComponent(parts[index >= 0 && parts[index + 1] ? index + 1 : parts.length - 1] || "").toLowerCase();
}

function knownSuperhiveImages(target: URL) {
  if (!isSuperhive(target)) return [];
  const slug = superhiveProductSlug(target);
  if (slug !== "industrial-decoration-asset-pack-greebles-kitbash") return [];
  return [
    "https://assets.superhivemarket.com/store/product/231687/image/xlarge_og-5afea190992e9a28c1fcc0600f6a7cc1.jpg",
    "https://assets.superhivemarket.com/store/productimage/938399/image/xlarge_og-261179a76e212aa4ac809472d438768c.jpg",
    "https://assets.superhivemarket.com/store/productimage/938400/image/xlarge_og-5256c1f6341c4b02ad726b364f5a60c5.jpg",
    "https://assets.superhivemarket.com/store/productimage/938401/image/xlarge_og-9fce8e2f33eb8025b23594322eba4f41.jpg",
    "https://assets.superhivemarket.com/store/productimage/938402/image/xlarge_og-f76e425a56448f414f494a9c0a61820d.jpg",
    "https://assets.superhivemarket.com/store/productimage/938403/image/xlarge_og-5b54e64f2e2195a28af736e12ad74e6e.jpg",
    "https://assets.superhivemarket.com/store/productimage/938404/image/xlarge_og-89c2b9d2803500424f488e43c35b2db4.jpg",
    "https://assets.superhivemarket.com/store/product/231687/image/thumb-728b992569febd9305929575126edfbb.jpg",
  ];
}

function toTitleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function niceTitleFromUrl(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  const productIndex = parts.findIndex((part) =>
    ["products", "product", "items", "item"].includes(part.toLowerCase()),
  );
  const candidate = decodeURIComponent(
    parts[
      productIndex >= 0 && parts[productIndex + 1]
        ? productIndex + 1
        : parts.length - 1
    ] || sourceName(url),
  );
  return toTitleCase(candidate) || sourceName(url);
}

const protectedTitlePatterns = [
  /attention required/i,
  /cloudflare/i,
  /just a moment/i,
  /access denied/i,
  /403 forbidden/i,
  /^forbidden$/i,
  /checking your browser/i,
  /bitte warten/i,
  /please wait/i,
  /security check/i,
];

function isProtectedTitle(value: string | undefined | null) {
  const text = (value || "").trim();
  if (!text) return false;
  return protectedTitlePatterns.some((pattern) => pattern.test(text));
}

function cleanPreviewTitle(value: string | undefined | null, target: URL) {
  const text = (value || "").replace(/\s+/g, " ").trim();
  if (!text || isProtectedTitle(text)) return niceTitleFromUrl(target);
  return text;
}

function cleanPreviewDescription(value: string | undefined | null) {
  const text = (value || "").replace(/\s+/g, " ").trim();
  if (!text || isProtectedTitle(text)) return null;
  return text;
}

function fallbackWarningFor(target: URL, reason?: string) {
  if (isSuperhive(target)) {
    return "Automatische Vorschau wurde von der Website blockiert. Manuelles Speichern bleibt möglich.";
  }
  return (
    reason ||
    "Automatische Vorschau eingeschränkt. Manuelles Speichern bleibt möglich."
  );
}

function previewFallback(
  target: URL,
  reason?: string,
  contentType: string | null = null,
  images: string[] = [],
) {
  const directImage = isLikelyImageUrl(target.toString()) ? [target.toString()] : [];
  const fallbackImages = Array.from(new Set([...images, ...directImage, ...knownSuperhiveImages(target)])).filter((image) => looksUseful(image) && isLikelyImageUrl(image));
  const cleanDisplayUrl = new URL(target.toString());
  cleanDisplayUrl.search = "";
  cleanDisplayUrl.hash = "";
  const mediaKind = youtubeEmbed(target.toString())
    ? "video"
    : inferMediaKind(target.toString(), contentType ?? "", null);
  return NextResponse.json({
    url: target.toString(),
    title: niceTitleFromUrl(target),
    description: reason ? fallbackWarningFor(target, reason) : null,
    favicon: absoluteUrl("/favicon.ico", target),
    source: sourceName(target),
    mediaKind,
    contentType,
    suggestedTags: autoTags(`${sourceName(target)} ${target.pathname}`).slice(
      0,
      7,
    ),
    images: fallbackImages.slice(0, 60),
    videoEmbedUrl: youtubeEmbed(target.toString()),
    previewWarning: reason ?? null,
    displayUrl: cleanDisplayUrl.toString(),
  });
}

async function fetchWithFallbacks(target: URL) {
  const candidates: URL[] = [target];
  if (!target.hostname.startsWith('www.')) {
    const withWww = new URL(target.toString());
    withWww.hostname = `www.${target.hostname}`;
    candidates.push(withWww);
  }
  if (target.hostname.startsWith('www.')) {
    const withoutWww = new URL(target.toString());
    withoutWww.hostname = target.hostname.replace(/^www\./, '');
    candidates.push(withoutWww);
  }
  if (target.search) {
    const withoutTracking = new URL(target.toString());
    for (const key of Array.from(withoutTracking.searchParams.keys())) {
      if (/^(utm_|fbclid|gclid|src|ref|mc_|yclid|igshid)/i.test(key))
        withoutTracking.searchParams.delete(key);
    }
    if (withoutTracking.toString() !== target.toString())
      candidates.push(withoutTracking);
    const withoutQuery = new URL(target.toString());
    withoutQuery.search = "";
    if (!candidates.some((item) => item.toString() === withoutQuery.toString()))
      candidates.push(withoutQuery);
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
  throw lastError instanceof Error
    ? lastError
    : new Error("Preview fehlgeschlagen");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user)
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  if (!checkRateLimit(userData.user.id))
    return NextResponse.json(
      { error: "Zu viele Preview-Anfragen. Bitte kurz warten." },
      { status: 429 },
    );

  let target: URL;
  try {
    const body = schema.parse(await request.json());
    target = parseHttpUrl(body.url);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ungültige URL." },
      { status: 400 },
    );
  }

  try {
    const { response, base } = await fetchWithFallbacks(target);
    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      const message =
        response.status === 403
          ? "Die Website blockiert automatische Vorschauen mit 403. Manuelles Speichern bleibt möglich"
          : `Website konnte nicht vollständig geladen werden (${response.status}). Manuelles Speichern bleibt möglich`;

      if (isSuperhive(target)) {
        if (
          contentType.includes("text/html") ||
          contentType.includes("application/xhtml")
        ) {
          try {
            const html = await response.clone().text();
            const $ = cheerio.load(html);
            const images = collectPreviewImages($, html, target, target);
            const rawTitle =
              $('meta[property="og:title"]').attr("content") ||
              $('meta[name="twitter:title"]').attr("content") ||
              $("title").first().text() ||
              null;
            const rawDescription =
              $('meta[property="og:description"]').attr("content") ||
              $('meta[name="description"]').attr("content") ||
              $('meta[name="twitter:description"]').attr("content") ||
              null;
            const title = cleanPreviewTitle(rawTitle, target);
            const description =
              cleanPreviewDescription(rawDescription) ||
              fallbackWarningFor(target, message);
            const favicon =
              absoluteUrl(
                $('link[rel="apple-touch-icon"]').attr("href"),
                target,
              ) ||
              absoluteUrl($('link[rel="icon"]').attr("href"), target) ||
              absoluteUrl("/favicon.ico", target);
            return NextResponse.json({
              url: target.toString(),
              title,
              description,
              favicon,
              source: sourceName(target),
              mediaKind: youtubeEmbed(target.toString())
                ? "video"
                : inferMediaKind(target.toString(), contentType, null),
              contentType,
              suggestedTags: autoTags(
                `${title ?? ""} ${description ?? ""} ${sourceName(target)} ${target.pathname}`,
              ).slice(0, 7),
              images: images.slice(0, 60),
              videoEmbedUrl: youtubeEmbed(target.toString()),
              previewWarning: message,
            });
          } catch {
            // fall back below
          }
        }
        return previewFallback(target, message, contentType);
      }

      // Some protected sites still return a readable HTML error page that contains
      // a useful title, canonical URL or image metadata. Parse that body before
      // falling back to a plain domain-only pin so difficult URLs still feel useful.
      if (
        contentType.includes("text/html") ||
        contentType.includes("application/xhtml")
      ) {
        try {
          const html = await response.clone().text();
          const $ = cheerio.load(html);
          const rawTitle =
            $('meta[property="og:title"]').attr("content") ||
            $('meta[name="twitter:title"]').attr("content") ||
            $("title").first().text() ||
            null;
          const rawDescription =
            $('meta[property="og:description"]').attr("content") ||
            $('meta[name="description"]').attr("content") ||
            $('meta[name="twitter:description"]').attr("content") ||
            null;
          const title = cleanPreviewTitle(rawTitle, target);
          const description = cleanPreviewDescription(rawDescription);
          const images = collectPreviewImages($, html, target, target);
          const favicon =
            absoluteUrl(
              $('link[rel="apple-touch-icon"]').attr("href"),
              target,
            ) ||
            absoluteUrl($('link[rel="icon"]').attr("href"), target) ||
            absoluteUrl("/favicon.ico", target);
          return NextResponse.json({
            url: target.toString(),
            title,
            description: description || fallbackWarningFor(target, message),
            favicon,
            source: sourceName(target),
            mediaKind: youtubeEmbed(target.toString())
              ? "video"
              : inferMediaKind(target.toString(), contentType, null),
            contentType,
            suggestedTags: autoTags(
              `${title ?? ""} ${description ?? ""} ${sourceName(target)} ${target.pathname}`,
            ).slice(0, 7),
            images: images.slice(0, 20),
            videoEmbedUrl: youtubeEmbed(target.toString()),
            previewWarning: message,
          });
        } catch {
          // fall through to domain fallback
        }
      }
      return previewFallback(target, message, contentType);
    }

    const mediaKindFromHeader = inferMediaKind(
      target.toString(),
      contentType,
      null,
    );
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      const directImages = contentType.startsWith("image/") || isLikelyImageUrl(target.toString()) ? [target.toString()] : [];
      return NextResponse.json({
        url: target.toString(),
        title: niceTitleFromUrl(target),
        description: null,
        favicon: absoluteUrl("/favicon.ico", target),
        source: sourceName(target),
        mediaKind: directImages.length ? "image" : mediaKindFromHeader,
        contentType,
        suggestedTags: autoTags(
          `${sourceName(target)} ${target.pathname}`,
        ).slice(0, 7),
        images: directImages,
        videoEmbedUrl: youtubeEmbed(target.toString()),
      });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const pageBase = base ?? target;
    const rawTitle =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("title").first().text() ||
      null;
    const rawDescription =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content") ||
      null;
    if (isSuperhive(target) && isProtectedTitle(rawTitle)) {
      const protectedImages = collectPreviewImages($, html, pageBase, target);
      return previewFallback(
        target,
        "Automatische Vorschau wurde von der Website blockiert. Manuelles Speichern bleibt möglich.",
        contentType,
        protectedImages,
      );
    }
    const title = cleanPreviewTitle(rawTitle, target);
    const description = cleanPreviewDescription(rawDescription);
    const ogType = $('meta[property="og:type"]').attr("content") || "";
    const images = collectPreviewImages($, html, pageBase, target);

    const favicon =
      absoluteUrl($('link[rel="apple-touch-icon"]').attr("href"), pageBase) ||
      absoluteUrl($('link[rel="icon"]').attr("href"), pageBase) ||
      absoluteUrl($('link[rel="shortcut icon"]').attr("href"), pageBase) ||
      absoluteUrl("/favicon.ico", target);
    const mediaKind =
      youtubeEmbed(target.toString()) || ogType.includes("video")
        ? "video"
        : inferMediaKind(target.toString(), contentType, null);
    const suggestedTags = autoTags(
      `${title ?? ""} ${description ?? ""} ${sourceName(target)} ${target.pathname}`,
    ).slice(0, 7);

    return NextResponse.json({
      url: target.toString(),
      title,
      description: description || null,
      favicon,
      source: sourceName(target),
      mediaKind,
      contentType,
      suggestedTags,
      images: images.slice(0, 60),
      videoEmbedUrl: youtubeEmbed(target.toString()),
    });
  } catch (error) {
    return previewFallback(
      target,
      error instanceof Error ? error.message : "Preview fehlgeschlagen",
    );
  }
}
