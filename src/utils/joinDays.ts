/** تحويل createdAt من Firestore (رقم أو Timestamp) إلى milliseconds */
export function parseTimestampMs(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'object' && raw !== null) {
    if ('toMillis' in raw && typeof (raw as { toMillis: () => number }).toMillis === 'function') {
      return (raw as { toMillis: () => number }).toMillis();
    }
    if ('seconds' in raw && typeof (raw as { seconds: number }).seconds === 'number') {
      return (raw as { seconds: number }).seconds * 1000;
    }
    if ('_seconds' in raw && typeof (raw as { _seconds: number })._seconds === 'number') {
      return (raw as { _seconds: number })._seconds * 1000;
    }
  }
  const d = new Date(raw as string | number);
  return Number.isFinite(d.getTime()) ? d.getTime() : 0;
}

/** عدد الأيام منذ التسجيل (1 كحد أدنى عند وجود تاريخ صالح، 0 إذا غير معروف) */
export function getJoinDays(createdAt: unknown): number {
  const ms = parseTimestampMs(createdAt);
  if (!ms) return 0;
  return Math.max(1, Math.floor((Date.now() - ms) / 86400000));
}
