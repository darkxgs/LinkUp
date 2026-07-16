/**
 * مستوى الجاذبية + مهمة رهان الثروة — الطرف الخادم.
 *
 * الجاذبية: تجربة تُمنح لمستقبِل الهدايا (1 تجربة = 1 كوين مُستلَم) عبر تريغر
 * على وثائق transactions من نوع gift_received. تُكتب حصرياً من هنا (Admin SDK
 * يتجاوز القواعد، والقواعد تمنع كتابة العميل لحقول الجاذبية) — فلا تُزوَّر.
 *
 * مهمة «راهن بقيمة 50000» تُستلم عبر callable لأن جائزتها عشوائية (30-300):
 * الرمية تُحسب هنا فلا يستطيع العميل اختيار قيمتها ولا الاستلام مرتين.
 *
 * ملاحظة بنيوية: لا admin.firestore() على مستوى الموديول — يُستدعى داخل
 * المعالجات فقط (درس فشل app/no-app عند الاستيراد قبل initializeApp).
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

// منحنى المستوى — نسخة مطابقة حرفياً لمنحنى الثروة في التطبيق
// (.linkup-publish/src/services/firebase/wealthLevel.ts:30-46) ويجب أن يبقيا متزامنين.
export function charmXpRequiredForLevel(level: number): number {
  return 500 + level * 250;
}

export function applyCharmXpGain(
  level: number,
  xp: number,
  gain: number,
): { level: number; xp: number } {
  let newLevel = Math.max(1, level);
  let newXp = xp + gain;
  while (newXp >= charmXpRequiredForLevel(newLevel)) {
    newXp -= charmXpRequiredForLevel(newLevel);
    newLevel += 1;
  }
  return { level: newLevel, xp: newXp };
}

/** مفتاح اليوم بتوقيت UTC — موحّد مع إعادة ضبط المهام اليومية في التطبيق */
function utcDayKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * تجربة الجاذبية عند استلام هدية — 1 تجربة لكل كوين مُستلَم.
 *
 * الإرسال متعدد المستلمين يُنتج وثيقة gift_received مستقلة لكل مستلم بقيمته
 * الفعلية، فلا حاجة لأي تقسيم هنا. التريغر at-least-once → حارس processedEvents
 * داخل نفس المعاملة يمنع الازدواج.
 *
 * سقف اختياري ضد إعادة تدوير الكوينز بين حسابين (المرسل يستعيد قيمة هديته
 * كمستلم ثم يعيد إرسالها بلا نهاية): config/settings.charmPairDailyCap
 * (كوينز لكل مرسل→مستلم يومياً بتوقيت UTC). غيابه أو ≤0 = بلا سقف.
 */
export const charmXpOnGiftReceived = onDocumentCreated(
  { document: 'transactions/{txId}', maxInstances: 20 },
  async (event) => {
    const tx = event.data?.data();
    if (!tx) return;

    if (String(tx.type ?? '') !== 'gift_received') return;
    if (String(tx.currency ?? '') !== 'coins') return;
    const amount = Math.floor(Number(tx.amount) || 0);
    if (amount <= 0) return;

    const uid = String(tx.uid ?? '');
    const fromUid = String(tx.fromUid ?? '');
    // بلا مُرسل معروف أو إهداء ذاتي → لا جاذبية
    if (!uid || !fromUid || fromUid === uid) return;

    const db = admin.firestore();
    const guardRef = db.collection('processedEvents').doc(`charmXp_${event.params.txId}`);
    const userRef = db.collection('users').doc(uid);

    try {
      const settingsSnap = await db.collection('config').doc('settings').get();
      const capRaw = Number(settingsSnap.get('charmPairDailyCap'));
      const pairCap = Number.isFinite(capRaw) && capRaw > 0 ? Math.floor(capRaw) : 0;
      const pairRef =
        pairCap > 0
          ? db.collection('charmPairDaily').doc(`${uid}_${fromUid}_${utcDayKey()}`)
          : null;

      await db.runTransaction(async (t) => {
        // كل القراءات قبل أي كتابة (شرط معاملات Firestore)
        const guardSnap = await t.get(guardRef);
        if (guardSnap.exists) return;

        let gained = amount;
        let pairAlready = 0;
        if (pairRef) {
          const pairSnap = await t.get(pairRef);
          pairAlready = Number(pairSnap.get('coins')) || 0;
          gained = Math.max(0, Math.min(amount, pairCap - pairAlready));
        }

        const userSnap = await t.get(userRef);

        t.set(guardRef, { processedAt: Date.now(), txId: event.params.txId });
        if (pairRef) {
          t.set(
            pairRef,
            {
              coins: admin.firestore.FieldValue.increment(amount),
              updatedAt: Date.now(),
            },
            { merge: true },
          );
        }

        if (gained <= 0 || !userSnap.exists) return;

        const data = userSnap.data() ?? {};
        const stats = (data.stats ?? {}) as Record<string, unknown>;
        // البذرة من أعلى القيمتين (stats/الجذر) — نفس عرف level/xp في التطبيق
        const level = Math.max(1, Number(stats.charmLevel) || 0, Number(data.charmLevel) || 0);
        const xp = Math.max(0, Number(stats.charmXp) || 0, Number(data.charmXp) || 0);
        const next = applyCharmXpGain(level, xp, gained);

        t.update(userRef, {
          'stats.charmLevel': next.level,
          'stats.charmXp': next.xp,
          charmLevel: next.level,
          charmXp: next.xp,
          updatedAt: Date.now(),
        });
      });
    } catch (e) {
      console.error('charmXpOnGiftReceived:', e);
    }
  },
);

// جدول رميات مهمة «راهن بقيمة 5000» — الوزن الكلي 100
const BET_MISSION_ROLLS: ReadonlyArray<{ xp: number; w: number }> = [
  { xp: 30, w: 50 },
  { xp: 60, w: 25 },
  { xp: 100, w: 14 },
  { xp: 200, w: 8 },
  { xp: 300, w: 3 },
];

function rollBetMissionXp(): number {
  let r = Math.random() * 100;
  for (const row of BET_MISSION_ROLLS) {
    if (r < row.w) return row.xp;
    r -= row.w;
  }
  return BET_MISSION_ROLLS[0].xp;
}

// السعر مضاعف ×10 بأمر المالك (2026-07-17) — يطابق wealthDailyTaskCurrent بالتطبيق
const BET_MISSION_UNIT_COINS = 50000;
const BET_MISSION_MAX_CYCLES = 10;

/**
 * استلام دورات مهمة «راهن بقيمة 50000 في الألعاب (0/10)» — EXP عشوائي 30-300.
 *
 * التقدّم من rewardsProgress.daily.stats.betCoins (يكتبه العميل — السقف اليومي
 * يحدّ الضرر)، أما الرمية والاستلام فهنا حصرياً: العميل لا يختار القيمة ولا
 * يستلم الدورة مرتين (claimedCounts تُكتب في نفس المعاملة).
 */
export const claimWealthBetMission = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const dayKey = utcDayKey();

  return db.runTransaction(async (t) => {
    const snap = await t.get(userRef);
    if (!snap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');
    const data = snap.data() ?? {};

    const daily = (data.rewardsProgress as Record<string, unknown> | undefined)?.daily as
      | Record<string, unknown>
      | undefined;
    const dailyStats = (daily?.stats ?? {}) as Record<string, unknown>;
    const betCoins =
      String(daily?.dateKey ?? '') === dayKey ? Math.max(0, Number(dailyStats.betCoins) || 0) : 0;
    const earned = Math.min(Math.floor(betCoins / BET_MISSION_UNIT_COINS), BET_MISSION_MAX_CYCLES);

    const tasksRaw = (data.wealthDailyTasks ?? {}) as Record<string, unknown>;
    const sameDay = String(tasksRaw.dateKey ?? '') === dayKey;
    const claimedIds =
      sameDay && Array.isArray(tasksRaw.claimedIds) ? tasksRaw.claimedIds.map(String) : [];
    const claimedCounts =
      sameDay && tasksRaw.claimedCounts && typeof tasksRaw.claimedCounts === 'object'
        ? ({ ...(tasksRaw.claimedCounts as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    const claimed = Math.max(0, Number(claimedCounts['bet-5000']) || 0);

    const owed = earned - claimed;
    if (owed <= 0) throw new HttpsError('failed-precondition', 'لا دورات مستحقة لهذه المهمة');

    const rolls: number[] = [];
    for (let i = 0; i < owed; i++) rolls.push(rollBetMissionXp());
    const totalXp = rolls.reduce((a, b) => a + b, 0);

    // XP الثروة — نفس شكل buildWealthXpFirestoreUpdate في التطبيق (stats + الجذر)
    const stats = (data.stats ?? {}) as Record<string, unknown>;
    const level = Math.max(1, Number(stats.level) || 0, Number(data.level) || 0);
    const xp = Math.max(0, Number(stats.xp) || 0, Number(data.xp) || 0);
    const next = applyCharmXpGain(level, xp, totalXp);

    t.update(userRef, {
      'stats.level': next.level,
      'stats.xp': next.xp,
      level: next.level,
      xp: next.xp,
      wealthDailyTasks: {
        dateKey: dayKey,
        claimedIds,
        claimedCounts: { ...claimedCounts, 'bet-5000': earned },
      },
      updatedAt: Date.now(),
    });

    // سجل تدقيق — يُظهر الدورات والرميات الممنوحة
    const auditRef = db.collection('transactions').doc();
    t.set(auditRef, {
      uid,
      type: 'wealth_mission_reward',
      taskId: 'bet-5000',
      cycles: owed,
      amount: totalXp,
      currency: 'xp',
      rolls,
      status: 'completed',
      createdAt: Date.now(),
    });

    return { cycles: owed, totalXp, rolls, newLevel: next.level, newXp: next.xp };
  });
});
