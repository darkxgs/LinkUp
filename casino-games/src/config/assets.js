/** قاعدة مسارات الأصول على Firebase Hosting */
export const CASINO_BASE = '/games/casino';

/** يبني مساراً كاملاً تحت /games/casino */
export function casinoAsset(path) {
  if (!path) return CASINO_BASE;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${CASINO_BASE}${p}`;
}
