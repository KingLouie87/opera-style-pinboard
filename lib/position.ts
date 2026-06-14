export function normalizePositions<T extends { position: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, position: (index + 1) * 1000 }));
}

export function nextPosition(items: { position: number }[]) {
  if (!items.length) return 1000;
  return Math.max(...items.map(item => Number(item.position || 0))) + 1000;
}
