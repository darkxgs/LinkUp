/**
 * Withdrawal Service — نظام السحب الكامل
 *
 * نوعان:
 *  1. سحب ذاتي (self) — عمولة 10% — المستخدم يقدم طلب → الأدمن يوافق
 *  2. سحب بالنيابة (via_agent) — عمولة 2% — العضو يقدم → الوكيل يوافق ويسلّم كاش
 *
 * البنية في Firestore:
 *   withdrawals/{id} → {
 *     uid, type, amount, commission, netAmount,
 *     method, accountInfo, status,
 *     agentUid?, agencyId?, // للسحب بالنيابة
 *     createdAt, updatedAt, processedBy?, rejectionReason?
 *   }
 *
 * الحالات: pending → approved/rejected → completed/cancelled
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  runTransaction,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, auth, functions } from './firebase/index';
import {
  parseWalletRules,
  validateHostWithdrawAmount,
  validateAgentSelfWithdrawAmount,
  isHostAgentWithdrawDayAllowed,
  getAgentWithdrawCooldownRemainingMs,
} from './walletRules';
import {
  buildBalanceIncrementPatch,
  statsFromFirestoreDoc,
} from '@/utils/userBalance';

const AGENT_WITHDRAWALS_POLL_MS = 8000;

const WEEKDAY_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

async function getLastSelfWithdrawAt(uid: string): Promise<number | null> {
  const q = query(
    collection(firestore, 'withdrawals'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(15),
  );
  const snap = await getDocs(q);
  const selfDoc = snap.docs.find((d) => d.data().type === 'self');
  if (!selfDoc) return null;
  return Number(selfDoc.data().createdAt) || null;
}

export type WithdrawalType = 'self' | 'via_agent';
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export type PaymentMethod = 'bank' | 'usdt' | 'paypal' | 'email';

export interface WithdrawalRequest {
  id: string;
  uid: string;
  uidName: string;
  uidAvatar: string;
  type: WithdrawalType;
  amount: number; // الماسة المطلوب
  commission: number; // العمولة المخصومة
  netAmount: number; // الماسة بعد العمولة (يعادل المبلغ النقدي)
  fiatValue: number; // القيمة بالعملة الحقيقية (USD)
  method: PaymentMethod;
  accountInfo: {
    label?: string;
    account?: string;
    iban?: string;
    address?: string;
    email?: string;
    country?: string;
  };
  status: WithdrawalStatus;
  agentUid?: string;
  agentName?: string;
  agencyId?: string;
  rejectionReason?: string;
  createdAt: number;
  updatedAt: number;
  processedAt?: number;
  processedBy?: string;
}

/**
 * تقديم طلب سحب ذاتي
 * - يفحص الرصيد
 * - يحجز الماسة من رصيد المستخدم (يخصمه فوراً)
 * - يقرأ نسبة العمولة من config
 * - إذا رفض الطلب → يرجع الماسة
 */
export const requestSelfWithdrawal = async (
  amount: number,
  method: PaymentMethod,
  accountInfo: WithdrawalRequest['accountInfo'],
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const amt = Math.floor(amount);
  if (amt <= 0) throw new Error('المبلغ غير صحيح');

  const meSnap = await getDoc(doc(firestore, 'users', user.uid));
  if (meSnap.exists() && meSnap.data().withdrawalBlocked === true) {
    throw new Error('عمليات السحب موقوفة على حسابك. راجع الإشعارات أو تواصل مع الدعم.');
  }

  const userDataPre = meSnap.exists() ? meSnap.data() : {};
  const agencyId = userDataPre.agencyId;
  if (agencyId) {
    const membersSnap = await getDocs(
      query(
        collection(firestore, 'agencyMembers'),
        where('uid', '==', user.uid),
        where('agencyId', '==', agencyId),
        limit(1),
      ),
    );
    if (!membersSnap.empty) {
      const memberDoc = membersSnap.docs[0];
      if (memberDoc) {
        const memberData = memberDoc.data();
        if (memberData.permissions && memberData.permissions.allowSelfWithdraw === false) {
          throw new Error('السحب الذاتي موقوف على حسابك من قِبل الوكالة.');
        }
      }
    }
  }
  // قراءة الإعدادات
  const settingsSnap = await getDoc(doc(firestore, 'config', 'settings'));
  const settings = settingsSnap.exists() ? (settingsSnap.data() as any) : {};

  const isAgentAccount =
    userDataPre.isAgent === true ||
    userDataPre.agencyRole === 'agent' ||
    userDataPre.agencyRole === 'owner' ||
    userDataPre.role === 'agent' ||
    userDataPre.role === 'owner';
  const isHostAccount = !!agencyId && !isAgentAccount;
  const rules = parseWalletRules(settings);
  const commissionPct = isAgentAccount
    ? rules.agentWithdrawCommission
    : rules.selfWithdrawCommission;
  const minWithdraw = isAgentAccount ? rules.minAgentWithdraw : rules.minHostWithdraw;

  if (isAgentAccount) {
    const agentErr = validateAgentSelfWithdrawAmount(amt, rules);
    if (agentErr) throw new Error(agentErr);
    const remaining = await getAgentWithdrawCooldownRemainingMs(
      user.uid,
      rules.agentWithdrawCooldownDays,
      getLastSelfWithdrawAt,
    );
    if (remaining > 0) {
      const daysLeft = Math.ceil(remaining / (24 * 60 * 60 * 1000));
      throw new Error(`يمكنك تقديم سحب جديد بعد ${daysLeft} يوم (فترة ${rules.agentWithdrawCooldownDays} يوم)`);
    }
  } else if (isHostAccount) {
    const hostErr = validateHostWithdrawAmount(amt, rules);
    if (hostErr) throw new Error(hostErr);
  } else if (amt < minWithdraw) {
    throw new Error(`الحد الأدنى للسحب ${minWithdraw.toLocaleString()} ماسة`);
  }

  // قراءة بيانات المستخدم لجلب الاسم والصورة + الرصيد
  const userRef = doc(firestore, 'users', user.uid);

  let withdrawalId = '';

  // Transaction: خصم الرصيد + إنشاء الطلب
  await runTransaction(firestore, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error('حسابك غير موجود');
    const userData = userSnap.data();
    const balance = statsFromFirestoreDoc(userData as Record<string, unknown>).pearls;

    if (balance < amt) {
      throw new Error('رصيدك من الماسة غير كافٍ');
    }

    // احسب العمولة
    const commission = Math.floor((amt * commissionPct) / 100);
    const netAmount = amt - commission;

    // خصم الماسة
    tx.update(userRef, buildBalanceIncrementPatch('pearls', -amt));

    // إنشاء وثيقة السحب
    const newRef = doc(collection(firestore, 'withdrawals'));
    withdrawalId = newRef.id;
    tx.set(newRef, {
      uid: user.uid,
      uidName: userData.profile?.displayName ?? userData.displayName ?? 'مستخدم',
      uidAvatar: userData.profile?.avatar ?? userData.avatar ?? '',
      type: 'self',
      amount: amt,
      commission,
      netAmount,
      fiatValue: netAmount / rules.pearlUsdRate,
      method,
      accountInfo,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  await addDoc(collection(firestore, 'transactions'), {
    uid: user.uid,
    type: 'withdrawal_self',
    amount: -amt,
    currency: 'pearls',
    status: 'pending',
    withdrawalId,
    createdAt: Date.now(),
  });

  return withdrawalId;
};

/**
 * تقديم طلب سحب بالنيابة (عبر وكيل)
 * - العضو لازم يكون في وكالة
 * - عمولة 2% (الأدمن)
 * - الوكيل يستلم الطلب + يوافق + يسلّم كاش خارجياً
 */
export const requestAgentWithdrawal = async (
  amount: number,
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const amt = Math.floor(amount);
  if (amt <= 0) throw new Error('المبلغ غير صحيح');

  // قراءة الإعدادات
  const settingsSnap = await getDoc(doc(firestore, 'config', 'settings'));
  const settings = settingsSnap.exists() ? (settingsSnap.data() as any) : {};
  const rules = parseWalletRules(settings);
  const commissionPct = rules.agentWithdrawCommission;

  if (!isHostAgentWithdrawDayAllowed(rules)) {
    const days = rules.hostAgentWithdrawWeekDays
      .map((d) => WEEKDAY_AR[d] ?? String(d))
      .join('، ');
    throw new Error(`السحب عبر الوكيل متاح في: ${days}`);
  }

  const hostErr = validateHostWithdrawAmount(amt, rules);
  if (hostErr) throw new Error(hostErr);

  // اقرأ بيانات المستخدم + تحقّق من العضوية في وكالة
  const userRef = doc(firestore, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('حسابك غير موجود');
  const userData = userSnap.data();
  if (userData.withdrawalBlocked === true) {
    throw new Error('عمليات السحب موقوفة على حسابك. راجع الإشعارات أو تواصل مع الدعم.');
  }
  const agencyId = userData.agencyId;
  if (!agencyId) {
    throw new Error('يجب أن تكون عضواً في وكالة لاستخدام السحب بالنيابة');
  }

  const membersSnap = await getDocs(
    query(
      collection(firestore, 'agencyMembers'),
      where('uid', '==', user.uid),
      where('agencyId', '==', agencyId),
      limit(1),
    ),
  );
  if (membersSnap.empty) throw new Error('عضويتك في الوكالة غير موجودة');
  const memberDoc = membersSnap.docs[0];
  if (!memberDoc) throw new Error('عضويتك في الوكالة غير موجودة');
  const memberData = memberDoc.data();
  if (memberData.permissions && memberData.permissions.allowAgentWithdraw === false) {
    throw new Error('السحب بالنيابة موقوف على حسابك من قِبل الوكالة.');
  }

  // اقرأ بيانات الوكالة لجلب الوكيل
  const agencySnap = await getDoc(doc(firestore, 'agencies', agencyId));
  if (!agencySnap.exists()) throw new Error('الوكالة غير موجودة');
  const agencyData = agencySnap.data();
  const agentUid = agencyData.ownerUid;
  if (!agentUid) throw new Error('وكالتك بدون مالك');

  // اقرأ اسم الوكيل
  const agentSnap = await getDoc(doc(firestore, 'users', agentUid));
  const agentName = agentSnap.exists()
    ? (agentSnap.data().profile?.displayName ?? agentSnap.data().displayName ?? 'الوكيل')
    : 'الوكيل';

  let withdrawalId = '';

  await runTransaction(firestore, async (tx) => {
    const u = await tx.get(userRef);
    if (!u.exists()) throw new Error('حسابك غير موجود');
    const balance = statsFromFirestoreDoc(u.data() as Record<string, unknown>).pearls;
    if (balance < amt) throw new Error('رصيدك من الماسة غير كافٍ');

    const commission = Math.floor((amt * commissionPct) / 100);
    const netAmount = amt - commission;

    // خصم الماسة من العضو
    tx.update(userRef, buildBalanceIncrementPatch('pearls', -amt));

    const newRef = doc(collection(firestore, 'withdrawals'));
    withdrawalId = newRef.id;
    tx.set(newRef, {
      uid: user.uid,
      uidName: u.data().profile?.displayName ?? u.data().displayName ?? 'مستخدم',
      uidAvatar: u.data().profile?.avatar ?? u.data().avatar ?? '',
      type: 'via_agent',
      amount: amt,
      commission,
      netAmount,
      fiatValue: netAmount / rules.pearlUsdRate,
      method: 'email' as PaymentMethod, // افتراضي، الوكيل يسلّم كاش
      accountInfo: { label: 'كاش عبر الوكيل' },
      status: 'pending',
      agentUid,
      agentName,
      agencyId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  return withdrawalId;
};

/**
 * الوكيل يوافق على طلب سحب
 * - يحوّل الماسة إلى رصيده (للسجلات)
 * - يحدّث الحالة
 */
export const agentApproveWithdrawal = async (
  withdrawalId: string,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const wRef = doc(firestore, 'withdrawals', withdrawalId);

  await runTransaction(firestore, async (tx) => {
    const wSnap = await tx.get(wRef);
    if (!wSnap.exists()) throw new Error('الطلب غير موجود');
    const w = wSnap.data() as WithdrawalRequest;
    if (w.agentUid !== user.uid) {
      throw new Error('لست الوكيل المسؤول عن هذا الطلب');
    }
    if (w.status !== 'pending') {
      throw new Error('الطلب لا يمكن معالجته (مُعالج مسبقاً)');
    }

    // الوكيل يحصل على الماسة في رصيده الخاص (يصير عنده للتسليم)
    const agentRef = doc(firestore, 'users', user.uid);
    tx.update(agentRef, buildBalanceIncrementPatch('pearls', w.netAmount));

    tx.update(wRef, {
      status: 'completed',
      processedAt: Date.now(),
      processedBy: user.uid,
      updatedAt: Date.now(),
    });
  });

  // سجّل المعاملتين
  const w = (await getDoc(wRef)).data() as WithdrawalRequest;
  await Promise.all([
    addDoc(collection(firestore, 'transactions'), {
      uid: w.uid,
      type: 'withdrawal_via_agent',
      amount: -w.amount,
      currency: 'pearls',
      agentUid: user.uid,
      status: 'completed',
      withdrawalId,
      createdAt: Date.now(),
    }),
    addDoc(collection(firestore, 'transactions'), {
      uid: user.uid,
      type: 'agent_collected',
      amount: w.netAmount,
      currency: 'pearls',
      fromUid: w.uid,
      status: 'completed',
      withdrawalId,
      createdAt: Date.now(),
    }),
  ]);
};

/**
 * الوكيل يرفض طلب سحب — الماسة يرجع للعضو
 */
export const agentRejectWithdrawal = async (
  withdrawalId: string,
  reason: string,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const wRef = doc(firestore, 'withdrawals', withdrawalId);

  await runTransaction(firestore, async (tx) => {
    const wSnap = await tx.get(wRef);
    if (!wSnap.exists()) throw new Error('الطلب غير موجود');
    const w = wSnap.data() as WithdrawalRequest;
    if (w.agentUid !== user.uid) {
      throw new Error('لست الوكيل المسؤول');
    }
    if (w.status !== 'pending') {
      throw new Error('الطلب مُعالج مسبقاً');
    }

    // إرجاع الماسة للعضو (المبلغ الكامل، بدون العمولة لأنها لم تُحسب فعلياً)
    const memberRef = doc(firestore, 'users', w.uid);
    tx.update(memberRef, buildBalanceIncrementPatch('pearls', w.amount));

    tx.update(wRef, {
      status: 'rejected',
      rejectionReason: reason,
      processedAt: Date.now(),
      processedBy: user.uid,
      updatedAt: Date.now(),
    });
  });

  const w = (await getDoc(wRef)).data() as WithdrawalRequest;
  await addDoc(collection(firestore, 'transactions'), {
    uid: w.uid,
    type: 'withdrawal_refund',
    amount: w.amount,
    currency: 'pearls',
    status: 'completed',
    withdrawalId,
    itemName: 'استرجاع ماسة — رفض الوكيل',
    createdAt: Date.now(),
  });
};

/**
 * الأدمن يوافق على طلب سحب ذاتي
 */
export const adminApproveWithdrawal = async (
  withdrawalId: string,
): Promise<void> => {
  await updateDoc(doc(firestore, 'withdrawals', withdrawalId), {
    status: 'completed',
    processedAt: Date.now(),
    updatedAt: Date.now(),
  });
};

/**
 * الأدمن يرفض طلب سحب ذاتي — الماسة يرجع
 */
export const adminRejectWithdrawal = async (
  withdrawalId: string,
  reason: string,
): Promise<void> => {
  const wRef = doc(firestore, 'withdrawals', withdrawalId);

  await runTransaction(firestore, async (tx) => {
    const wSnap = await tx.get(wRef);
    if (!wSnap.exists()) throw new Error('الطلب غير موجود');
    const w = wSnap.data() as WithdrawalRequest;
    if (w.status !== 'pending') throw new Error('الطلب مُعالج');

    // إرجاع الماسة
    const memberRef = doc(firestore, 'users', w.uid);
    tx.update(memberRef, buildBalanceIncrementPatch('pearls', w.amount));

    tx.update(wRef, {
      status: 'rejected',
      rejectionReason: reason,
      processedAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  const w = (await getDoc(wRef)).data() as WithdrawalRequest;
  await addDoc(collection(firestore, 'transactions'), {
    uid: w.uid,
    type: 'withdrawal_refund',
    amount: w.amount,
    currency: 'pearls',
    status: 'completed',
    withdrawalId,
    itemName: 'استرجاع ماسة — رفض السحب',
    createdAt: Date.now(),
  });
};

/**
 * جلب طلبات السحب الخاصة بي
 */
export const getMyWithdrawals = async (
  max = 50,
): Promise<WithdrawalRequest[]> => {
  const user = auth.currentUser;
  if (!user) return [];
  const q = query(
    collection(firestore, 'withdrawals'),
    where('uid', '==', user.uid),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as WithdrawalRequest));
};

/** جلب فوري لطلبات الوكيل (سحب بالنيابة) */
export const fetchAgentWithdrawals = async (): Promise<WithdrawalRequest[]> => {
  const fn = httpsCallable<Record<string, never>, { withdrawals: WithdrawalRequest[] }>(
    functions,
    'listAgentWithdrawals',
  );
  const res = await fn({});
  return (res.data.withdrawals ?? []) as WithdrawalRequest[];
};

/**
 * الاستماع لطلبات السحب الواردة للوكيل — عبر Cloud Function
 */
export const subscribeToAgentPendingWithdrawals = (
  callback: (requests: WithdrawalRequest[]) => void,
): (() => void) => {
  let cancelled = false;
  const load = async () => {
    try {
      const all = await fetchAgentWithdrawals();
      if (!cancelled) {
        callback(all.filter((w) => w.status === 'pending'));
      }
    } catch {
      if (!cancelled) callback([]);
    }
  };
  void load();
  const timer = setInterval(() => void load(), AGENT_WITHDRAWALS_POLL_MS);
  return () => {
    cancelled = true;
    clearInterval(timer);
  };
};

/**
 * كل طلبات سحب أعضاء الوكالة — عبر Cloud Function
 */
export const subscribeToAgentWithdrawals = (
  callback: (requests: WithdrawalRequest[]) => void,
): (() => void) => {
  let cancelled = false;
  const load = async () => {
    try {
      const all = await fetchAgentWithdrawals();
      if (!cancelled) callback(all);
    } catch {
      if (!cancelled) callback([]);
    }
  };
  void load();
  const timer = setInterval(() => void load(), AGENT_WITHDRAWALS_POLL_MS);
  return () => {
    cancelled = true;
    clearInterval(timer);
  };
};

/**
 * طرق الدفع المدعومة
 */
export const PAYMENT_METHODS = [
  { id: 'bank' as PaymentMethod, label: 'بنك', desc: 'تحويل بنكي (IBAN)' },
  { id: 'usdt' as PaymentMethod, label: 'USDT-TRC20', desc: 'محفظة تيثر' },
  { id: 'paypal' as PaymentMethod, label: 'PayPal', desc: 'حساب باي بال' },
  { id: 'email' as PaymentMethod, label: 'البريد الإلكتروني', desc: 'تواصل عبر البريد' },
];
