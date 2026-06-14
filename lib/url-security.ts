import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_REDIRECTS = 3;

export function parseHttpUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Ungültige URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Nur HTTP- und HTTPS-Links sind erlaubt.');
  }

  if (!url.hostname || url.username || url.password) {
    throw new Error('Diese URL wird aus Sicherheitsgründen nicht akzeptiert.');
  }

  return url;
}

function ipToNumber(ip: string) {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inRange(ip: string, cidr: string) {
  const [range, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipToNumber(ip) & mask) === (ipToNumber(range) & mask);
}

export function isPrivateAddress(address: string) {
  const family = net.isIP(address);
  if (family === 4) {
    return [
      '0.0.0.0/8',
      '10.0.0.0/8',
      '100.64.0.0/10',
      '127.0.0.0/8',
      '169.254.0.0/16',
      '172.16.0.0/12',
      '192.0.0.0/24',
      '192.168.0.0/16',
      '198.18.0.0/15',
      '224.0.0.0/4',
      '240.0.0.0/4'
    ].some(cidr => inRange(address, cidr));
  }

  if (family === 6) {
    const value = address.toLowerCase();
    return (
      value === '::1' ||
      value === '::' ||
      value.startsWith('fc') ||
      value.startsWith('fd') ||
      value.startsWith('fe80:') ||
      value.startsWith('ff')
    );
  }

  return true;
}

export async function assertPublicUrl(url: URL) {
  const hostname = url.hostname;
  const directIp = net.isIP(hostname);

  if (directIp && isPrivateAddress(hostname)) {
    throw new Error('Private IP-Adressen sind nicht erlaubt.');
  }

  if (!directIp) {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(entry => isPrivateAddress(entry.address))) {
      throw new Error('Die Domain zeigt auf eine nicht erlaubte Adresse.');
    }
  }
}

export async function safeFetch(input: string, init?: RequestInit, redirects = 0): Promise<Response> {
  if (redirects > MAX_REDIRECTS) {
    throw new Error('Zu viele Weiterleitungen.');
  }

  const url = parseHttpUrl(input);
  await assertPublicUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url.toString(), {
      ...init,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': 'OperaStylePinboardPreview/0.1 (+https://example.local)',
        accept: 'text/html,application/xhtml+xml,image/avif,image/webp,image/png,image/jpeg,*/*;q=0.7',
        ...(init?.headers || {})
      }
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Weiterleitung ohne Ziel.');
      const nextUrl = new URL(location, url).toString();
      return safeFetch(nextUrl, init, redirects + 1);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}
