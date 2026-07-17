/**
 * مرقاب الحرارة والأداء — وضع التطوير فقط.
 *
 * يطبع كل 10 ثوانٍ تقريراً «[heat]» يشخّص مصادر سخونة الهاتف وبطئه:
 *  - الشاشة الحالية (لربط أي ارتفاع بمكانه).
 *  - انشغال خيط JS: متوسط/أقصى تأخر نبضة 500ms + نسبة الانشغال الكلية.
 *  - الريندر (React Profiler حول الشجرة): عدد الـcommits، زمنها الكلي، أثقلها.
 *  - الشبكة (fetch/XHR مغلّفان): عدد الطلبات، الحجم التقريبي، أعلى المضيفين.
 *  - المؤقتات الحية بأسماء منشئيها وإيقاعها + معدل جدولة المهلات في النافذة.
 *  - ذاكرة Hermes إن توفرت + معدل الإطارات (عينة ثانية واحدة، لا rAF دائم).
 *
 * لا يعمل في الإنتاج (__DEV__ فقط من نقطة التركيب) وكلفته نفسها شبه معدومة.
 */
import { AppState } from 'react-native';

type IntervalInfo = { tag: string; ms: number };

const liveIntervals = new Map<number, IntervalInfo>();
const liveTimeouts = new Set<number>();
let timeoutsScheduledInWindow = 0;
// منشئو المهلات في النافذة الحالية — يكشف عواصف إعادة الجدولة بالاسم
const timeoutCreators = new Map<string, number>();
let patched = false;
let started = false;
let lags: number[] = [];

// ─── الشاشة الحالية (يضبطها _layout عبر usePathname) ───────────────────────
let currentRoute = '?';
export function setPerfCurrentRoute(route: string | null | undefined): void {
  currentRoute = route || '?';
}

// ─── تجميع الريندر (React Profiler onRender من _layout) ────────────────────
let renderCommits = 0;
let renderTotalMs = 0;
let renderWorstMs = 0;
let renderWorstAtRoute = '';
export function reportRenderCommit(
  _id: string,
  _phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,
): void {
  renderCommits += 1;
  renderTotalMs += actualDuration;
  if (actualDuration > renderWorstMs) {
    renderWorstMs = actualDuration;
    renderWorstAtRoute = currentRoute;
  }
}

// ─── إحصاء الشبكة (fetch + XHR) ─────────────────────────────────────────────
let netRequests = 0;
let netBytes = 0;
const netHosts = new Map<string, number>();

function noteRequest(url: string, bytes: number): void {
  netRequests += 1;
  netBytes += Math.max(0, bytes);
  try {
    const host = url.replace(/^https?:\/\//, '').split('/')[0]?.split(':')[0] ?? '?';
    // اختصار مضيفي جوجل الطويلة لأسماء مقروءة
    const short = host
      .replace('firestore.googleapis.com', 'firestore')
      .replace(/.*firebasestorage.*/, 'storage')
      .replace(/.*firebaseio\.com$/, 'rtdb')
      .replace('firebasedatabase.app', 'rtdb')
      .replace('identitytoolkit.googleapis.com', 'auth')
      .replace('cloudfunctions.net', 'functions');
    netHosts.set(short, (netHosts.get(short) ?? 0) + 1);
  } catch {
    /* لا شيء */
  }
}

function patchNetwork(): void {
  const g = globalThis as Record<string, any>;

  const origFetch = g.fetch?.bind(g);
  if (origFetch) {
    g.fetch = async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : (input?.url ?? '');
      const res = await origFetch(input, init);
      const len = Number(res?.headers?.get?.('content-length')) || 0;
      noteRequest(String(url), len);
      return res;
    };
  }

  const XHR = g.XMLHttpRequest;
  if (XHR?.prototype) {
    const origOpen = XHR.prototype.open;
    const origSend = XHR.prototype.send;
    XHR.prototype.open = function (method: string, url: string, ...rest: unknown[]) {
      (this as any).__heatUrl = String(url ?? '');
      return origOpen.call(this, method, url, ...rest);
    };
    XHR.prototype.send = function (...args: unknown[]) {
      this.addEventListener?.('loadend', () => {
        let len = 0;
        try {
          len = Number(this.getResponseHeader?.('content-length')) || 0;
          if (!len && typeof (this as any).response === 'string') {
            len = (this as any).response.length;
          }
        } catch {
          /* لا شيء */
        }
        noteRequest((this as any).__heatUrl ?? '', len);
      });
      return origSend.apply(this, args as never[]);
    };
  }
}

// ─── وسم منشئ المؤقت من الـstack ────────────────────────────────────────────
// إطارات داخلية (React/Metro) لا تدل على المنشئ الحقيقي — نتخطاها لأقرب اسم تطبيقي
const INTERNAL_FRAMES = [
  'perfHeatMonitor',
  'commitHook',
  'PassiveMount',
  'PassiveEffect',
  'commitLayoutEffect',
  'loadModuleImplementation',
  'guardedLoadModule',
  'metroRequire',
  'requireImpl',
  'flushPassiveEffects',
  'callFunctionReturnFlushedQueue',
  'safelyCall',
  'recursivelyTraverse',
];

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
    timeoutsScheduledInWindow += 1;
    const tag = callerTag();
    timeoutCreators.set(tag, (timeoutCreators.get(tag) ?? 0) + 1);
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

/** أعلى منشئي المؤقتات الحية — مجمّعة بالاسم مع الإيقاع */
function topIntervalTags(max = 5): string {
  const groups = new Map<string, { n: number; ms: number }>();
  for (const info of liveIntervals.values()) {
    if (info.tag.includes('PerfHeatMonitor') || info.tag.includes('perfHeatMonitor')) continue;
    const g = groups.get(info.tag) ?? { n: 0, ms: info.ms };
    g.n += 1;
    g.ms = Math.min(g.ms, info.ms);
    groups.set(info.tag, g);
  }
  const fmtMs = (ms: number) => (ms >= 1000 ? `${Math.round(ms / 1000)}ث` : `${ms}مث`);
  return (
    [...groups.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, max)
      .map(([tag, g]) => `${tag}(${fmtMs(g.ms)})${g.n > 1 ? `×${g.n}` : ''}`)
      .join('، ') || 'لا شيء'
  );
}

function hermesHeapMb(): string {
  try {
    const g = globalThis as Record<string, any>;
    const stats = g.HermesInternal?.getInstrumentedStats?.();
    const bytes =
      Number(stats?.js_allocatedBytes) ||
      Number(stats?.hermes_allocatedBytes) ||
      Number(g.performance?.memory?.usedJSHeapSize) ||
      0;
    return bytes > 0 ? `${(bytes / (1024 * 1024)).toFixed(1)}MB` : '؟';
  } catch {
    return '؟';
  }
}

const HEARTBEAT_MS = 500;
const REPORT_MS = 10_000;

export function startPerfHeatMonitor(): void {
  if (started) return;
  started = true;
  patchTimers();
  patchNetwork();

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
    // نسبة الانشغال: مجموع التأخيرات إلى طول النافذة
    const busyPct = Math.min(99, Math.round((window.reduce((a, b) => a + b, 0) / REPORT_MS) * 100));

    const commits = renderCommits;
    const renderMs = Math.round(renderTotalMs);
    const worstMs = Math.round(renderWorstMs);
    const worstAt = renderWorstAtRoute;
    renderCommits = 0;
    renderTotalMs = 0;
    renderWorstMs = 0;
    renderWorstAtRoute = '';

    const reqs = netRequests;
    const kb = Math.round(netBytes / 1024);
    const hosts = [...netHosts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([h, n]) => `${h}:${n}`)
      .join('، ');
    netRequests = 0;
    netBytes = 0;
    netHosts.clear();

    const timeoutChurn = timeoutsScheduledInWindow;
    timeoutsScheduledInWindow = 0;
    const topTimeoutCreators = [...timeoutCreators.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag, n]) => `${tag}:${n}`)
      .join('، ');
    timeoutCreators.clear();

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
          `[heat] 📍${currentRoute} | JS: متوسط ${avg}ms أقصى ${max}ms انشغال ${busyPct}% | ` +
            `إطارات ~${fps}fps | ريندر: ${commits} commit بمجموع ${renderMs}ms (أثقلها ${worstMs}ms${worstAt && worstAt !== currentRoute ? ` @${worstAt}` : ''}) | ` +
            `شبكة: ${reqs} طلب ~${kb}KB (${hosts || 'لا شيء'}) | ` +
            `مؤقتات ${intervals} [${topIntervalTags()}] | مهلات: ${liveTimeouts.size} معلّقة، ${timeoutChurn} جُدولت (${topTimeoutCreators || 'لا شيء'}) | ` +
            `ذاكرة ${hermesHeapMb()} | ${AppState.currentState}`,
        );
        if (max >= 1000) {
          console.warn(
            `[heat] ⚠️ خيط JS انسدّ ${max}ms على ${currentRoute} — اذكر ماذا فعلت لحظتها (فتح شاشة؟ هدية؟ رسالة؟)`,
          );
        }
        if (kb >= 2048) {
          console.warn(`[heat] ⚠️ تنزيل كثيف: ~${Math.round(kb / 1024)}MB خلال 10ث على ${currentRoute} (${hosts})`);
        }
      }
    };
    if (raf) raf(sample);
  }, REPORT_MS);

  console.log('[heat] مرقاب الحرارة v2 يعمل — تقرير كل 10 ثوانٍ. ابعث السطور المرتفعة للمطوّر.');
}
