/** تحويل قيم Firebase (قد تكون نصاً أو null) إلى عدد صحيح آمن للعرض */
export function toSafeInt(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}
