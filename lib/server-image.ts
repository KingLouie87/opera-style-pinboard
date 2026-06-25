import { parseHttpUrl, safeFetch } from './url-security';

export type FetchedImage = {
  url: string;
  buffer: Buffer;
  contentType: string;
  bytes: number;
};

function sniffImageContentType(buffer: Buffer, fallback?: string | null) {
  const lower = (fallback || '').toLowerCase();
  if (lower.startsWith('image/')) return lower.split(';')[0];
  if (buffer.length >= 12) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    if (buffer.toString('ascii', 4, 12).includes('ftypavif')) return 'image/avif';
  }
  const head = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<svg') || head.includes('<svg')) return 'image/svg+xml';
  return lower || 'application/octet-stream';
}

function unique(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function originFromUrl(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = parseHttpUrl(value);
    return `${parsed.origin}/`;
  } catch {
    return null;
  }
}

function imageHeaders(target: URL, referer?: string | null) {
  const headers: Record<string, string> = {
    accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/png,image/jpeg,image/gif,image/*,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9,de-DE;q=0.8,de;q=0.7',
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    'sec-fetch-dest': 'image',
    'sec-fetch-mode': 'no-cors',
    'sec-fetch-site': 'cross-site',
  };
  if (referer) headers.referer = referer;
  // Some CDNs behave better when the request has an Origin consistent with the referer.
  if (referer) {
    try { headers.origin = new URL(referer).origin; } catch {}
  }
  return headers;
}

function pinterestReferers(pageUrl?: string | null) {
  const referers: string[] = [];
  const pageOrigin = originFromUrl(pageUrl);
  if (pageUrl && /pinterest\./i.test(pageUrl) && pageOrigin) referers.push(pageOrigin);
  referers.push('https://www.pinterest.com/', 'https://de.pinterest.com/');
  return referers.filter(Boolean);
}

export async function fetchPublicImage(imageUrl: string, options?: { pageUrl?: string | null; maxBytes?: number }) {
  const target = parseHttpUrl(imageUrl);
  const maxBytes = options?.maxBytes ?? 20 * 1024 * 1024;
  const referers = unique([
    originFromUrl(options?.pageUrl),
    ...pinterestReferers(options?.pageUrl),
    `${target.origin}/`,
    null,
  ]);

  let lastError: Error | null = null;
  for (const referer of referers.length ? referers : [null]) {
    try {
      const response = await safeFetch(target.toString(), { headers: imageHeaders(target, referer) });
      if (!response.ok) {
        lastError = new Error(`Bild konnte nicht geladen werden (${response.status}).`);
        continue;
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.byteLength > maxBytes) throw new Error('Bild ist zu groß.');
      const contentType = sniffImageContentType(buffer, response.headers.get('content-type'));
      if (!contentType.startsWith('image/')) {
        lastError = new Error('Antwort ist kein Bild.');
        continue;
      }
      return { url: target.toString(), buffer, contentType, bytes: buffer.byteLength } satisfies FetchedImage;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Bild konnte nicht geladen werden.');
    }
  }
  throw lastError || new Error('Bild konnte nicht geladen werden.');
}
