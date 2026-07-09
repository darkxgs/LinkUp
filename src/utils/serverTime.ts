/**
 * وقت السيرفر (Firebase RTDB) — يمنع التلاعب بساعة الجهاز.
 */
import { ref, onValue } from 'firebase/database';
import { realtimeDb } from '@/services/firebase';

let serverTimeOffsetMs = 0;
let offsetSubscribed = false;
let offsetReady: Promise<void> | null = null;

function subscribeServerTimeOffset(): void {
  if (offsetSubscribed) return;
  offsetSubscribed = true;
  try {
    onValue(ref(realtimeDb, '.info/serverTimeOffset'), (snap) => {
      const v = snap.val();
      if (typeof v === 'number') serverTimeOffsetMs = v;
    });
  } catch {
    // ignore
  }
}

/** ينتظر أول مزامنة لفرق الساعة (أو مهلة قصيرة) */
export async function ensureServerTimeOffsetReady(timeoutMs = 4000): Promise<void> {
  subscribeServerTimeOffset();
  if (serverTimeOffsetMs !== 0) return;
  if (!offsetReady) {
    offsetReady = new Promise((resolve) => {
      const timer = setTimeout(() => resolve(), timeoutMs);
      try {
        onValue(
          ref(realtimeDb, '.info/serverTimeOffset'),
          (snap) => {
            const v = snap.val();
            if (typeof v === 'number') {
              serverTimeOffsetMs = v;
              clearTimeout(timer);
              resolve();
            }
          },
          { onlyOnce: true },
        );
      } catch {
        clearTimeout(timer);
        resolve();
      }
    });
  }
  await offsetReady;
}

export const serverNow = (): number => {
  subscribeServerTimeOffset();
  return Date.now() + serverTimeOffsetMs;
};

/** مفتاح اليوم بتوقيت UTC — يطابق السيرفر */
export function getUtcDateKey(ms: number = serverNow()): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** الميلي ثانية حتى منتصف الليل UTC */
export function getMsUntilNextUtcDay(ms: number = serverNow()): number {
  const d = new Date(ms);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(0, next - ms);
}
