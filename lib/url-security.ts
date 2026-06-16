import dns from 'dns/promises';
import net from 'net';

const privateCidrs = [
  ['10.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['0.0.0.0', 8]
] as const;

function ipToNumber(ip: string) {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isPrivateIp(ip: string) {
  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return true;
  if (!net.isIPv4(ip)) return false;
  const numeric = ipToNumber(ip);
  return privateCidrs.some(([range, bits]) => {
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return (numeric & mask) === (ipToNumber(range) & mask);
  });
}

export function parseHttpUrl(value: string) {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Nur HTTP- und HTTPS-Links sind erlaubt.');
  url.hash = '';
  return url;
}

export async function assertPublicHostname(url: URL) {
  if (url.hostname === 'localhost') throw new Error('Lokale URLs sind nicht erlaubt.');
  if (net.isIP(url.hostname) && isPrivateIp(url.hostname)) throw new Error('Interne URLs sind nicht erlaubt.');
  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some(record => isPrivateIp(record.address))) throw new Error('Interne oder private Zieladressen sind blockiert.');
}

export async function safeFetch(url: string, init?: RequestInit) {
  const parsed = parseHttpUrl(url);
  await assertPublicHostname(parsed);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8500);
  try {
    return await fetch(parsed.toString(), {
      ...init,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 PinboardPreview/1.0',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
        'accept-language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        ...(init?.headers ?? {})
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}
