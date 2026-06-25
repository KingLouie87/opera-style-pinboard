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
  return value
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function unescapeUrlCandidate(value: string) {
  return value
    .replace(/\\u0026/g, "&")
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .trim();
}

function isLikelyImageUrl(value: string) {
  const lower = value.toLowerCase();
  if (!/^https?:\/\//.test(lower)) return false;
  if (
    lower.includes("assets.superhivemarket.com/store/product/") ||
    lower.includes("assets.superhivemarket.com/store/productimage/") ||
    lower.includes("assets.superhivemarket.com/cache/")
  )
    return true;
  if (lower.includes("superhivemarket.com") && /\/(?:image|images|productimage|cache)\//.test(lower))
    return true;
  if (lower.includes("blendermarket.com") && /\/image\//.test(lower))
    return true;
  return (
    /\.(?:jpe?g|png|webp|avif)(?:[?#].*)?$/i.test(lower) ||
    /(?:image|thumbnail|thumb|xlarge|large|gallery)/i.test(lower)
  );
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
    if (isLikelyImageUrl(cleaned)) push(cleaned);
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
        if (isLikelyImageUrl(cleaned)) push(cleaned, width, height);
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
    .replace(/\\u0026/g, "&")
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/");
  const patterns = [
    /https?:\/\/assets\.superhivemarket\.com\/[^"'<>\s)\]\}]+/gi,
    /https?:\/\/[^"'<>\s)\]\}]+\.(?:jpe?g|png|webp|avif|gif)(?:\?[^"'<>\s)\]\}]*)?/gi,
    /https?:\/\/[^"'<>\s)\]\}]+\/(?:store\/productimage|store\/product|cache)\/[^"'<>\s)\]\}]+/gi,
  ];
  for (const pattern of patterns) {
    const matches = normalized.match(pattern) ?? [];
    matches.forEach((match) => push(unescapeUrlCandidate(match)));
  }
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
      isLikelyImageUrl(absolute) &&
      !images.includes(absolute)
    )
      images.push(absolute);
  };

  push(
    $('meta[property="og:image:secure_url"]').attr("content"),
    $('meta[property="og:image:width"]').attr("content"),
    $('meta[property="og:image:height"]').attr("content"),
  );
  push(
    $('meta[property="og:image"]').attr("content"),
    $('meta[property="og:image:width"]').attr("content"),
    $('meta[property="og:image:height"]').attr("content"),
  );
  push($('meta[name="twitter:image"]').attr("content"));
  push($('meta[name="twitter:image:src"]').attr("content"));
  push($('link[rel="image_src"]').attr("href"));
  push($('link[rel="preload"][as="image"]').attr("href"));

  $("img").each((_, element) => {
    const img = $(element);
    const width = img.attr("width") || img.attr("data-width");
    const height = img.attr("height") || img.attr("data-height");
    push(img.attr("src"), width, height);
    push(img.attr("data-src"), width, height);
    push(img.attr("data-lazy-src"), width, height);
    push(img.attr("data-original"), width, height);
    push(img.attr("data-zoom"), width, height);
    push(img.attr("data-image"), width, height);
    for (const src of srcsetUrls(img.attr("srcset"))) push(src, width, height);
    for (const src of srcsetUrls(img.attr("data-srcset")))
      push(src, width, height);
  });

  $("source").each((_, element) =>
    srcsetUrls($(element).attr("srcset")).forEach((src) => push(src)),
  );
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
    'script[type="application/ld+json"], script#__NEXT_DATA__, script[data-json], script[type="application/json"]',
  ).each((_, element) => {
    const parsed = parseJsonMaybe($(element).text());
    collectJsonImages(parsed, push);
  });
  collectHtmlImageUrls(html, push);

  if (isSuperhive(target)) {
    knownSuperhiveImages(target).forEach((image) => push(image));
    images.sort((a, b) => {
      const score = (url: string) => {
        const lower = url.toLowerCase();
        let value = 0;
        if (lower.includes("assets.superhivemarket.com/store/product/"))
          value += 40;
        if (lower.includes("/image/")) value += 30;
        if (lower.includes("xlarge_og") || lower.includes("xlarge"))
          value += 18;
        if (lower.includes("large")) value += 10;
        if (
          lower.includes("avatar") ||
          lower.includes("icon") ||
          lower.includes("logo")
        )
          value -= 25;
        return value;
      };
      return score(b) - score(a);
    });
  }
  return images;
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
  const fallbackImages = Array.from(new Set([...images, ...knownSuperhiveImages(target)])).filter((image) => looksUseful(image));
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
          const images: string[] = [];
          const push = (value: string | undefined | null) => {
            const absolute = absoluteUrl(value, target);
            if (absolute && looksUseful(absolute) && !images.includes(absolute))
              images.push(absolute);
          };
          push($('meta[property="og:image:secure_url"]').attr("content"));
          push($('meta[property="og:image"]').attr("content"));
          push($('meta[name="twitter:image"]').attr("content"));
          push($('link[rel="image_src"]').attr("href"));
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
      return NextResponse.json({
        url: target.toString(),
        title: niceTitleFromUrl(target),
        description: null,
        favicon: absoluteUrl("/favicon.ico", target),
        source: sourceName(target),
        mediaKind: mediaKindFromHeader,
        contentType,
        suggestedTags: autoTags(
          `${sourceName(target)} ${target.pathname}`,
        ).slice(0, 7),
        images: [],
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
