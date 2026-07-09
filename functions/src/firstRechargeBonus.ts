/**
 * مكافأة أول شحن — 50,000 كوين للحساب العادي (مرة واحدة)
 */
import * as admin from 'firebase-admin';

export const FIRST_RECHARGE_BONUS_COINS = 50_000;

export function isRegularAccount(data: FirebaseFirestore.DocumentData): boolean {
  if (data.isAgent === true) return false;
  if (data.isFemaleHost === true) return false;
  const role = data.agencyRole;
  if (role === 'owner' || role === 'host' || role === 'agent') return false;
  if (data.isOfficial === true || data.isRechargeBot === true || data.isSupport === true) {
    return false;
  }
  return true;
}

function pickBonusAmount(settingsSnap: FirebaseFirestore.DocumentSnapshot | null): number {
  if (settingsSnap?.exists) {
    const v = Number((settingsSnap.data() as { firstRechargeBonus?: number })?.firstRechargeBonus);
    if (Number.isFinite(v) && v > 0) return Math.floor(v);
  }
  return FIRST_RECHARGE_BONUS_COINS;
}

/**
 * يمنح مكافأة أول شحن إن كان المستخدم مؤهّلاً.
 * يُرجع عدد الكوينز الممنوحة (0 إن لم تُمنح).
 */
export async function applyFirstRechargeBonus(
  db: FirebaseFirestore.Firestore,
  uid: string,
): Promise<number> {
  const userRef = db.collection('users').doc(uid);
  const settingsRef = db.collection('config').doc('settings');

  let granted = 0;

  await db.runTransaction(async (tx) => {
    const [userSnap, settingsSnap] = await Promise.all([tx.get(userRef), tx.get(settingsRef)]);
    if (!userSnap.exists) return;

    const data = userSnap.data()!;
    if (data.firstRechargeBonusClaimed === true) return;
    if (!isRegularAccount(data)) return;

    granted = pickBonusAmount(settingsSnap);
    if (granted <= 0) return;

    tx.update(userRef, {
      'stats.coins': admin.firestore.FieldValue.increment(granted),
      coins: admin.firestore.FieldValue.increment(granted),
      firstRechargeBonusClaimed: true,
      firstRechargeBonusAt: Date.now(),
    });
  });

  if (granted <= 0) return 0;

  const now = Date.now();
  await Promise.all([
    db.collection('transactions').add({
      uid,
      type: 'first_recharge_bonus',
      amount: granted,
      currency: 'coins',
      itemName: 'هدية أول شحن',
      status: 'completed',
      createdAt: now,
    }),
    db.collection('notifications').add({
      uid,
      type: 'system',
      message: `مبروك! حصلت على ${granted.toLocaleString('en-US')} عملة هدية مع أول شحن`,
      data: {
        title: 'LinkUp',
        body: `+${granted.toLocaleString('en-US')} عملة هدية أول شحن — بالإضافة لرصيد الشحن`,
        type: 'first_recharge_bonus',
      },
      fromName: 'LinkUp',
      isRead: false,
      createdAt: now,
    }),
  ]);

  return granted;
}
