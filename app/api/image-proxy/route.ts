import { NextResponse } from 'next/server';
import { parseHttpUrl, safeFetch } from '@/lib/url-security';

export const runtime = 'nodejs';

function imageRequestHeaders(target: URL) {
  return {
    accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/png,image/jpeg,image/gif,*/*;q=0.8',
    referer: `${target.origin}/`,
    'sec-fetch-dest': 'image',
    'sec-fetch-mode': 'no-cors',
    'sec-fetch-site': 'cross-site',
  };
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const value = requestUrl.searchParams.get('url');
  if (!value) return NextResponse.json({ error: 'Bild-URL fehlt.' }, { status: 400 });

  let target: URL;
  try {
    target = parseHttpUrl(value);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ungültige Bild-URL.' }, { status: 400 });
  }

  try {
    const response = await safeFetch(target.toString(), { headers: imageRequestHeaders(target) });
    if (!response.ok) return NextResponse.json({ error: `Bild konnte nicht geladen werden (${response.status}).` }, { status: 502 });

    const contentType = response.headers.get('content-type') || '';
    if (contentType && !contentType.toLowerCase().startsWith('image/')) {
      return NextResponse.json({ error: 'Antwort ist kein Bild.' }, { status: 415 });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'Bild ist zu groß.' }, { status: 413 });
    }

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'content-type': contentType || 'image/jpeg',
        'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bild konnte nicht geladen werden.' }, { status: 502 });
  }
}
