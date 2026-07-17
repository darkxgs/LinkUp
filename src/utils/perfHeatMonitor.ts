/**
 * مرقاب الحرارة والأداء — وضع التطوير فقط.
 *
 * يطبع كل 10 ثوانٍ سطر «[heat] …» موجزاً في الكونسول يكشف المصادر الشائعة
 * لسخونة الهاتف وبطئه:
 *  - انشغال خيط JS (تأخر نبضة 500ms عن موعدها) — التقطيع والحسابات الثقيلة.
 *  - عدد المؤقتات الحية (intervals) مع أسماء منشئيها — التسريبات تستنزف البطارية.
 *  - عدد المهلات المعلّقة (timeouts) — تراكمها مؤشر حلقات إعادة جدولة.
 *  - معدل الإطارات التقريبي (عينة ثانية واحدة كل دورة — لا حلقة rAF دائمة).
 *
 * لا يعمل في نسخ الإنتاج (__DEV__ فقط من نقطة التركيب) ولا يضيف أي حمل يُذكر.
 */
import { AppState } from 'react-native';

type IntervalInfo = { tag: string; ms: number };

const liveIntervals = new Map<number, IntervalInfo>();
const liveTimeouts = new Set<number>();
let patched = false;
let started = false;
let lags: number[] = [];

// إطارات داخلية (React/Metro) لا تدل على المنشئ الحقيقي — نتخطاها لأقرب اسم تطبيقي
const INTERNAL_FRAMES = [
  'perfHeatMonitor',
  'commitHookEffectList',
  'commitPassiveMount',
  'loadModuleImplementation',
  'guardedLoadModule',
  'metroRequire',
  'requireImpl',
  'flushPassiveEffects',
  'invokePassiveEffect',
  'callFunctionReturnFlushedQueue',
];

/** اسم الدالة المنشئة من الـstack — في وضع التطوير الأسماء غير مصغّرة */
function callerTag(): string {
  const stack = new Error().stack ?? '';
  const lines = stack.split('\n').slice(2, 14);
  let fallback = 'anonymous';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const fn = line.replace(/^at\s+/, '').split(' ')[0];
    if (!fn || fn === 'anonymous' || fn.startsWith('http')) continue;
    if (INTERNAL_FRAMES.some((f) => fn.includes(f))) {
      if (fallback === 'anonymous') fallback = fn.slice(0, 48);
      continue;
    }
    return fn.slice(0, 48);
  }
  return fallback;
}

function patchTimers(): void {
  if (patched) return;
  patched = true;
  const g = globalThis as Record<string, any>;
  const origSetInterval = g.setInterval?.bind(g);
  const origClearInterval = g.clearInterval?.bind(g);
  const origSetTimeout = g.setTimeout?.bind(g);
  const origClearTimeout = g.clearTimeout?.bind(g);
  if (!origSetInterval || !origClearInterval || !origSetTimeout || !origClearTimeout) return;

  g.setInterval = (fn: (...a: unknown[]) => void, ms?: number, ...rest: unknown[]) => {
    const id = origSetInterval(fn, ms, ...rest);
    liveIntervals.set(Number(id), { tag: callerTag(), ms: Number(ms) || 0 });
    return id;
  };
  g.clearInterval = (id: unknown) => {
    liveIntervals.delete(Number(id));
    return origClearInterval(id);
  };
  g.setTimeout = (fn: (...a: unknown[]) => void, ms?: number, ...rest: unknown[]) => {
    let idNum = -1;
    const id = origSetTimeout(
      (...a: unknown[]) => {
        liveTimeouts.delete(idNum);
        fn(...a);
      },
      ms,
      ...rest,
    );
    idNum = Number(id);
    liveTimeouts.add(idNum);
    return id;
  };
  g.clearTimeout = (id: unknown) => {
    liveTimeouts.delete(Number(id));
    return origClearTimeout(id);
  };
}

/** أعلى منشئي المؤقتات الحية — مجمّعة بالاسم */
function topIntervalTags(max = 4): string {
  const counts = new Map<string, number>();
  for (const info of liveIntervals.values()) {
    if (info.tag.includes('perfHeatMonitor') || info.tag.includes('startPerfHeatMonitor')) continue;
    counts.set(info.tag, (counts.get(info.tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([tag, n]) => (n > 1 ? `${tag}×${n}` : tag))
    .join('، ') || 'لا شيء';
}

const HEARTBEAT_MS = 500;
const REPORT_MS = 10_000;

export function startPerfHeatMonitor(): void {
  if (started) return;
  started = true;
  patchTimers();

  // نبضة قياس انشغال خيط JS — الانحراف عن الموعد = مدة انسداد الخيط
  let expected = Date.now() + HEARTBEAT_MS;
  setInterval(() => {
    const now = Date.now();
    lags.push(Math.max(0, now - expected));
    expected = now + HEARTBEAT_MS;
  }, HEARTBEAT_MS);

  setInterval(() => {
    const window = lags;
    lags = [];
    const avg = window.length ? Math.round(window.reduce((a, b) => a + b, 0) / window.length) : 0;
    const max = window.length ? Math.max(...window) : 0;

    // عيّنة إطارات لثانية واحدة فقط — بلا حلقة rAF دائمة تستهلك بنفسها
    let frames = 0;
    const t0 = Date.now();
    const raf = globalThis.requestAnimationFrame?.bind(globalThis);
    const sample = () => {
      frames += 1;
      if (Date.now() - t0 < 1000 && raf) raf(sample);
      else {
        const fps = Math.min(60, frames);
        const intervals = Math.max(0, liveIntervals.size - 2); // باستثناء مؤقّتَي المرقاب
        console.log(
          `[heat] JS-lag متوسط ${avg}ms أقصى ${max}ms | إطارات ~${fps}fps | ` +
            `مؤقتات حية ${intervals} (أعلى المنشئين: ${topIntervalTags()}) | ` +
            `مهلات معلّقة ${liveTimeouts.size} | الحالة ${AppState.currentState}`,
        );
        if (max >= 1000) {
          console.warn(
            `[heat] ⚠️ خيط JS انسدّ ${max}ms خلال آخر 10ث — افتح/اقفل الشاشة الحالية وراقب أي سطر يتكرر معها`,
          );
        }
      }
    };
    if (raf) raf(sample);
  }, REPORT_MS);

  console.log('[heat] مرقاب الحرارة يعمل — سطر كل 10 ثوانٍ. ابعث السطور المرتفعة للمطوّر.');
}
