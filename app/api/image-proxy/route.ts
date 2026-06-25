import { NextResponse } from 'next/server';
import { parseHttpUrl } from '@/lib/url-security';
import { fetchPublicImage } from '@/lib/server-image';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const value = requestUrl.searchParams.get('url');
  const referer = requestUrl.searchParams.get('referer') || requestUrl.searchParams.get('page') || null;
  if (!value) return NextResponse.json({ error: 'Bild-URL fehlt.' }, { status: 400 });

  try {
    parseHttpUrl(value);
    if (referer) parseHttpUrl(referer);
    const image = await fetchPublicImage(value, { pageUrl: referer, maxBytes: 20 * 1024 * 1024 });
    return new NextResponse(image.buffer, {
      status: 200,
      headers: {
        'content-type': image.contentType,
        'content-length': String(image.bytes),
        'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
        'x-content-type-options': 'nosniff',
        'access-control-allow-origin': '*',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bild konnte nicht geladen werden.' }, { status: 502 });
  }
}
