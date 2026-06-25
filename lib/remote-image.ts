export function isHttpImageUrl(value: string | undefined | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
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

export function proxiedImageUrl(value: string | undefined | null) {
  if (!value) return '';
  if (isAppServedImage(value) || value.startsWith('/')) return value;
  if (!isHttpImageUrl(value)) return value;
  return `/api/image-proxy?url=${encodeURIComponent(value)}`;
}

export function sameImageReference(a: string | undefined | null, b: string | undefined | null) {
  if (!a || !b) return false;
  if (a === b) return true;
  return proxiedImageUrl(a) === proxiedImageUrl(b);
}
