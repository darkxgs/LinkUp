/**
 * ألعاب الذكاء — حد يومي واحد لكل الألعاب معاً بوقت السيرفر (لا يعتمد على ساعة الجهاز).
 * لعب أي لعبة ذكاء يقفل بقية ألعاب الذكاء حتى اليوم التالي (UTC).
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { pickCoinsBalance } from './shared/userLookup';

const INTELLIGENCE_GAME_IDS = new Set(['flag-guess', 'memory-match', 'sequence-memory']);

function formatUtcDayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function msUntilNextUtcDay(nowMs: number): number {
  const d = new Date(nowMs);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(0, next - nowMs);
}

const DAILY_LIMIT_MSG =
  'لقد لعبت لعبة ذكاء اليوم — عد غداً وجرّب حظك من جديد!';

/**
 * خصم دخولية لعبة ذكاء + قفل يومي ذري على السيرفر.
 */
export const placeIntelligenceGameBet = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  }

  const uid = request.auth.uid;
  const gameId = String(request.data?.gameId ?? '').trim();
  const stake = Math.floor(Number(request.data?.stake));

  if (!INTELLIGENCE_GAME_IDS.has(gameId)) {
    throw new HttpsError('invalid-argument', 'لعبة ذكاء غير صالحة');
  }
  if (!stake || stake <= 0) {
    throw new HttpsError('invalid-argument', 'قيمة الدخولية غير صالحة');
  }

  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const nowMs = now.toMillis();
  const playDayKey = formatUtcDayKey(now.toDate());
  // قفل موحّد لكل ألعاب الذكاء: أي لعبة تُقفل المجموعة كلها لليوم
  const lockRef = db.doc(`users/${uid}/intelligenceDaily/all_${playDayKey}`);
  // توافق خلفي: مستندات القفل القديمة كانت لكل لعبة على حدة
  const legacyLockRefs = [...INTELLIGENCE_GAME_IDS].map((g) =>
    db.doc(`users/${uid}/intelligenceDaily/${g}_${playDayKey}`),
  );
  const userRef = db.collection('users').doc(uid);

  try {
    await db.runTransaction(async (tx) => {
      const [lockSnap, userSnap, ...legacySnaps] = await Promise.all([
        tx.get(lockRef),
        tx.get(userRef),
        ...legacyLockRefs.map((r) => tx.get(r)),
      ]);
      if (lockSnap.exists || legacySnaps.some((s) => s.exists)) {
        throw new Error('DAILY_LIMIT');
      }
      if (!userSnap.exists) {
        throw new Error('USER_NOT_FOUND');
      }
      const balance = pickCoinsBalance(userSnap.data()!);
      if (balance < stake) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      tx.set(lockRef, {
        uid,
        gameId,
        playDayKey,
        stake,
        claimedAt: now,
      });
      tx.update(userRef, {
        'stats.coins': admin.firestore.FieldValue.increment(-stake),
        coins: admin.firestore.FieldValue.increment(-stake),
      });
    });
  } catch (err) {
    const code = (err as Error)?.message ?? '';
    if (code === 'DAILY_LIMIT') {
      throw new HttpsError('failed-precondition', DAILY_LIMIT_MSG);
    }
    if (code === 'USER_NOT_FOUND') {
      throw new HttpsError('not-found', 'المستخدم غير موجود');
    }
    if (code === 'INSUFFICIENT_BALANCE') {
      throw new HttpsError('failed-precondition', 'رصيد غير كافٍ');
    }
    throw err;
  }

  return {
    ok: true,
    serverNow: nowMs,
    playDayKey,
    msUntilNextDailyReset: msUntilNextUtcDay(nowMs),
  };
});
