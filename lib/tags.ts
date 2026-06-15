export function normalizeTag(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9äöüß_-]+/gi, '')
    .slice(0, 28);
}

export function sanitizeTags(input: string | string[] | null | undefined, max = 7) {
  const raw = Array.isArray(input)
    ? input
    : String(input ?? '')
        .split(/[#,;\n\t ]+/)
        .map(part => part.trim());
  const clean = raw.map(normalizeTag).filter(tag => tag.length >= 2);
  return Array.from(new Set(clean)).slice(0, max);
}
