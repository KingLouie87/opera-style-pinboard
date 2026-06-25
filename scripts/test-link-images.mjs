#!/usr/bin/env node
/**
 * Manual QA helper for the Pinboard image pipeline.
 *
 * Usage while logged into the local app:
 *   1. Open DevTools on http://localhost:3000, copy the Cookie header for the app.
 *   2. Run:
 *      PINBOARD_COOKIE='sb-...=...' node scripts/test-link-images.mjs http://localhost:3000
 *
 * The /api/link-preview route is intentionally authenticated, so the cookie is required.
 */

const appBase = (process.argv[2] || process.env.PINBOARD_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const cookie = process.env.PINBOARD_COOKIE || '';

const urls = [
  'https://www.blender.org',
  'https://github.com',
  'https://www.youtube.com',
  'https://www.wikipedia.org',
  'https://www.artstation.com',
  'https://www.behance.net',
  'https://www.pinterest.com',
  'https://de.pinterest.com',
  'https://superhivemarket.com',
  'https://sketchfab.com',
  'https://www.cgtrader.com',
  'https://www.turbosquid.com',
  'https://www.unrealengine.com/marketplace',
  'https://www.fab.com',
  'https://www.adobe.com',
  'https://www.figma.com/community',
  'https://dribbble.com',
  'https://www.awwwards.com',
  'https://www.notion.so',
  'https://medium.com',
  'https://superhivemarket.com/products/industrial-decoration-asset-pack-greebles-kitbash',
  'https://superhivemarket.com/products/tracked-crawler-heavy-duty-industrial-load-carrier-robot-3d-model',
  'https://de.pinterest.com/pin/985231165616861/',
];

async function analyze(url) {
  const response = await fetch(`${appBase}/api/link-preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ url }),
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { error: text.slice(0, 180) }; }
  return { ok: response.ok, status: response.status, json };
}

async function proxyStatus(imageUrl, pageUrl) {
  if (!imageUrl) return 'no-image';
  const params = new URLSearchParams({ url: imageUrl, referer: pageUrl });
  const response = await fetch(`${appBase}/api/image-proxy?${params.toString()}`);
  const contentType = response.headers.get('content-type') || '';
  return `${response.status} ${contentType}`;
}

let usable = 0;
for (const url of urls) {
  try {
    const result = await analyze(url);
    const images = Array.isArray(result.json.images) ? result.json.images : [];
    const first = images[0] || '';
    const proxy = first ? await proxyStatus(first, result.json.url || url) : 'no-image';
    const proxyOk = proxy.startsWith('200 ') && proxy.includes('image/');
    if (images.length > 0 && proxyOk) usable += 1;
    console.log(JSON.stringify({
      url,
      status: result.status,
      title: result.json.title || null,
      images: images.length,
      firstImage: first || null,
      proxy,
      pass: images.length > 0 && proxyOk,
      warning: result.json.previewWarning || result.json.error || null,
    }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ url, pass: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  }
}

console.log(`\nImage pipeline result: ${usable}/${urls.length} URLs returned at least one proxied image with image/* content-type.`);
if (usable < 18) process.exitCode = 1;
