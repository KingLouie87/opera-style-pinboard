export function isHttpImageUrl(value: string | undefined | null) {
  if (!value) return false;
  try {
    const original = unproxiedImageUrl(value);
    const url = new URL(original.startsWith('//') ? `https:${original}` : original);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isAppServedImage(value: string | undefined | null) {
  if (!value) return false;
  return (
    value.startsWith('/api/images/') ||
    value.startsWith('/api/files/') ||
    value.startsWith('/api/image-proxy') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  );
}

export function unproxiedImageUrl(value: string | undefined | null) {
  if (!value) return '';
  if (!value.startsWith('/api/image-proxy')) return value;
  try {
    const parsed = new URL(value, 'https://pinboard.local');
    return parsed.searchParams.get('url') || value;
  } catch {
    return value;
  }
}

export function proxiedImageUrl(value: string | undefined | null, pageUrl?: string | null) {
  if (!value) return '';
  if (value.startsWith('/api/image-proxy')) return value;
  if (value.startsWith('/api/images/') || value.startsWith('/api/files/') || value.startsWith('data:') || value.startsWith('blob:')) return value;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  let original = unproxiedImageUrl(value);
  if (original.startsWith('//')) original = `https:${original}`;
  if (!isHttpImageUrl(original)) return original;
  const params = new URLSearchParams({ url: original });
  if (pageUrl && /^https?:\/\//i.test(pageUrl)) params.set('referer', pageUrl);
  return `/api/image-proxy?${params.toString()}`;
}

export function directImageUrl(value: string | undefined | null) {
  const original = unproxiedImageUrl(value);
  return original.startsWith('//') ? `https:${original}` : original;
}

export function sameImageReference(a: string | undefined | null, b: string | undefined | null) {
  if (!a || !b) return false;
  if (a === b) return true;
  return directImageUrl(a) === directImageUrl(b);
}
