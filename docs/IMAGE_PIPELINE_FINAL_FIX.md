# Image pipeline final fix

## Root cause addressed

The app was already finding image candidates on many pages, but the UI displayed broken tiles because many remote image URLs cannot be hotlinked directly. Some candidates also need a page referer or return `application/octet-stream` while still containing valid image bytes.

## What changed

- Centralized remote image display now goes through `RemoteImage`.
- `RemoteImage` tries the app image proxy first and falls back to the direct URL only if the proxy fails.
- Broken candidates are removed from the image picker after both proxy and direct display fail.
- The image proxy now accepts an optional `referer`/`page` parameter and uses image-specific request headers.
- The image proxy validates image bytes by magic signature, not only by `Content-Type`.
- `cache-image` uses the same image fetcher as the proxy and keeps the raw remote image when caching fails.
- Pins store the original image URL where possible; display uses the proxy dynamically.
- Existing boards, pins, header, mobile layout, capture flow and Supabase schema were left unchanged.

## Manual QA helper

Run the 20+ domain QA helper while logged in locally:

```bash
PINBOARD_COOKIE='copy-your-local-app-cookie-here' node scripts/test-link-images.mjs http://localhost:3000
```

The script checks `/api/link-preview`, counts image candidates and verifies that the first candidate can be delivered through `/api/image-proxy` with an image content type.

## Required UI QA

For each critical domain, verify:

- Images appear in the cover picker.
- No broken image tiles remain after loading.
- Selecting an image updates the cover preview.
- Saving the pin keeps the cover.
- The saved pin card displays the cover after reload.
