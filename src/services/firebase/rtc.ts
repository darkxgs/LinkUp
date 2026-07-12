/**
 * RTC Service — يجلب tokens الآمنة من Cloud Functions
 *
 * LiveKit → المكالمات 1-to-1 (صوت/فيديو) + المطابقات + الغرف الصوتية
 *
 * كل المفاتيح السرية على السيرفر — التطبيق يطلب توكن قصير العمر فقط.
 */

import { httpsCallable } from 'firebase/functions';
import { ensureCallableAuth, translateCallableError } from './authReady';
import { callCallableHttp } from './callableHttp';
import { app, auth, functions } from './index';

async function callFunction<TReq, TRes>(
  name: string,
  data: TReq,
): Promise<TRes> {
  const user = await ensureCallableAuth(false);
  const idToken = await user.getIdToken(false);

  if (!idToken) {
    throw new Error(translateCallableError({ code: 'functions/unauthenticated' }));
  }

  // 1) HTTP + Bearer token — موثوق على React Native (Gen2 Callable)
  try {
    return await callCallableHttp<TReq, TRes>(name, data, idToken);
  } catch (httpErr) {
    if (__DEV__) {
      console.warn(`[RTC] HTTP ${name} failed, trying httpsCallable`, {
        message: (httpErr as Error)?.message,
        uid: auth.currentUser?.uid,
        projectId: app.options.projectId,
      });
    }
  }

  // 2) fallback: Firebase SDK
  if (!auth.currentUser) {
    throw new Error(translateCallableError({ code: 'functions/unauthenticated' }));
  }

  const fn = httpsCallable<TReq, TRes>(functions, name);
  try {
    const result = await fn(data);
    return result.data;
  } catch (e) {
    if (__DEV__) {
      console.warn(`[RTC] SDK ${name} failed`, {
        code: (e as { code?: string })?.code,
        message: (e as { message?: string })?.message,
        uid: auth.currentUser?.uid,
      });
    }
    throw new Error(translateCallableError(e));
  }
}

// ==================== LIVEKIT ====================
export interface LiveKitTokenResult {
  token: string;
  wsUrl: string;
  identity: string;
  roomName: string;
  freeCall?: boolean;
}

/**
 * جلب توكن LiveKit للانضمام لغرفة أو مكالمة
 * @param canPublish هل يمكنه التحدث؟ (المضيف/المتحدثون true، المستمعون false)
 * @param peerUid معرّف الطرف الآخر — لفحص امتياز المكالمة المجانية للوكالة
 */
export const getLiveKitToken = async (
  roomName: string,
  canPublish = true,
  peerUid?: string,
): Promise<LiveKitTokenResult> =>
  callFunction<
    { roomName: string; canPublish: boolean; peerUid?: string },
    LiveKitTokenResult
  >('generateLiveKitToken', { roomName, canPublish, ...(peerUid ? { peerUid } : {}) });

// ==================== AGORA ====================
export interface AgoraTokenResult {
  token: string;
  appId: string;
  identity: string;
  roomName: string;
  freeCall?: boolean;
}

/**
 * جلب توكن Agora للانضمام لقناة (غرفة/مكالمة) — appId يصل من السيرفر
 * @param canPublish هل يمكنه التحدث؟ (المضيف/المتحدثون true، المستمعون false)
 * @param peerUid معرّف الطرف الآخر — لفحص امتياز المكالمة المجانية للوكالة
 */
export const getAgoraToken = async (
  roomName: string,
  canPublish = true,
  peerUid?: string,
): Promise<AgoraTokenResult> =>
  callFunction<
    { roomName: string; canPublish: boolean; peerUid?: string },
    AgoraTokenResult
  >('generateAgoraToken', { roomName, canPublish, ...(peerUid ? { peerUid } : {}) });

// ==================== MATCHING ====================
export interface MatchResult {
  matched: boolean;
  waiting?: boolean;
  channelName?: string;
  partnerUid?: string;
  freeMatch?: boolean;
}

/**
 * بدء المطابقة — يبحث عن شريك أو يضع المستخدم في الانتظار
 */
export const createMatch = async (
  type: 'voice' | 'video',
  ageRanges?: string[],
): Promise<MatchResult> =>
  callFunction<{ type: string; ageRanges?: string[] }, MatchResult>(
    'createMatch',
    { type, ageRanges },
  );

export const fetchMatchQueueCount = async (
  type: 'voice' | 'video',
): Promise<number> => {
  try {
    const fn = httpsCallable<{ type: string }, { count: number }>(
      functions,
      'getMatchQueueCount',
    );
    const result = await fn({ type });
    return Math.max(0, result.data?.count ?? 0);
  } catch {
    return 0;
  }
};

/**
 * إلغاء المطابقة (الخروج من قائمة الانتظار)
 */
export const cancelMatch = async (type?: 'voice' | 'video'): Promise<void> => {
  await callFunction<{ type?: string }, { cancelled: boolean }>(
    'cancelMatch',
    type ? { type } : {},
  );
};

/**
 * فحص حالة مطابقتي — نفس نوع المطابقة (صوت ≠ فيديو)
 */
export const checkMyMatch = async (
  type: 'voice' | 'video',
): Promise<MatchResult | null> => {
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  const { firestore, auth } = await import('./index');
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const snap = await getDocs(
    query(collection(firestore, 'matchQueue'), where('uid', '==', uid)),
  );
  if (snap.empty) return null;

  const mine = snap.docs
    .map((d) => d.data())
    .filter((d) => d.type === type);

  const matched = mine.find((d) => d.status === 'matched' && d.channelName);
  if (matched) {
    return {
      matched: true,
      channelName: matched.channelName as string,
      partnerUid: matched.matchedWith as string | undefined,
    };
  }

  const waiting = mine.some((d) => d.status === 'waiting');
  return waiting ? { matched: false, waiting: true } : null;
};

/**
 * إنهاء مكالمة وتسجيل مدتها (وإنهاء جلسة الفوترة إن وُجدت)
 */
export const endCall = async (
  channelName: string,
  durationSeconds: number,
  sessionId?: string,
): Promise<void> => {
  await callFunction('endCall', {
    channelName,
    durationSeconds,
    ...(sessionId ? { sessionId } : {}),
  });
};

// ==================== CALL BILLING (جلسة مكالمة مفوترة) ====================
export interface StartCallResult {
  sessionId: string;
  billed: boolean;
  freeCall: boolean;
}

/**
 * يبدأ المتصل (الدافع) جلسة مكالمة.
 * يرمي خطأ إن كانت مفوترة والرصيد لا يكفي الدقيقة الأولى.
 */
export const startCall = async (
  calleeUid: string,
  type: 'voice' | 'video',
  channelName: string,
  source: 'chat' | 'match' = 'chat',
): Promise<StartCallResult> =>
  callFunction<
    { calleeUid: string; type: 'voice' | 'video'; channelName: string; source?: 'chat' | 'match' },
    StartCallResult
  >('startCall', { calleeUid, type, channelName, source });

export interface ChargeMinuteResult {
  ok: boolean;
  billed?: boolean;
  reason?: 'insufficient' | 'ended';
  balance?: number;
  minutesCharged?: number;
}

/**
 * يُحتسب دقيقة مكالمة على الدافع. آمن لاستدعائه من أي طرف —
 * السيرفر يخصم من الدافع فقط ويتجاهل البقية.
 */
export const chargeCallMinute = async (
  sessionId: string,
): Promise<ChargeMinuteResult> =>
  callFunction<{ sessionId: string }, ChargeMinuteResult>(
    'chargeCallMinute',
    { sessionId },
  );
