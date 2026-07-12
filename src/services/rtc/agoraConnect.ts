/**
 * سلّم نقل Agora مع Cloud Proxy تلقائي (نظير livekitConnect لمشكلة سوريا)
 *
 * بعض مزودي الإنترنت يحجبون/يخنقون UDP فتفشل الوسائط رغم نجاح الإشارة.
 * Agora يوفر Cloud Proxy بوضعين: UDP قسري (1) و TCP/TLS على 443 (2).
 *
 * الأسلوب: محاولة مباشرة أولاً (أفضل جودة/زمن وصول) بمهلة قصيرة، وعند
 * الفشل الصعود في السلّم: مباشر → UDP proxy → TCP proxy.
 *
 * تحسينات ضد بطء الشبكات المحجوبة (نفس دروس LiveKit):
 * - الوضع الناجح يُحفظ على الجهاز — الجلسات اللاحقة تبدأ منه مباشرة
 * - إعادة استكشاف المسار المباشر عند تغيّر نوع الشبكة أو مرور 24 ساعة
 * - مفتاح فرض من الداشبورد: config/settings.audioForceProxy
 *   (غياب/0 = سلّم آلي، 1 = UDP فوراً، 2 = TCP فوراً)
 *
 * قاعدة صارمة: setCloudProxy دائماً قبل joinChannel، وفي هذا الملف حصرياً.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { ref as rtdbRef, set as rtdbSet } from 'firebase/database';

import { agoraEngine, type AgoraRole } from './agoraEngine';

export type AgoraTransportMode = 'direct' | 'udp' | 'tcp';

const TRANSPORT_PREF_KEY = 'agora_transport_pref';
/** بعد 24 ساعة من آخر نجاح نعيد استكشاف المسار المباشر */
const TRANSPORT_PREF_TTL_MS = 24 * 60 * 60 * 1000;

/** مهلات كل درجة من السلّم (مللي ثانية) */
const DIRECT_TIMEOUT_MS = 8_000;
const UDP_PROXY_TIMEOUT_MS = 6_000;
const TCP_PROXY_TIMEOUT_MS = 8_000;
/** مهلة الوضع المفروض (من الداشبورد/المختبر) — أسخى لأنه بلا بدائل */
const FORCED_TIMEOUT_MS = 10_000;

interface StoredTransportPref {
  mode: AgoraTransportMode;
  at: number;
}

/** الوضع الناجح السابق — تبدأ الجلسات اللاحقة منه */
let storedPref: StoredTransportPref | null = null;
/** فرض من الداشبورد: config/settings.audioForceProxy (0/1/2) */
let forceProxyConfig: number | null = null;
let bootstrapped = false;
/** نوع الشبكة الحالي — للتشخيص + إعادة الاستكشاف عند تغيّره */
let currentNetType = 'unknown';

/** تحميل التفضيل المحفوظ + إعداد الداشبورد + مراقبة الشبكة — مرة واحدة */
async function bootstrapTransportPreference(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  try {
    const raw = await AsyncStorage.getItem(TRANSPORT_PREF_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredTransportPref;
      if (
        parsed &&
        (parsed.mode === 'direct' || parsed.mode === 'udp' || parsed.mode === 'tcp') &&
        typeof parsed.at === 'number'
      ) {
        storedPref = parsed;
      }
    }
  } catch {
    // ignore
  }

  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const { firestore } = await import('@/services/firebase/index');
    const snap = await getDoc(doc(firestore, 'config', 'settings'));
    const v = snap.exists()
      ? (snap.data() as Record<string, unknown>).audioForceProxy
      : undefined;
    if (typeof v === 'number') forceProxyConfig = v;
  } catch {
    // ignore — غياب الإعداد يعني السلّم الآلي
  }

  try {
    const state = await NetInfo.fetch();
    currentNetType = state.type ?? 'unknown';
  } catch {
    // ignore
  }

  // تغيّر نوع الشبكة (WiFi ↔ بيانات) — الشبكة الجديدة قد لا تحتاج البروكسي
  try {
    NetInfo.addEventListener((state) => {
      const nextType = state.type ?? 'unknown';
      if (nextType !== currentNetType) {
        currentNetType = nextType;
        resetAgoraTransportPreference();
      }
    });
  } catch {
    // ignore
  }
}

function rememberTransportWorks(mode: AgoraTransportMode): void {
  storedPref = { mode, at: Date.now() };
  void AsyncStorage.setItem(TRANSPORT_PREF_KEY, JSON.stringify(storedPref)).catch(
    () => {},
  );
}

/** إعادة الاستكشاف من المسار المباشر (تغيّر شبكة/رغبة صريحة من المختبر) */
export function resetAgoraTransportPreference(): void {
  storedPref = null;
  void AsyncStorage.removeItem(TRANSPORT_PREF_KEY).catch(() => {});
}

/** التفضيل الفعّال الآن — يتجاهل المحفوظ إن تقادم (أكثر من 24 ساعة) */
function effectiveStoredMode(): AgoraTransportMode | null {
  if (!storedPref) return null;
  if (Date.now() - storedPref.at > TRANSPORT_PREF_TTL_MS) {
    resetAgoraTransportPreference();
    return null;
  }
  return storedPref.mode;
}

function timeoutForMode(mode: AgoraTransportMode): number {
  if (mode === 'direct') return DIRECT_TIMEOUT_MS;
  if (mode === 'udp') return UDP_PROXY_TIMEOUT_MS;
  return TCP_PROXY_TIMEOUT_MS;
}

/**
 * تشخيص صامت في RTDB: rtcDiag/{uid}/{timestamp}
 * القاعدة الأمنية تُضاف لاحقاً — الفشل الصامت مقبول في هذه المرحلة.
 */
function writeJoinDiagnostics(mode: AgoraTransportMode, joinMs: number): void {
  void (async () => {
    try {
      const { realtimeDb, auth } = await import('@/services/firebase');
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      await rtdbSet(rtdbRef(realtimeDb, `rtcDiag/${uid}/${Date.now()}`), {
        provider: 'agora',
        mode,
        joinMs,
        netType: currentNetType,
      });
    } catch {
      // صامت — التشخيص لا يعطل الانضمام أبداً
    }
  })();
}

export interface AgoraLadderParams {
  appId: string;
  token: string;
  channel: string;
  identity: string;
  role: AgoraRole;
  /** فرض وضع محدد (أدوات المختبر) — يتجاوز التفضيل والداشبورد */
  forceMode?: AgoraTransportMode;
}

/** ترتيب درجات السلّم بدءاً من وضع معيّن */
function ladderFrom(start: AgoraTransportMode): AgoraTransportMode[] {
  const full: AgoraTransportMode[] = ['direct', 'udp', 'tcp'];
  const idx = full.indexOf(start);
  return full.slice(idx === -1 ? 0 : idx);
}

/**
 * الانضمام عبر سلّم النقل: مباشر (8ث) → UDP proxy (6ث) → TCP proxy.
 * يعيد الوضع الذي نجح به الانضمام.
 */
export async function joinWithTransportLadder(
  params: AgoraLadderParams,
): Promise<AgoraTransportMode> {
  await bootstrapTransportPreference();

  let attempts: AgoraTransportMode[];
  let forcedSingle = false;

  if (params.forceMode) {
    attempts = [params.forceMode];
    forcedSingle = true;
  } else if (forceProxyConfig === 1) {
    // الداشبورد: UDP proxy فوراً — مع TCP كدرجة أخيرة احتياطاً
    attempts = ['udp', 'tcp'];
  } else if (forceProxyConfig === 2) {
    attempts = ['tcp'];
    forcedSingle = true;
  } else {
    const saved = effectiveStoredMode();
    attempts = saved ? ladderFrom(saved) : ladderFrom('direct');
  }

  let lastError: unknown = null;
  for (let i = 0; i < attempts.length; i++) {
    const mode = attempts[i]!;
    try {
      // setCloudProxy دائماً قبل joinChannel — حتى للوضع المباشر (تصفير بروكسي سابق)
      await agoraEngine.setCloudProxy(
        params.appId,
        mode === 'direct' ? 'none' : mode,
      );
      const startedAt = Date.now();
      await agoraEngine.joinChannel({
        appId: params.appId,
        token: params.token,
        channel: params.channel,
        identity: params.identity,
        role: params.role,
        timeoutMs: forcedSingle ? FORCED_TIMEOUT_MS : timeoutForMode(mode),
      });
      const joinMs = Date.now() - startedAt;
      rememberTransportWorks(mode);
      writeJoinDiagnostics(mode, joinMs);
      if (mode !== 'direct') {
        console.log(`[Agora] connected via ${mode} proxy in ${joinMs}ms`);
      }
      return mode;
    } catch (e) {
      lastError = e;
      // تنظيف قبل الدرجة التالية — join فاشل قد يترك المحرك بحالة معلّقة
      await agoraEngine.leaveChannel().catch(() => {});
      if (i < attempts.length - 1) {
        console.log(
          `[Agora] ${mode} join failed — trying ${attempts[i + 1]}:`,
          (e as Error)?.message,
        );
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('تعذّر الاتصال الصوتي عبر كل مسارات النقل');
}
