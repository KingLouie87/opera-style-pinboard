import type { MediaKind } from './types';

export const COLOR_PRESETS = [
  '#8A8F98','#6E7685','#A3A3A3','#C77D5A','#B95F63','#9D6B88','#7D6FB2','#5E6FB8','#497C9F','#3F8F9B',
  '#3B9278','#5D9562','#8E9149','#B38A45','#C47B43','#D45D4C','#9C4B4B','#784F6E','#555A83','#334B69',
  '#2E6670','#2F6B55','#596B36','#78683E','#9C704A','#BD8A6A','#D8BBA1','#B7C2CF','#7F8EA3','#5B6373'
];

const STOP = new Set(['the','and','oder','und','für','mit','von','ein','eine','der','die','das','auf','to','in','of','a','an','is','are','as','im','am','bei','your','you','how','was','ist']);

export function normalizeOptionalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function inferMediaKind(url: string | null | undefined, mime?: string | null, fileName?: string | null): MediaKind {
  const source = `${url ?? ''} ${mime ?? ''} ${fileName ?? ''}`.toLowerCase();
  if (/youtube\.com|youtu\.be|vimeo\.com|\.mp4|\.webm|video\//.test(source)) return 'video';
  if (/\.pdf|application\/pdf/.test(source)) return 'pdf';
  if (/audio\/|\.mp3|\.wav|\.m4a|\.ogg/.test(source)) return 'audio';
  if (/image\/|\.jpg|\.jpeg|\.png|\.webp|\.avif|\.gif/.test(source)) return 'image';
  if (url) return 'webpage';
  return 'file';
}

export function youtubeEmbed(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${parsed.pathname.replace('/','')}?autoplay=1&rel=0`;
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function autoTags(input: string, max = 7) {
  const words = input
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-zäöüß0-9\s-]/gi, ' ')
    .split(/\s+/)
    .map(word => word.trim().replace(/^-|-$/g, ''))
    .filter(word => word.length > 3 && !STOP.has(word));
  const unique = Array.from(new Set(words));
  return unique.slice(0, max);
}

export function formatBytes(bytes?: number | null) {
  if (!bytes) return '';
  const units = ['B','KB','MB','GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
