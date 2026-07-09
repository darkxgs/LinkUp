/**
 * Coin Transfer Service — تحويل العملات بين المستخدمين
 *
 * البنية:
 *   - يقرأ عمولة التحويل من config/settings.transferCommission
 *   - يقرأ الحد الأدنى من config/settings.minTransferAmount
 *   - يستخدم runTransaction لضمان atomic operation (no double-spend)
 *   - يسجّل معاملتين في transactions: واحدة للمرسل (-) واحدة للمستلم (+)
 *
 * عمليتان مدعومتان:
 *   - transferCoins (العملات الأساسية)
 *   - transferPearls (الماسة)
 */

import {
  doc,
  getDoc,
  runTransaction,
  collection,
  addDoc,
  increment,
  query,
  where,
  limit,
  getDocs,
} from 'firebase/firestore';
import { firestore, auth } from './firebase/index';
import {
  statsFromFirestoreDoc,
  buildBalanceIncrementPatch,
} from '@/utils/userBalance';

export type TransferCurrency = 'coins' | 'pearls';

export interface TransferResult {
  ok: boolean;
  message: string;
  commissionPaid: number;
  netReceived: number;
}

/**
 * تحويل عملات/ماسة من المستخدم الحالي لمستخدم آخر
 *
 * @param toUid معرّف المستلم
 * @param amount المبلغ الكامل (قبل العمولة) — المرسل يدفع هذا، المستلم يأخذ (amount - commission)
 * @param currency 'coins' أو 'pearls'
 * @param note ملاحظة اختيارية للمرسل (لتسجيل المعاملة)
 */
export const transferCurrency = async (
  toUid: string,
  amount: number,
  currency: TransferCurrency,
  note?: string,
): Promise<TransferResult> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');
  if (toUid === me.uid) throw new Error('لا يمكن التحويل لنفسك');

  // قراءة الإعدادات من config (الأدمن يتحكّم)
  let commissionPercent = 5;
  let minAmount = 100;
  try {
    const settingsSnap = await getDoc(doc(firestore, 'config', 'settings'));
    if (settingsSnap.exists()) {
      const s = settingsSnap.data() as any;
      if (typeof s.transferCommission === 'number') {
        commissionPercent = Math.max(0, Math.min(100, s.transferCommission));
      }
      if (typeof s.minTransferAmount === 'number') {
        minAmount = Math.max(1, s.minTransferAmount);
      }
    }
  } catch {
    // استخدم القيم الافتراضية
  }

  const amt = Math.floor(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error('المبلغ غير صحيح');
  }
  if (amt < minAmount) {
    throw new Error(`الحد الأدنى للتحويل ${minAmount} ${currency === 'coins' ? 'عملة' : 'ماسة'}`);
  }

  // احسب العمولة وما سيصل المستلم
  const commission = Math.floor((amt * commissionPercent) / 100);
  const netReceived = amt - commission;

  if (netReceived <= 0) {
    throw new Error('المبلغ صغير جداً بعد العمولة');
  }

  const meRef = doc(firestore, 'users', me.uid);
  const toRef = doc(firestore, 'users', toUid);
  const balanceKey = currency === 'coins' ? 'coins' : 'pearls';

  // التحقق من وجود المستلم + الرصيد + الخصم/الإضافة كله في transaction واحدة
  let recipientName = 'مستخدم';
  await runTransaction(firestore, async (tx) => {
    const meSnap = await tx.get(meRef);
    const toSnap = await tx.get(toRef);

    if (!meSnap.exists()) throw new Error('حسابك غير موجود');
    if (!toSnap.exists()) throw new Error('المستلم غير موجود');

    const meData = meSnap.data() as Record<string, unknown>;
    const toData = toSnap.data();
    const meStats = statsFromFirestoreDoc(meData);
    const myBalance =
      currency === 'coins' ? meStats.coins : meStats.pearls;

    if (myBalance < amt) {
      throw new Error(`رصيدك غير كافٍ. تحتاج ${amt} ${currency === 'coins' ? 'عملة' : 'ماسة'}`);
    }

    recipientName =
      toData.profile?.displayName ?? toData.displayName ?? 'مستخدم';

    tx.update(meRef, buildBalanceIncrementPatch(balanceKey, -amt));
    tx.update(toRef, buildBalanceIncrementPatch(balanceKey, netReceived));
  });

  // تسجيل المعاملتين بعد نجاح الـ transaction
  const now = Date.now();
  await Promise.all([
    // للمرسل
    addDoc(collection(firestore, 'transactions'), {
      uid: me.uid,
      type: 'transfer_sent',
      amount: -amt,
      currency,
      toUid,
      toName: recipientName,
      commission,
      status: 'completed',
      note: note ?? '',
      createdAt: now,
    }),
    // للمستلم
    addDoc(collection(firestore, 'transactions'), {
      uid: toUid,
      type: 'transfer_received',
      amount: netReceived,
      currency,
      fromUid: me.uid,
      fromName: me.displayName ?? 'مستخدم',
      commission: 0,
      status: 'completed',
      note: note ?? '',
      createdAt: now,
    }),
  ]);

  return {
    ok: true,
    message: `تم تحويل ${netReceived.toLocaleString()} ${currency === 'coins' ? 'عملة' : 'ماسة'} إلى ${recipientName}`,
    commissionPaid: commission,
    netReceived,
  };
};

/**
 * البحث عن مستخدم بـ UID أو بـ username (الاسم المعروض)
 * تُستخدم في شاشة التحويل لإيجاد المستلم قبل التحويل
 */
export const findUserForTransfer = async (
  searchTerm: string,
): Promise<{
  uid: string;
  displayName: string;
  avatar: string;
} | null> => {
  const term = searchTerm.trim();
  if (!term) return null;

  try {
    // محاولة 1: قراءة مباشرة بـ UID
    if (term.length >= 20) {
      const directSnap = await getDoc(doc(firestore, 'users', term));
      if (directSnap.exists()) {
        const data = directSnap.data();
        return {
          uid: directSnap.id,
          displayName: data.profile?.displayName ?? data.displayName ?? 'مستخدم',
          avatar: data.profile?.avatar ?? data.avatar ?? '',
        };
      }
    }

    // محاولة 2: بحث بـ displayName (الـ profile الجديد)
    const q1 = query(
      collection(firestore, 'users'),
      where('profile.displayName', '==', term),
      limit(1),
    );
    let snap = await getDocs(q1);

    // محاولة 3: fallback لـ displayName المباشر (legacy)
    if (snap.empty) {
      const q2 = query(
        collection(firestore, 'users'),
        where('displayName', '==', term),
        limit(1),
      );
      snap = await getDocs(q2);
    }

    if (snap.empty) return null;

    const d = snap.docs[0];
    if (!d) return null;
    const data = d.data();
    return {
      uid: d.id,
      displayName: data.profile?.displayName ?? data.displayName ?? 'مستخدم',
      avatar: data.profile?.avatar ?? data.avatar ?? '',
    };
  } catch {
    return null;
  }
};
