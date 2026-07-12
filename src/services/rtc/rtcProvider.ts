/**
 * قرار مزوّد الصوت (LiveKit / Agora) — Agora هو النظام الافتراضي لهذه النسخة
 *
 * القواعد بالترتيب:
 * 1) settings.rtcProvider === 'livekit' → رجوع طارئ للنظام القديم (فرملة من الداشبورد)
 * 2) غير ذلك (أو أي فشل)               → Agora (النظام المعتمد — بأمر المالك 2026-07-12)
 *
 * النسخ القديمة الموزعة لا تقرأ هذا العلم أصلاً (LiveKit مدمج فيها) —
 * فالعلم يحكم النسخ الجديدة فقط، والرجوع الطارئ لا يحتاج APK جديداً.
 * القراءة من Firestore مرة واحدة لكل جلسة تطبيق (كاش ذاكرة)، مع كاش
 * AsyncStorage ('rtc_provider_cache') ليصمد القرار عند الإقلاع دون شبكة.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type RtcProvider = 'livekit' | 'agora';

const PROVIDER_CACHE_KEY = 'rtc_provider_cache';

/** قرار الجلسة الحالية — يثبت بعد أول حسم ناجح من Firestore */
let sessionProvider: RtcProvider | null = null;
/** كاش الإقلاع من AsyncStorage — آخر قرار محسوم (مع صاحبه) */
let storageCache: { provider: RtcProvider; uid?: string } | null = null;
let storageHydrated = false;
let hydratePromise: Promise<void> | null = null;
/** طلب حسم جارٍ — يمنع قراءات Firestore متوازية عند تعدد المستدعين */
let inflight: Promise<RtcProvider> | null = null;

function isProvider(v: unknown): v is RtcProvider {
  return v === 'livekit' || v === 'agora';
}

/** تحميل كاش الإقلاع مرة واحدة — peekCachedProvider لا يرى إلا ما حُمّل */
function hydrateStorageCache(): Promise<void> {
  if (storageHydrated) return Promise.resolve();
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(PROVIDER_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { provider?: unknown; uid?: unknown };
          if (isProvider(parsed?.provider)) {
            storageCache = {
              provider: parsed.provider,
              uid: typeof parsed.uid === 'string' ? parsed.uid : undefined,
            };
          }
        }
      } catch {
        // كاش تالف/غير موجود — الافتراضي الآمن يغطي
      }
      storageHydrated = true;
    })();
  }
  return hydratePromise;
}

// بدء الترطيب مبكراً عند تحميل الموديول — لا ينتظر أول استدعاء
void hydrateStorageCache();

/**
 * قراءة متزامنة للكاش — للإقلاع/القرارات السريعة قبل اكتمال الحسم.
 * لا تضرب الشبكة أبداً: قرار الجلسة ← كاش الإقلاع ← LiveKit.
 */
export function peekCachedProvider(): RtcProvider {
  return sessionProvider ?? storageCache?.provider ?? 'agora';
}

/**
 * حسم المزوّد لهذه الجلسة — Firestore مرة واحدة ثم كاش ذاكرة.
 * أي فشل (شبكة/صلاحيات) = كاش الإقلاع لنفس الحساب، وإلا LiveKit —
 * دون تثبيت القرار كي تعيد المحاولةُ التاليةُ القراءةَ من السيرفر.
 */
export async function resolveRtcProvider(uid?: string): Promise<RtcProvider> {
  if (sessionProvider) return sessionProvider;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { firestore } = await import('@/services/firebase/index');
      const snap = await getDoc(doc(firestore, 'config', 'settings'));
      const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
      // Agora افتراضياً — القيمة الصريحة 'livekit' وحدها ترجع للنظام القديم (طوارئ)
      const provider: RtcProvider = data.rtcProvider === 'livekit' ? 'livekit' : 'agora';
      sessionProvider = provider;
      storageCache = { provider, uid };
      void AsyncStorage.setItem(
        PROVIDER_CACHE_KEY,
        JSON.stringify({ provider, uid: uid ?? null, at: Date.now() }),
      ).catch(() => {});
      return provider;
    } catch {
      // إقلاع دون شبكة — آخر قرار محفوظ لنفس الحساب، وإلا الافتراضي (Agora)
      await hydrateStorageCache().catch(() => {});
      if (storageCache && (!storageCache.uid || !uid || storageCache.uid === uid)) {
        return storageCache.provider;
      }
      return 'agora';
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
