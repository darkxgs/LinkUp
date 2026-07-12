/**
 * توكنات Agora مع كاش قصير + ربط التجديد التلقائي
 * (نفس نمط كاش prefetch للتوكن في roomAudioSession)
 */

import { getAgoraToken, type AgoraTokenResult } from '@/services/firebase/rtc';

import { agoraEngine, type AgoraEngineManager } from './agoraEngine';

const TOKEN_CACHE_TTL_MS = 4 * 60 * 1000;

const tokenCache = new Map<string, { result: AgoraTokenResult; at: number }>();

function cacheKey(roomName: string, canPublish: boolean, peerUid?: string): string {
  return `${roomName}|${canPublish}|${peerUid ?? ''}`;
}

export interface GetAgoraTokenOptions {
  /** تجاهل الكاش وجلب توكن جديد — إلزامي عند التجديد قبل الانتهاء */
  forceFresh?: boolean;
}

/**
 * جلب توكن Agora بكاش 4 دقائق لكل (roomName, canPublish, peerUid).
 * الدخول المتكرر السريع (تنقل بين رومات/إعادة اتصال) لا يضرب السيرفر.
 */
export async function getAgoraTokenCached(
  roomName: string,
  canPublish: boolean,
  peerUid?: string,
  options?: GetAgoraTokenOptions,
): Promise<AgoraTokenResult> {
  const key = cacheKey(roomName, canPublish, peerUid);
  if (!options?.forceFresh) {
    const cached = tokenCache.get(key);
    if (cached && Date.now() - cached.at < TOKEN_CACHE_TTL_MS) {
      return cached.result;
    }
  }
  const result = await getAgoraToken(roomName, canPublish, peerUid);
  tokenCache.set(key, { result, at: Date.now() });
  return result;
}

/** إفراغ الكاش (تسجيل خروج/تبديل حساب) */
export function clearAgoraTokenCache(): void {
  tokenCache.clear();
}

export interface TokenRenewalOptions {
  roomName: string;
  canPublish: boolean;
  peerUid?: string;
  /**
   * التوكن انتهى فعلاً (onRequestToken) — التجديد وحده لا يكفي،
   * على المستدعي إعادة الانضمام كاملة بتوكن جديد.
   */
  onTokenRequired?: () => void;
}

/**
 * ربط التجديد التلقائي: قبيل انتهاء التوكن نجلب واحداً جديداً (متجاوزين
 * الكاش) ونمرره للمحرك دون قطع. يعيد دالة فكّ الاشتراك.
 */
export function attachTokenRenewal(
  engine: AgoraEngineManager = agoraEngine,
  options: TokenRenewalOptions = { roomName: '', canPublish: false },
): () => void {
  return engine.subscribe((event) => {
    if (event.type === 'tokenWillExpire') {
      void (async () => {
        try {
          const fresh = await getAgoraTokenCached(
            options.roomName,
            options.canPublish,
            options.peerUid,
            { forceFresh: true },
          );
          engine.renewToken(fresh.token);
        } catch {
          // فشل الجلب — onRequestToken سيصل لاحقاً ويُعالج بإعادة انضمام
        }
      })();
    } else if (event.type === 'tokenRequired') {
      options.onTokenRequired?.();
    }
  });
}
