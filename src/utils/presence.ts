/**
 * حضور المستخدم — تحويل lastSeen واعتبار المتصل
 */

/** يطابق UserHeartbeat (كل دقيقتين) */
export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

export function parseLastSeen(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 1e12 ? raw : raw * 1000;
  }
  if (typeof raw === 'object') {
    const o = raw as { toMillis?: () => number; seconds?: number };
    if (typeof o.toMillis === 'function') return o.toMillis();
    if (typeof o.seconds === 'number') return o.seconds * 1000;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function isUserOnline(lastSeenMs: number, now = Date.now()): boolean {
  return lastSeenMs > 0 && now - lastSeenMs < ONLINE_THRESHOLD_MS;
}

type TranslateFn = (key: string, opts?: Record<string, unknown>) => string;

/** نص وقت آخر ظهور — للعرض مع chat.lastSeen */
export function formatLastSeenTime(
  lastSeenMs: number,
  locale: string,
  t: TranslateFn,
  now = Date.now(),
): string {
  if (!lastSeenMs) return '';

  const lang = locale.startsWith('ar') ? 'ar-SA' : 'en-US';
  const date = new Date(lastSeenMs);
  const clock = date.toLocaleTimeString(lang, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const today = new Date(now);
  if (date.toDateString() === today.toDateString()) {
    return clock;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `${t('time.yesterday')} ${clock}`;
  }

  const diffDays = Math.max(1, Math.floor((now - lastSeenMs) / (24 * 60 * 60 * 1000)));
  if (diffDays < 7) {
    return `${t('time.daysAgo', { count: diffDays })} · ${clock}`;
  }

  const datePart = date.toLocaleDateString(lang, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
  return `${datePart} · ${clock}`;
}

/** أحدث طابع من Firestore و RTDB */
export function resolveLastSeenMs(
  firestoreLastSeen: unknown,
  rtdbLastSeen?: number,
): number {
  const a = parseLastSeen(firestoreLastSeen);
  const b = rtdbLastSeen ?? 0;
  return Math.max(a, b);
}
