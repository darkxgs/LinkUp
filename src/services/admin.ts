/**
 * Admin Service — كل عمليات قراءة/كتابة البيانات
 * مربوط بنفس Firestore الخاص بالتطبيق
 */

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  Timestamp,
  addDoc,
  increment,
  deleteField,
  runTransaction,
  writeBatch,
  arrayUnion,
} from 'firebase/firestore';
import { ref, get as rtdbGet, query as rtdbQuery, orderByChild, limitToLast } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { firestore, realtimeDb, auth, functions } from '@/lib/firebase';
import { formatPublicAccountId } from '@/utils/publicAccountId';
import {
  setCountryScopeProfile,
  isInAdminCountryScope,
  isSuperCountryScope,
  getUserCountry,
  preloadUserCountries,
  countryFromUserDoc,
  getCachedUserCountry,
  assertCountryAccess,
  assertUidInAdminCountryScope,
  scopedFetchLimit,
  isRelationshipInScope,
  normalizeCountryCode,
} from '@/services/countryScope';

// ==================== TYPES ====================
export interface AdminUser {
  uid: string;
  publicAccountId: string;
  displayName: string;
  avatar: string;
  email?: string;
  phoneNumber?: string;
  gender: string;
  country: string;
  coins: number;
  pearls: number;
  casinoCoins: number;
  level: number;
  followers: number;
  following: number;
  isVIP?: boolean;
  isVerified?: boolean;
  isBanned?: boolean;
  withdrawalBlocked?: boolean;
  banReason?: string;
  vipLevel?: number;
  bio?: string;
  birthYear?: number;
  agencyId?: string;
  createdAt: number;
  lastSeen?: number;
}

export interface AdminCreateAppUserInput {
  email: string;
  password: string;
  displayName: string;
  gender?: 'male' | 'female';
  country?: string;
  coins?: number;
  pearls?: number;
  casinoCoins?: number;
  isVIP?: boolean;
  isVerified?: boolean;
  isBanned?: boolean;
  phoneNumber?: string;
  bio?: string;
}

export interface AdminUpdateAppUserPatch {
  displayName?: string;
  avatar?: string;
  bio?: string;
  gender?: 'male' | 'female';
  country?: string;
  birthYear?: number;
  phoneNumber?: string;
  email?: string;
  isVIP?: boolean;
  isVerified?: boolean;
  isBanned?: boolean;
  withdrawalBlocked?: boolean;
  banReason?: string;
  vipLevel?: number;
  vipPoints?: number;
  vipPointsMonth?: number;
  coins?: number;
  pearls?: number;
  casinoCoins?: number;
  level?: number;
  followers?: number;
  following?: number;
}

export type AdminBulkDeleteMode = 'selected' | 'active' | 'inactive' | 'all';

export interface AdminBulkDeleteResult {
  ok: boolean;
  deleted: number;
  failed: number;
  errors?: string[];
}

type BalanceField = 'coins' | 'pearls' | 'casinoCoins';

function pickBalance(data: Record<string, unknown> | undefined, field: BalanceField): number {
  if (!data) return 0;
  const stats = (data.stats as Record<string, unknown>) ?? {};
  const n = stats[field] ?? data[field] ?? 0;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

export interface AdminTransaction {
  id: string;
  uid: string;
  type: string;
  amount: number;
  currency?: string;
  itemName?: string;
  status: string;
  createdAt: number;
}

export interface AdminRoom {
  id: string;
  name: string;
  hostUid: string;
  hostName?: string;
  country: string;
  banner?: string;
  category?: string;
  memberCount?: number;
  totalGifts?: number;
  isActive?: boolean;
  isLocked?: boolean;
  /** غرفة خاصة — تظهر فقط لمن يملك رابطها */
  isPrivate?: boolean;
  seatsCount?: number;
  maxSeatsCount?: number;
  agencyId?: string;
  isAgencyRoom?: boolean;
  createdAt: number;
}

export interface AdminAgency {
  id: string;
  name: string;
  ownerName: string;
  country: string;
  members: number;
  earnings: number;
  rating: number;
  isVerified?: boolean;
  logo?: string;
  banner?: string;
}

// ==================== USERS ====================
export const getUsers = async (limitCount = 100): Promise<AdminUser[]> => {
  try {
    const fetchLimit = scopedFetchLimit(limitCount);
    const q = query(
      collection(firestore, 'users'),
      orderBy('createdAt', 'desc'),
      limit(fetchLimit),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      // العملات/الإحصائيات في stats.* المتداخل — مع fallback للحقول المباشرة (legacy)
      const stats = data.stats ?? {};
      return {
        uid: d.id,
        publicAccountId: formatPublicAccountId(data.publicAccountId, d.id),
        displayName: data.profile?.displayName ?? data.displayName ?? 'مستخدم',
        avatar: data.profile?.avatar ?? data.avatar ?? '',
        email: data.email,
        phoneNumber: data.phoneNumber,
        gender: data.profile?.gender ?? data.gender ?? 'male',
        country: countryFromUserDoc(data as Record<string, unknown>) || 'PS',
        coins: stats.coins ?? data.coins ?? 0,
        pearls: stats.pearls ?? data.pearls ?? 0,
        casinoCoins: stats.casinoCoins ?? data.casinoCoins ?? 0,
        // إصلاح #18 — ثلاثة مصادر للمستوى: stats.level → data.level → data.profile.level
        level: stats.level ?? data.level ?? (data.profile as any)?.level ?? 1,
        followers: stats.followers ?? data.followers ?? 0,
        following: stats.following ?? data.following ?? 0,
        isVIP: data.isVIP,
        isVerified: data.isVerified,
        isBanned: data.isBanned,
        withdrawalBlocked: data.withdrawalBlocked,
        banReason: data.banReason,
        vipLevel: data.vipLevel,
        bio: data.profile?.bio ?? data.bio,
        birthYear: data.profile?.birthYear ?? data.birthYear,
        agencyId: data.agencyId,
        createdAt: data.createdAt ?? Date.now(),
        lastSeen: data.lastSeen,
      };
    })
      .filter((u) => isInAdminCountryScope(u.country))
      .slice(0, limitCount);
  } catch (e) {
    console.error('getUsers:', e);
    return [];
  }
};

/** حل معرّف الحساب (8 أرقام) أو Firebase UID */
export async function resolveUserAccountId(raw: string): Promise<string | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9]{20,}$/.test(trimmed)) {
    const snap = await getDoc(doc(firestore, 'users', trimmed));
    if (snap.exists()) return snap.id;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits) {
    const publicId = digits.length >= 8 ? digits.slice(-8) : digits.padStart(8, '0');
    const q = query(
      collection(firestore, 'users'),
      where('publicAccountId', '==', publicId),
      limit(1),
    );
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;
  }
  return null;
}

export const getUserById = async (identifier: string): Promise<AdminUser | null> => {
  try {
    let uid = identifier.trim();
    const direct = await getDoc(doc(firestore, 'users', uid));
    if (!direct.exists()) {
      const resolved = await resolveUserAccountId(uid);
      if (!resolved) return null;
      uid = resolved;
    }
    const snap = await getDoc(doc(firestore, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    const country = countryFromUserDoc(data as Record<string, unknown>);
    if (!isInAdminCountryScope(country)) return null;
    const stats = (data as any).stats ?? {};
    return {
      uid: snap.id,
      publicAccountId: formatPublicAccountId((data as any).publicAccountId, snap.id),
      displayName: (data as any).profile?.displayName ?? (data as any).displayName ?? 'مستخدم',
      avatar: (data as any).profile?.avatar ?? (data as any).avatar ?? '',
      email: (data as any).email,
      phoneNumber: (data as any).phoneNumber,
      gender: (data as any).profile?.gender ?? (data as any).gender ?? 'male',
      country,
      coins: stats.coins ?? (data as any).coins ?? 0,
      pearls: stats.pearls ?? (data as any).pearls ?? 0,
      casinoCoins: stats.casinoCoins ?? (data as any).casinoCoins ?? 0,
      level: stats.level ?? (data as any).level ?? 1,
      followers: stats.followers ?? (data as any).followers ?? 0,
      following: stats.following ?? (data as any).following ?? 0,
      isVIP: (data as any).isVIP,
      isVerified: (data as any).isVerified,
      isBanned: (data as any).isBanned,
      withdrawalBlocked: (data as any).withdrawalBlocked,
      banReason: (data as any).banReason,
      vipLevel: (data as any).vipLevel,
      bio: (data as any).profile?.bio ?? (data as any).bio,
      birthYear: (data as any).profile?.birthYear ?? (data as any).birthYear,
      agencyId: (data as any).agencyId,
      createdAt: (data as any).createdAt ?? Date.now(),
      lastSeen: (data as any).lastSeen,
    };
  } catch {
    return null;
  }
};

export const adminCreateAppUser = async (
  input: AdminCreateAppUserInput,
): Promise<{ uid: string; publicAccountId: string; displayName: string }> => {
  const fn = httpsCallable<
    AdminCreateAppUserInput,
    { ok: boolean; uid: string; publicAccountId: string; displayName: string }
  >(functions, 'adminCreateAppUser');
  const res = await fn(input);
  return {
    uid: res.data.uid,
    publicAccountId: res.data.publicAccountId,
    displayName: res.data.displayName,
  };
};

export const adminUpdateAppUser = async (
  uid: string,
  patch: AdminUpdateAppUserPatch,
): Promise<void> => {
  const fn = httpsCallable<{ uid: string; patch: AdminUpdateAppUserPatch }, { ok: boolean }>(
    functions,
    'adminUpdateAppUser',
  );
  await fn({ uid, patch });
};

export const adminSetAppUserPassword = async (uid: string, password: string): Promise<void> => {
  const fn = httpsCallable<{ uid: string; password: string }, { ok: boolean }>(
    functions,
    'adminSetAppUserPassword',
  );
  await fn({ uid, password });
};

export const adminDeleteAppUsers = async (opts: {
  mode: AdminBulkDeleteMode;
  uids?: string[];
  confirmPhrase?: string;
}): Promise<AdminBulkDeleteResult> => {
  const fn = httpsCallable<
    { mode: AdminBulkDeleteMode; uids?: string[]; confirmPhrase?: string },
    AdminBulkDeleteResult
  >(functions, 'adminDeleteAppUsers');
  const res = await fn(opts);
  return res.data;
};

interface BackfillPage {
  done: boolean;
  processed: number;
  stored: number;
  indexed: number;
  nextCursor: string | null;
}

/**
 * مزامنة معرّفات الحساب لكل المستخدمين (يشمل القدامى) — يمر على كل الصفحات
 * يجعل كل الحسابات قابلة للبحث في دعوة الوكالة.
 */
export const backfillPublicAccountIds = async (
  onProgress?: (p: { processed: number; stored: number; indexed: number }) => void,
): Promise<{ processed: number; stored: number; indexed: number }> => {
  const fn = httpsCallable<
    { startAfter?: string; pageSize?: number },
    BackfillPage
  >(functions, 'backfillPublicAccountIds');

  let cursor: string | null | undefined;
  let processed = 0;
  let stored = 0;
  let indexed = 0;

  for (let i = 0; i < 200; i++) {
    const res = await fn({ startAfter: cursor ?? undefined, pageSize: 500 });
    const d = res.data;
    processed += d.processed;
    stored += d.stored;
    indexed += d.indexed;
    onProgress?.({ processed, stored, indexed });
    if (d.done || !d.nextCursor) break;
    cursor = d.nextCursor;
  }

  return { processed, stored, indexed };
};

export const banUser = async (uid: string, banned: boolean): Promise<void> => {
  assertCountryAccess(await getUserCountry(uid));
  await updateDoc(doc(firestore, 'users', uid), { isBanned: banned });
};

/**
 * تعليق مؤقت للحساب — يمنع الدخول حتى انتهاء المدة أو رفع التعليق يدوياً.
 * يفعّل isBanned/banReason أيضاً لأن تطبيق الموبايل يراقب هذين الحقلين مباشرة (onSnapshot حي)
 * ويحجب المستخدم فوراً بدون أي تعديل على التطبيق — isSuspended/suspendedUntil للتتبّع الداخلي فقط
 * (لتمييز التعليق المؤقت عن الحظر الدائم في لوحة التحكم وتفعيل الرفع التلقائي بعد انتهاء المدة).
 */
export const suspendUser = async (
  uid: string,
  durationDays: number,
  reason?: string,
): Promise<void> => {
  assertCountryAccess(await getUserCountry(uid));
  const suspendedUntil = Date.now() + Math.max(1, durationDays) * 24 * 60 * 60 * 1000;
  const trimmedReason = reason?.trim();
  await updateDoc(doc(firestore, 'users', uid), {
    isSuspended: true,
    suspendedUntil,
    suspendReason: trimmedReason || null,
    isBanned: true,
    banReason: `الحساب معلّق حتى ${formatDate(suspendedUntil)}${trimmedReason ? ` — ${trimmedReason}` : ''}`,
  });
};

export const unsuspendUser = async (uid: string): Promise<void> => {
  assertCountryAccess(await getUserCountry(uid));
  await updateDoc(doc(firestore, 'users', uid), {
    isSuspended: false,
    suspendedUntil: deleteField(),
    suspendReason: deleteField(),
    isBanned: false,
    banReason: deleteField(),
  });
};

export const toggleVIP = async (uid: string, isVIP: boolean): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  await updateDoc(doc(firestore, 'users', uid), { isVIP });
};

export const toggleVerified = async (uid: string, isVerified: boolean): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  if (isVerified) {
    await updateDoc(doc(firestore, 'users', uid), {
      isVerified: true,
      verificationStatus: 'approved',
      verifiedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return;
  }
  await revokeUserVerification(uid);
};

/** إلغاء توثيق المستخدم — يزامن users + kycRequests + وكالة المضيفة إن وُجدت */
export const revokeUserVerification = async (
  uid: string,
  reason = 'تم إلغاء التوثيق من الإدارة',
): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  const now = Date.now();
  const adminUid = auth.currentUser?.uid ?? 'admin';

  await updateDoc(doc(firestore, 'users', uid), {
    isVerified: false,
    verificationStatus: 'rejected',
    verifiedAt: deleteField(),
    updatedAt: now,
  });

  const kycRef = doc(firestore, 'kycRequests', uid);
  const kycSnap = await getDoc(kycRef);
  if (kycSnap.exists()) {
    await updateDoc(kycRef, {
      status: 'rejected',
      rejectionReason: reason,
      revokedAt: now,
      revokedBy: adminUid,
      updatedAt: now,
    });
  }

  // إن كانت مضيفة موثّقة في وكالة — إرجاعها لعضو عادي
  const memberQ = await getDocs(
    query(
      collection(firestore, 'agencyMembers'),
      where('uid', '==', uid),
      limit(1),
    ),
  );
  if (!memberQ.empty) {
    const memberDoc = memberQ.docs[0];
    const memberData = memberDoc.data() as Record<string, unknown>;
    if (memberData.hostVerified === true && memberData.isFemaleHost === true) {
      const agencyId = String(memberData.agencyId ?? '').trim();
      await updateDoc(memberDoc.ref, {
        hostVerified: false,
        role: 'member',
        verifiedAt: deleteField(),
        verifiedBy: deleteField(),
        updatedAt: now,
      });
      await updateDoc(doc(firestore, 'users', uid), {
        agencyRole: 'member',
        accountKind: 'member',
        updatedAt: now,
      });
      if (agencyId) {
        const agencyRef = doc(firestore, 'agencies', agencyId);
        const agencySnap = await getDoc(agencyRef);
        if (agencySnap.exists()) {
          const current = Number((agencySnap.data() as Record<string, unknown>).femaleHostCount) || 0;
          await updateDoc(agencyRef, {
            femaleHostCount: Math.max(0, current - 1),
            updatedAt: now,
          });
        }
      }
    }
  }

  await addDoc(collection(firestore, 'notifications'), {
    uid,
    type: 'system',
    message: `تم إلغاء توثيق حسابك: ${reason}`,
    data: {
      title: 'إلغاء التوثيق',
      body: `تم إلغاء توثيق حسابك من الإدارة. السبب: ${reason}`,
      type: 'kyc_revoked',
      route: '/wallet/kyc',
    },
    isRead: false,
    createdAt: now,
  });
};

/** إلغاء التوثيق من صفحة طلبات KYC */
export const revokeKycVerification = revokeUserVerification;

export const adjustBalance = async (
  uid: string,
  field: BalanceField,
  newAmount: number,
): Promise<void> => {
  assertCountryAccess(await getUserCountry(uid));
  const safe = Math.max(0, Math.floor(Number(newAmount) || 0));
  await updateDoc(doc(firestore, 'users', uid), {
    [`stats.${field}`]: safe,
    [field]: safe,
  });
};

/**
 * إضافة رصيد (شحن حقيقي) — يُحدَّث Firestore فوراً ويظهر في التطبيق
 */
export const addUserBalance = async (
  uid: string,
  field: BalanceField,
  delta: number,
  meta?: { note?: string },
): Promise<{ newBalance: number }> => {
  assertCountryAccess(await getUserCountry(uid));
  const amount = Math.floor(Number(delta) || 0);
  if (amount <= 0) throw new Error('أدخل مبلغاً أكبر من صفر');

  const userRef = doc(firestore, 'users', uid);
  const before = await getDoc(userRef);
  if (!before.exists()) throw new Error('المستخدم غير موجود');

  await updateDoc(userRef, {
    [`stats.${field}`]: increment(amount),
    [field]: increment(amount),
  });

  if (field === 'coins') {
    await addDoc(collection(firestore, 'transactions'), {
      uid,
      type: 'admin_grant',
      amount,
      currency: 'coins',
      itemName: meta?.note ?? 'شحن من لوحة التحكم',
      status: 'completed',
      createdAt: Date.now(),
    });

    await addDoc(collection(firestore, 'notifications'), {
      uid,
      type: 'system',
      message: `تم شحن ${amount.toLocaleString()} عملة إلى حسابك`,
      data: {
        title: 'LinkUp',
        body: `+${amount.toLocaleString()} عملة — ${meta?.note ?? 'شحن من الإدارة'}`,
        type: 'admin_recharge',
      },
      isRead: false,
      createdAt: Date.now(),
    });

    try {
      await addVipPointsAdmin(uid, amount);
    } catch { /* ignore */ }

    try {
      const bonusFn = httpsCallable<{ targetUid: string }, { bonus?: number }>(
        functions,
        'tryFirstRechargeBonus',
      );
      await bonusFn({ targetUid: uid });
    } catch { /* ignore */ }
  }

  const after = await getDoc(userRef);
  return { newBalance: pickBalance(after.data() as Record<string, unknown>, field) };
};

export interface GrantCoinsResult {
  uid: string;
  displayName: string;
  publicAccountId: string;
  previousBalance: number;
  added: number;
  firstRechargeBonus?: number;
  newBalance: number;
}

/** شحن عملات عبر معرّف الحساب (8 أرقام) أو UID — Cloud Function */
export const grantCoinsByAccountId = async (
  accountIdRaw: string,
  coins: number,
  note?: string,
): Promise<GrantCoinsResult> => {
  const fn = httpsCallable<
    { accountId: string; coins: number; note?: string },
    GrantCoinsResult
  >(functions, 'adminGrantCoins');
  const { data } = await fn({
    accountId: accountIdRaw.trim(),
    coins: Math.floor(Number(coins) || 0),
    note: note?.trim() || undefined,
  });
  return data;
};

// ==================== TRANSACTIONS ====================
export const getGameTransactions = async (limitCount = 100): Promise<AdminTransaction[]> => {
  try {
    const q = query(
      collection(firestore, 'gameTransactions'),
      orderBy('createdAt', 'desc'),
      limit(scopedFetchLimit(limitCount)),
    );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    if (isSuperCountryScope()) return rows.slice(0, limitCount);
    await preloadUserCountries(rows.map((t) => String(t.uid ?? '')));
    return rows
      .filter((t) => isInAdminCountryScope(getCachedUserCountry(String(t.uid ?? ''))))
      .slice(0, limitCount);
  } catch (e) {
    console.error('getGameTransactions:', e);
    return [];
  }
};

export const updateTransactionStatus = async (id: string, status: string): Promise<void> => {
  const txRef = doc(firestore, 'transactions', id);
  const snap = await getDoc(txRef);
  if (!snap.exists()) throw new Error('المعاملة غير موجودة');

  const tx = snap.data() as Record<string, unknown>;
  const prevStatus = String(tx.status ?? '');
  const uid = String(tx.uid ?? '');
  if (!uid) throw new Error('معاملة بدون مستخدم');
  await assertUidInAdminCountryScope(uid);

  if (status === 'completed' && prevStatus === 'pending') {
    const type = String(tx.type ?? '');
    const coinAmount = Math.abs(Math.floor(Number(tx.amount) || 0));
    if (type === 'recharge' && coinAmount > 0) {
      await addUserBalance(uid, 'coins', coinAmount, {
        note: `اعتماد شحن — معاملة ${id.slice(0, 8)}`,
      });
    }
  }

  await updateDoc(txRef, {
    status,
    updatedAt: Date.now(),
  });
};

// ==================== WITHDRAWALS ====================
export interface AdminWithdrawal {
  id: string;
  uid: string;
  uidName: string;
  uidAvatar: string;
  type: 'self' | 'via_agent';
  amount: number;
  commission: number;
  netAmount: number;
  fiatValue: number;
  method: string;
  accountInfo: any;
  status: string;
  agentUid?: string;
  agentName?: string;
  agencyId?: string;
  rejectionReason?: string;
  createdAt: number;
  updatedAt: number;
}

export const getWithdrawals = async (limitCount = 200): Promise<AdminWithdrawal[]> => {
  try {
    const q = query(
      collection(firestore, 'withdrawals'),
      orderBy('createdAt', 'desc'),
      limit(scopedFetchLimit(limitCount, 3)),
    );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as AdminWithdrawal[];
    if (isSuperCountryScope()) return rows.slice(0, limitCount);
    await preloadUserCountries(rows.map((w) => w.uid));
    return rows
      .filter((w) => isInAdminCountryScope(getCachedUserCountry(w.uid)))
      .slice(0, limitCount);
  } catch (e) {
    console.error('getWithdrawals:', e);
    return [];
  }
};

/** اعتماد طلب سحب — فقط ضمن نطاق دولة المشرف */
export const approveWithdrawal = async (withdrawalId: string): Promise<void> => {
  const wRef = doc(firestore, 'withdrawals', withdrawalId);
  const snap = await getDoc(wRef);
  if (!snap.exists()) throw new Error('طلب السحب غير موجود');
  const w = snap.data() as AdminWithdrawal;
  await assertUidInAdminCountryScope(String(w.uid ?? ''));
  await updateDoc(wRef, {
    status: 'completed',
    processedAt: Date.now(),
    updatedAt: Date.now(),
  });
};

/** رفض طلب سحب وإرجاع الماسة — فقط ضمن نطاق دولة المشرف */
export const rejectWithdrawal = async (
  withdrawalId: string,
  reason: string,
): Promise<void> => {
  const wRef = doc(firestore, 'withdrawals', withdrawalId);
  const snap = await getDoc(wRef);
  if (!snap.exists()) throw new Error('طلب السحب غير موجود');
  const w = snap.data() as AdminWithdrawal;
  const uid = String(w.uid ?? '');
  const amount = Math.floor(Number(w.amount) || 0);
  await assertUidInAdminCountryScope(uid);
  await runTransaction(firestore, async (tx) => {
    const memberRef = doc(firestore, 'users', uid);
    tx.update(memberRef, { 'stats.pearls': increment(amount) });
    tx.update(wRef, {
      status: 'rejected',
      rejectionReason: reason,
      processedAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
};

// ==================== KYC REQUESTS ====================
export interface AdminKycRequest {
  id: string;
  uid: string;
  displayName: string;
  avatar: string;
  gender: string;
  fullName: string;
  birthDate: string;
  nationality: string;
  phoneNumber: string;
  idFront: string;
  idBack: string;
  selfie: string;
  verificationFrameUrl?: string;
  videoUrl?: string;
  aiGender?: string;
  aiConfidence?: number;
  aiProvider?: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing';
  rejectionReason?: string;
  revokedAt?: number;
  revokedBy?: string;
  approvedAt?: number;
  method: 'manual' | 'ai' | 'face';
  createdAt: number;
  updatedAt: number;
}

export const getKycRequests = async (limitCount = 200): Promise<AdminKycRequest[]> => {
  try {
    const q = query(
      collection(firestore, 'kycRequests'),
      orderBy('createdAt', 'desc'),
      limit(scopedFetchLimit(limitCount, 5)),
    );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as AdminKycRequest[];
    if (isSuperCountryScope()) return rows.slice(0, limitCount);
    await preloadUserCountries(rows.map((r) => r.uid));
    return rows
      .filter((r) => isInAdminCountryScope(getCachedUserCountry(r.uid)))
      .slice(0, limitCount);
  } catch (e) {
    console.error('getKycRequests:', e);
    return [];
  }
};

export const approveKycRequest = async (uid: string): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  await updateDoc(doc(firestore, 'kycRequests', uid), {
    status: 'approved',
    method: 'manual',
    approvedAt: Date.now(),
    rejectionReason: deleteField(),
    revokedAt: deleteField(),
    revokedBy: deleteField(),
    updatedAt: Date.now(),
  });
  await updateDoc(doc(firestore, 'users', uid), {
    isVerified: true,
    verificationStatus: 'approved',
    verifiedAt: Date.now(),
    isBanned: false,
    banReason: null,
    updatedAt: Date.now(),
  });

  // Automatically activate agency membership if they are a female host in an agency
  const memberQ = await getDocs(
    query(
      collection(firestore, 'agencyMembers'),
      where('uid', '==', uid),
      limit(1),
    ),
  );
  if (!memberQ.empty) {
    const memberDoc = memberQ.docs[0];
    const memberData = memberDoc.data() as Record<string, any>;
    const isFemaleHost = memberData.isFemaleHost === true;
    if (isFemaleHost && memberData.hostVerified !== true) {
      const now = Date.now();
      const adminUid = auth.currentUser?.uid ?? 'admin';

      await updateDoc(memberDoc.ref, {
        role: 'host',
        hostVerified: true,
        verifiedAt: now,
        verifiedBy: adminUid,
      });

      await updateDoc(doc(firestore, 'users', uid), {
        agencyRole: 'host',
        accountKind: 'host',
      });

      const agencyId = String(memberData.agencyId ?? '');
      if (agencyId) {
        const agencyRef = doc(firestore, 'agencies', agencyId);
        const agencySnap = await getDoc(agencyRef);
        if (agencySnap.exists()) {
          const agencyData = agencySnap.data() as Record<string, any>;
          const newFemaleCount = (Number(agencyData.femaleHostCount) || 0) + 1;
          const minRequired = Number(agencyData.minHostsRequired) || 10;

          await updateDoc(agencyRef, {
            femaleHostCount: newFemaleCount,
            updatedAt: now,
          });

          // Update associated agency application if it is awaiting hosts
          const appQuery = await getDocs(
            query(
              collection(firestore, 'agencyApplications'),
              where('agencyId', '==', agencyId),
              where('status', '==', 'awaiting_hosts'),
              limit(1),
            ),
          );
          if (!appQuery.empty) {
            const appDoc = appQuery.docs[0];
            const nextAppStatus = newFemaleCount >= minRequired ? 'ready' : 'awaiting_hosts';
            await updateDoc(appDoc.ref, {
              status: nextAppStatus,
              femaleHostCount: newFemaleCount,
              updatedAt: now,
            });
          }
        }
      }
    }
  }

  await addDoc(collection(firestore, 'notifications'), {
    uid,
    type: 'system',
    message: 'تم توثيق حسابك بنجاح',
    data: {
      title: 'توثيق الحساب',
      body: 'تهانينا! تم قبول طلب التحقق الخاص بك بنجاح.',
      type: 'kyc_approved',
    },
    isRead: false,
    createdAt: Date.now(),
  });
};

export const rejectKycRequest = async (uid: string, reason: string): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  await updateDoc(doc(firestore, 'kycRequests', uid), {
    status: 'rejected',
    method: 'manual',
    rejectionReason: reason,
    updatedAt: Date.now(),
  });
  await updateDoc(doc(firestore, 'users', uid), {
    isVerified: false,
    verificationStatus: 'rejected',
    updatedAt: Date.now(),
  });
  await addDoc(collection(firestore, 'notifications'), {
    uid,
    type: 'system',
    message: `تم رفض طلب توثيق حسابك: ${reason}`,
    data: {
      title: 'توثيق الحساب',
      body: `عذراً، تم رفض طلب توثيق حسابك. السبب: ${reason}`,
      type: 'kyc_rejected',
    },
    isRead: false,
    createdAt: Date.now(),
  });
};

// ==================== RELATIONSHIPS ====================
export interface AdminRelationship {
  id: string;
  user1Uid: string;
  user2Uid: string;
  user1Name: string;
  user1Avatar: string;
  user2Name: string;
  user2Avatar: string;
  level: number;
  intimacyPoints: number;
  giftsExchanged: number;
  updatedAt: number;
}

export const getRelationships = async (limitCount = 100): Promise<AdminRelationship[]> => {
  try {
    const q = query(
      collection(firestore, 'relationships'),
      orderBy('intimacyPoints', 'desc'),
      limit(scopedFetchLimit(limitCount, 4)),
    );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as AdminRelationship[];
    if (isSuperCountryScope()) return rows.slice(0, limitCount);
    const filtered: AdminRelationship[] = [];
    for (const r of rows) {
      if (await isRelationshipInScope(r.user1Uid, r.user2Uid)) filtered.push(r);
      if (filtered.length >= limitCount) break;
    }
    return filtered;
  } catch (e) {
    console.error('getRelationships:', e);
    return [];
  }
};

// ==================== ROOMS (Realtime DB) ====================
export const getRooms = async (): Promise<AdminRoom[]> => {
  try {
    const snap = await rtdbGet(ref(realtimeDb, 'rooms'));
    if (!snap.exists()) return [];
    const data = snap.val();
    const raw = Object.entries(data).map(([id, room]: [string, any]) => ({
      id,
      name: room.name ?? 'غرفة',
      hostUid: room.hostUid ?? '',
      hostName: room.hostName,
      country: normalizeCountryCode(room.country),
      banner: room.banner,
      category: room.category,
      memberCount: room.memberCount ?? room.members?.length ?? 0,
      totalGifts: room.totalGifts ?? 0,
      isActive: room.isActive,
      isLocked: room.isLocked === true,
      // إصلاح #29 — تتبع الغرف الخاصة
      isPrivate: room.isPrivate === true,
      seatsCount: Number(room.seatsCount) || 9,
      maxSeatsCount: Number(room.maxSeatsCount) || undefined,
      agencyId: room.agencyId ? String(room.agencyId) : undefined,
      isAgencyRoom: room.isAgencyRoom === true || !!room.agencyId,
      createdAt: room.createdAt ?? Date.now(),
    }));

    if (isSuperCountryScope()) return raw;

    const hostUids = raw.filter((r) => !r.country && r.hostUid).map((r) => r.hostUid);
    await preloadUserCountries(hostUids);

    return raw.filter((r) => {
      const country = r.country || getCachedUserCountry(r.hostUid);
      return isInAdminCountryScope(country);
    });
  } catch (e) {
    console.error('getRooms:', e);
    return [];
  }
};

/**
 * إغلاق روم بالقوة من الأدمن
 * يضع isActive=false → التطبيق يخرج كل المشاركين
 */
export const forceCloseRoom = async (roomId: string): Promise<void> => {
  const rooms = await getRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (room) assertCountryAccess(room.country);
  const { update } = await import('firebase/database');
  await update(ref(realtimeDb, `rooms/${roomId}`), {
    isActive: false,
    closedByAdmin: true,
    closedAt: Date.now(),
  });
};

/**
 * حذف روم نهائياً (مع كل بياناتها)
 */
export const deleteRoom = async (roomId: string): Promise<void> => {
  const rooms = await getRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) throw new Error('الغرفة غير موجودة أو خارج نطاق دولك');
  assertCountryAccess(room.country);
  const { remove } = await import('firebase/database');
  await Promise.all([
    remove(ref(realtimeDb, `rooms/${roomId}`)),
    remove(ref(realtimeDb, `roomMessages/${roomId}`)),
    remove(ref(realtimeDb, `roomAudience/${roomId}`)),
  ]);
};

/**
 * إصلاح #25 — تبديل حالة قفل الغرفة (مقفلة/مفتوحة)
 * يكتب isLocked مباشرة في Realtime DB → التطبيق يمنع الدخول الجديد إذا كانت مقفلة
 */
export const setRoomLocked = async (roomId: string, locked: boolean): Promise<void> => {
  const rooms = await getRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (room) assertCountryAccess(room.country);
  const { update } = await import('firebase/database');
  await update(ref(realtimeDb, `rooms/${roomId}`), {
    isLocked: locked,
    lockedByAdmin: locked ? true : null,
    lockedAt: locked ? Date.now() : null,
  });
};

/**
 * إصلاح #24 — بحث غرفة بمعرّفها مباشرةً من Realtime DB
 * يتجاوز القائمة المحمّلة في الذاكرة — مفيد للبحث عن غرف غير محمّلة بعد
 */
export const getRoomById = async (roomId: string): Promise<AdminRoom | null> => {
  try {
    const snap = await rtdbGet(ref(realtimeDb, `rooms/${roomId}`));
    if (!snap.exists()) return null;
    const room = snap.val() as any;
    return {
      id: roomId,
      name: room.name ?? 'غرفة',
      hostUid: room.hostUid ?? '',
      hostName: room.hostName,
      country: normalizeCountryCode(room.country),
      banner: room.banner,
      category: room.category,
      memberCount: room.memberCount ?? room.members?.length ?? 0,
      totalGifts: room.totalGifts ?? 0,
      isActive: room.isActive,
      isLocked: room.isLocked === true,
      isPrivate: room.isPrivate === true,
      seatsCount: Number(room.seatsCount) || 9,
      maxSeatsCount: Number(room.maxSeatsCount) || undefined,
      agencyId: room.agencyId ? String(room.agencyId) : undefined,
      isAgencyRoom: room.isAgencyRoom === true || !!room.agencyId,
      createdAt: room.createdAt ?? Date.now(),
    };
  } catch (e) {
    console.error('getRoomById:', e);
    return null;
  }
};

// ==================== AGENCIES ====================
export const getAgencies = async (): Promise<AdminAgency[]> => {
  try {
    const q = query(collection(firestore, 'agencies'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        name: String(data.name ?? data.agencyName ?? '—'),
        ownerName: String(data.ownerName ?? '—'),
        country: String(data.country ?? data.countryCode ?? '—'),
        members: Number(data.members ?? data.memberCount ?? 0) || 0,
        earnings: Number(data.earnings ?? data.totalEarnings ?? 0) || 0,
        rating: Number(data.rating ?? 0) || 0,
        isVerified: Boolean(data.isVerified),
        logo: data.logo ? String(data.logo) : undefined,
        banner: data.banner ? String(data.banner) : undefined,
      };
    }).filter((a) => isInAdminCountryScope(a.country));
  } catch (e) {
    console.error('getAgencies:', e);
    return [];
  }
};

/**
 * توثيق/إلغاء توثيق وكالة
 */
async function assertAgencyIdInScope(agencyId: string): Promise<void> {
  const detail = await getAgencyFullDetail(agencyId);
  if (!detail) throw new Error('الوكالة غير موجودة أو خارج نطاق دولك');
}

export const toggleAgencyVerified = async (
  agencyId: string,
  verified: boolean,
): Promise<void> => {
  await assertAgencyIdInScope(agencyId);
  await updateDoc(doc(firestore, 'agencies', agencyId), { isVerified: verified });
};

const USER_AGENCY_UNLINK_PATCH = {
  agencyRole: deleteField(),
  agencyId: deleteField(),
  agencyName: deleteField(),
  isFemaleHost: deleteField(),
  isAgent: false,
  accountKind: 'user',
};

async function batchDeleteDocRefs(refs: ReturnType<typeof doc>[]): Promise<void> {
  const CHUNK = 450;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(firestore);
    refs.slice(i, i + CHUNK).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function deleteCollectionWhere(
  collectionName: string,
  field: string,
  value: string,
  pageSize = 450,
): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await getDocs(
      query(
        collection(firestore, collectionName),
        where(field, '==', value),
        limit(pageSize),
      ),
    );
    if (snap.empty) break;
    await batchDeleteDocRefs(snap.docs.map((d) => d.ref));
    if (snap.size < pageSize) break;
  }
}

async function agencyDocExists(agencyId: string): Promise<boolean> {
  const snap = await getDoc(doc(firestore, 'agencies', agencyId));
  return snap.exists();
}

async function purgeOrphanAgencyChat(agencyId: string, uid?: string): Promise<void> {
  const chatRef = doc(firestore, 'agencyChats', agencyId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) return;

  if (uid) {
    const members: string[] = Array.isArray(chatSnap.data()?.members)
      ? chatSnap.data()!.members
      : [];
    if (members.includes(uid)) {
      await updateDoc(chatRef, {
        members: members.filter((m) => m !== uid),
        [`memberNames.${uid}`]: deleteField(),
        [`memberAvatars.${uid}`]: deleteField(),
        updatedAt: Date.now(),
      }).catch(() => {});
    }
    return;
  }

  await deleteDoc(chatRef).catch(() => {});
  await deleteCollectionWhere('agencyChatMessages', 'chatId', agencyId);
}

/** يزيل روابط وكالة محذوفة/يتيمة ويعيد معرّف الوكالة الفعلية إن وُجدت */
export async function resolveUserActiveAgencyId(uid: string): Promise<string | null> {
  const userRef = doc(firestore, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return null;

  const user = userSnap.data() as Record<string, unknown>;
  let activeAgencyId: string | null = null;
  let needsUserUnlink = false;

  const userAgencyId = String(user.agencyId ?? '').trim();
  if (userAgencyId) {
    if (await agencyDocExists(userAgencyId)) {
      activeAgencyId = userAgencyId;
    } else {
      needsUserUnlink = true;
      await purgeOrphanAgencyChat(userAgencyId, uid);
    }
  }

  const memberSnap = await getDocs(
    query(collection(firestore, 'agencyMembers'), where('uid', '==', uid), limit(20)),
  );
  const orphanMemberRefs: ReturnType<typeof doc>[] = [];

  for (const memberDoc of memberSnap.docs) {
    const memberAgencyId = String(memberDoc.data().agencyId ?? '').trim();
    if (!memberAgencyId) {
      orphanMemberRefs.push(memberDoc.ref);
      continue;
    }
    if (await agencyDocExists(memberAgencyId)) {
      if (!activeAgencyId) activeAgencyId = memberAgencyId;
    } else {
      orphanMemberRefs.push(memberDoc.ref);
      if (userAgencyId === memberAgencyId) needsUserUnlink = true;
      await purgeOrphanAgencyChat(memberAgencyId, uid);
    }
  }

  if (orphanMemberRefs.length > 0) {
    await batchDeleteDocRefs(orphanMemberRefs);
  }
  if (needsUserUnlink && (!activeAgencyId || userAgencyId !== activeAgencyId)) {
    await updateDoc(userRef, USER_AGENCY_UNLINK_PATCH).catch(() => {});
  }

  return activeAgencyId;
}

/**
 * حذف وكالة نهائياً مع تنظيف كل الارتباطات:
 * الأعضاء، بيانات المستخدمين، دردشة العشيرة، الرسائل، وطلبات الوكالة.
 */
export const deleteAgency = async (agencyId: string): Promise<void> => {
  await assertAgencyIdInScope(agencyId);
  const fn = httpsCallable<{ agencyId: string }, { ok: boolean }>(functions, 'adminDeleteAgency');
  await fn({ agencyId });
};

export type DeleteAllAgenciesResult = {
  ok: boolean;
  deleted: number;
  failed: number;
  orphansCleared: number;
  orphanRoomsCleared: number;
  errors?: string[];
};

/** حذف كل الوكالات نهائياً — مدير النظام فقط */
export const deleteAllAgencies = async (
  confirmPhrase: string,
): Promise<DeleteAllAgenciesResult> => {
  const fn = httpsCallable<{ confirmPhrase: string }, DeleteAllAgenciesResult>(
    functions,
    'adminDeleteAllAgencies',
  );
  const res = await fn({ confirmPhrase });
  return res.data;
};

/** تنظيف بيانات يتيمة لوكالة محذوفة سابقاً (أعضاء، دعوات، دردشة، …) */
export const purgeAgencyOrphans = async (agencyId: string): Promise<void> => {
  const fn = httpsCallable<{ agencyId: string }, { ok: boolean }>(functions, 'adminPurgeAgencyOrphans');
  await fn({ agencyId });
};

/** تنظيف بيانات يتيمة لمستخدم محذوف سابقاً */
export const purgeUserOrphans = async (uid: string): Promise<void> => {
  const fn = httpsCallable<{ uid: string }, { ok: boolean }>(functions, 'adminPurgeUserOrphans');
  await fn({ uid });
};

// ==================== STATS ====================
export interface DashboardStats {
  totalUsers: number;
  totalVIP: number;
  totalRooms: number;
  totalRevenue: number;
  totalCoinsInCirculation: number;
  newUsersToday: number;
  pendingWithdrawals: number;
  activeRooms: number;
  pendingReports: number;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const usersCol = collection(firestore, 'users');
    const superScope = isSuperCountryScope();

    // عدّ المستخدمين: count-aggregation للسوبر أدمن (بدل جلب كل المستندات).
    // المشرف المحدود بدولة يحتاج المستندات نفسها للفلترة حسب الدولة.
    const [usersSnap, txSnap, rooms] = await Promise.all([
      superScope
        // للسوبر: نجلب عيّنة محدودة فقط لحساب إجمالي العملات (قيمة تقريبية)،
        // بينما الأعداد الدقيقة تأتي من count-aggregation أدناه.
        ? getDocs(query(usersCol, orderBy('createdAt', 'desc'), limit(2000)))
        : getDocs(usersCol),
      getDocs(query(collection(firestore, 'transactions'), orderBy('createdAt', 'desc'), limit(500))),
      getRooms(),
    ]);

    let totalVIP = 0;
    let totalCoins = 0;
    let newToday = 0;
    let scopedUsers = 0;

    if (superScope) {
      // أعداد دقيقة عبر count-aggregation (لا تجلب مستندات)
      const [totalCnt, vipCnt, newCnt] = await Promise.all([
        getCountFromServer(usersCol),
        getCountFromServer(query(usersCol, where('isVIP', '==', true))),
        getCountFromServer(query(usersCol, where('createdAt', '>=', todayStart))),
      ]);
      scopedUsers = totalCnt.data().count;
      totalVIP = vipCnt.data().count;
      newToday = newCnt.data().count;
      // إجمالي العملات: مجموع على العيّنة المحمّلة (تقريبي — حقل coins غير موحّد: stats.coins ?? coins)
      usersSnap.forEach((d) => {
        const u = d.data();
        const stats = u.stats ?? {};
        totalCoins += stats.coins ?? u.coins ?? 0;
      });
    } else {
    usersSnap.forEach((d) => {
      const u = d.data();
      const country = countryFromUserDoc(u as Record<string, unknown>);
      if (!isInAdminCountryScope(country)) return;
      scopedUsers++;
      if (u.isVIP) totalVIP++;
      const stats = u.stats ?? {};
      totalCoins += stats.coins ?? u.coins ?? 0;
      if ((u.createdAt ?? 0) >= todayStart) newToday++;
    });
    }

    let revenue = 0;
    let pendingWd = 0;
    if (!isSuperCountryScope()) {
      await preloadUserCountries(
        txSnap.docs.map((d) => String((d.data() as any).uid ?? '')),
      );
    }
    txSnap.forEach((d) => {
      const t = d.data() as any;
      if (!isSuperCountryScope() && !isInAdminCountryScope(getCachedUserCountry(t.uid))) return;
      if (t.type === 'recharge' && t.status === 'completed') revenue += Math.abs(t.amount ?? 0);
      if (t.type === 'withdraw' && t.status === 'pending') pendingWd++;
    });

    return {
      totalUsers: scopedUsers,
      totalVIP,
      totalRooms: rooms.length,
      totalRevenue: revenue,
      totalCoinsInCirculation: totalCoins,
      newUsersToday: newToday,
      pendingWithdrawals: pendingWd,
      activeRooms: rooms.filter((r) => r.isActive).length,
      pendingReports: await (async () => {
        try {
          const { getPendingReportsCount } = await import('@/services/reports');
          return await getPendingReportsCount();
        } catch {
          return 0;
        }
      })(),
    };
  } catch (e) {
    console.error('getDashboardStats:', e);
    return {
      totalUsers: 0, totalVIP: 0, totalRooms: 0, totalRevenue: 0,
      totalCoinsInCirculation: 0, newUsersToday: 0, pendingWithdrawals: 0, activeRooms: 0,
      pendingReports: 0,
    };
  }
};

// ==================== WEEKLY ACTIVITY (بيانات حقيقية للرسم البياني) ====================
export interface WeeklyActivityPoint {
  day: string;
  date: number;
  users: number;
  revenue: number;
  minutes: number;
}

/**
 * سلسلة نشاط آخر N يوم محسوبة من بيانات فعلية:
 * مستخدمون جدد (users.createdAt) + إيرادات شحن حقيقية (transactions recharge مكتملة)
 * + دقائق مكالمات مُستهلَكة (callSessions.minutesCharged) — لا أرقام تقديرية.
 */
export const getWeeklyActivity = async (days = 7): Promise<WeeklyActivityPoint[]> => {
  const dayMs = 86400000;
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const startCutoff = todayStart - (days - 1) * dayMs;
  const labels = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const [usersSnap, txSnap, callSnap] = await Promise.all([
    getDocs(query(collection(firestore, 'users'), where('createdAt', '>=', startCutoff))),
    getDocs(query(collection(firestore, 'transactions'), where('createdAt', '>=', startCutoff))),
    getDocs(query(collection(firestore, 'callSessions'), where('createdAt', '>=', startCutoff))),
  ]);

  const buckets = new Map<number, WeeklyActivityPoint>();
  for (let i = 0; i < days; i++) {
    const dStart = startCutoff + i * dayMs;
    buckets.set(dStart, {
      day: labels[new Date(dStart).getDay()],
      date: dStart,
      users: 0,
      revenue: 0,
      minutes: 0,
    });
  }
  const keyFor = (ts: number) => {
    if (!ts || ts < startCutoff) return null;
    const idx = Math.floor((ts - startCutoff) / dayMs);
    return startCutoff + idx * dayMs;
  };

  usersSnap.forEach((d) => {
    const k = keyFor(Number((d.data() as any).createdAt) || 0);
    if (k != null) buckets.get(k)!.users++;
  });
  txSnap.forEach((d) => {
    const t = d.data() as any;
    if (t.type === 'recharge' && t.status === 'completed') {
      const k = keyFor(Number(t.createdAt) || 0);
      if (k != null) buckets.get(k)!.revenue += Math.abs(Number(t.amount) || 0);
    }
  });
  callSnap.forEach((d) => {
    const k = keyFor(Number((d.data() as any).createdAt) || 0);
    if (k != null) buckets.get(k)!.minutes += Number((d.data() as any).minutesCharged) || 0;
  });

  return Array.from(buckets.values()).sort((a, b) => a.date - b.date);
};

// ==================== NOTIFICATIONS (Broadcast) ====================
export interface BroadcastNotification {
  title: string;
  body: string;
  target: 'all' | 'vip' | 'active';
  type: 'info' | 'promo' | 'warning' | 'reward';
}

/** سيناريوهات إشعار مستخدم محدد */
export type AdminNotifyScenario =
  | 'custom'
  | 'account_warning'
  | 'account_banned'
  | 'account_unbanned'
  | 'withdrawal_blocked'
  | 'withdrawal_unblocked'
  | 'verification_required'
  | 'content_removed';

export interface AdminUserNotificationPayload {
  identifier: string;
  scenario: AdminNotifyScenario;
  title?: string;
  message?: string;
  applyAction?: boolean;
  reason?: string;
}

/**
 * إرسال إشعار لمستخدم — Cloud Function (إشعار حقيقي + إجراء حساب)
 */
export const sendUserNotification = async (
  payload: AdminUserNotificationPayload,
): Promise<{
  targetUid: string;
  displayName: string;
  publicAccountId: string;
  notificationId: string;
}> => {
  const fn = httpsCallable(functions, 'adminSendUserNotification');
  const res = await fn(payload);
  const data = res.data as {
    targetUid: string;
    displayName: string;
    publicAccountId: string;
    notificationId: string;
  };
  return data;
};

export const lookupUserByIdentifier = async (
  identifier: string,
): Promise<{
  uid: string;
  displayName: string;
  avatar: string;
  publicAccountId: string;
  coins?: number;
  isBanned?: boolean;
  withdrawalBlocked?: boolean;
}> => {
  const fn = httpsCallable(functions, 'lookupUserByIdentifier');
  const res = await fn({ identifier: identifier.trim() });
  return res.data as {
    uid: string;
    displayName: string;
    avatar: string;
    publicAccountId: string;
    coins?: number;
    isBanned?: boolean;
    withdrawalBlocked?: boolean;
  };
};

/**
 * إرسال إشعار جماعي — broadcasts + inbox لكل مستخدم
 */
export const sendBroadcast = async (
  notif: BroadcastNotification,
): Promise<{ sent: number }> => {
  const fn = httpsCallable(functions, 'adminSendBroadcast');
  const res = await fn({
    title: notif.title,
    body: notif.body,
    target: notif.target,
    type: notif.type,
  });
  const data = res.data as { sent: number };
  return { sent: data.sent ?? 0 };
};

export interface AdminBroadcastRecord {
  id: string;
  title: string;
  body?: string;
  target?: string;
  type?: string;
  sentCount: number;
  viewCount?: number;
  createdAt: number;
}

export const getBroadcasts = async (): Promise<AdminBroadcastRecord[]> => {
  try {
    const q = query(collection(firestore, 'broadcasts'), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as AdminBroadcastRecord[];
  } catch {
    return [];
  }
};

/** تحديث مباشر لعداد المشاهدات في سجل البث */
export const subscribeBroadcasts = (
  callback: (items: AdminBroadcastRecord[]) => void,
): (() => void) => {
  const q = query(collection(firestore, 'broadcasts'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as AdminBroadcastRecord[]);
    },
    () => callback([]),
  );
};

// ==================== ADMIN ACTIVITY LOG ====================
export interface AdminLog {
  id?: string;
  action: string;
  target: string;
  details?: string;
  adminName: string;
  createdAt: number;
}

/**
 * تسجيل نشاط الأدمن — يُستدعى عند كل إجراء حساس (حظر، تعديل رصيد...)
 */
export const logAdminAction = async (
  action: string,
  target: string,
  details = '',
): Promise<void> => {
  try {
    await addDoc(collection(firestore, 'adminLogs'), {
      action,
      target,
      details,
      adminName: localStorage.getItem('admin_name') ?? 'مدير النظام',
      createdAt: Date.now(),
    });
  } catch (e) {
    console.error('logAdminAction:', e);
  }
};

export const getAdminLogs = async (): Promise<AdminLog[]> => {
  try {
    const q = query(collection(firestore, 'adminLogs'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  } catch {
    return [];
  }
};

// ==================== CSV EXPORT ====================
/**
 * تصدير أي مصفوفة بيانات إلى CSV وتنزيلها
 */
export const exportToCSV = (rows: Record<string, any>[], filename: string): void => {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h];
        const str = val == null ? '' : String(val);
        // escape quotes & commas
        return str.includes(',') || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(','),
    ),
  ].join('\n');

  // BOM للعربية في Excel
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ==================== CONFIG MANAGEMENT (التحكم في التطبيق) ====================
// كل تعديل هنا ينعكس فوراً في التطبيق (real-time عبر onSnapshot)

export type GiftVisualType = 'icon' | 'image';
export type GiftMediaType = 'static' | 'animated' | 'animated_sound' | 'video';

export interface ConfigGiftCategory {
  id: string;
  /** تسميات حسب اللغة — ar, en, ... */
  labels: Record<string, string>;
  order?: number;
  enabled?: boolean;
}

/** توحيد تصنيف (يدعم label/labelEn القديمة) */
export function normalizeConfigGiftCategory(raw: ConfigGiftCategory & {
  label?: string;
  labelEn?: string;
}): ConfigGiftCategory {
  const labels: Record<string, string> = { ...(raw.labels ?? {}) };
  if (raw.label?.trim() && !labels.ar) labels.ar = raw.label.trim();
  if (raw.labelEn?.trim() && !labels.en) labels.en = raw.labelEn.trim();
  Object.keys(labels).forEach((k) => {
    if (!labels[k]?.trim()) delete labels[k];
  });
  return {
    id: raw.id,
    labels,
    order: raw.order ?? 0,
    enabled: raw.enabled !== false,
  };
}

export function categoryToFirestore(c: ConfigGiftCategory): ConfigGiftCategory {
  const normalized = normalizeConfigGiftCategory(c);
  const labels: Record<string, string> = {};
  Object.entries(normalized.labels).forEach(([k, v]) => {
    const t = v?.trim();
    if (t) labels[k] = t;
  });
  const out: ConfigGiftCategory = { id: normalized.id, labels, order: normalized.order ?? 0 };
  if (normalized.enabled === false) out.enabled = false;
  return out;
}

export interface ConfigGift {
  id: string;
  name: string;
  price: number;
  category: string;
  iconName: string;
  iconColor: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  isAnimated?: boolean;
  isLimited?: boolean;
  /** icon = Lucide (افتراضي) | image = صورة مرفوعة */
  visualType?: GiftVisualType;
  /** static | animated | animated_sound | video */
  giftMediaType?: GiftMediaType;
  /** صورة القائمة / شبكة الهدايا */
  imageUrl?: string;
  /** GIF أو صورة للأنيميشن — إن تُركت فارغة تُستخدم imageUrl */
  animationUrl?: string;
  /** ملف صوتي للهدايا الصوتية */
  soundUrl?: string;
  /** فيديو MP4/MOV/WebM — ملء الشاشة */
  videoUrl?: string;
  /** MP4/MOV احتياطي لـ iOS عند استخدام WebM كفيديو أساسي */
  videoUrlMp4?: string;
  /** black (افتراضي) | green | none */
  videoChromaKey?: 'black' | 'green' | 'none';
  /** هدية حصرية: مستوى SVIP المطلوب لإرسالها (0/فارغ = للجميع) */
  requiredVipLevel?: number;
}

export interface ConfigVipTier {
  level: number;
  name: string;
  price: number;
  color: string;
  iconName: string;
  perks: string[];
  coinBonus: number;
  validityDays: number;
}

export interface ConfigRechargePackageTag {
  id: string;
  labels: Record<string, string>;
  emoji?: string;
  color?: string;
  borderColor?: string;
  order?: number;
  enabled?: boolean;
}

export interface ConfigRechargePackage {
  id: string;
  coins: number;
  bonus: number;
  priceUSD: number;
  priceLabel: string;
  /** تصنيف/شارة الباقة — من إدارة التصنيفات */
  tagId?: string;
  /** @deprecated استخدم tagId */
  isPopular?: boolean;
  /** @deprecated استخدم tagId */
  isBestValue?: boolean;
}

export function normalizeConfigRechargePackageTag(raw: ConfigRechargePackageTag): ConfigRechargePackageTag {
  const labels: Record<string, string> = {};
  Object.entries(raw.labels ?? {}).forEach(([k, v]) => {
    if (v?.trim()) labels[k] = v.trim();
  });
  return {
    id: raw.id,
    labels,
    emoji: raw.emoji?.trim() || undefined,
    color: raw.color?.trim() || undefined,
    borderColor: raw.borderColor?.trim() || undefined,
    order: raw.order ?? 0,
    enabled: raw.enabled !== false,
  };
}

export function normalizeConfigRechargePackage(raw: ConfigRechargePackage): ConfigRechargePackage {
  let tagId = raw.tagId?.trim() || undefined;
  if (!tagId) {
    if (raw.isBestValue) tagId = 'best_value';
    else if (raw.isPopular) tagId = 'popular';
  }
  const out: ConfigRechargePackage = {
    id: raw.id,
    coins: raw.coins,
    bonus: raw.bonus ?? 0,
    priceUSD: raw.priceUSD,
    priceLabel: raw.priceLabel,
  };
  if (tagId) out.tagId = tagId;
  return out;
}

export function rechargePackageTagLabel(tag: ConfigRechargePackageTag, lang = 'ar'): string {
  return tag.labels[lang]?.trim()
    || tag.labels.ar?.trim()
    || tag.labels.en?.trim()
    || Object.values(tag.labels).find((v) => v?.trim())?.trim()
    || tag.id;
}

export interface ConfigSettings {
  coinRate: number;
  minWithdraw: number;
  /** مرايا من config/games (تُكتب من صفحة الألعاب) — تقرأها أجزاء قديمة من التطبيق */
  challengeWinnerPercent?: number;
  challengeAppCommission?: number;
  minHostWithdraw?: number;
  minAgentWithdraw?: number;
  hostWithdrawAmounts?: number[];
  agentWithdrawAmounts?: number[];
  allowCustomHostWithdraw?: boolean;
  allowCustomAgentWithdraw?: boolean;
  hostAgentWithdrawWeekDays?: number[];
  hostSelfWithdrawAnytime?: boolean;
  agentWithdrawCooldownDays?: number;
  agentBatchDivisor?: number;
  pearlUsdRate?: number;
  giftCommission: number;
  agencyCommission: number;
  /** نسبة عمولة BD من دخل الوكالة المُحالة (%) */
  bdReferralCommissionPercent?: number;
  /** مدة استفادة الوكيل المُحيل من الوكالة الجديدة (أشهر) */
  bdReferralBenefitMonths?: number;
  transferCommission: number;
  minTransferAmount: number;
  coinsToPearlsRate: number;
  casinoToCoinsRate: number;
  casinoToPearlsRate: number;
  selfWithdrawCommission?: number;
  agentWithdrawCommission?: number;
  lockedMessagePrice?: number;
  lockedMessageCommission?: number;
  maintenanceMode: boolean;
  allowRegistration: boolean;
  requireVerification: boolean;
  welcomeBonus: number;
  firstRechargeBonus?: number;
  inAppRechargeEnabled?: boolean;
  termsUrl?: string;
  privacyUrl?: string;
  copyrightUrl?: string;
  childSafetyUrl?: string;
  musicUrl?: string;
  acknowledgementsUrl?: string;
  opensourceUrl?: string;
  communityUrl?: string;
  aboutUsUrl?: string;
  intellectualPropertyUrl?: string;
  returnUrl?: string;
  contactUrl?: string;
  // ===== إصلاحات الأداء والمزامنة (#30–38) — يقرأها التطبيق من config/settings =====
  /** مهلة تسليم الهدية بالملي ثانية (#11) — افتراضي 10000 */
  giftDeliveryTimeoutMs?: number;
  /** حجم دفعة تحميل الرسائل (#2) — افتراضي 30 */
  chatLoadBatchSize?: number;
  /** فاصل مزامنة المايكروفون بالملي ثانية (#30) — افتراضي 500 */
  micSyncIntervalMs?: number;
  /** فاصل مزامنة الهدايا بالملي ثانية (#35) — افتراضي 3000 */
  giftSyncIntervalMs?: number;
  /** مهلة إشارة المكالمة بالملي ثانية (#37) — افتراضي 30000 */
  callSignalingTimeoutMs?: number;
  /** فترة سماح قبل قطع الاتصال بالملي ثانية (#38) — افتراضي 15000 */
  reconnectGracePeriodMs?: number;
  /** تفعيل مزامنة موسيقى الغرفة (#36) */
  roomMusicSyncEnabled?: boolean;
}

// ===== Gifts =====
export const getConfigGifts = async (): Promise<ConfigGift[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'gifts'));
    return snap.exists() ? (snap.data().items ?? []) : [];
  } catch { return []; }
};

export const getConfigGiftCategories = async (): Promise<ConfigGiftCategory[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'gifts'));
    if (snap.exists() && snap.data().categories?.length) {
      return (snap.data().categories as ConfigGiftCategory[])
        .map(normalizeConfigGiftCategory)
        .filter((c) => c.enabled !== false)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
  } catch { /* ignore */ }
  return [];
};

/**
 * يقرأ مستند config/gifts كاملاً مع تمييز حالة الوجود:
 *  - exists=false → المستند لم يُنشأ بعد (أول تشغيل) ⇒ يجوز زرع الافتراضي مرة واحدة
 *  - exists=true  → المستند موجود (حتى لو القائمة فارغة) ⇒ يُحترم حذف المستخدم
 * بهذا لا ترجع الهدايا التجريبية بعد حذفها.
 */
export const getConfigGiftsState = async (): Promise<{
  exists: boolean;
  items: ConfigGift[];
  categories: ConfigGiftCategory[];
}> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'gifts'));
    if (!snap.exists()) return { exists: false, items: [], categories: [] };
    const data = snap.data();
    const items = (data.items ?? []) as ConfigGift[];
    const categories = data.categories?.length
      ? (data.categories as ConfigGiftCategory[])
          .map(normalizeConfigGiftCategory)
          .filter((c) => c.enabled !== false)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : [];
    return { exists: true, items, categories };
  } catch {
    return { exists: false, items: [], categories: [] };
  }
};

export const saveConfigGifts = async (
  items: ConfigGift[],
  categories?: ConfigGiftCategory[],
): Promise<void> => {
  const payload: Record<string, unknown> = {
    items: items.map(giftToFirestore),
    updatedAt: Date.now(),
    _permKey: 'gifts',
  };
  if (categories) payload.categories = categories.map(categoryToFirestore);
  await setDoc(doc(firestore, 'config', 'gifts'), payload, { merge: true });
};

export const saveConfigGiftCategories = async (categories: ConfigGiftCategory[]): Promise<void> => {
  await setDoc(
    doc(firestore, 'config', 'gifts'),
    { categories: categories.map(categoryToFirestore), updatedAt: Date.now(), _permKey: 'gifts' },
    { merge: true },
  );
};
function inferGiftMediaType(g: ConfigGift): GiftMediaType {
  if (g.giftMediaType) return g.giftMediaType;
  if (g.videoUrl?.trim()) return 'video';
  if (g.soundUrl?.trim()) return 'animated_sound';
  if (g.isAnimated || g.animationUrl?.trim()) return 'animated';
  if (g.imageUrl?.trim()) return 'static';
  return 'static';
}

function giftToFirestore(g: ConfigGift): ConfigGift {
  const imageUrl = (g.imageUrl ?? '').trim();
  const animationUrl = (g.animationUrl ?? '').trim();
  const soundUrl = (g.soundUrl ?? '').trim();
  const videoUrl = (g.videoUrl ?? '').trim();
  const hasMedia = Boolean(imageUrl || animationUrl || videoUrl);
  const giftMediaType = inferGiftMediaType(g);
  const out: ConfigGift = {
    id: g.id,
    name: g.name,
    price: g.price,
    category: g.category,
    iconName: g.iconName || 'Gift',
    iconColor: g.iconColor || '#d21e2a',
    rarity: g.rarity,
    visualType: hasMedia ? 'image' : 'icon',
    giftMediaType,
  };
  if (imageUrl) out.imageUrl = imageUrl;
  if (animationUrl) out.animationUrl = animationUrl;
  if (soundUrl) out.soundUrl = soundUrl;
  if (videoUrl) out.videoUrl = videoUrl;
  const videoUrlMp4 = (g.videoUrlMp4 ?? '').trim();
  if (videoUrlMp4) out.videoUrlMp4 = videoUrlMp4;
  const chroma = (g.videoChromaKey ?? '').trim().toLowerCase();
  if (chroma === 'green' || chroma === 'none') out.videoChromaKey = chroma;
  if (giftMediaType !== 'static') out.isAnimated = true;
  if (g.isLimited === true) out.isLimited = true;
  const reqVip = Number(g.requiredVipLevel ?? 0);
  if (Number.isFinite(reqVip) && reqVip > 0) out.requiredVipLevel = Math.floor(reqVip);
  return out;
}

// ===== إطارات الروم (مدفوعة) + خلفيات الروم (مجانية) =====
export type DecorBadge = 'limited' | 'event' | 'hot' | 'new';

export interface RoomFrame {
  id: string;
  name: string;
  /** صورة الإطار الشفافة (PNG) */
  imageUrl: string;
  /** السعر بالعملات (0 = مجاني) */
  price: number;
  /** شارة ترويجية اختيارية */
  badge?: DecorBadge;
  /** 0 أو غير محدّد = دائم، غير ذلك = عدد أيام الصلاحية */
  durationDays?: number;
  enabled: boolean;
  sort?: number;
}

export interface RoomBackground {
  id: string;
  name: string;
  /** صورة الخلفية */
  imageUrl: string;
  enabled: boolean;
  sort?: number;
}

function frameToFirestore(f: RoomFrame): RoomFrame {
  const out: RoomFrame = {
    id: f.id,
    name: f.name,
    imageUrl: (f.imageUrl ?? '').trim(),
    price: Number(f.price) || 0,
    enabled: f.enabled !== false,
  };
  if (f.badge) out.badge = f.badge;
  if (Number(f.durationDays) > 0) out.durationDays = Number(f.durationDays);
  if (typeof f.sort === 'number') out.sort = f.sort;
  return out;
}

function backgroundToFirestore(b: RoomBackground): RoomBackground {
  const out: RoomBackground = {
    id: b.id,
    name: b.name,
    imageUrl: (b.imageUrl ?? '').trim(),
    enabled: b.enabled !== false,
  };
  if (typeof b.sort === 'number') out.sort = b.sort;
  return out;
}

export const getRoomFrames = async (): Promise<RoomFrame[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'roomFrames'));
    return snap.exists() ? (snap.data().items ?? []) : [];
  } catch { return []; }
};

export const saveRoomFrames = async (items: RoomFrame[]): Promise<void> => {
  await setDoc(
    doc(firestore, 'config', 'roomFrames'),
    { items: items.map(frameToFirestore), updatedAt: Date.now(), _permKey: 'room-decor' },
    { merge: true },
  );
};

export const getRoomBackgrounds = async (): Promise<RoomBackground[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'roomBackgrounds'));
    return snap.exists() ? (snap.data().items ?? []) : [];
  } catch { return []; }
};

export const saveRoomBackgrounds = async (items: RoomBackground[]): Promise<void> => {
  await setDoc(
    doc(firestore, 'config', 'roomBackgrounds'),
    { items: items.map(backgroundToFirestore), updatedAt: Date.now(), _permKey: 'room-decor' },
    { merge: true },
  );
};

export const getAgencyRoomFrames = async (): Promise<RoomFrame[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'agencyRoomFrames'));
    return snap.exists() ? (snap.data().items ?? []) : [];
  } catch { return []; }
};

export const saveAgencyRoomFrames = async (items: RoomFrame[]): Promise<void> => {
  await setDoc(
    doc(firestore, 'config', 'agencyRoomFrames'),
    { items: items.map(frameToFirestore), updatedAt: Date.now(), _permKey: 'room-decor' },
    { merge: true },
  );
};

export const getAgencyRoomBackgrounds = async (): Promise<RoomBackground[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'agencyRoomBackgrounds'));
    return snap.exists() ? (snap.data().items ?? []) : [];
  } catch { return []; }
};

export const saveAgencyRoomBackgrounds = async (items: RoomBackground[]): Promise<void> => {
  await setDoc(
    doc(firestore, 'config', 'agencyRoomBackgrounds'),
    { items: items.map(backgroundToFirestore), updatedAt: Date.now(), _permKey: 'room-decor' },
    { merge: true },
  );
};

// ===== متجر التطبيق (دخولية / فقاعة / شارات / تأثيرات / ثيمات / VIP) =====
export type ConfigStoreCategoryId =
  | 'entrance'
  | 'bubble'
  | 'badge'
  | 'effect'
  | 'theme'
  | 'vip'
  | string;

export interface ConfigStoreCategory {
  id: string;
  labels: Record<string, string>;
  order?: number;
  enabled?: boolean;
  iconName?: string;
}

export interface ConfigStoreItem {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  descriptionEn?: string;
  /** معرّف التصنيف — entrance | bubble | badge | effect | theme | vip */
  category: string;
  price: number;
  currency: 'coins' | 'pearls';
  iconName: string;
  iconColor: string;
  bgColor1: string;
  bgColor2: string;
  imageUrl?: string;
  animationUrl?: string;
  videoUrl?: string;
  videoUrlMp4?: string;
  isLimited?: boolean;
  isNew?: boolean;
  validityDays?: number;
  enabled?: boolean;
  sort?: number;
  /** إصلاح #15 — هل يظهر زر «إهداء» بعد الشراء؟ (افتراضي true) */
  allowGift?: boolean;
}

function normalizeConfigStoreCategory(raw: ConfigStoreCategory): ConfigStoreCategory {
  return {
    id: String(raw.id ?? '').trim(),
    labels: raw.labels && typeof raw.labels === 'object' ? raw.labels : { ar: raw.id },
    order: Number(raw.order ?? 0),
    enabled: raw.enabled !== false,
    iconName: raw.iconName ? String(raw.iconName) : 'ShoppingBag',
  };
}

function storeCategoryToFirestore(c: ConfigStoreCategory): ConfigStoreCategory {
  const out: ConfigStoreCategory = {
    id: c.id.trim(),
    labels: c.labels ?? { ar: c.id },
    order: Number(c.order ?? 0),
    enabled: c.enabled !== false,
  };
  if (c.iconName?.trim()) out.iconName = c.iconName.trim();
  return out;
}

function storeItemToFirestore(item: ConfigStoreItem): ConfigStoreItem {
  const out: ConfigStoreItem = {
    id: item.id.trim(),
    name: item.name.trim(),
    description: item.description?.trim() ?? '',
    category: item.category.trim(),
    price: Math.max(0, Number(item.price) || 0),
    currency: item.currency === 'pearls' ? 'pearls' : 'coins',
    iconName: item.iconName?.trim() || 'ShoppingBag',
    iconColor: item.iconColor?.trim() || '#e11212',
    bgColor1: item.bgColor1?.trim() || '#FCD34D',
    bgColor2: item.bgColor2?.trim() || '#F59E0B',
    enabled: item.enabled !== false,
    sort: Number(item.sort ?? 0),
  };
  if (item.nameEn?.trim()) out.nameEn = item.nameEn.trim();
  if (item.descriptionEn?.trim()) out.descriptionEn = item.descriptionEn.trim();
  if (item.imageUrl?.trim()) out.imageUrl = item.imageUrl.trim();
  if (item.animationUrl?.trim()) out.animationUrl = item.animationUrl.trim();
  if (item.videoUrl?.trim()) out.videoUrl = item.videoUrl.trim();
  if (item.videoUrlMp4?.trim()) out.videoUrlMp4 = item.videoUrlMp4.trim();
  if (item.isLimited === true) out.isLimited = true;
  if (item.isNew === true) out.isNew = true;
  if (Number(item.validityDays) > 0) out.validityDays = Number(item.validityDays);
  // إصلاح #15 — احتفظ بحقل allowGift عند الحفظ
  if (item.allowGift === false) out.allowGift = false; // سالب فقط (true افتراضي في التطبيق)
  return out;
}

export const DEFAULT_STORE_CATEGORIES: ConfigStoreCategory[] = [
  { id: 'entrance', labels: { ar: 'دخولية', en: 'Entrance' }, order: 1, enabled: true, iconName: 'Sparkles' },
  { id: 'frame', labels: { ar: 'الإطارات', en: 'Frames' }, order: 2, enabled: true, iconName: 'Frame' },
  { id: 'bubble', labels: { ar: 'فقاعة الدردشة', en: 'Chat Bubble' }, order: 3, enabled: true, iconName: 'MessageCircle' },
  { id: 'badge', labels: { ar: 'شارات', en: 'Badges' }, order: 4, enabled: true, iconName: 'Award' },
  { id: 'effect', labels: { ar: 'تأثيرات', en: 'Effects' }, order: 5, enabled: true, iconName: 'Sparkles' },
  { id: 'theme', labels: { ar: 'ثيمات', en: 'Themes' }, order: 6, enabled: true, iconName: 'Palette' },
  { id: 'vip', labels: { ar: 'VIP', en: 'VIP' }, order: 7, enabled: true, iconName: 'Crown' },
];

export const DEFAULT_CONFIG_STORE_ITEMS: ConfigStoreItem[] = [
  { id: 'entrance-gold', name: 'دخولية ذهبية', description: 'مؤثر دخول ذهبي لامع عند دخول الغرف', category: 'entrance', price: 8000, currency: 'coins', iconName: 'Sparkles', iconColor: '#F59E0B', bgColor1: '#FCD34D', bgColor2: '#F59E0B', validityDays: 30, isNew: true, enabled: true, sort: 1 },
  { id: 'entrance-space', name: 'دخولية فضائية', description: 'مركبة فضائية ترافق دخولك للغرفة', category: 'entrance', price: 15000, currency: 'coins', iconName: 'Rocket', iconColor: '#f05a5a', bgColor1: '#f2a0a0', bgColor2: '#e11212', validityDays: 30, isLimited: true, enabled: true, sort: 2 },
  { id: 'bubble-pink', name: 'فقاعة وردية', description: 'فقاعة رسائل وردية مميزة في الدردشة', category: 'bubble', price: 3000, currency: 'pearls', iconName: 'MessageCircle', iconColor: '#d21e2a', bgColor1: '#F9A8D4', bgColor2: '#d21e2a', validityDays: 30, enabled: true, sort: 1 },
  { id: 'bubble-vip', name: 'فقاعة VIP', description: 'فقاعة رسائل ذهبية حصرية', category: 'bubble', price: 6000, currency: 'pearls', iconName: 'MessageCircle', iconColor: '#FCD34D', bgColor1: '#FDE68A', bgColor2: '#F59E0B', validityDays: 30, isNew: true, enabled: true, sort: 2 },
  { id: 'badge-verified', name: 'شارة موثّقة', description: 'علامة التحقق الزرقاء بجانب اسمك', category: 'badge', price: 50000, currency: 'coins', iconName: 'BadgeCheck', iconColor: '#b00814', bgColor1: '#93C5FD', bgColor2: '#b00814', validityDays: 90, enabled: true, sort: 1 },
  { id: 'badge-king', name: 'شارة الملك', description: 'شارة ملك المنطقة', category: 'badge', price: 100000, currency: 'coins', iconName: 'Crown', iconColor: '#F59E0B', bgColor1: '#FCD34D', bgColor2: '#F59E0B', isLimited: true, enabled: true, sort: 2 },
  { id: 'badge-pro', name: 'شارة Pro', description: 'مستخدم محترف', category: 'badge', price: 2500, currency: 'pearls', iconName: 'Star', iconColor: '#F59E0B', bgColor1: '#FBBF24', bgColor2: '#D97706', enabled: true, sort: 3 },
  { id: 'effect-gift', name: 'تأثير الهدية', description: 'تأثير خاص عند إرسال الهدايا', category: 'effect', price: 3000, currency: 'pearls', iconName: 'Gift', iconColor: '#10B981', bgColor1: '#6EE7B7', bgColor2: '#10B981', validityDays: 7, enabled: true, sort: 1 },
  { id: 'theme-dark', name: 'الثيم الداكن', description: 'مظهر داكن للتطبيق', category: 'theme', price: 1000, currency: 'pearls', iconName: 'Moon', iconColor: '#1F2937', bgColor1: '#6B7280', bgColor2: '#1F2937', enabled: true, sort: 1 },
  { id: 'theme-pink', name: 'الثيم الوردي', description: 'مظهر وردي رومانسي', category: 'theme', price: 1500, currency: 'pearls', iconName: 'Heart', iconColor: '#d21e2a', bgColor1: '#F9A8D4', bgColor2: '#d21e2a', enabled: true, sort: 2 },
  { id: 'vip-week', name: 'VIP لأسبوع', description: 'كل مزايا VIP لمدة 7 أيام', category: 'vip', price: 30000, currency: 'coins', iconName: 'Crown', iconColor: '#FCD34D', bgColor1: '#FCD34D', bgColor2: '#F59E0B', validityDays: 7, enabled: true, sort: 1 },
  { id: 'vip-month', name: 'VIP لشهر', description: 'كل مزايا VIP لمدة 30 يوم', category: 'vip', price: 100000, currency: 'coins', iconName: 'Crown', iconColor: '#FCD34D', bgColor1: '#FCD34D', bgColor2: '#F59E0B', validityDays: 30, isNew: true, enabled: true, sort: 2 },
];

export const getConfigStoreState = async (): Promise<{
  exists: boolean;
  items: ConfigStoreItem[];
  categories: ConfigStoreCategory[];
}> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'store'));
    if (!snap.exists()) return { exists: false, items: [], categories: [] };
    const data = snap.data();
    const items = ((data.items ?? []) as ConfigStoreItem[])
      .map(storeItemToFirestore)
      .filter((i) => i.id && i.name)
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    const categories = data.categories?.length
      ? (data.categories as ConfigStoreCategory[])
          .map(normalizeConfigStoreCategory)
          .filter((c) => c.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : [];
    return { exists: true, items, categories };
  } catch {
    return { exists: false, items: [], categories: [] };
  }
};

export const saveConfigStore = async (
  items: ConfigStoreItem[],
  categories?: ConfigStoreCategory[],
): Promise<void> => {
  const payload: Record<string, unknown> = {
    items: items.map(storeItemToFirestore),
    updatedAt: Date.now(),
    _permKey: 'store',
  };
  if (categories) payload.categories = categories.map(storeCategoryToFirestore);
  await setDoc(doc(firestore, 'config', 'store'), payload, { merge: true });
};

export const saveConfigStoreCategories = async (categories: ConfigStoreCategory[]): Promise<void> => {
  await setDoc(
    doc(firestore, 'config', 'store'),
    { categories: categories.map(storeCategoryToFirestore), updatedAt: Date.now(), _permKey: 'store' },
    { merge: true },
  );
};

// ===== خلفيات المحادثة (bond level) =====
export interface ChatBackgroundBlob {
  color: string;
  size: number;
  top: `${number}%` | number;
  left: `${number}%` | number;
  opacity?: number;
}

export interface ConfigChatBackground {
  id: string;
  name: string;
  minBondLevel: number;
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  blobs?: ChatBackgroundBlob[];
  imageUrl?: string;
  enabled?: boolean;
  sort?: number;
  isDefault?: boolean;
}

function chatBackgroundToFirestore(b: ConfigChatBackground): ConfigChatBackground {
  const colors = (b.colors ?? []).map((c) => c.trim()).filter(Boolean);
  const out: ConfigChatBackground = {
    id: b.id.trim(),
    name: b.name.trim(),
    minBondLevel: Math.max(1, Math.min(15, Number(b.minBondLevel) || 1)),
    colors: colors.length >= 2 ? colors : ['#F3E9FF', '#faf7f7'],
    enabled: b.enabled !== false,
  };
  if (b.start) out.start = b.start;
  if (b.end) out.end = b.end;
  if (b.blobs?.length) out.blobs = b.blobs;
  const img = (b.imageUrl ?? '').trim();
  if (img) out.imageUrl = img;
  if (typeof b.sort === 'number') out.sort = b.sort;
  if (b.isDefault === true) out.isDefault = true;
  return out;
}

export const DEFAULT_CONFIG_CHAT_BACKGROUNDS: ConfigChatBackground[] = [
  {
    id: 'lavender',
    name: 'لافندر',
    minBondLevel: 1,
    colors: ['#F3E9FF', '#FBEFF8', '#faf7f7'],
    start: { x: 0, y: 0 },
    end: { x: 0.3, y: 1 },
    enabled: true,
    sort: 0,
    isDefault: true,
  },
  {
    id: 'mint',
    name: 'نسيم النعناع',
    minBondLevel: 3,
    colors: ['#E6FFF5', '#F0FFF8', '#faf7f7'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    blobs: [
      { color: '#2BD9A8', size: 180, top: '8%', left: '-12%', opacity: 0.12 },
      { color: '#ff5a47', size: 140, top: '72%', left: '78%', opacity: 0.1 },
    ],
    enabled: true,
    sort: 1,
  },
  {
    id: 'ocean',
    name: 'أحلام المحيط',
    minBondLevel: 5,
    colors: ['#E4F4FF', '#F0F8FF', '#faf7f7'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    blobs: [
      { color: '#ff5a47', size: 200, top: '5%', left: '70%', opacity: 0.14 },
      { color: '#4FD0FF', size: 160, top: '65%', left: '-10%', opacity: 0.11 },
    ],
    enabled: true,
    sort: 2,
  },
  {
    id: 'royal',
    name: 'الملكي',
    minBondLevel: 7,
    colors: ['#F3E4FF', '#FBE8FF', '#faf7f7'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0.8 },
    blobs: [
      { color: '#c21520', size: 190, top: '12%', left: '-8%', opacity: 0.13 },
      { color: '#FFC53D', size: 120, top: '58%', left: '82%', opacity: 0.1 },
    ],
    enabled: true,
    sort: 3,
  },
  {
    id: 'rose',
    name: 'حديقة الورد',
    minBondLevel: 8,
    colors: ['#FFE8F3', '#FFF0F8', '#faf7f7'],
    start: { x: 0, y: 0 },
    end: { x: 0.5, y: 1 },
    blobs: [
      { color: '#e11e2a', size: 170, top: '18%', left: '75%', opacity: 0.11 },
      { color: '#C42BE0', size: 150, top: '70%', left: '-5%', opacity: 0.1 },
    ],
    enabled: true,
    sort: 4,
  },
  {
    id: 'sunset',
    name: 'غروب دافئ',
    minBondLevel: 10,
    colors: ['#FFF0E8', '#FFEDF5', '#faf7f7'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    blobs: [
      { color: '#FF9A2E', size: 180, top: '10%', left: '5%', opacity: 0.12 },
      { color: '#FF5CA8', size: 140, top: '68%', left: '72%', opacity: 0.11 },
    ],
    enabled: true,
    sort: 5,
  },
  {
    id: 'starlight',
    name: 'ضوء النجوم',
    minBondLevel: 12,
    colors: ['#EDE8FF', '#F0EBFF', '#faf7f7'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    blobs: [
      { color: '#7B5CFF', size: 210, top: '6%', left: '60%', opacity: 0.15 },
      { color: '#c21520', size: 130, top: '75%', left: '0%', opacity: 0.12 },
    ],
    enabled: true,
    sort: 6,
  },
  {
    id: 'golden',
    name: 'أسطورة ذهبية',
    minBondLevel: 15,
    colors: ['#FFF8E8', '#FFF0F5', '#faf7f7'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    blobs: [
      { color: '#FFC53D', size: 200, top: '15%', left: '-10%', opacity: 0.14 },
      { color: '#FF9A2E', size: 160, top: '62%', left: '80%', opacity: 0.12 },
      { color: '#C42BE0', size: 90, top: '40%', left: '45%', opacity: 0.08 },
    ],
    enabled: true,
    sort: 7,
  },
];

export const getConfigChatBackgrounds = async (): Promise<ConfigChatBackground[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'chatBackgrounds'));
    return snap.exists() ? (snap.data().items ?? []) : [];
  } catch {
    return [];
  }
};

export const saveConfigChatBackgrounds = async (
  items: ConfigChatBackground[],
): Promise<void> => {
  await setDoc(
    doc(firestore, 'config', 'chatBackgrounds'),
    { items: items.map(chatBackgroundToFirestore), updatedAt: Date.now(), _permKey: 'chat-backgrounds' },
    { merge: true },
  );
};

// ===== هدايا حقيبة الحظ =====
export interface LuckyBagGift {
  id: string;
  name: string;
  iconName: string;
  iconColor: string;
  value: number;
  weight: number;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

export const DEFAULT_LUCKY_BAG_GIFTS: LuckyBagGift[] = [
  { id: 'lb_rose', name: 'وردة', iconName: 'Flower2', iconColor: '#e11e2a', value: 10, weight: 40, rarity: 'common' },
  { id: 'lb_heart', name: 'قلب', iconName: 'Heart', iconColor: '#EF4444', value: 50, weight: 30, rarity: 'common' },
  { id: 'lb_star', name: 'نجمة', iconName: 'Star', iconColor: '#FFC53D', value: 100, weight: 15, rarity: 'rare' },
  { id: 'lb_diamond', name: 'ماسة', iconName: 'Diamond', iconColor: '#ff5a47', value: 500, weight: 8, rarity: 'epic' },
  { id: 'lb_crown', name: 'تاج', iconName: 'Crown', iconColor: '#FF9A2E', value: 1000, weight: 5, rarity: 'epic' },
  { id: 'lb_rocket', name: 'صاروخ', iconName: 'Rocket', iconColor: '#c21520', value: 5000, weight: 2, rarity: 'legendary' },
];

export const getLuckyBagGifts = async (): Promise<LuckyBagGift[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'luckyBagGifts'));
    return snap.exists() ? (snap.data().items ?? DEFAULT_LUCKY_BAG_GIFTS) : DEFAULT_LUCKY_BAG_GIFTS;
  } catch { return DEFAULT_LUCKY_BAG_GIFTS; }
};

export const saveLuckyBagGifts = async (items: LuckyBagGift[]): Promise<void> => {
  await setDoc(doc(firestore, 'config', 'luckyBagGifts'), { items, updatedAt: Date.now(), _permKey: 'lucky-bag' }, { merge: true });
};

// ===== عرش الغرفة =====
export interface ConfigRoomThrone {
  enabled: boolean;
  minGiftCoins: number;
  titleAr: string;
  titleEn: string;
  hintAr: string;
  hintEn: string;
}

export const DEFAULT_ROOM_THRONE: ConfigRoomThrone = {
  enabled: true,
  minGiftCoins: 2000,
  titleAr: 'العرش ينتظر',
  titleEn: 'The Throne Awaits',
  hintAr: 'تولّى مقعد العرش إذا تجاوزت قيمة هداياك المرسلة {{coins}} كوين',
  hintEn: 'Take the throne if your sent gifts exceed {{coins}} coins',
};

export const getRoomThroneConfig = async (): Promise<ConfigRoomThrone> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'roomThrone'));
    if (!snap.exists()) return DEFAULT_ROOM_THRONE;
    const d = snap.data();
    return {
      enabled: d.enabled !== false,
      minGiftCoins: Number(d.minGiftCoins) || DEFAULT_ROOM_THRONE.minGiftCoins,
      titleAr: d.titleAr ?? DEFAULT_ROOM_THRONE.titleAr,
      titleEn: d.titleEn ?? DEFAULT_ROOM_THRONE.titleEn,
      hintAr: d.hintAr ?? DEFAULT_ROOM_THRONE.hintAr,
      hintEn: d.hintEn ?? DEFAULT_ROOM_THRONE.hintEn,
    };
  } catch {
    return DEFAULT_ROOM_THRONE;
  }
};

export const saveRoomThroneConfig = async (config: ConfigRoomThrone): Promise<void> => {
  await setDoc(doc(firestore, 'config', 'roomThrone'), { ...config, updatedAt: Date.now(), _permKey: 'room-throne' }, { merge: true });
};

// ===== رموز/صور الروم (GIF/PNG) — config/roomReactions =====
export interface ConfigRoomReactionItem {
  id: string;
  imageUrl: string;
  enabled?: boolean;
  order?: number;
}

export interface ConfigRoomReactionPack {
  id: string;
  nameAr: string;
  nameEn: string;
  /** إيموجي احتياطي — يُستخدم إذا لم تُرفع iconUrl */
  icon: string;
  iconUrl?: string;
  enabled?: boolean;
  order?: number;
  items: ConfigRoomReactionItem[];
}

export interface ConfigRoomReactions {
  packs: ConfigRoomReactionPack[];
}

export const DEFAULT_ROOM_REACTIONS: ConfigRoomReactions = { packs: [] };

function normalizeRoomReactionItem(raw: Partial<ConfigRoomReactionItem>): ConfigRoomReactionItem | null {
  const id = String(raw.id ?? '').trim();
  const imageUrl = String(raw.imageUrl ?? '').trim();
  if (!id || !imageUrl) return null;
  return {
    id,
    imageUrl,
    enabled: raw.enabled !== false,
    order: Number(raw.order) || 0,
  };
}

function normalizeRoomReactionPack(raw: Partial<ConfigRoomReactionPack>): ConfigRoomReactionPack | null {
  const id = String(raw.id ?? '').trim();
  if (!id) return null;
  const items = (raw.items ?? [])
    .map((item) => normalizeRoomReactionItem(item))
    .filter((item): item is ConfigRoomReactionItem => Boolean(item))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return {
    id,
    nameAr: raw.nameAr?.trim() || id,
    nameEn: raw.nameEn?.trim() || id,
    icon: raw.icon?.trim() || '✨',
    iconUrl: raw.iconUrl?.trim() || undefined,
    enabled: raw.enabled !== false,
    order: Number(raw.order) || 0,
    items,
  };
}

export function normalizeRoomReactionsConfig(data: unknown): ConfigRoomReactions {
  const raw = data as { packs?: Partial<ConfigRoomReactionPack>[] } | null | undefined;
  const packs = (raw?.packs ?? [])
    .map((pack) => normalizeRoomReactionPack(pack))
    .filter((pack): pack is ConfigRoomReactionPack => Boolean(pack))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return { packs };
}

export const getRoomReactionsConfig = async (): Promise<ConfigRoomReactions> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'roomReactions'));
    if (!snap.exists()) return DEFAULT_ROOM_REACTIONS;
    return normalizeRoomReactionsConfig(snap.data());
  } catch {
    return DEFAULT_ROOM_REACTIONS;
  }
};

export const saveRoomReactionsConfig = async (config: ConfigRoomReactions): Promise<void> => {
  const packs = (config?.packs ?? [])
    .map((pack) => normalizeRoomReactionPack(pack))
    .filter((pack): pack is ConfigRoomReactionPack => Boolean(pack))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((pack) => ({
      id: pack.id,
      nameAr: pack.nameAr,
      nameEn: pack.nameEn,
      icon: pack.icon,
      ...(pack.iconUrl ? { iconUrl: pack.iconUrl } : {}),
      enabled: pack.enabled !== false,
      order: pack.order ?? 0,
      items: pack.items.map((item) => ({
        id: item.id,
        imageUrl: item.imageUrl,
        enabled: item.enabled !== false,
        order: item.order ?? 0,
      })),
    }));
  await setDoc(
    doc(firestore, 'config', 'roomReactions'),
    { packs, updatedAt: Date.now(), _permKey: 'room-reactions' },
    { merge: true },
  );
};

// ===== مستويات الوكالة =====
export interface ConfigAgencyLevelRow {
  level: number;
  supportTarget: number;
  managerBonus?: number;
}

export interface ConfigAgencySupervisorCapTier {
  minLevel: number;
  maxLevel: number;
  maxSupervisors: number;
}

export interface ConfigAgencyLevels {
  levels: ConfigAgencyLevelRow[];
  extendStepCoins: number;
  throneUnlockLevel: number;
  supervisorCapTiers: ConfigAgencySupervisorCapTier[];
  vipSupervisorBonus: number;
}

const DEFAULT_AGENCY_LEVEL_ROWS: ConfigAgencyLevelRow[] = [
  { level: 1, supportTarget: 1_000_000 },
  { level: 2, supportTarget: 2_000_000 },
  { level: 3, supportTarget: 4_000_000 },
  { level: 4, supportTarget: 6_000_000 },
  { level: 5, supportTarget: 10_000_000 },
  { level: 6, supportTarget: 14_000_000 },
  { level: 7, supportTarget: 18_000_000 },
  { level: 8, supportTarget: 22_000_000 },
  { level: 9, supportTarget: 25_000_000 },
  { level: 10, supportTarget: 30_000_000 },
  { level: 11, supportTarget: 35_000_000 },
  { level: 12, supportTarget: 40_000_000 },
  { level: 13, supportTarget: 45_000_000 },
  { level: 14, supportTarget: 50_000_000 },
  { level: 15, supportTarget: 60_000_000 },
  { level: 16, supportTarget: 80_000_000 },
  { level: 17, supportTarget: 100_000_000 },
  { level: 18, supportTarget: 125_000_000 },
  { level: 19, supportTarget: 150_000_000 },
  { level: 20, supportTarget: 200_000_000 },
  { level: 21, supportTarget: 250_000_000 },
  { level: 22, supportTarget: 300_000_000 },
];

export const DEFAULT_AGENCY_LEVELS_CONFIG: ConfigAgencyLevels = {
  levels: DEFAULT_AGENCY_LEVEL_ROWS.map((r) => ({
    ...r,
    managerBonus: Math.floor(r.supportTarget * 0.32),
  })),
  extendStepCoins: 25_000_000,
  throneUnlockLevel: 15,
  supervisorCapTiers: [
    { minLevel: 1, maxLevel: 9, maxSupervisors: 3 },
    { minLevel: 10, maxLevel: 19, maxSupervisors: 5 },
    { minLevel: 20, maxLevel: 999, maxSupervisors: 7 },
  ],
  vipSupervisorBonus: 0,
};

export const getAgencyLevelsConfig = async (): Promise<ConfigAgencyLevels> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'agencyLevels'));
    if (!snap.exists()) return DEFAULT_AGENCY_LEVELS_CONFIG;
    const d = snap.data();
    const levels = Array.isArray(d.levels)
      ? (d.levels as ConfigAgencyLevelRow[])
          .map((row) => ({
            level: Number(row.level) || 0,
            supportTarget: Number(row.supportTarget) || 0,
            managerBonus:
              Number(row.managerBonus) > 0
                ? Number(row.managerBonus)
                : Math.floor((Number(row.supportTarget) || 0) * 0.32),
          }))
          .filter((r) => r.level >= 1 && r.supportTarget > 0)
          .sort((a, b) => a.level - b.level)
      : DEFAULT_AGENCY_LEVELS_CONFIG.levels;
    return {
      levels: levels.length ? levels : DEFAULT_AGENCY_LEVELS_CONFIG.levels,
      extendStepCoins: Number(d.extendStepCoins) || DEFAULT_AGENCY_LEVELS_CONFIG.extendStepCoins,
      throneUnlockLevel: Number(d.throneUnlockLevel) || DEFAULT_AGENCY_LEVELS_CONFIG.throneUnlockLevel,
      supervisorCapTiers: Array.isArray(d.supervisorCapTiers) && d.supervisorCapTiers.length > 0
        ? (d.supervisorCapTiers as ConfigAgencySupervisorCapTier[])
            .map((t) => ({
              minLevel: Math.max(1, Math.round(Number(t.minLevel) || 1)),
              maxLevel: Math.max(1, Math.round(Number(t.maxLevel) || 1)),
              maxSupervisors: Math.max(1, Math.round(Number(t.maxSupervisors) || 1)),
            }))
            .filter((t) => t.maxLevel >= t.minLevel)
            .sort((a, b) => a.minLevel - b.minLevel)
        : DEFAULT_AGENCY_LEVELS_CONFIG.supervisorCapTiers,
      vipSupervisorBonus: Math.max(0, Math.round(Number(d.vipSupervisorBonus) || 0)),
    };
  } catch {
    return DEFAULT_AGENCY_LEVELS_CONFIG;
  }
};

export const saveAgencyLevelsConfig = async (config: ConfigAgencyLevels): Promise<void> => {
  const levels = [...config.levels]
    .map((r) => ({
      level: Math.round(Number(r.level)),
      supportTarget: Math.round(Number(r.supportTarget)),
      managerBonus: Math.round(Number(r.managerBonus) || r.supportTarget * 0.32),
    }))
    .filter((r) => r.level >= 1 && r.supportTarget > 0)
    .sort((a, b) => a.level - b.level);
  await setDoc(
    doc(firestore, 'config', 'agencyLevels'),
    {
      levels,
      extendStepCoins: Math.max(1, Math.round(Number(config.extendStepCoins) || 25_000_000)),
      throneUnlockLevel: Math.max(1, Math.round(Number(config.throneUnlockLevel) || 15)),
      supervisorCapTiers: (config.supervisorCapTiers ?? DEFAULT_AGENCY_LEVELS_CONFIG.supervisorCapTiers)
        .map((t) => ({
          minLevel: Math.max(1, Math.round(Number(t.minLevel) || 1)),
          maxLevel: Math.max(1, Math.round(Number(t.maxLevel) || 1)),
          maxSupervisors: Math.max(1, Math.round(Number(t.maxSupervisors) || 1)),
        }))
        .filter((t) => t.maxLevel >= t.minLevel)
        .sort((a, b) => a.minLevel - b.minLevel),
      vipSupervisorBonus: Math.max(0, Math.round(Number(config.vipSupervisorBonus) || 0)),
      updatedAt: Date.now(),
      _permKey: 'agency-levels',
    },
    { merge: true },
  );
};


// ===== VIP Tiers =====
export const getConfigVipTiers = async (): Promise<ConfigVipTier[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'vipTiers'));
    return snap.exists() ? (snap.data().tiers ?? []) : [];
  } catch { return []; }
};

export const saveConfigVipTiers = async (tiers: ConfigVipTier[]): Promise<void> => {
  await setDoc(doc(firestore, 'config', 'vipTiers'), { tiers, updatedAt: Date.now(), _permKey: 'vip' }, { merge: true });
};

// ===== VIP System (levels + privileges) =====
export interface ConfigVipLevel {
  level: number;
  label: string;
  priceCoins: number;
  maintainPoints: number;
  mode: 'vip' | 'svip';
  imageUrl?: string;
  imageAnimatedUrl?: string;
  backgroundImageUrl?: string;
  bgColors?: [string, string, string];
  accentColor?: string;
  heroSubtitleAr?: string;
  heroSubtitleEn?: string;
  levelPrivileges?: ConfigVipPrivilege[];
  storeItemIds?: string[];
  enabled?: boolean;
  /** @deprecated */
  minPoints?: number;
  maxPoints?: number | null;
}

export interface ConfigVipQuickAction {
  id: string;
  labelAr: string;
  labelEn: string;
  route?: string;
  enabled?: boolean;
}

export interface ConfigVipPrivilege {
  id: string;
  assetKey: string;
  titleKey: string;
  descKey: string;
  unlockLevel: number;
  mode: 'vip' | 'svip';
  order: number;
  title?: string;
  desc?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoUrlMp4?: string;
  /** ملف صوتي (لتأثير الدخول الصوتي specialSoundEffect) */
  soundUrl?: string;
  /** إذا false يُخفى من التطبيق */
  enabled?: boolean;
}

/** مفاتيح امتيازات SVIP المرتبطة بوظائف التطبيق */
export const VIP_PRIVILEGE_ASSET_OPTIONS: { key: string; labelAr: string; feature: string }[] = [
  // — امتيازات بصرية (صورة/فيديو) —
  { key: 'vipBadge', labelAr: 'علامة VIP', feature: 'بصري — الملف والغرف' },
  { key: 'vipSeat', labelAr: 'مقعد VIP', feature: 'بصري — منصة الغرف' },
  { key: 'entryEffect', labelAr: 'تأثير الدخول الحصري', feature: 'بصري — دخول الغرف' },
  { key: 'chatBubble', labelAr: 'فقاعة الكتابة', feature: 'بصري — رسائل الغرف' },
  { key: 'profileCard', labelAr: 'بطاقة الملف الشخصي', feature: 'بصري — الملف الشخصي' },
  { key: 'vipEntry', labelAr: 'دخولية VIP', feature: 'بصري — أنيميشن الدخول (فيديو)' },
  { key: 'photoFrame', labelAr: 'إطار الصورة', feature: 'بصري — الصورة الشخصية' },
  { key: 'honorMedal', labelAr: 'وسام الشرف', feature: 'بصري — الملف والغرف' },
  { key: 'specialSoundEffect', labelAr: 'تأثير صوتي مميز', feature: 'بصري — صوت دخول الغرفة' },
  { key: 'roomBackground', labelAr: 'خلفية الغرفة', feature: 'بصري — خلفية الغرفة' },
  { key: 'animatedAvatar', labelAr: 'صورة متحركة', feature: 'بصري — الصورة الشخصية المتحركة' },
  // — امتيازات وظيفية (سلوك حقيقي) —
  { key: 'exclusiveGifts', labelAr: 'هدايا حصرية', feature: 'وظيفي — هدايا حصرية للأعضاء' },
  { key: 'visitorsLog', labelAr: 'سجل الزوار', feature: 'وظيفي — عرض كامل لزوار الملف' },
  { key: 'flyingMessage', labelAr: 'رسائل طائرة', feature: 'وظيفي — رسالة عابرة في الغرفة' },
  { key: 'upgradeAnnouncement', labelAr: 'إعلان الترقية', feature: 'وظيفي — إعلان عند رفع المستوى' },
  { key: 'specialRoomId', labelAr: 'أيدي غرفة مميز', feature: 'وظيفي — معرّف غرفة مخصّص' },
  { key: 'specialId', labelAr: 'أيدي مميز', feature: 'وظيفي — معرّف حساب مخصّص' },
  { key: 'invisibleVisitor', labelAr: 'زائر خفي', feature: 'وظيفي — زيارة بلا تسجيل' },
  { key: 'exclusiveSupport', labelAr: 'خدمة عملاء حصرية', feature: 'وظيفي — أولوية الدعم' },
  { key: 'hideOnline', labelAr: 'إخفاء حالة Online', feature: 'وظيفي — إخفاء حالة الاتصال' },
  { key: 'hideGiftHistory', labelAr: 'إخفاء سجل الهدايا', feature: 'وظيفي — إخفاء الهدايا المستلمة' },
  { key: 'luckyBagMax', labelAr: 'زيادة حد حقيبة الحظ', feature: 'وظيفي — رفع حد الفاتحين' },
  { key: 'hiddenRanking', labelAr: 'ترتيب خفي', feature: 'وظيفي — الاختفاء من المتصدّرين' },
  { key: 'extraRoomAdmins', labelAr: 'زيادة عدد مشرفين الغرفة', feature: 'وظيفي — رفع حد المشرفين' },
  { key: 'antiMute', labelAr: 'ضد التصميت', feature: 'وظيفي — منع كتم العضو' },
  { key: 'appWideMessage', labelAr: 'رسائل على مستوى التطبيق', feature: 'وظيفي — بثّ عام' },
  { key: 'hiddenPresence', labelAr: 'تواجد خفي', feature: 'وظيفي — دخول الغرف بلا ظهور' },
  { key: 'hiddenVipIdentity', labelAr: 'هوية VIP مخفية', feature: 'وظيفي — إخفاء شارة VIP' },
  { key: 'antiKick', labelAr: 'ضد الطرد', feature: 'وظيفي — منع الطرد' },
  { key: 'removeBan', labelAr: 'إلغاء الحظر', feature: 'وظيفي — تجاوز حظر الغرفة' },
  { key: 'comingSoon', labelAr: 'قريباً', feature: 'placeholder' },
];

export interface ConfigVipSystem {
  pointPerCoin: number;
  validityDays: number;
  downgradeToLevel: number;
  expiryWarningDays: number;
  levels: ConfigVipLevel[];
  privileges: ConfigVipPrivilege[];
  screenTitleAr?: string;
  screenTitleEn?: string;
  privilegesSectionAr?: string;
  privilegesSectionEn?: string;
  quickActions?: ConfigVipQuickAction[];
}

export function normalizeConfigVipPrivilege(raw: ConfigVipPrivilege): ConfigVipPrivilege {
  const out: ConfigVipPrivilege = {
    id: raw.id,
    assetKey: raw.assetKey,
    titleKey: raw.titleKey,
    descKey: raw.descKey,
    unlockLevel: raw.unlockLevel,
    mode: raw.mode ?? 'svip',
    order: raw.order,
    enabled: raw.enabled !== false,
  };
  const title = raw.title?.trim();
  const desc = raw.desc?.trim();
  const imageUrl = raw.imageUrl?.trim();
  const videoUrl = raw.videoUrl?.trim();
  const videoUrlMp4 = raw.videoUrlMp4?.trim();
  const soundUrl = raw.soundUrl?.trim();
  if (title) out.title = title;
  if (desc) out.desc = desc;
  if (imageUrl) out.imageUrl = imageUrl;
  if (videoUrl) out.videoUrl = videoUrl;
  if (videoUrlMp4) out.videoUrlMp4 = videoUrlMp4;
  if (soundUrl) out.soundUrl = soundUrl;
  return out;
}

export function normalizeConfigVipLevel(raw: ConfigVipLevel): ConfigVipLevel {
  const bg = raw.bgColors;
  const bgColors =
    Array.isArray(bg) && bg.length >= 3
      ? ([String(bg[0]), String(bg[1]), String(bg[2])] as [string, string, string])
      : undefined;
  const out: ConfigVipLevel = {
    level: raw.level,
    label: raw.label,
    priceCoins: raw.priceCoins ?? raw.minPoints ?? 0,
    maintainPoints: raw.maintainPoints ?? 0,
    mode: raw.mode ?? 'svip',
    enabled: raw.enabled !== false,
  };
  const imageUrl = raw.imageUrl?.trim();
  const imageAnimatedUrl = raw.imageAnimatedUrl?.trim();
  const backgroundImageUrl = raw.backgroundImageUrl?.trim();
  const accentColor = raw.accentColor?.trim();
  const heroSubtitleAr = raw.heroSubtitleAr?.trim();
  const heroSubtitleEn = raw.heroSubtitleEn?.trim();
  if (imageUrl) out.imageUrl = imageUrl;
  if (imageAnimatedUrl) out.imageAnimatedUrl = imageAnimatedUrl;
  if (backgroundImageUrl) out.backgroundImageUrl = backgroundImageUrl;
  if (bgColors) out.bgColors = bgColors;
  if (accentColor) out.accentColor = accentColor;
  if (heroSubtitleAr) out.heroSubtitleAr = heroSubtitleAr;
  if (heroSubtitleEn) out.heroSubtitleEn = heroSubtitleEn;
  if (raw.levelPrivileges?.length) {
    out.levelPrivileges = raw.levelPrivileges.map(normalizeConfigVipPrivilege);
  }
  const storeItemIds = raw.storeItemIds?.filter(Boolean);
  if (storeItemIds?.length) out.storeItemIds = storeItemIds;
  return out;
}

export function normalizeConfigVipSystem(raw: Partial<ConfigVipSystem>): ConfigVipSystem {
  return {
    pointPerCoin: raw.pointPerCoin ?? 1,
    validityDays: raw.validityDays ?? 30,
    downgradeToLevel: raw.downgradeToLevel ?? 1,
    expiryWarningDays: raw.expiryWarningDays ?? 5,
    levels: (raw.levels?.length ? raw.levels : DEFAULT_CONFIG_VIP_SYSTEM.levels).map(normalizeConfigVipLevel),
    privileges: raw.privileges?.length ? raw.privileges.map(normalizeConfigVipPrivilege) : DEFAULT_CONFIG_VIP_SYSTEM.privileges,
    screenTitleAr: raw.screenTitleAr?.trim() || 'SVIP',
    screenTitleEn: raw.screenTitleEn?.trim() || 'SVIP',
    privilegesSectionAr: raw.privilegesSectionAr?.trim() || 'امتيازات',
    privilegesSectionEn: raw.privilegesSectionEn?.trim() || 'Privileges',
    quickActions: raw.quickActions?.length ? raw.quickActions : DEFAULT_CONFIG_VIP_SYSTEM.quickActions,
  };
}

export const DEFAULT_CONFIG_VIP_SYSTEM: ConfigVipSystem = {
  pointPerCoin: 1,
  validityDays: 30,
  downgradeToLevel: 1,
  expiryWarningDays: 5,
  levels: [
    { level: 1, label: 'SVIP1', priceCoins: 1_000_000, maintainPoints: 500_000, mode: 'svip' },
    { level: 2, label: 'SVIP2', priceCoins: 2_000_000, maintainPoints: 1_000_000, mode: 'svip' },
    { level: 3, label: 'SVIP3', priceCoins: 4_000_000, maintainPoints: 2_000_000, mode: 'svip' },
    { level: 4, label: 'SVIP4', priceCoins: 6_000_000, maintainPoints: 5_000_000, mode: 'svip' },
    { level: 5, label: 'SVIP5', priceCoins: 10_000_000, maintainPoints: 9_000_000, mode: 'svip' },
    { level: 6, label: 'SVIP6', priceCoins: 15_000_000, maintainPoints: 12_500_000, mode: 'svip' },
    { level: 7, label: 'SVIP7', priceCoins: 20_000_000, maintainPoints: 17_500_000, mode: 'svip' },
    { level: 8, label: 'SVIP8', priceCoins: 25_000_000, maintainPoints: 22_500_000, mode: 'svip' },
    { level: 9, label: 'SVIP9', priceCoins: 50_000_000, maintainPoints: 37_500_000, mode: 'svip' },
    { level: 10, label: 'SVIP10', priceCoins: 100_000_000, maintainPoints: 75_000_000, mode: 'svip' },
    { level: 11, label: 'SVIP11', priceCoins: 150_000_000, maintainPoints: 125_000_000, mode: 'svip' },
    { level: 12, label: 'SVIP12', priceCoins: 200_000_000, maintainPoints: 175_000_000, mode: 'svip' },
  ],
  privileges: [
    { id: 'vip-badge', assetKey: 'vipBadge', titleKey: 'vipHub.privilegeBadge', descKey: 'vipHub.privilegeBadgeDesc', unlockLevel: 1, mode: 'svip', order: 1, title: 'علامة VIP', desc: 'شعار SVIP حصري يظهر على صورتك الشخصية وفي غرف الدردشة لتتميز بين الجميع.' },
    { id: 'exclusive-gifts', assetKey: 'exclusiveGifts', titleKey: 'vipHub.privExclusiveGifts', descKey: 'vipHub.privExclusiveGiftsDesc', unlockLevel: 1, mode: 'svip', order: 2, title: 'هدايا حصرية', desc: 'باقة هدايا فاخرة لا تتوفّر إلا لأعضاء SVIP.' },
    { id: 'visitors-log', assetKey: 'visitorsLog', titleKey: 'vipHub.privVisitorsLog', descKey: 'vipHub.privVisitorsLogDesc', unlockLevel: 1, mode: 'svip', order: 3, title: 'سجل الزوار', desc: 'اطّلع على قائمة كاملة بمن زار ملفك الشخصي.' },
    { id: 'vip-seat', assetKey: 'vipSeat', titleKey: 'vipHub.privilegeSeat', descKey: 'vipHub.privilegeSeatDesc', unlockLevel: 2, mode: 'svip', order: 4, title: 'مقعد VIP', desc: 'تصميم مقعد مذهل وخاص عند صعودك على المنصة في الغرف.' },
    { id: 'flying-message', assetKey: 'flyingMessage', titleKey: 'vipHub.privFlyingMessage', descKey: 'vipHub.privFlyingMessageDesc', unlockLevel: 3, mode: 'svip', order: 5, title: 'رسائل طائرة', desc: 'أرسل رسالة متحركة تعبر شاشة الغرفة ليراها الجميع.' },
    { id: 'entry-effect', assetKey: 'entryEffect', titleKey: 'vipHub.privilegeEntry', descKey: 'vipHub.privilegeEntryDesc', unlockLevel: 4, mode: 'svip', order: 6, title: 'تأثير الدخول الحصري', desc: 'تأثير دخول متحرك وجذاب عند دخولك أي غرفة دردشة ليلاحظك الجميع.' },
    { id: 'upgrade-announcement', assetKey: 'upgradeAnnouncement', titleKey: 'vipHub.privUpgradeAnnouncement', descKey: 'vipHub.privUpgradeAnnouncementDesc', unlockLevel: 5, mode: 'svip', order: 7, title: 'إعلان الترقية', desc: 'إعلان احتفالي يظهر للجميع عند ترقية مستواك.' },
    { id: 'chat-bubble', assetKey: 'chatBubble', titleKey: 'vipHub.privilegeBubble', descKey: 'vipHub.privilegeBubbleDesc', unlockLevel: 6, mode: 'svip', order: 8, title: 'فقاعة الكتابة', desc: 'لون وتصميم خاص لفقاعة رسائلك داخل غرف الدردشة.' },
    { id: 'photo-frame', assetKey: 'photoFrame', titleKey: 'vipHub.privilegeFrame', descKey: 'vipHub.privilegeFrameDesc', unlockLevel: 6, mode: 'svip', order: 9, title: 'إطار الصورة', desc: 'إطار ذهبي وفخم يحيط بصورتك الشخصية أينما ظهرت.' },
    { id: 'vip-entry', assetKey: 'vipEntry', titleKey: 'vipHub.privilegeVipEntry', descKey: 'vipHub.privilegeVipEntryDesc', unlockLevel: 6, mode: 'svip', order: 10, title: 'دخولية VIP', desc: 'مركبة فاخرة متحركة ترافق دخولك للغرفة.' },
    { id: 'profile-card', assetKey: 'profileCard', titleKey: 'vipHub.privilegeCard', descKey: 'vipHub.privilegeCardDesc', unlockLevel: 6, mode: 'svip', order: 11, title: 'بطاقة الملف الشخصي', desc: 'خلفية وتأثيرات ساحرة لبطاقة ملفك الشخصي تبرز فخامتك.' },
    { id: 'special-sound-effect', assetKey: 'specialSoundEffect', titleKey: 'vipHub.privSpecialSound', descKey: 'vipHub.privSpecialSoundDesc', unlockLevel: 7, mode: 'svip', order: 12, title: 'تأثير صوتي مميز', desc: 'مؤثر صوتي خاص يصدح عند دخولك الغرفة.' },
    { id: 'special-room-id', assetKey: 'specialRoomId', titleKey: 'vipHub.privSpecialRoomId', descKey: 'vipHub.privSpecialRoomIdDesc', unlockLevel: 8, mode: 'svip', order: 13, title: 'أيدي غرفة مميز', desc: 'معرّف غرفة مميز يسهل تذكّره ويبرز غرفتك.' },
    { id: 'special-id', assetKey: 'specialId', titleKey: 'vipHub.privSpecialId', descKey: 'vipHub.privSpecialIdDesc', unlockLevel: 8, mode: 'svip', order: 14, title: 'أيدي مميز', desc: 'معرّف حساب مميز قصير يميّزك عن الآخرين.' },
    { id: 'room-background', assetKey: 'roomBackground', titleKey: 'vipHub.privRoomBackground', descKey: 'vipHub.privRoomBackgroundDesc', unlockLevel: 8, mode: 'svip', order: 15, title: 'خلفية الغرفة', desc: 'خلفيات حصرية لتزيين غرفتك الصوتية.' },
    { id: 'invisible-visitor', assetKey: 'invisibleVisitor', titleKey: 'vipHub.privInvisibleVisitor', descKey: 'vipHub.privInvisibleVisitorDesc', unlockLevel: 9, mode: 'svip', order: 16, title: 'زائر خفي', desc: 'تصفّح ملفات الآخرين دون أن يظهر اسمك في سجل الزوار.' },
    { id: 'exclusive-support', assetKey: 'exclusiveSupport', titleKey: 'vipHub.privExclusiveSupport', descKey: 'vipHub.privExclusiveSupportDesc', unlockLevel: 9, mode: 'svip', order: 17, title: 'خدمة عملاء حصرية', desc: 'دعم فني مميز وذو أولوية على مدار الساعة.' },
    { id: 'hide-online', assetKey: 'hideOnline', titleKey: 'vipHub.privHideOnline', descKey: 'vipHub.privHideOnlineDesc', unlockLevel: 10, mode: 'svip', order: 18, title: 'إخفاء حالة Online', desc: 'أخفِ حالة اتصالك فلا يعرف أحد متى تكون متصلاً.' },
    { id: 'hide-gift-history', assetKey: 'hideGiftHistory', titleKey: 'vipHub.privHideGiftHistory', descKey: 'vipHub.privHideGiftHistoryDesc', unlockLevel: 10, mode: 'svip', order: 19, title: 'إخفاء سجل الهدايا', desc: 'أخفِ سجل الهدايا المستلمة عن الآخرين.' },
    { id: 'lucky-bag-max', assetKey: 'luckyBagMax', titleKey: 'vipHub.privLuckyBagMax', descKey: 'vipHub.privLuckyBagMaxDesc', unlockLevel: 10, mode: 'svip', order: 20, title: 'زيادة الحد الأقصى لحقيبة الحظ', desc: 'ارفع الحد الأقصى لعدد فاتحي حقيبة الحظ.' },
    { id: 'animated-avatar', assetKey: 'animatedAvatar', titleKey: 'vipHub.privAnimatedAvatar', descKey: 'vipHub.privAnimatedAvatarDesc', unlockLevel: 11, mode: 'svip', order: 21, title: 'صورة متحركة', desc: 'استخدم صورة شخصية متحركة (GIF) تلفت الأنظار.' },
    { id: 'hidden-ranking', assetKey: 'hiddenRanking', titleKey: 'vipHub.privHiddenRanking', descKey: 'vipHub.privHiddenRankingDesc', unlockLevel: 11, mode: 'svip', order: 22, title: 'ترتيب خفي', desc: 'اختفِ من قوائم المتصدّرين والترتيب العام.' },
    { id: 'extra-room-admins', assetKey: 'extraRoomAdmins', titleKey: 'vipHub.privExtraRoomAdmins', descKey: 'vipHub.privExtraRoomAdminsDesc', unlockLevel: 11, mode: 'svip', order: 23, title: 'زيادة عدد مشرفين الغرفة', desc: 'عيّن عدداً أكبر من المشرفين في غرفتك.' },
    { id: 'anti-mute', assetKey: 'antiMute', titleKey: 'vipHub.privAntiMute', descKey: 'vipHub.privAntiMuteDesc', unlockLevel: 12, mode: 'svip', order: 24, title: 'ضد التصميت', desc: 'لا يستطيع أحد كتم صوتك داخل الغرف.' },
    { id: 'app-wide-message', assetKey: 'appWideMessage', titleKey: 'vipHub.privAppWideMessage', descKey: 'vipHub.privAppWideMessageDesc', unlockLevel: 12, mode: 'svip', order: 25, title: 'رسائل على مستوى التطبيق', desc: 'أرسل رسالة تظهر لكل مستخدمي التطبيق.' },
    { id: 'hidden-presence', assetKey: 'hiddenPresence', titleKey: 'vipHub.privHiddenPresence', descKey: 'vipHub.privHiddenPresenceDesc', unlockLevel: 12, mode: 'svip', order: 26, title: 'تواجد خفي', desc: 'ادخل الغرف دون أن يظهر اسمك في قائمة الحضور.' },
    { id: 'hidden-vip-identity', assetKey: 'hiddenVipIdentity', titleKey: 'vipHub.privHiddenVipIdentity', descKey: 'vipHub.privHiddenVipIdentityDesc', unlockLevel: 13, mode: 'svip', order: 27, title: 'هوية VIP مخفية', desc: 'أخفِ شارة الـ VIP وتنقّل بهوية عادية متى شئت.' },
    { id: 'anti-kick', assetKey: 'antiKick', titleKey: 'vipHub.privAntiKick', descKey: 'vipHub.privAntiKickDesc', unlockLevel: 13, mode: 'svip', order: 28, title: 'ضد الطرد', desc: 'لا يستطيع أحد طردك من الغرف.' },
    { id: 'remove-ban', assetKey: 'removeBan', titleKey: 'vipHub.privRemoveBan', descKey: 'vipHub.privRemoveBanDesc', unlockLevel: 14, mode: 'svip', order: 29, title: 'إلغاء الحظر', desc: 'تجاوز الحظر وادخل الغرف التي حُظرت منها.' },
    { id: 'coming-soon', assetKey: 'comingSoon', titleKey: 'vipHub.privComingSoon', descKey: 'vipHub.privComingSoonDesc', unlockLevel: 16, mode: 'svip', order: 30, title: 'قريباً', desc: 'امتياز حصري جديد يُكشف عنه قريباً.' },
  ],
  screenTitleAr: 'SVIP',
  screenTitleEn: 'SVIP',
  privilegesSectionAr: 'امتيازات',
  privilegesSectionEn: 'Privileges',
  quickActions: [
    { id: 'perks', labelAr: 'إمتياز', labelEn: 'Perks', route: '/vip', enabled: true },
    { id: 'tasks', labelAr: 'مهمة', labelEn: 'Tasks', route: '/wealth-level', enabled: true },
    { id: 'honor', labelAr: 'تشريف', labelEn: 'Honor', route: '/vip/rules', enabled: true },
  ],
};

function resolveVipLevelFromPoints(points: number, levels: ConfigVipLevel[]): number {
  let resolved = 0;
  for (const lv of levels.map(normalizeConfigVipLevel)) {
    if (points >= lv.priceCoins) resolved = lv.level;
  }
  return resolved;
}

export const getConfigVipSystem = async (): Promise<ConfigVipSystem> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'vipSystem'));
    if (snap.exists()) {
      return normalizeConfigVipSystem(snap.data() as Partial<ConfigVipSystem>);
    }
  } catch { /* ignore */ }
  return DEFAULT_CONFIG_VIP_SYSTEM;
};

export const saveConfigVipSystem = async (config: ConfigVipSystem): Promise<void> => {
  const normalized = normalizeConfigVipSystem(config);
  const payload = stripUndefinedDeep({ ...normalized, updatedAt: Date.now(), _permKey: 'vip' });
  await setDoc(doc(firestore, 'config', 'vipSystem'), payload, { merge: true });
};

/** Firestore يرفض undefined — نزيلها قبل الكتابة */
function stripUndefinedDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === undefined) continue;
    out[key] = stripUndefinedDeep(entry);
  }
  return out as T;
}

async function addVipPointsAdmin(uid: string, coinsAdded: number): Promise<void> {
  if (coinsAdded <= 0) return;
  const config = await getConfigVipSystem();
  const points = Math.floor(coinsAdded * (config.pointPerCoin ?? 1));
  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;
  const data = snap.data() as Record<string, unknown>;
  const newPoints = Number(data.vipPoints ?? 0) + points;
  const newMonth = Number(data.vipPointsMonth ?? 0) + points;
  const newLevel = resolveVipLevelFromPoints(newPoints, config.levels);
  await updateDoc(userRef, {
    vipPoints: newPoints,
    vipPointsMonth: newMonth,
    vipLevel: newLevel,
    isVIP: newLevel >= 1,
    updatedAt: Date.now(),
  });
}

// ===== Recharge Packages =====
export const getConfigPackagesState = async (): Promise<{
  exists: boolean;
  packages: ConfigRechargePackage[];
  tags: ConfigRechargePackageTag[];
}> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'rechargePackages'));
    if (!snap.exists()) return { exists: false, packages: [], tags: [] };
    const data = snap.data();
    const tags = ((data.tags ?? data.categories ?? []) as ConfigRechargePackageTag[])
      .map(normalizeConfigRechargePackageTag)
      .filter((t) => t.id && t.enabled !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const packages = ((data.packages ?? []) as ConfigRechargePackage[])
      .map(normalizeConfigRechargePackage);
    return { exists: true, packages, tags };
  } catch {
    return { exists: false, packages: [], tags: [] };
  }
};

export const getConfigPackages = async (): Promise<ConfigRechargePackage[]> => {
  const { packages } = await getConfigPackagesState();
  return packages;
};

export const saveConfigPackages = async (
  packages: ConfigRechargePackage[],
  tags?: ConfigRechargePackageTag[],
): Promise<void> => {
  const normalized = packages.map(normalizeConfigRechargePackage);
  const payload: Record<string, unknown> = { packages: normalized, updatedAt: Date.now(), _permKey: 'packages' };
  if (tags) {
    payload.tags = tags.map(normalizeConfigRechargePackageTag).map((t, i) => ({ ...t, order: i }));
  }
  await setDoc(doc(firestore, 'config', 'rechargePackages'), payload, { merge: true });
};

export const saveConfigPackageTags = async (tags: ConfigRechargePackageTag[]): Promise<void> => {
  const normalized = tags.map(normalizeConfigRechargePackageTag).map((t, i) => ({ ...t, order: i }));
  await setDoc(doc(firestore, 'config', 'rechargePackages'), { tags: normalized, updatedAt: Date.now(), _permKey: 'packages' }, { merge: true });
};

// ===== Rewards Center =====
export interface ConfigCheckInDay {
  day: number;
  rewardType: 'coins' | 'message_cards' | 'frame' | 'gift';
  amount: number;
  labelAr?: string;
  labelEn?: string;
}

export interface ConfigRewardTask {
  id: string;
  enabled: boolean;
  order: number;
  titleAr: string;
  titleEn: string;
  metric: string;
  target: number;
  /** إصلاح #21 — pearls (ماسة) خيار صريح إلى جانب coins وبطاقات الرسائل */
  rewardType: 'coins' | 'message_cards' | 'pearls';
  rewardAmount: number;
  route: string;
  iconKey: string;
}

export interface ConfigRewardsCenter {
  enabled: boolean;
  titleAr: string;
  titleEn: string;
  freeCardsLabelAr: string;
  freeCardsLabelEn: string;
  checkInFreeTitleAr: string;
  checkInFreeTitleEn: string;
  checkInPremiumTitleAr: string;
  checkInPremiumTitleEn: string;
  upgradePriceCoins: number;
  upgradePriceLabel: string;
  premiumMaxInfoAr: string;
  premiumMaxInfoEn: string;
  upgradeModalAr: string;
  upgradeModalEn: string;
  dailyTasksSubtitleAr: string;
  dailyTasksSubtitleEn: string;
  dailyTasksMaxCards: number;
  newUserTasksSubtitleAr: string;
  newUserTasksSubtitleEn: string;
  newUserTasksMaxCards: number;
  freeCheckInDays: ConfigCheckInDay[];
  premiumCheckInDays: ConfigCheckInDay[];
  dailyTasks: ConfigRewardTask[];
  newUserTasks: ConfigRewardTask[];
}

export const DEFAULT_REWARDS_CENTER: ConfigRewardsCenter = {
  enabled: true,
  titleAr: 'مركز المكافآت',
  titleEn: 'Rewards Center',
  freeCardsLabelAr: 'بطاقات رسائل مجانية',
  freeCardsLabelEn: 'Free message cards',
  checkInFreeTitleAr: 'تسجيل الدخول المتواصل',
  checkInFreeTitleEn: 'Continuous Check-in',
  checkInPremiumTitleAr: 'ترقية تسجيل الدخول',
  checkInPremiumTitleEn: 'Check-in Upgrade',
  upgradePriceCoins: 50_000,
  upgradePriceLabel: '$1.99',
  premiumMaxInfoAr: 'الحد الأقصى 1900 ≈ $2.71',
  premiumMaxInfoEn: 'Maximum 1900 ≈ $2.71',
  upgradeModalAr:
    'يمكنك ترقية مكافآت تسجيل الدخول اليومية بشراء البطاقة الأسبوعية. البطاقة صالحة لمدة 7 أيام. يجب تسجيل الدخول يومياً لاستلام المكافآت.',
  upgradeModalEn: 'Upgrade daily login rewards with the weekly card. Valid 7 days. Claim daily.',
  dailyTasksSubtitleAr: 'أكمل المهام اليومية لتربح 3 بطاقات رسائل مجانية',
  dailyTasksSubtitleEn: 'Complete daily tasks to win 3 free message cards',
  dailyTasksMaxCards: 3,
  newUserTasksSubtitleAr: 'أكمل مهام المستخدمين الجدد لتربح بطاقات رسائل مجانية',
  newUserTasksSubtitleEn: 'Complete new user tasks for free message cards',
  newUserTasksMaxCards: 2,
  freeCheckInDays: [
    { day: 1, rewardType: 'coins', amount: 5 },
    { day: 2, rewardType: 'message_cards', amount: 1 },
    { day: 3, rewardType: 'frame', amount: 1, labelAr: 'إطار', labelEn: 'Frame' },
    { day: 4, rewardType: 'gift', amount: 1, labelAr: 'هدية', labelEn: 'Gift' },
    { day: 5, rewardType: 'coins', amount: 5 },
    { day: 6, rewardType: 'message_cards', amount: 1 },
    { day: 7, rewardType: 'coins', amount: 10 },
  ],
  premiumCheckInDays: [
    { day: 1, rewardType: 'coins', amount: 600 },
    { day: 2, rewardType: 'coins', amount: 500 },
    { day: 3, rewardType: 'coins', amount: 160 },
    { day: 4, rewardType: 'coins', amount: 160 },
    { day: 5, rewardType: 'coins', amount: 160 },
    { day: 6, rewardType: 'coins', amount: 160 },
    { day: 7, rewardType: 'coins', amount: 160 },
  ],
  dailyTasks: [
    { id: 'send-msgs-female', enabled: true, order: 1, titleAr: 'أرسل 5 رسائل إلى فتاة', titleEn: 'Send 5 messages to a girl', metric: 'messages_to_female', target: 1, rewardType: 'message_cards', rewardAmount: 2, route: '/(tabs)/chat', iconKey: 'message' },
    { id: 'rel-level-2', enabled: true, order: 2, titleAr: 'الوصول إلى مستوى 2 مع 1 فتاة', titleEn: 'Reach level 2 with 1 girl', metric: 'relationship_level_2', target: 1, rewardType: 'message_cards', rewardAmount: 1, route: '/relationships', iconKey: 'level' },
    { id: 'chat-rounds', enabled: true, order: 3, titleAr: 'الدردشة مع 2 لمدة 2 جولات', titleEn: 'Chat with 2 for 2 rounds', metric: 'chat_rounds', target: 2, rewardType: 'coins', rewardAmount: 2, route: '/(tabs)/chat', iconKey: 'chat' },
    { id: 'game-bet', enabled: true, order: 4, titleAr: 'العب لعبة 1 مراهنة', titleEn: 'Play 1 game bet', metric: 'game_bet', target: 1, rewardType: 'coins', rewardAmount: 8, route: '/games/wheel', iconKey: 'game' },
  ],
  newUserTasks: [
    { id: 'profile-complete', enabled: true, order: 1, titleAr: 'إكمال معلومات الملف الشخصي', titleEn: 'Complete profile', metric: 'profile_complete', target: 1, rewardType: 'message_cards', rewardAmount: 2, route: '/profile/edit', iconKey: 'profile' },
  ],
};

export const getRewardsCenterConfig = async (): Promise<ConfigRewardsCenter | null> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'rewardsCenter'));
    return snap.exists() ? ({ ...DEFAULT_REWARDS_CENTER, ...snap.data() } as ConfigRewardsCenter) : null;
  } catch { return null; }
};

export const saveRewardsCenterConfig = async (config: ConfigRewardsCenter): Promise<void> => {
  await setDoc(doc(firestore, 'config', 'rewardsCenter'), { ...config, updatedAt: Date.now(), _permKey: 'rewards-center' }, { merge: true });
};

// ===== Host Tasks (مهام المضيفة) =====
export interface ConfigHostTaskItem {
  enabled: boolean;
  order: number;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  target: number;
  rewardCoins: number;
  repeatable: boolean;
  iconKey: string;
}

export interface ConfigHostTasks {
  enabled: boolean;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  resetHour: number;
  tasks: {
    messages: ConfigHostTaskItem;
    voiceCalls: ConfigHostTaskItem;
    videoCalls: ConfigHostTaskItem;
    voiceCompetition: ConfigHostTaskItem;
    videoCompetition: ConfigHostTaskItem;
    dailyOnline: ConfigHostTaskItem;
  };
}

export const DEFAULT_HOST_TASKS: ConfigHostTasks = {
  enabled: true,
  titleAr: 'صفحة المهمات',
  titleEn: 'Host Tasks',
  subtitleAr: 'أكمل المهام اليومية لتحصل على كوينز — تُضاف المكافآت مباشرة لحسابك',
  subtitleEn: 'Complete daily tasks to earn coins — rewards are credited instantly',
  resetHour: 0,
  tasks: {
    messages: {
      enabled: true, order: 1,
      titleAr: 'الرسائل الواردة', titleEn: 'Incoming Messages',
      descAr: 'كل 1,000 رسالة تصلك', descEn: 'Every 1,000 messages received',
      target: 1000, rewardCoins: 10_000, repeatable: true, iconKey: 'message',
    },
    voiceCalls: {
      enabled: true, order: 2,
      titleAr: 'محادثة صوتية', titleEn: 'Voice Calls',
      descAr: '60 دقيقة صوت مع أشخاص مختلفين', descEn: '60 voice minutes across partners',
      target: 60, rewardCoins: 50_000, repeatable: false, iconKey: 'voice',
    },
    videoCalls: {
      enabled: true, order: 3,
      titleAr: 'محادثة فيديو', titleEn: 'Video Calls',
      descAr: '60 دقيقة فيديو مع أشخاص مختلفين', descEn: '60 video minutes across partners',
      target: 60, rewardCoins: 120_000, repeatable: false, iconKey: 'video',
    },
    voiceCompetition: {
      enabled: true, order: 4,
      titleAr: 'مطابقات صوت', titleEn: 'Voice Matches',
      descAr: 'كل 10 مطابقات صوت', descEn: 'Every 10 voice matches',
      target: 10, rewardCoins: 15_000, repeatable: true, iconKey: 'voice_pk',
    },
    videoCompetition: {
      enabled: true, order: 5,
      titleAr: 'مطابقات فيديو', titleEn: 'Video Matches',
      descAr: 'كل 10 مطابقات فيديو', descEn: 'Every 10 video matches',
      target: 10, rewardCoins: 25_000, repeatable: true, iconKey: 'video_pk',
    },
    dailyOnline: {
      enabled: true, order: 6,
      titleAr: 'التسجيل اليومي', titleEn: 'Daily Online',
      descAr: 'أكثر من 8 ساعات مع تفاعل', descEn: '8+ hours online with interaction',
      target: 480, rewardCoins: 5_000, repeatable: false, iconKey: 'online',
    },
  },
};

export const getHostTasksConfig = async (): Promise<ConfigHostTasks | null> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'hostTasks'));
    if (!snap.exists()) return null;
    const data = snap.data() as Partial<ConfigHostTasks>;
    return {
      ...DEFAULT_HOST_TASKS,
      ...data,
      tasks: { ...DEFAULT_HOST_TASKS.tasks, ...(data.tasks ?? {}) },
    };
  } catch { return null; }
};

export const saveHostTasksConfig = async (config: ConfigHostTasks): Promise<void> => {
  await setDoc(doc(firestore, 'config', 'hostTasks'), { ...config, updatedAt: Date.now(), _permKey: 'host-tasks' }, { merge: true });
};

// ===== About Pages (حول التطبيق) =====
export type ConfigAboutAction = 'page' | 'support' | 'url';

export interface ConfigAboutSection {
  id: string;
  order: number;
  enabled: boolean;
  titleAr: string;
  titleEn: string;
  contentAr: string;
  contentEn: string;
  actionType: ConfigAboutAction;
  externalUrl?: string;
}

export interface ConfigAboutPages {
  appVersion: string;
  sections: ConfigAboutSection[];
}

export const DEFAULT_ABOUT_PAGES: ConfigAboutPages = {
  appVersion: '1.0.0',
  sections: [
    { id: 'terms', order: 1, enabled: true, titleAr: 'شروط الخدمة', titleEn: 'Terms of Service', contentAr: 'باستخدامك تطبيق LinkUp فإنك توافق على شروط الخدمة.', contentEn: 'By using LinkUp you agree to the Terms of Service.', actionType: 'page' },
    { id: 'privacy', order: 2, enabled: true, titleAr: 'سياسة الخصوصية', titleEn: 'Privacy Policy', contentAr: 'نحترم خصوصيتك ولا نبيع بياناتك.', contentEn: 'We respect your privacy and do not sell your data.', actionType: 'page' },
    { id: 'copyright', order: 3, enabled: true, titleAr: 'إشعار حقوق الملكية', titleEn: 'Copyright Notice', contentAr: 'جميع المحتويات محمية بحقوق الملكية.', contentEn: 'All content is protected by copyright.', actionType: 'page' },
    { id: 'child-safety', order: 4, enabled: true, titleAr: 'سياسة حماية الأطفال', titleEn: 'Child Safety Policy', contentAr: 'نلتزم بحماية القُصّر.', contentEn: 'We are committed to protecting minors.', actionType: 'page' },
    { id: 'music', order: 5, enabled: true, titleAr: 'تعليمات المكتبة الموسيقية', titleEn: 'Music Library Usage', contentAr: 'الموسيقى تخضع لتراخيص الاستخدام.', contentEn: 'Music is subject to usage licenses.', actionType: 'page' },
    { id: 'community', order: 6, enabled: true, titleAr: 'إرشادات المجتمع', titleEn: 'Community Guidelines', contentAr: 'كن محترماً مع الآخرين.', contentEn: 'Be respectful to others.', actionType: 'page' },
    { id: 'about-us', order: 7, enabled: true, titleAr: 'من نحن', titleEn: 'About Us', contentAr: 'LinkUp منصة اجتماعية للبث والدردشة.', contentEn: 'LinkUp is a social voice and chat platform.', actionType: 'page' },
    { id: 'ip', order: 8, enabled: true, titleAr: 'حقوق الملكية الفكرية', titleEn: 'Intellectual Property', contentAr: 'للإبلاغ عن انتهاك IP تواصل مع الدعم.', contentEn: 'Report IP violations via support.', actionType: 'page' },
    { id: 'return', order: 9, enabled: true, titleAr: 'سياسة الإرجاع', titleEn: 'Return Policy', contentAr: 'المشتريات الرقمية غير قابلة للاسترداد إلا حيث يقتضي القانون.', contentEn: 'Digital purchases are non-refundable except where required by law.', actionType: 'page' },
    { id: 'contact', order: 10, enabled: true, titleAr: 'تواصل معنا', titleEn: 'Contact Us', contentAr: '', contentEn: '', actionType: 'support' },
  ],
};

export const getAboutPagesConfig = async (): Promise<ConfigAboutPages | null> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'aboutPages'));
    if (!snap.exists()) return null;
    const data = snap.data() as Partial<ConfigAboutPages>;
    return {
      ...DEFAULT_ABOUT_PAGES,
      ...data,
      sections: data.sections?.length ? data.sections : DEFAULT_ABOUT_PAGES.sections,
    };
  } catch { return null; }
};

export const saveAboutPagesConfig = async (config: ConfigAboutPages): Promise<void> => {
  await setDoc(doc(firestore, 'config', 'aboutPages'), { ...config, updatedAt: Date.now(), _permKey: 'about-pages' }, { merge: true });
};

// ===== إصدار التطبيق (APK تجريبي) =====
export interface ConfigAppRelease {
  enabled: boolean;
  versionName: string;
  versionCode: number;
  minVersionCode: number;
  promptUpdate: boolean;
  forceUpdate: boolean;
  downloadUrl: string;
  storagePath?: string;
  landingUrl?: string;
  fileSizeBytes?: number;
  releaseNotesAr: string;
  releaseNotesEn: string;
  updateTitleAr: string;
  updateTitleEn: string;
  updateMessageAr: string;
  updateMessageEn: string;
  updatedAt: number;
}

export const DEFAULT_APP_RELEASE: ConfigAppRelease = {
  enabled: false,
  versionName: '1.0.0',
  versionCode: 1,
  minVersionCode: 1,
  promptUpdate: true,
  forceUpdate: false,
  downloadUrl: '',
  landingUrl: '',
  releaseNotesAr: '',
  releaseNotesEn: '',
  updateTitleAr: 'تحديث جديد متوفر',
  updateTitleEn: 'New update available',
  updateMessageAr: 'يوجد إصدار أحدث من التطبيق. حمّل التحديث للاستمرار بأفضل تجربة.',
  updateMessageEn: 'A newer version is available. Download the update for the best experience.',
  updatedAt: 0,
};

export const getAppReleaseConfig = async (): Promise<ConfigAppRelease | null> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'appRelease'));
    if (!snap.exists()) return null;
    return { ...DEFAULT_APP_RELEASE, ...(snap.data() as Partial<ConfigAppRelease>) };
  } catch {
    return null;
  }
};

export const saveAppReleaseConfig = async (config: ConfigAppRelease): Promise<void> => {
  const data: Record<string, unknown> = { ...config, updatedAt: Date.now(), _permKey: 'app-release' };

  if (config.storagePath === undefined) data.storagePath = deleteField();
  if (config.fileSizeBytes === undefined) data.fileSizeBytes = deleteField();

  for (const key of Object.keys(data)) {
    if (data[key] === undefined) delete data[key];
  }

  await setDoc(doc(firestore, 'config', 'appRelease'), data, { merge: true });
};

// ===== Aristocracy =====
export interface ConfigAristocracyPrivilege {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  assetKey: string;
  /** wide/half = بطاقات معاينة | icon = شبكة إمتيازات العرض */
  layout: 'wide' | 'half' | 'icon';
  order: number;
  imageUrl?: string;
  /** فيديو الامتياز (مثل دخولية الفيديو) — مثل امتيازات SVIP */
  videoUrl?: string;
  videoUrlMp4?: string;
  enabled?: boolean;
}

export interface ConfigAristocracyLevel {
  id: string;
  level: number;
  nameAr: string;
  nameEn: string;
  enabled: boolean;
  comingSoon: boolean;
  activationCoins: number;
  renewalCoins: number;
  allowRenewal?: boolean;
  validityDays: number;
  coinReturnPercent: number;
  coinReturnCoins?: number;
  grantedVipLevel?: number;
  /**
   * مفاتيح امتيازات SVIP التي تظهر فعلياً لحامل هذا المستوى.
   * undefined = كل امتيازات المستوى الممنوح. مصفوفة = فقط المفاتيح المحددة.
   */
  svipPrivilegeKeys?: string[];
  honorPointsRequired: number;
  requiredVipLevel: number;
  themeKey: string;
  privileges: ConfigAristocracyPrivilege[];
  imageUrl?: string;
  /** خلفية بطاقة المستوى */
  backgroundImageUrl?: string;
  accentColor?: string;
  bgColors?: string[];
  /** معرّفات هدايا حصرية من config/gifts */
  exclusiveGiftIds?: string[];
  heroSubtitleAr?: string;
  heroSubtitleEn?: string;
}

/** مفاتيح امتيازات الأرستقراطية المرتبطة بوظائف التطبيق */
export const ARISTOCRACY_PRIVILEGE_ASSET_OPTIONS: { key: string; labelAr: string; feature: string }[] = [
  { key: 'entry', labelAr: 'دخولية', feature: 'دخول الغرف' },
  { key: 'frame', labelAr: 'إطار', feature: 'الصورة الشخصية' },
  { key: 'profileCard', labelAr: 'بطاقة الملف', feature: 'الملف الشخصي' },
  { key: 'effects', labelAr: 'تأثيرات', feature: 'تأثيرات بصرية' },
  { key: 'badge', labelAr: 'وسام الهوية', feature: 'الملف والغرف' },
  { key: 'bubble', labelAr: 'إطار الكتابة', feature: 'رسائل الدردشة' },
  { key: 'emblem', labelAr: 'شعار التصنيف', feature: 'عرض المستوى' },
];

export const ARISTOCRACY_THEME_OPTIONS: { key: string; labelAr: string; accent: string; bg: string[] }[] = [
  { key: 'leader', labelAr: 'أزرق قائد', accent: '#7EB8FF', bg: ['#0F1C3F', '#1A2F5C', '#0A1428'] },
  { key: 'knight', labelAr: 'أزرق فارس', accent: '#4FD0FF', bg: ['#0A1E4A', '#123872', '#081530'] },
  { key: 'minister', labelAr: 'أزرق وزير', accent: '#5B9BFF', bg: ['#0C2048', '#153D7A', '#0A1838'] },
  { key: 'prince', labelAr: 'وردي أمير', accent: '#FF7AC0', bg: ['#4A0E2E', '#7A1A45', '#2D0818'] },
  { key: 'noble', labelAr: 'بنفسجي نبيل', accent: '#C9A0FF', bg: ['#2A1248', '#4A2080', '#1A0B2E'] },
  { key: 'king', labelAr: 'بنفسجي ملك', accent: '#E8B4FF', bg: ['#3D1366', '#5C1F8C', '#2A0F4A'] },
  { key: 'aristocrat', labelAr: 'ذهبي أرستقراطي', accent: '#FFD700', bg: ['#22143D', '#3C1F61', '#130B23'] },
  { key: 'emperor', labelAr: 'ذهبي إمبراطور', accent: '#FFD700', bg: ['#0A1628', '#142040', '#060D18'] },
  { key: 'legend', labelAr: 'رمادي أسطورة', accent: '#9A93AD', bg: ['#1A1A22', '#2A2A35', '#101018'] },
];

import {
  buildRichAristocracyPrivileges,
  SAMPLE_ARISTOCRACY_LEVELS,
  mergeSampleAristocracyLevels,
  ARISTOCRACY_LEVEL_GIFT_IDS,
} from './aristocracySeed';

export { buildRichAristocracyPrivileges, SAMPLE_ARISTOCRACY_LEVELS, mergeSampleAristocracyLevels, ARISTOCRACY_LEVEL_GIFT_IDS };

export function buildDefaultAristocracyPrivileges(level: number): ConfigAristocracyPrivilege[] {
  return buildRichAristocracyPrivileges(level);
}

export function normalizeAristocracyPrivilege(raw: ConfigAristocracyPrivilege): ConfigAristocracyPrivilege {
  const out: ConfigAristocracyPrivilege = {
    ...raw,
    order: raw.order ?? 0,
    enabled: raw.enabled !== false,
  };
  const imageUrl = raw.imageUrl?.trim();
  const videoUrl = raw.videoUrl?.trim();
  const videoUrlMp4 = raw.videoUrlMp4?.trim();
  if (imageUrl) out.imageUrl = imageUrl; else delete out.imageUrl;
  if (videoUrl) out.videoUrl = videoUrl; else delete out.videoUrl;
  if (videoUrlMp4) out.videoUrlMp4 = videoUrlMp4; else delete out.videoUrlMp4;
  return out;
}

const ARISTOCRACY_FIXED_LEVEL_IDS = ['noble', 'minister', 'prince', 'king', 'aristocrat'] as const;

/** هيكل مستوى فارغ — بدون امتيازات/صور تجريبية (لا يُعاد حقن SAMPLE عند التحديث) */
function aristocracyLevelSkeleton(id: string): ConfigAristocracyLevel {
  const sample = SAMPLE_ARISTOCRACY_LEVELS.find((l) => l.id === id);
  if (!sample) {
    return {
      id,
      level: 1,
      nameAr: id,
      nameEn: id,
      enabled: true,
      comingSoon: false,
      activationCoins: 0,
      renewalCoins: 0,
      allowRenewal: true,
      validityDays: 30,
      coinReturnPercent: 0,
      honorPointsRequired: 0,
      requiredVipLevel: 0,
      themeKey: 'noble',
      privileges: [],
      exclusiveGiftIds: [],
    };
  }
  return {
    id: sample.id,
    level: sample.level,
    nameAr: sample.nameAr,
    nameEn: sample.nameEn,
    enabled: sample.enabled,
    comingSoon: sample.comingSoon,
    activationCoins: sample.activationCoins,
    renewalCoins: sample.renewalCoins,
    allowRenewal: sample.allowRenewal,
    validityDays: sample.validityDays,
    coinReturnPercent: sample.coinReturnPercent,
    coinReturnCoins: sample.coinReturnCoins,
    grantedVipLevel: 0,
    honorPointsRequired: sample.honorPointsRequired,
    requiredVipLevel: sample.requiredVipLevel,
    themeKey: sample.themeKey,
    accentColor: sample.accentColor,
    bgColors: sample.bgColors,
    privileges: [],
    exclusiveGiftIds: [],
  };
}

export function normalizeAristocracyLevel(
  raw: Partial<ConfigAristocracyLevel>,
  fallback?: ConfigAristocracyLevel,
): ConfigAristocracyLevel {
  const base = fallback ?? aristocracyLevelSkeleton(String(raw.id ?? 'noble'));
  const level = raw.level ?? base.level;
  const privileges = Array.isArray(raw.privileges)
    ? raw.privileges.map(normalizeAristocracyPrivilege).sort((a, b) => a.order - b.order)
    : [];
  return {
    ...base,
    ...raw,
    level,
    privileges,
    imageUrl: raw.imageUrl?.trim() || undefined,
    backgroundImageUrl: raw.backgroundImageUrl?.trim() || undefined,
    accentColor: raw.accentColor?.trim() || base.accentColor,
    bgColors: raw.bgColors?.length === 3 ? raw.bgColors : base.bgColors,
    allowRenewal: raw.allowRenewal ?? base.allowRenewal ?? true,
    coinReturnCoins: raw.coinReturnCoins != null ? Number(raw.coinReturnCoins) : base.coinReturnCoins,
    grantedVipLevel: raw.grantedVipLevel != null ? Number(raw.grantedVipLevel) : base.grantedVipLevel,
    svipPrivilegeKeys: Array.isArray(raw.svipPrivilegeKeys)
      ? raw.svipPrivilegeKeys.map(String)
      : undefined,
    exclusiveGiftIds: Array.isArray(raw.exclusiveGiftIds) ? raw.exclusiveGiftIds : [],
    heroSubtitleAr: raw.heroSubtitleAr?.trim() || undefined,
    heroSubtitleEn: raw.heroSubtitleEn?.trim() || undefined,
  };
}

export function normalizeAristocracyConfig(raw: Partial<ConfigAristocracy>): ConfigAristocracy {
  const defaults = DEFAULT_ARISTOCRACY_CONFIG;
  const { levels: _defaultLevels, ...defaultMeta } = defaults;
  const { levels: rawLevels, ...rawMeta } = raw;

  const merged: ConfigAristocracy = {
    ...defaultMeta,
    ...rawMeta,
    showPrivilegesSectionAr: raw.showPrivilegesSectionAr?.trim() || defaults.showPrivilegesSectionAr,
    showPrivilegesSectionEn: raw.showPrivilegesSectionEn?.trim() || defaults.showPrivilegesSectionEn,
    identityRulesAr: raw.identityRulesAr?.trim() || defaults.identityRulesAr,
    identityRulesEn: raw.identityRulesEn?.trim() || defaults.identityRulesEn,
    rulesIntroAr: raw.rulesIntroAr?.length ? raw.rulesIntroAr : defaults.rulesIntroAr,
    rulesIntroEn: raw.rulesIntroEn?.length ? raw.rulesIntroEn : defaults.rulesIntroEn,
    rulesPurchaseAr: raw.rulesPurchaseAr?.length ? raw.rulesPurchaseAr : defaults.rulesPurchaseAr,
    rulesPurchaseEn: raw.rulesPurchaseEn?.length ? raw.rulesPurchaseEn : defaults.rulesPurchaseEn,
    rulesRewardsAr: raw.rulesRewardsAr?.length ? raw.rulesRewardsAr : defaults.rulesRewardsAr,
    rulesRewardsEn: raw.rulesRewardsEn?.length ? raw.rulesRewardsEn : defaults.rulesRewardsEn,
    rulesLegendAr: raw.rulesLegendAr?.length ? raw.rulesLegendAr : defaults.rulesLegendAr,
    rulesLegendEn: raw.rulesLegendEn?.length ? raw.rulesLegendEn : defaults.rulesLegendEn,
    experienceCardRulesAr: raw.experienceCardRulesAr?.length ? raw.experienceCardRulesAr : defaults.experienceCardRulesAr,
    experienceCardRulesEn: raw.experienceCardRulesEn?.length ? raw.experienceCardRulesEn : defaults.experienceCardRulesEn,
    levels: [],
  };

  const sourceLevels = Array.isArray(rawLevels) ? rawLevels : [];
  let normalizedLevels = sourceLevels
    .map((lv) => normalizeAristocracyLevel(lv, aristocracyLevelSkeleton(String(lv.id ?? 'noble'))))
    .filter((lv) => ARISTOCRACY_FIXED_LEVEL_IDS.includes(lv.id as typeof ARISTOCRACY_FIXED_LEVEL_IDS[number]))
    .sort((a, b) => a.level - b.level);

  for (const required of ARISTOCRACY_FIXED_LEVEL_IDS) {
    if (!normalizedLevels.some((lv) => lv.id === required)) {
      normalizedLevels.push(aristocracyLevelSkeleton(required));
    }
  }
  merged.levels = normalizedLevels.sort((a, b) => a.level - b.level);
  return merged;
}

const ARISTO_PRIVILEGE_TITLES: Record<string, { titleAr: string; titleEn: string; layout: 'wide' | 'half' | 'icon' }> = {
  entry: { titleAr: 'دخولية', titleEn: 'Entrance', layout: 'half' },
  frame: { titleAr: 'إطار الصورة', titleEn: 'Avatar Frame', layout: 'half' },
  profileCard: { titleAr: 'بطاقة الملف', titleEn: 'Profile Card', layout: 'wide' },
  effects: { titleAr: 'تأثيرات', titleEn: 'Effects', layout: 'half' },
  badge: { titleAr: 'وسام الهوية', titleEn: 'Identity Badge', layout: 'half' },
  bubble: { titleAr: 'إطار الكتابة', titleEn: 'Chat Frame', layout: 'wide' },
  emblem: { titleAr: 'شعار التصنيف', titleEn: 'Tier Emblem', layout: 'icon' },
};

/** استبدال/دمج امتيازات المستويات من ملفات Storage المرفوعة */
export function mergeRecoveredAristocracyUploads(
  config: ConfigAristocracy,
  uploads: { storageId: string; levelId: string; privId: string; assetKey: string; titleAr?: string; titleEn?: string; imageUrl?: string; videoUrl?: string; videoUrlMp4?: string }[],
  mode: 'replace-level' | 'merge' = 'replace-level',
): ConfigAristocracy {
  if (!uploads.length) return config;
  return {
    ...config,
    levels: config.levels.map((level) => {
      const forLevel = uploads.filter((u) => u.levelId === level.id);
      if (!forLevel.length) return level;

      const buildOne = (u: (typeof uploads)[number], order: number): ConfigAristocracyPrivilege => {
        const meta = ARISTO_PRIVILEGE_TITLES[u.assetKey] ?? ARISTO_PRIVILEGE_TITLES.entry;
        return normalizeAristocracyPrivilege({
          id: u.privId,
          titleAr: u.titleAr || meta.titleAr,
          titleEn: u.titleEn || meta.titleEn,
          descAr: meta.titleAr,
          descEn: meta.titleEn,
          assetKey: u.assetKey,
          layout: meta.layout,
          order,
          enabled: true,
          imageUrl: u.imageUrl,
          videoUrl: u.videoUrl,
          videoUrlMp4: u.videoUrlMp4,
        });
      };

      if (mode === 'replace-level') {
        return {
          ...level,
          privileges: forLevel
            .map((u, i) => buildOne(u, i + 1))
            .sort((a, b) => a.order - b.order),
        };
      }

      const privileges = [...level.privileges];
      for (const u of forLevel) {
        const idx = privileges.findIndex((p) => p.id === u.privId);
        const merged = buildOne(u, idx >= 0 ? privileges[idx]!.order : privileges.length + 1);
        if (idx >= 0) privileges[idx] = merged;
        else privileges.push(merged);
      }
      return { ...level, privileges: privileges.sort((a, b) => a.order - b.order) };
    }),
  };
}

export interface ConfigAristocracy {
  enabled: boolean;
  titleAr: string;
  titleEn: string;
  gracePeriodDays: number;
  frozenExpireDays: number;
  maxValidityDays: number;
  levels: ConfigAristocracyLevel[];
  /** عنوان قسم «إمتيازات العرض» */
  showPrivilegesSectionAr?: string;
  showPrivilegesSectionEn?: string;
  /** نص «قيود الهوية» أسفل شريط السعر */
  identityRulesAr?: string;
  identityRulesEn?: string;
  rulesIntroAr: string[];
  rulesIntroEn: string[];
  rulesPurchaseAr: string[];
  rulesPurchaseEn: string[];
  rulesRewardsAr: string[];
  rulesRewardsEn: string[];
  rulesLegendAr: string[];
  rulesLegendEn: string[];
  experienceCardRulesAr: string[];
  experienceCardRulesEn: string[];
  levelTableNoteAr: string;
  levelTableNoteEn: string;
}

export const DEFAULT_ARISTOCRACY_CONFIG: ConfigAristocracy = {
  enabled: true,
  titleAr: 'الأرستقراطية',
  titleEn: 'Aristocracy',
  showPrivilegesSectionAr: 'إمتيازات العرض',
  showPrivilegesSectionEn: 'Display Privileges',
  identityRulesAr: 'قيود الهوية',
  identityRulesEn: 'Identity restrictions',
  gracePeriodDays: 5,
  frozenExpireDays: 60,
  maxValidityDays: 120,
  rulesIntroAr: ['الأرستقراطية هوية رفيعة المستوى تتكون من 5 مستويات ثابتة.', 'كلما ارتفع المستوى زادت مزايا الهوية ونسبة عائد الكوينز.'],
  rulesIntroEn: [],
  rulesPurchaseAr: ['اختر المستوى وادفع بالكوينز — الصلاحية 30 يوماً.', 'التجديد قبل الانتهاء أو خلال 5 أيام حماية بسعر أقل.'],
  rulesPurchaseEn: [],
  rulesRewardsAr: ['عائد الكوينز يُستلم يدوياً من أرستقراطيتي.', 'بعد 60 يوماً دون تجديد يُفقد العائد المجمّد.'],
  rulesRewardsEn: [],
  rulesLegendAr: ['الأسطورة تُمنح عبر نشاط الترتيب الشهري.'],
  rulesLegendEn: [],
  experienceCardRulesAr: ['بطاقة التجربة تمنح الامتيازات دون عائد الكوينز.'],
  experienceCardRulesEn: [],
  levelTableNoteAr: 'جدول الأسعار',
  levelTableNoteEn: 'Pricing table',
  levels: SAMPLE_ARISTOCRACY_LEVELS,
};

export const getAristocracyConfig = async (): Promise<ConfigAristocracy | null> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'aristocracy'));
    return snap.exists()
      ? normalizeAristocracyConfig(snap.data() as Partial<ConfigAristocracy>)
      : null;
  } catch { return null; }
};

export const saveAristocracyConfig = async (config: ConfigAristocracy): Promise<void> => {
  const normalized = normalizeAristocracyConfig(config);
  const payload = stripUndefinedDeep({ ...normalized, updatedAt: Date.now(), _permKey: 'aristocracy' });
  // استبدال كامل — merge كان يبقي حقول قديمة ويعيد محتوى تجريبي
  await setDoc(doc(firestore, 'config', 'aristocracy'), payload);
};

// ===== Titles (جدار الألقاب) =====
export type ConfigTitleObtainType =
  | 'free'
  | 'vip'
  | 'wealth'
  | 'aristocracy'
  | 'purchase'
  | 'manual';

export type ConfigSlotUnlockType = 'free' | 'vip' | 'wealth';

export interface ConfigTitleSlot {
  slotIndex: number;
  unlockType: ConfigSlotUnlockType;
  unlockValue: number;
}

export interface ConfigTitleDef {
  id: string;
  nameAr: string;
  nameEn: string;
  enabled: boolean;
  imageUrl: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  obtainType: ConfigTitleObtainType;
  obtainValue: number;
  priceCoins: number;
  validityDays: number;
  order: number;
  descAr: string;
  descEn: string;
  gradientColors: [string, string];
}

export interface ConfigTitles {
  enabled: boolean;
  wallTitleAr: string;
  wallTitleEn: string;
  aboutPageTitleAr: string;
  aboutPageTitleEn: string;
  defaultSlots: number;
  maxSlots: number;
  slots: ConfigTitleSlot[];
  titles: ConfigTitleDef[];
  aboutUseAr: string[];
  aboutUseEn: string[];
  aboutBadgeAr: string[];
  aboutBadgeEn: string[];
}

const DEFAULT_TITLE_SLOTS: ConfigTitleSlot[] = [
  { slotIndex: 0, unlockType: 'free', unlockValue: 0 },
  { slotIndex: 1, unlockType: 'free', unlockValue: 0 },
  { slotIndex: 2, unlockType: 'free', unlockValue: 0 },
  { slotIndex: 3, unlockType: 'vip', unlockValue: 1 },
  { slotIndex: 4, unlockType: 'vip', unlockValue: 6 },
  { slotIndex: 5, unlockType: 'vip', unlockValue: 8 },
  { slotIndex: 6, unlockType: 'wealth', unlockValue: 10 },
  { slotIndex: 7, unlockType: 'wealth', unlockValue: 15 },
  { slotIndex: 8, unlockType: 'wealth', unlockValue: 20 },
];

export const DEFAULT_TITLES_CONFIG: ConfigTitles = {
  enabled: true,
  wallTitleAr: 'جدار الألقاب',
  wallTitleEn: 'Title Wall',
  aboutPageTitleAr: 'عن اللقب',
  aboutPageTitleEn: 'About Titles',
  defaultSlots: 3,
  maxSlots: 9,
  slots: DEFAULT_TITLE_SLOTS,
  titles: [
    { id: 'traveler', nameAr: 'الرحّال', nameEn: 'Traveler', enabled: true, imageUrl: '', rarity: 'common', obtainType: 'free', obtainValue: 0, priceCoins: 0, validityDays: 0, order: 1, descAr: 'لقب ترحيبي لكل المستخدمين', descEn: 'Welcome title for all users', gradientColors: ['#ff5a47', '#e11212'] },
    { id: 'supporter', nameAr: 'داعم', nameEn: 'Supporter', enabled: true, imageUrl: '', rarity: 'rare', obtainType: 'vip', obtainValue: 3, priceCoins: 0, validityDays: 30, order: 2, descAr: 'للحاصلين على VIP3', descEn: 'For VIP3 members', gradientColors: ['#1A0B2E', '#FFD700'] },
    { id: 'party-organizer', nameAr: 'منظم بارتي مميز', nameEn: 'Party Organizer', enabled: true, imageUrl: '', rarity: 'epic', obtainType: 'wealth', obtainValue: 10, priceCoins: 0, validityDays: 30, order: 3, descAr: 'مستوى ثروة 10', descEn: 'Wealth level 10', gradientColors: ['#e11e2a', '#c21520'] },
    { id: 'noble-lord', nameAr: 'اللورد النبيل', nameEn: 'Noble Lord', enabled: true, imageUrl: '', rarity: 'legendary', obtainType: 'aristocracy', obtainValue: 5, priceCoins: 0, validityDays: 0, order: 4, descAr: 'أرستقراطية النبيل فأعلى', descEn: 'Noble aristocracy and above', gradientColors: ['#2BD9A8', '#FFD700'] },
    { id: 'games-pro', nameAr: 'محترف الألعاب', nameEn: 'Games Pro', enabled: true, imageUrl: '', rarity: 'epic', obtainType: 'purchase', obtainValue: 0, priceCoins: 50_000, validityDays: 30, order: 5, descAr: 'شراء من جدار الألقاب', descEn: 'Purchase from title wall', gradientColors: ['#ff5a47', '#0A1E4A'] },
  ],
  aboutUseAr: [
    'يمكنك استخدام كل الألقاب التي تملكها.',
    '3 فتحات افتراضياً، وتزيد مع VIP ومستوى الثروة حتى 9 فتحات.',
    'يمكن ارتداء حتى 9 ألقاب في نفس الوقت.',
  ],
  aboutUseEn: [
    'You can use all titles you own.',
    '3 slots by default; more unlock with VIP and wealth level up to 9.',
    'Wear up to 9 titles at once.',
  ],
  aboutBadgeAr: [
    'اضغط على تفاصيل اللقب لمعرفة طريقة الحصول عليه.',
    'للألقاب مدة صلاحية وتختفي بعد انتهائها.',
    'يمكنك مشاهدة جدار ألقابك وألقاب الآخرين.',
  ],
  aboutBadgeEn: [],
};

export const getTitlesConfig = async (): Promise<ConfigTitles | null> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'titles'));
    return snap.exists() ? ({ ...DEFAULT_TITLES_CONFIG, ...snap.data() } as ConfigTitles) : null;
  } catch { return null; }
};

export const saveTitlesConfig = async (config: ConfigTitles): Promise<void> => {
  await setDoc(doc(firestore, 'config', 'titles'), { ...config, updatedAt: Date.now(), _permKey: 'titles' }, { merge: true });
};

/** منح لقب يدوياً لمستخدم */
export const grantUserTitle = async (
  uid: string,
  titleId: string,
  validityDays = 0,
): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('المستخدم غير موجود');

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const expiresAt = validityDays > 0 ? now + validityDays * DAY : null;
  const raw = (snap.data().userTitles ?? { owned: [], equipped: [] }) as {
    owned: { titleId: string; obtainedAt: number; expiresAt: number | null }[];
    equipped: (string | null)[];
  };

  const owned = [...(raw.owned ?? [])];
  const idx = owned.findIndex((o) => o.titleId === titleId);
  const entry = { titleId, obtainedAt: now, expiresAt };
  if (idx >= 0) owned[idx] = entry;
  else owned.push(entry);

  await updateDoc(userRef, {
    userTitles: { owned, equipped: raw.equipped ?? [] },
    updatedAt: now,
  });
};

/** سحب لقب من مستخدم */
export const revokeUserTitle = async (uid: string, titleId: string): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('المستخدم غير موجود');

  const now = Date.now();
  const raw = (snap.data().userTitles ?? { owned: [], equipped: [] }) as {
    owned: { titleId: string; obtainedAt: number; expiresAt: number | null }[];
    equipped: (string | null)[];
  };

  const owned = (raw.owned ?? []).filter((o) => o.titleId !== titleId);
  const equipped = (raw.equipped ?? []).map((id) => (id === titleId ? null : id));

  await updateDoc(userRef, {
    userTitles: { owned, equipped },
    updatedAt: now,
  });
};

// ===== منح الامتيازات للمستخدمين (متجر / إطار / SVIP / أرستقراطية) =====
const GRANT_DAY_MS = 24 * 60 * 60 * 1000;

export type GiftPrivilegeKind = 'store' | 'frame' | 'vip' | 'aristocracy';

/** يمنح عنصر متجر (دخولية/فقاعة/شارة...) لمستخدم مع مدة صلاحية ويجهّزه للظهور فوراً */
export const grantStoreItemToUser = async (
  uid: string,
  item: ConfigStoreItem,
  validityDays: number,
  equip = true,
): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('المستخدم غير موجود');

  const now = Date.now();
  const expiresAt = validityDays > 0 ? now + validityDays * GRANT_DAY_MS : null;
  const canEquip = equip && (item.category === 'entrance' || item.category === 'bubble');

  await addDoc(collection(firestore, 'inventory'), {
    uid,
    itemId: item.id,
    itemType: item.category,
    itemName: item.name,
    iconName: item.iconName || 'ShoppingBag',
    iconColor: item.iconColor || '#e11212',
    quantity: 1,
    isEquipped: canEquip,
    acquiredAt: now,
    expiresAt,
    fromName: 'هدية الإدارة',
  });

  if (canEquip && item.category === 'entrance') {
    await updateDoc(userRef, { equippedEntranceId: item.id, updatedAt: now });
  } else if (canEquip && item.category === 'bubble') {
    await updateDoc(userRef, { equippedBubbleId: item.id, updatedAt: now });
  }
};

/** يمنح إطار صورة شخصية لمستخدم (config/roomFrames → users.frameInventory) */
export const grantFrameToUser = async (
  uid: string,
  frame: RoomFrame,
  validityDays: number,
  equip = true,
): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('المستخدم غير موجود');

  const now = Date.now();
  // 0 = دائم (نفس منطق التطبيق)
  const expiresAt = validityDays > 0 ? now + validityDays * GRANT_DAY_MS : 0;
  const inv = (snap.data().frameInventory ?? {}) as Record<string, number>;
  const next = { ...inv, [frame.id]: expiresAt };

  const patch: Record<string, unknown> = {
    frameInventory: next,
    ownedFrames: arrayUnion(frame.id),
    updatedAt: now,
  };
  if (equip) patch.equippedFrameId = frame.id;
  await updateDoc(userRef, patch);
};

/** يمنح مستوى SVIP لمستخدم مع مدة صلاحية (0 = دائم) — يفتح كل امتيازات المستوى */
export const grantVipLevelToUser = async (
  uid: string,
  level: number,
  validityDays: number,
): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('المستخدم غير موجود');

  const now = Date.now();
  const expiresAt = validityDays > 0 ? now + validityDays * GRANT_DAY_MS : null;
  await updateDoc(userRef, {
    vipLevel: level,
    isVIP: level >= 1,
    vipExpiresAt: expiresAt,
    vipMonthKey: new Date(now).toISOString().slice(0, 7),
    updatedAt: now,
  });
};

/** يمنح تصنيف أرستقراطية لمستخدم مع مدة صلاحية (0 = دائم تقريباً) */
export const grantAristocracyToUser = async (
  uid: string,
  level: ConfigAristocracyLevel,
  validityDays: number,
): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('المستخدم غير موجود');

  const now = Date.now();
  // الأرستقراطية تتطلب تاريخ انتهاء أكبر من الآن لتُعتبر فعّالة — 0 = ~10 سنوات
  const days = validityDays > 0 ? validityDays : 3650;
  const expiresAt = now + days * GRANT_DAY_MS;
  const grantedVipLevel = level.grantedVipLevel ?? 0;
  const svipPrivilegeKeys = Array.isArray(level.svipPrivilegeKeys) ? level.svipPrivilegeKeys.map(String) : null;
  const newState = {
    level: level.level,
    expiresAt,
    autoRenew: false,
    grantedVipLevel,
    svipPrivilegeKeys,
    pendingReturns: 0,
    frozenReturns: 0,
    frozenAt: null,
    honorPoints: 0,
    honorMonth: '',
  };

  await updateDoc(userRef, {
    aristocracy: newState,
    aristocracyLevel: level.level,
    aristocracyExpiresAt: expiresAt,
    aristocracyGrantedVipLevel: grantedVipLevel,
    aristocracySvipPrivilegeKeys: svipPrivilegeKeys,
    updatedAt: now,
  });
};

// ===== أمير الوكلاء =====
export interface AgencyPrinceHolder {
  uid: string;
  agencyId: string;
  agencyName: string;
  ownerName: string;
  monthKey: string;
  monthlyTotal: number;
  grantedAt: number;
}

export interface ConfigAgencyPrince {
  enabled: boolean;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  rulesAr: string[];
  rulesEn: string[];
  badgeImageUrl?: string;
  crownImageUrl?: string;
  entryImageUrl?: string;
  entryAnimationUrl?: string;
  /** امتيازات أمير الوكالة المفعّلة على المستخدم — مثل امتيازات SVIP */
  entryVideoUrl?: string;
  entryVideoUrlMp4?: string;
  frameImageUrl?: string;
  bubbleImageUrl?: string;
  accentColor: string;
  autoAssignMonthly: boolean;
  currentHolder?: AgencyPrinceHolder | null;
}

export const DEFAULT_AGENCY_PRINCE_CONFIG: ConfigAgencyPrince = {
  enabled: true,
  titleAr: 'أمير الوكلاء',
  titleEn: 'Prince of Agents',
  subtitleAr: 'للوكيل صاحب أكبر وكالة وأعلى أداء خلال الشهر',
  subtitleEn: 'For the agent with the top-performing agency this month',
  rulesAr: [
    'يُمنح أمير الوكلاء لصاحب الوكالة الأولى حسب أرباح المضيفين خلال الشهر.',
    'يشمل الوسام شارة مميزة ودخولية حصرية في غرف الوكالة.',
    'يمكن للإدارة منح الوسام يدوياً أو تحديثه تلقائياً شهرياً.',
  ],
  rulesEn: [],
  badgeImageUrl: 'https://cdn-icons-png.flaticon.com/512/3147/3147763.png',
  crownImageUrl: 'https://cdn-icons-png.flaticon.com/512/2582/2582603.png',
  entryImageUrl: 'https://cdn-icons-png.flaticon.com/512/616/616408.png',
  accentColor: '#F59E0B',
  autoAssignMonthly: true,
  currentHolder: null,
};

function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthDayKeys(monthKey: string): string[] {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return [];
  const daysInMonth = new Date(y, m, 0).getDate();
  const keys: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    keys.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return keys;
}

async function sumAgencyMonthEarnings(agencyId: string, monthKey: string): Promise<number> {
  const dayKeys = monthDayKeys(monthKey);
  let total = 0;
  for (const dayKey of dayKeys) {
    try {
      const snap = await getDoc(doc(firestore, 'agencyEarnings', `${agencyId}_${dayKey}`));
      if (snap.exists()) total += Number(snap.data().total ?? 0);
    } catch {
      // skip missing day docs
    }
  }
  return total;
}

export const getAgencyPrinceConfig = async (): Promise<ConfigAgencyPrince | null> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'agencyPrince'));
    return snap.exists()
      ? ({ ...DEFAULT_AGENCY_PRINCE_CONFIG, ...snap.data() } as ConfigAgencyPrince)
      : null;
  } catch {
    return null;
  }
};

export const saveAgencyPrinceConfig = async (config: ConfigAgencyPrince): Promise<void> => {
  await setDoc(doc(firestore, 'config', 'agencyPrince'), { ...config, updatedAt: Date.now(), _permKey: 'agency-prince' }, { merge: true });
};

async function applyAgencyPrinceToUser(
  uid: string,
  holder: AgencyPrinceHolder,
  assets: Pick<
    ConfigAgencyPrince,
    'badgeImageUrl' | 'entryImageUrl' | 'entryAnimationUrl' | 'entryVideoUrl' | 'entryVideoUrlMp4' | 'frameImageUrl' | 'bubbleImageUrl'
  >,
): Promise<void> {
  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('المستخدم غير موجود');

  await updateDoc(userRef, {
    agencyPrince: {
      active: true,
      monthKey: holder.monthKey,
      agencyId: holder.agencyId,
      agencyName: holder.agencyName,
      badgeImageUrl: assets.badgeImageUrl ?? null,
      entryImageUrl: assets.entryImageUrl ?? null,
      entryAnimationUrl: assets.entryAnimationUrl ?? null,
      entryVideoUrl: assets.entryVideoUrl ?? null,
      entryVideoUrlMp4: assets.entryVideoUrlMp4 ?? null,
      frameImageUrl: assets.frameImageUrl ?? null,
      bubbleImageUrl: assets.bubbleImageUrl ?? null,
      grantedAt: holder.grantedAt,
    },
    updatedAt: Date.now(),
  });
}

export const revokeAgencyPrinceFromUser = async (uid: string): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  const userRef = doc(firestore, 'users', uid);
  await updateDoc(userRef, {
    agencyPrince: null,
    updatedAt: Date.now(),
  });
};

export interface AgencyPrinceGrantPreview {
  uid: string;
  displayName: string;
  publicAccountId?: string;
  isAgencyManager: boolean;
  agencyId: string;
  agencyName: string;
  agencyRole: string;
  isAgent: boolean;
  isOwner: boolean;
}

async function resolveAgencyManagerForPrince(rawIdentifier: string): Promise<
  AgencyPrinceGrantPreview & { ownerName: string }
> {
  const uid = await resolveUserAccountId(rawIdentifier.trim());
  if (!uid) throw new Error('المستخدم غير موجود — تحقق من UID أو رقم الحساب (8 أرقام)');

  await assertUidInAdminCountryScope(uid);
  const userSnap = await getDoc(doc(firestore, 'users', uid));
  if (!userSnap.exists()) throw new Error('المستخدم غير موجود');

  const user = userSnap.data() as Record<string, unknown>;
  const agencyRole = String(user.agencyRole ?? '');
  const isAgent = user.isAgent === true;
  const isOwner = agencyRole === 'owner';
  const isManager = isOwner || isAgent;

  if (!isManager) {
    throw new Error('هذا المستخدم ليس مدير وكالة — يجب أن يكون مالكاً (owner) أو وكيلاً معتمداً');
  }

  const displayName = String(
    (user.profile as Record<string, unknown> | undefined)?.displayName ?? user.displayName ?? 'مستخدم',
  );
  const publicAccountId = user.publicAccountId != null ? String(user.publicAccountId) : undefined;

  let agencyId = '';
  let agencyName = '';
  let ownerName = displayName;

  if (isOwner) {
    const ownedSnap = await getDocs(
      query(collection(firestore, 'agencies'), where('ownerUid', '==', uid), limit(1)),
    );
    if (!ownedSnap.empty) {
      const agDoc = ownedSnap.docs[0];
      const ag = agDoc.data() as Record<string, unknown>;
      agencyId = agDoc.id;
      agencyName = String(ag.name ?? ag.agencyName ?? '');
      ownerName = String(ag.ownerName ?? displayName);
    }
  }

  if (!agencyId && user.agencyId) {
    agencyId = String(user.agencyId);
    agencyName = String(user.agencyName ?? '');
  }

  if (!agencyId) {
    throw new Error('لا توجد وكالة مرتبطة بهذا المدير');
  }

  await assertAgencyIdInScope(agencyId);
  const agencySnap = await getDoc(doc(firestore, 'agencies', agencyId));
  if (!agencySnap.exists()) throw new Error('الوكالة غير موجودة');

  const agency = agencySnap.data() as Record<string, unknown>;
  const status = String(agency.status ?? 'active');
  if (status === 'deleted' || status === 'rejected') {
    throw new Error('الوكالة غير نشطة');
  }

  agencyName = agencyName || String(agency.name ?? agency.agencyName ?? 'وكالة');
  const ownerUid = String(agency.ownerUid ?? '');

  if (isOwner && ownerUid && ownerUid !== uid) {
    throw new Error('المستخدم مُعلَّم كمالك وكالة لكنه لا يطابق سجل الوكالة');
  }

  if (isAgent && !isOwner) {
    const userAgencyId = String(user.agencyId ?? '');
    if (userAgencyId && userAgencyId !== agencyId) {
      throw new Error('الوكيل مرتبط بوكالة أخرى');
    }
  }

  return {
    uid,
    displayName,
    publicAccountId,
    isAgencyManager: true,
    agencyId,
    agencyName,
    agencyRole,
    isAgent,
    isOwner,
    ownerName: isOwner ? ownerName : displayName,
  };
}

/** معاينة قبل المنح — يتحقق أن المستخدم مدير وكالة */
export const lookupAgencyPrinceGrantCandidate = async (
  identifier: string,
): Promise<AgencyPrinceGrantPreview> => {
  const { ownerName: _o, ...preview } = await resolveAgencyManagerForPrince(identifier);
  return preview;
};

export const grantAgencyPrinceManual = async (
  identifier: string,
  config: ConfigAgencyPrince,
): Promise<AgencyPrinceHolder> => {
  const resolved = await resolveAgencyManagerForPrince(identifier);
  const { uid, agencyId, agencyName, ownerName } = resolved;

  const previousUid = config.currentHolder?.uid;
  if (previousUid && previousUid !== uid) {
    await revokeAgencyPrinceFromUser(previousUid).catch(() => undefined);
  }

  const monthKey = currentMonthKey();
  const monthlyTotal = await sumAgencyMonthEarnings(agencyId, monthKey);
  const holder: AgencyPrinceHolder = {
    uid,
    agencyId,
    agencyName,
    ownerName,
    monthKey,
    monthlyTotal,
    grantedAt: Date.now(),
  };
  await applyAgencyPrinceToUser(uid, holder, config);
  return holder;
};

/** حساب أكبر وكالة للشهر الحالي ومنح أمير الوكلاء لمالكها */
export const refreshMonthlyAgencyPrince = async (): Promise<AgencyPrinceHolder | null> => {
  const config = (await getAgencyPrinceConfig()) ?? DEFAULT_AGENCY_PRINCE_CONFIG;
  const monthKey = currentMonthKey();
  const snap = await getDocs(query(collection(firestore, 'agencies'), limit(100)));

  let best: { agencyId: string; ownerUid: string; agencyName: string; ownerName: string; total: number } | null = null;

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const status = String(data.status ?? 'active');
    if (status === 'deleted' || status === 'rejected') continue;
    const ownerUid = String(data.ownerUid ?? '');
    if (!ownerUid) continue;
    const total = await sumAgencyMonthEarnings(docSnap.id, monthKey);
    if (!best || total > best.total) {
      best = {
        agencyId: docSnap.id,
        ownerUid,
        agencyName: String(data.name ?? data.agencyName ?? 'وكالة'),
        ownerName: String(data.ownerName ?? ''),
        total,
      };
    }
  }

  if (!best || best.total <= 0) return null;

  const previousUid = config.currentHolder?.uid;
  if (previousUid && previousUid !== best.ownerUid) {
    await revokeAgencyPrinceFromUser(previousUid).catch(() => undefined);
  }

  const holder: AgencyPrinceHolder = {
    uid: best.ownerUid,
    agencyId: best.agencyId,
    agencyName: best.agencyName,
    ownerName: best.ownerName,
    monthKey,
    monthlyTotal: best.total,
    grantedAt: Date.now(),
  };

  await applyAgencyPrinceToUser(best.ownerUid, holder, config);
  const nextConfig = { ...config, currentHolder: holder };
  await saveAgencyPrinceConfig(nextConfig);
  return holder;
};

// ===== Privacy (إعدادات الخصوصية) =====
export type ConfigPrivacyFeatureKey =
  | 'visitAnonymously'
  | 'hideGiftHistory'
  | 'hideFromRanking'
  | 'hideInRoom'
  | 'hideSvipIdentity'
  | 'profileUnsearchable'
  | 'hideWealthLevel';

export interface ConfigPrivacyFeature {
  key: ConfigPrivacyFeatureKey;
  labelAr: string;
  labelEn: string;
  lockLabelAr: string;
  lockLabelEn: string;
  requiredVipLevel?: number;
  requiredAristocracyLevel?: number;
  enabled: boolean;
  order: number;
}

export interface ConfigPrivacy {
  enabled: boolean;
  titleAr: string;
  titleEn: string;
  introAr: string[];
  introEn: string[];
  features: ConfigPrivacyFeature[];
}

export const DEFAULT_PRIVACY_CONFIG: ConfigPrivacy = {
  enabled: true,
  titleAr: 'إعدادات الخصوصية',
  titleEn: 'Privacy Settings',
  introAr: [
    'بعض الخيارات تتطلب مستوى VIP أو أرستقراطية.',
    'عند التفعيل، يُطبَّق الإخفاء فوراً في الغرف والترتيب والبروفايل.',
  ],
  introEn: [],
  features: [
    { key: 'visitAnonymously', labelAr: 'زيارة الصفحات متخفياً', labelEn: 'Visit anonymously', lockLabelAr: 'تحتاج SVIP 9 للفتح', lockLabelEn: 'Requires SVIP 9', requiredVipLevel: 9, enabled: true, order: 1 },
    { key: 'hideGiftHistory', labelAr: 'إخفاء سجل الهدايا', labelEn: 'Hide gift history', lockLabelAr: 'تحتاج SVIP 10 للفتح', lockLabelEn: 'Requires SVIP 10', requiredVipLevel: 10, enabled: true, order: 2 },
    { key: 'hideFromRanking', labelAr: 'إخفاء من الترتيب', labelEn: 'Hide from ranking', lockLabelAr: 'تحتاج SVIP 11 للفتح', lockLabelEn: 'Requires SVIP 11', requiredVipLevel: 11, enabled: true, order: 3 },
    { key: 'hideInRoom', labelAr: 'إخفاء في الغرفة', labelEn: 'Hide in room', lockLabelAr: 'تحتاج SVIP 12 للفتح', lockLabelEn: 'Requires SVIP 12', requiredVipLevel: 12, enabled: true, order: 4 },
    { key: 'hideSvipIdentity', labelAr: 'إخفاء هوية SVIP', labelEn: 'Hide SVIP identity', lockLabelAr: 'تحتاج SVIP 13 للفتح', lockLabelEn: 'Requires SVIP 13', requiredVipLevel: 12, enabled: true, order: 5 },
    { key: 'profileUnsearchable', labelAr: 'عدم إمكانية العثور عليك', labelEn: 'Unsearchable profile', lockLabelAr: 'فتح الأسطورة', lockLabelEn: 'Unlock Legend', requiredAristocracyLevel: 8, enabled: true, order: 6 },
    { key: 'hideWealthLevel', labelAr: 'إخفاء مستوى الثروة', labelEn: 'Hide wealth level', lockLabelAr: 'VIP 5+', lockLabelEn: 'VIP 5+', requiredVipLevel: 5, enabled: true, order: 7 },
  ],
};

export const getPrivacyConfig = async (): Promise<ConfigPrivacy | null> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'privacy'));
    return snap.exists() ? ({ ...DEFAULT_PRIVACY_CONFIG, ...snap.data() } as ConfigPrivacy) : null;
  } catch { return null; }
};

export const savePrivacyConfig = async (config: ConfigPrivacy): Promise<void> => {
  await setDoc(doc(firestore, 'config', 'privacy'), { ...config, updatedAt: Date.now(), _permKey: 'privacy' }, { merge: true });
};

// ===== Settings =====
export const getConfigSettings = async (): Promise<ConfigSettings | null> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'settings'));
    return snap.exists() ? (snap.data() as ConfigSettings) : null;
  } catch { return null; }
};

export const saveConfigSettings = async (settings: ConfigSettings): Promise<void> => {
  await setDoc(doc(firestore, 'config', 'settings'), { ...settings, updatedAt: Date.now(), _permKey: 'settings' }, { merge: true });
};

/** مفتاح Bot Admin API + باقة الشحن — يُحفظ في السحابة */
export interface BotAdminPanelConfig {
  apiKey?: string;
  packageCoins?: number;
  packagePriceUsd?: number;
  updatedAt?: number;
}

export const getBotAdminPanelConfig = async (): Promise<BotAdminPanelConfig | null> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'botAdmin'));
    return snap.exists() ? (snap.data() as BotAdminPanelConfig) : null;
  } catch {
    return null;
  }
};

export const saveBotAdminPanelConfig = async (config: BotAdminPanelConfig): Promise<void> => {
  await setDoc(doc(firestore, 'config', 'botAdmin'), { ...config, updatedAt: Date.now(), _permKey: 'bot' }, { merge: true });
};

/** تصنيفات عينة — تُضاف فقط عند الضغط على «عينات تجريبية» */
export const SAMPLE_GIFT_CATEGORIES: ConfigGiftCategory[] = [
  { id: 'demo_daily', labels: { ar: 'يومية', en: 'Daily' }, order: 0 },
  { id: 'demo_romance', labels: { ar: 'رومانسية', en: 'Romance' }, order: 1 },
  { id: 'demo_party', labels: { ar: 'احتفالات', en: 'Celebrations' }, order: 2 },
  { id: 'demo_luxury', labels: { ar: 'VIP فاخرة', en: 'VIP Luxury' }, order: 3 },
];

/**
 * هدايا تجريبية واقعية — ثابتة / متحركة (GIF) / صوتية (PNG + MP3)
 * روابط CDN للمعاينة؛ يمكن استبدالها برفع ملفاتك من نفس نموذج التعديل.
 */
export const SAMPLE_CONFIG_GIFTS: ConfigGift[] = [
  // ─── ثابتة (6) ───
  {
    id: 'demo_static_rose',
    name: 'وردة حمراء',
    price: 50,
    category: 'demo_romance',
    iconName: 'Flower2',
    iconColor: '#d21e2a',
    rarity: 'common',
    giftMediaType: 'static',
    visualType: 'image',
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/616/616408.png',
  },
  {
    id: 'demo_static_coffee',
    name: 'قهوة صباحية',
    price: 30,
    category: 'demo_daily',
    iconName: 'Coffee',
    iconColor: '#92400E',
    rarity: 'common',
    giftMediaType: 'static',
    visualType: 'image',
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/924/924514.png',
  },
  {
    id: 'demo_static_hug',
    name: 'عناق دافئ',
    price: 60,
    category: 'demo_romance',
    iconName: 'Heart',
    iconColor: '#ff6b6b',
    rarity: 'common',
    giftMediaType: 'static',
    visualType: 'image',
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/833/833472.png',
  },
  {
    id: 'demo_static_chocolate',
    name: 'شوكولاتة',
    price: 80,
    category: 'demo_romance',
    iconName: 'Candy',
    iconColor: '#78350F',
    rarity: 'common',
    giftMediaType: 'static',
    visualType: 'image',
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/3081/3081982.png',
  },
  {
    id: 'demo_static_crown',
    name: 'تاج ملكي',
    price: 500,
    category: 'demo_luxury',
    iconName: 'Crown',
    iconColor: '#F59E0B',
    rarity: 'legendary',
    giftMediaType: 'static',
    visualType: 'image',
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/2582/2582603.png',
  },
  {
    id: 'demo_static_car',
    name: 'سيارة فاخرة',
    price: 800,
    category: 'demo_luxury',
    iconName: 'Car',
    iconColor: '#1D4ED8',
    rarity: 'epic',
    giftMediaType: 'static',
    visualType: 'image',
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/741/741407.png',
  },
  // ─── متحركة GIF (6) ───
  {
    id: 'demo_anim_heartbeat',
    name: 'قلب ينبض',
    price: 150,
    category: 'demo_romance',
    iconName: 'Heart',
    iconColor: '#EF4444',
    rarity: 'rare',
    giftMediaType: 'animated',
    visualType: 'image',
    isAnimated: true,
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/833/833472.png',
    animationUrl: 'https://media.giphy.com/media/26BRuo6sKonPmAfhm/giphy.gif',
  },
  {
    id: 'demo_anim_kiss',
    name: 'قبلة',
    price: 180,
    category: 'demo_romance',
    iconName: 'Heart',
    iconColor: '#d21e2a',
    rarity: 'rare',
    giftMediaType: 'animated',
    visualType: 'image',
    isAnimated: true,
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
    animationUrl: 'https://media.giphy.com/media/3o6Zt4HU9qdRnbkYec/giphy.gif',
  },
  {
    id: 'demo_anim_fireworks',
    name: 'ألعاب نارية',
    price: 300,
    category: 'demo_party',
    iconName: 'Sparkles',
    iconColor: '#F59E0B',
    rarity: 'rare',
    giftMediaType: 'animated',
    visualType: 'image',
    isAnimated: true,
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png',
    animationUrl: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif',
  },
  {
    id: 'demo_anim_confetti',
    name: 'احتفال',
    price: 250,
    category: 'demo_party',
    iconName: 'PartyPopper',
    iconColor: '#f05a5a',
    rarity: 'rare',
    giftMediaType: 'animated',
    visualType: 'image',
    isAnimated: true,
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/3147/3147763.png',
    animationUrl: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif',
  },
  {
    id: 'demo_anim_butterfly',
    name: 'فراشة',
    price: 200,
    category: 'demo_daily',
    iconName: 'Sparkles',
    iconColor: '#f2454e',
    rarity: 'rare',
    giftMediaType: 'animated',
    visualType: 'image',
    isAnimated: true,
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/616/616430.png',
    animationUrl: 'https://media.giphy.com/media/l0MYt5jPR6FB5tPO0/giphy.gif',
  },
  {
    id: 'demo_anim_diamond',
    name: 'ألماس لامع',
    price: 1500,
    category: 'demo_luxury',
    iconName: 'Diamond',
    iconColor: '#06B6D4',
    rarity: 'legendary',
    giftMediaType: 'animated',
    visualType: 'image',
    isAnimated: true,
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/2582/2582603.png',
    animationUrl: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
  },
  // ─── صوتية PNG + MP3 (5) ───
  {
    id: 'demo_sound_love',
    name: 'جرس الحب',
    price: 600,
    category: 'demo_romance',
    iconName: 'Bell',
    iconColor: '#d21e2a',
    rarity: 'epic',
    giftMediaType: 'animated_sound',
    visualType: 'image',
    isAnimated: true,
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/833/833472.png',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  },
  {
    id: 'demo_sound_cheer',
    name: 'هتاف حماسي',
    price: 800,
    category: 'demo_party',
    iconName: 'Megaphone',
    iconColor: '#F59E0B',
    rarity: 'epic',
    giftMediaType: 'animated_sound',
    visualType: 'image',
    isAnimated: true,
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/3147/3147763.png',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  },
  {
    id: 'demo_sound_rocket',
    name: 'صاروخ انطلاق',
    price: 1200,
    category: 'demo_party',
    iconName: 'Rocket',
    iconColor: '#EF4444',
    rarity: 'epic',
    giftMediaType: 'animated_sound',
    visualType: 'image',
    isAnimated: true,
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/3212/3212567.png',
    animationUrl: 'https://media.giphy.com/media/13CoXD02Cc1hjq/giphy.gif',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
  },
  {
    id: 'demo_sound_magic',
    name: 'سحر لامع',
    price: 900,
    category: 'demo_luxury',
    iconName: 'Wand2',
    iconColor: '#f05a5a',
    rarity: 'epic',
    giftMediaType: 'animated_sound',
    visualType: 'image',
    isAnimated: true,
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png',
    animationUrl: 'https://media.giphy.com/media/3o7aCTPPm4OHfRLSH6/giphy.gif',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/270/270-preview.mp3',
  },
  {
    id: 'demo_sound_yacht',
    name: 'قارب VIP',
    price: 2000,
    category: 'demo_luxury',
    iconName: 'Ship',
    iconColor: '#ff5a47',
    rarity: 'legendary',
    giftMediaType: 'animated_sound',
    visualType: 'image',
    isAnimated: true,
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/3062/3062633.png',
    soundUrl: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  },
];

// القيم الافتراضية (للتهيئة الأولى من اللوحة)
export const DEFAULT_CONFIG_GIFTS: ConfigGift[] = [
  { id: 'rose', name: 'وردة', price: 10, category: 'classic', iconName: 'Flower2', iconColor: '#e11e2a', rarity: 'common' },
  { id: 'heart', name: 'قلب', price: 25, category: 'popular', iconName: 'Heart', iconColor: '#EF4444', rarity: 'common' },
  { id: 'cake', name: 'كعكة', price: 50, category: 'classic', iconName: 'Cake', iconColor: '#F59E0B', rarity: 'common' },
  { id: 'star', name: 'نجمة', price: 100, category: 'popular', iconName: 'Star', iconColor: '#FCD34D', rarity: 'rare' },
  { id: 'fire', name: 'نار', price: 200, category: 'animated', iconName: 'Flame', iconColor: '#F59E0B', rarity: 'rare', isAnimated: true },
  { id: 'diamond', name: 'ألماس', price: 500, category: 'luxury', iconName: 'Diamond', iconColor: '#ff5a47', rarity: 'epic' },
  { id: 'crown', name: 'تاج', price: 1000, category: 'luxury', iconName: 'Crown', iconColor: '#F59E0B', rarity: 'epic' },
  { id: 'rocket', name: 'صاروخ', price: 5000, category: 'special', iconName: 'Rocket', iconColor: '#EF4444', rarity: 'legendary', isLimited: true },
  { id: 'castle', name: 'قلعة', price: 10000, category: 'special', iconName: 'Castle', iconColor: '#f05a5a', rarity: 'legendary', isLimited: true },
  { id: 'yacht', name: 'يخت', price: 25000, category: 'special', iconName: 'Ship', iconColor: '#ff5a47', rarity: 'legendary', isLimited: true },
];

export const DEFAULT_CONFIG_VIP: ConfigVipTier[] = [
  { level: 1, name: 'VIP فضي', price: 5000, color: '#9CA3AF', iconName: 'Crown', coinBonus: 5, validityDays: 30, perks: ['إطار فضي', 'دخول مميز', '+5% عملات'] },
  { level: 2, name: 'VIP ذهبي', price: 15000, color: '#FCD34D', iconName: 'Crown', coinBonus: 10, validityDays: 30, perks: ['إطار ذهبي', 'تأثير دخول', '+10% عملات'] },
  { level: 3, name: 'VIP ماسي', price: 50000, color: '#06B6D4', iconName: 'Diamond', coinBonus: 20, validityDays: 30, perks: ['إطار ماسي', 'تأثيرات حصرية', '+20% عملات'] },
  { level: 4, name: 'VIP أسطوري', price: 150000, color: '#f2454e', iconName: 'Sparkles', coinBonus: 50, validityDays: 30, perks: ['كل المزايا', 'هدايا حصرية', '+50% عملات'] },
];

export const DEFAULT_RECHARGE_PACKAGE_TAGS: ConfigRechargePackageTag[] = [
  {
    id: 'popular',
    labels: { ar: 'الأكثر شيوعاً', en: 'Most Popular' },
    emoji: '🔥',
    color: '#e11212',
    borderColor: '#e11212',
    order: 0,
  },
  {
    id: 'best_value',
    labels: { ar: 'أفضل قيمة', en: 'Best Value' },
    emoji: '⭐',
    color: '#F59E0B',
    borderColor: '#F59E0B',
    order: 1,
  },
];

export const DEFAULT_CONFIG_PACKAGES: ConfigRechargePackage[] = [
  { id: 'pkg1', coins: 10000, bonus: 0, priceUSD: 1, priceLabel: '$1' },
  { id: 'pkg2', coins: 50000, bonus: 2500, priceUSD: 5, priceLabel: '$5' },
  { id: 'pkg3', coins: 100000, bonus: 10000, priceUSD: 10, priceLabel: '$10', tagId: 'popular' },
  { id: 'pkg4', coins: 500000, bonus: 75000, priceUSD: 50, priceLabel: '$50' },
  { id: 'pkg5', coins: 1000000, bonus: 200000, priceUSD: 100, priceLabel: '$100', tagId: 'best_value' },
];

// ==================== GAMES CONFIG ====================
/** وقت تسلسل الذاكرة لشريحة دخولية واحدة */
export interface SequenceMemoryStakeTiming {
  stake: number;
  memorizeSeconds: number;
  reconstructSeconds: number;
  /** عدد مربعات التسلسل لهذه الدخولية */
  sequenceLength: number;
}

export interface ConfigGame {
  id: string;
  name: string;
  enabled: boolean;
  minBet: number;
  maxBet: number;
  rtp: number;
  multipliers: number[];
  /** sequence-memory فقط — وقت الحفظ والترتيب حسب الدخولية */
  sequenceTimingByStake?: SequenceMemoryStakeTiming[];
}

/** افتراضيات وقت تسلسل الذاكرة حسب الدخولية */
export const DEFAULT_SEQUENCE_MEMORY_TIMING_BY_STAKE: Record<
  number,
  { memorizeSeconds: number; reconstructSeconds: number; sequenceLength: number }
> = {
  5000: { memorizeSeconds: 5, reconstructSeconds: 15, sequenceLength: 8 },
  10000: { memorizeSeconds: 6, reconstructSeconds: 18, sequenceLength: 10 },
  25000: { memorizeSeconds: 8, reconstructSeconds: 20, sequenceLength: 10 },
  50000: { memorizeSeconds: 10, reconstructSeconds: 25, sequenceLength: 12 },
};

export function normalizeSequenceMemoryTiming(
  stakeChips: number[],
  saved?: SequenceMemoryStakeTiming[],
  globalFallback?: { memorizeSeconds: number; reconstructSeconds: number },
): SequenceMemoryStakeTiming[] {
  const fallback = globalFallback ?? { memorizeSeconds: 5, reconstructSeconds: 15 };
  const savedMap = new Map((saved ?? []).map((t) => [t.stake, t]));
  return stakeChips.map((stake) => {
    const fromSaved = savedMap.get(stake);
    const fromDefault = DEFAULT_SEQUENCE_MEMORY_TIMING_BY_STAKE[stake];
    const mem = fromSaved?.memorizeSeconds ?? fromDefault?.memorizeSeconds ?? fallback.memorizeSeconds;
    const rec = fromSaved?.reconstructSeconds ?? fromDefault?.reconstructSeconds ?? fallback.reconstructSeconds;
    const len = fromSaved?.sequenceLength ?? fromDefault?.sequenceLength ?? 8;
    return {
      stake,
      memorizeSeconds: Math.min(60, Math.max(3, Number(mem) || fallback.memorizeSeconds)),
      reconstructSeconds: Math.min(180, Math.max(5, Number(rec) || fallback.reconstructSeconds)),
      sequenceLength: Math.min(20, Math.max(4, Number(len) || 8)),
    };
  });
}

export type GameSectionId = 'challenges' | 'intelligence' | 'casino' | 'lottery';

export interface GamesSectionsConfig {
  challenges: boolean;
  intelligence: boolean;
  casino: boolean;
  lottery: boolean;
}

export const DEFAULT_GAMES_SECTIONS: GamesSectionsConfig = {
  challenges: true,
  intelligence: true,
  casino: true,
  lottery: true,
};

/** إعدادات اقتصاد الألعاب العامة — تُتحكم من لوحة الألعاب */
export interface GamesGlobalEconomy {
  challengeWinnerPercent: number;
  challengeAppPercent: number;
  lotteryTicketPrice: number;
  lotteryGrandPrize: number;
  casinoToCoinsRate: number;
  /** 1$ = كم كوين (الوثيقة: 10,000) */
  coinsPerDollar: number;
  /** شرائح الرهان لألعاب الذكاء */
  intelligenceStakeChips: number[];
  /** شرائح الرهان لتحديات 1v1 ($1 / $5 / $10) */
  challengeStakeChips: number[];
  /** رصيد المحاكي في لوحة التحكم والتجربة المباشرة */
  demoBalance: number;
  /** وقت كل لاعب في البلياردو (ملي ثانية) */
  billiardsTurnMs: number;
  penaltyRounds: number;
  penaltyTurnSeconds: number;
  coinChallengeRounds: number;
  coinChallengeTurnSeconds: number;
  /** مرحلة حفظ التسلسل — تذكر التسلسل (ثوان) */
  sequenceMemoryMemorizeSeconds: number;
  /** مرحلة إعادة الترتيب — تذكر التسلسل (ثوان) */
  sequenceMemoryReconstructSeconds: number;
  /** مؤقّت سؤال ألعاب الذكاء «خمّن العلم» بالثواني */
  intelligenceQuestionSeconds: number;
  /** إظهار/إخفاء أقسام الألعاب في التطبيق */
  sections?: GamesSectionsConfig;
}

export const DEFAULT_GAMES_GLOBAL: GamesGlobalEconomy = {
  challengeWinnerPercent: 80,
  challengeAppPercent: 20,
  lotteryTicketPrice: 200_000,
  lotteryGrandPrize: 10_000_000,
  casinoToCoinsRate: 10_000,
  coinsPerDollar: 10_000,
  intelligenceStakeChips: [5000, 10000, 25000, 50000],
  challengeStakeChips: [5000, 10000, 25000, 50000],
  demoBalance: 50_000,
  billiardsTurnMs: 420_000,
  penaltyRounds: 5,
  penaltyTurnSeconds: 10,
  coinChallengeRounds: 3,
  coinChallengeTurnSeconds: 10,
  sequenceMemoryMemorizeSeconds: 5,
  sequenceMemoryReconstructSeconds: 15,
  intelligenceQuestionSeconds: 10,
  sections: { ...DEFAULT_GAMES_SECTIONS },
};

export const DEFAULT_CONFIG_GAMES: ConfigGame[] = [
  { id: 'lucky-777', name: 'لاكي 777', enabled: true, minBet: 200, maxBet: 50000, rtp: 92, multipliers: [100, 50, 30, 20, 10] },
  { id: 'dice', name: 'النرد', enabled: true, minBet: 100, maxBet: 50000, rtp: 99, multipliers: [2] },
  { id: 'duck-race', name: 'سباق البط', enabled: true, minBet: 100, maxBet: 10000, rtp: 95, multipliers: [2, 0.5, 0.25] },
  { id: 'rock-paper-scissors', name: 'حجر ورقة مقص', enabled: true, minBet: 100, maxBet: 50000, rtp: 95, multipliers: [2] },
  { id: 'hilo', name: 'هاي لو', enabled: true, minBet: 100, maxBet: 50000, rtp: 99, multipliers: [1.5, 2, 5, 10] },
  { id: 'limbo', name: 'ليمبو', enabled: true, minBet: 100, maxBet: 50000, rtp: 99, multipliers: [1.5, 2, 5, 10] },
  { id: 'roulette', name: 'الروليت', enabled: true, minBet: 100, maxBet: 50000, rtp: 97, multipliers: [2, 3, 36] },
  { id: 'blackjack', name: 'بلاك جاك', enabled: true, minBet: 100, maxBet: 50000, rtp: 99, multipliers: [2, 2.5, 3] },
  { id: 'chicken-cross', name: 'عبور الدجاجة', enabled: true, minBet: 100, maxBet: 50000, rtp: 96, multipliers: [1.5, 2, 5, 10, 50] },
  { id: 'crash-rocket', name: 'الصاروخ', enabled: true, minBet: 100, maxBet: 100000, rtp: 97, multipliers: [2, 4, 10] },
  { id: 'plinko', name: 'بلينكو', enabled: true, minBet: 100, maxBet: 100000, rtp: 96, multipliers: [2, 5, 10, 20] },
  { id: 'dino', name: 'دينو رن', enabled: true, minBet: 100, maxBet: 100000, rtp: 96, multipliers: [1.5, 2, 5, 10, 50] },
  { id: 'spin-win', name: 'عجلة Spin & Win', enabled: true, minBet: 1000, maxBet: 100000, rtp: 94, multipliers: [5, 10, 15, 20, 45] },
  { id: 'mines', name: 'الألغام', enabled: true, minBet: 100, maxBet: 100000, rtp: 97, multipliers: [1.5, 2, 5, 10, 24] },
  { id: 'dragon-tower', name: 'برج التنين', enabled: true, minBet: 5000, maxBet: 50000, rtp: 98, multipliers: [] },
  { id: 'flag-guess', name: 'خمّن العلم', enabled: true, minBet: 5000, maxBet: 50000, rtp: 90, multipliers: [20] },
  { id: 'memory-match', name: 'الذاكرة', enabled: true, minBet: 5000, maxBet: 50000, rtp: 90, multipliers: [20] },
  { id: 'sequence-memory', name: 'تسلسل الذاكرة', enabled: true, minBet: 5000, maxBet: 50000, rtp: 90, multipliers: [20] },
  { id: 'xo', name: 'لعبة XO', enabled: true, minBet: 100, maxBet: 100000, rtp: 90, multipliers: [2] },
  { id: 'penalty-kicks', name: 'ركلات الجزاء', enabled: true, minBet: 10000, maxBet: 100000, rtp: 92, multipliers: [2] },
  { id: 'coin-challenge', name: 'رمي العملة 1v1', enabled: true, minBet: 10000, maxBet: 100000, rtp: 92, multipliers: [2] },
  { id: 'pool', name: 'البلياردو 1v1', enabled: true, minBet: 5000, maxBet: 50000, rtp: 100, multipliers: [] },
  { id: 'lottery', name: 'اليانصيب', enabled: true, minBet: 1000, maxBet: 10000, rtp: 85, multipliers: [1000] },
  { id: 'challenges', name: 'التحديات', enabled: true, minBet: 0, maxBet: 0, rtp: 100, multipliers: [] },
];

const INTELLIGENCE_GAME_IDS = new Set(['flag-guess', 'memory-match', 'sequence-memory']);
const INTELLIGENCE_WIN_MULTIPLIER_DEFAULT = 20;

export function normalizeGamesGlobal(raw?: Partial<GamesGlobalEconomy>): GamesGlobalEconomy {
  const merged = { ...DEFAULT_GAMES_GLOBAL, ...raw };
  merged.sections = { ...DEFAULT_GAMES_SECTIONS, ...raw?.sections };
  merged.intelligenceStakeChips =
    raw?.intelligenceStakeChips?.length ? raw.intelligenceStakeChips : DEFAULT_GAMES_GLOBAL.intelligenceStakeChips;
  merged.challengeStakeChips =
    raw?.challengeStakeChips?.length ? raw.challengeStakeChips : DEFAULT_GAMES_GLOBAL.challengeStakeChips;
  merged.sequenceMemoryMemorizeSeconds = Math.min(
    60,
    Math.max(3, Number(merged.sequenceMemoryMemorizeSeconds) || DEFAULT_GAMES_GLOBAL.sequenceMemoryMemorizeSeconds),
  );
  merged.sequenceMemoryReconstructSeconds = Math.min(
    180,
    Math.max(5, Number(merged.sequenceMemoryReconstructSeconds) || DEFAULT_GAMES_GLOBAL.sequenceMemoryReconstructSeconds),
  );
  merged.intelligenceQuestionSeconds = Math.min(
    120,
    Math.max(3, Number(merged.intelligenceQuestionSeconds) || DEFAULT_GAMES_GLOBAL.intelligenceQuestionSeconds),
  );
  return merged;
}

function normalizeIntelligenceConfig(merged: ConfigGame, def: ConfigGame): ConfigGame {
  merged.minBet = Math.max(5000, merged.minBet);
  merged.maxBet = Math.min(50000, Math.max(merged.minBet, merged.maxBet));
  if (!merged.multipliers?.length) {
    merged.multipliers = def.multipliers.length ? def.multipliers : [INTELLIGENCE_WIN_MULTIPLIER_DEFAULT];
  }
  return merged;
}

function mergeConfigGames(saved?: ConfigGame[]): ConfigGame[] {
  const merged = DEFAULT_CONFIG_GAMES.map((def) => {
    const s = saved?.find((x) => x.id === def.id);
    if (!s) return def;
    const result: ConfigGame = {
      ...def,
      ...s,
      multipliers:
        Array.isArray(s.multipliers) && s.multipliers.length > 0 ? s.multipliers : def.multipliers,
    };
    if (INTELLIGENCE_GAME_IDS.has(def.id)) return normalizeIntelligenceConfig(result, def);
    return result;
  });

  for (const s of saved ?? []) {
    if (!merged.some((g) => g.id === s.id)) merged.push(s);
  }
  return merged;
}

export const getConfigGames = async (): Promise<ConfigGame[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'games'));
    if (snap.exists() && snap.data().games?.length) {
      const saved = snap.data().games as ConfigGame[];
      return mergeConfigGames(saved);
    }
  } catch {}
  return DEFAULT_CONFIG_GAMES;
};

export const getGamesGlobalEconomy = async (): Promise<GamesGlobalEconomy> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'games'));
    if (snap.exists() && snap.data().global) {
      return normalizeGamesGlobal(snap.data().global as GamesGlobalEconomy);
    }
  } catch {}
  return DEFAULT_GAMES_GLOBAL;
};

/**
 * سحب يانصيب أسبوعي يدوي — عبر Cloud Function (adminRunWeeklyLotteryDraw) بدل الكتابة
 * المباشرة من العميل (weeklyLotteryDraws/lotteryTickets محظورة الكتابة مباشرة بقواعد Firestore
 * أصلاً — الخصم والسحب يتمّان بصلاحيات السيرفر فقط).
 */
export const runWeeklyLotteryDraw = async (weekId?: string): Promise<{
  weekId: string;
  winnerUid: string;
  winnerName: string;
  prize: number;
  ticketCount: number;
}> => {
  const fn = httpsCallable<
    { weekId?: string },
    { weekId: string; winnerUid: string; winnerName: string; prize: number; ticketCount: number }
  >(functions, 'adminRunWeeklyLotteryDraw');
  const res = await fn({ weekId });
  const draw = res.data;
  await logAdminAction(
    'سحب اليانصيب الأسبوعي',
    `${draw.winnerName} (${draw.winnerUid}) — ${draw.prize.toLocaleString()} كوين`,
  );
  return draw;
};

export const saveConfigGames = async (
  games: ConfigGame[],
  global?: GamesGlobalEconomy,
): Promise<void> => {
  const globalPayload = normalizeGamesGlobal(global ?? (await getGamesGlobalEconomy()));
  const mergedGames = mergeConfigGames(games).map((g) => {
    if (g.id !== 'sequence-memory') return g;
    return {
      ...g,
      sequenceTimingByStake: normalizeSequenceMemoryTiming(
        globalPayload.intelligenceStakeChips,
        g.sequenceTimingByStake,
        {
          memorizeSeconds: globalPayload.sequenceMemoryMemorizeSeconds,
          reconstructSeconds: globalPayload.sequenceMemoryReconstructSeconds,
        },
      ),
    };
  });
  await setDoc(
    doc(firestore, 'config', 'games'),
    { games: mergedGames, global: globalPayload, updatedAt: Date.now(), _permKey: 'games' },
    { merge: true },
  );

  try {
    const settings = await getConfigSettings();
    if (settings) {
      await saveConfigSettings({
        ...settings,
        challengeWinnerPercent: globalPayload.challengeWinnerPercent,
        challengeAppCommission: globalPayload.challengeAppPercent,
        casinoToCoinsRate: globalPayload.casinoToCoinsRate,
      });
    }
  } catch {
    /* non-blocking sync to legacy settings doc */
  }
};

// ==================== CALL PRICING (مطابقة + مكالمات الشات) ====================

export interface ConfigCallPricingRates {
  voicePerMinute: number;
  videoFirstMinute: number;
  videoAfterMinute: number;
}

export interface ConfigChatMessagePricing {
  enabled: boolean;
  textMessage: number;
  voiceMessage: number;
  imageMessage: number;
}

export interface ConfigCallPricing {
  match: ConfigCallPricingRates;
  chat: ConfigCallPricingRates;
  messages: ConfigChatMessagePricing;
  updatedAt?: number;
}

export const DEFAULT_CONFIG_CALL_PRICING: ConfigCallPricing = {
  match: { voicePerMinute: 260, videoFirstMinute: 175, videoAfterMinute: 350 },
  chat: { voicePerMinute: 260, videoFirstMinute: 175, videoAfterMinute: 350 },
  messages: { enabled: true, textMessage: 200, voiceMessage: 200, imageMessage: 200 },
};

const clampCallPrice = (n: unknown, fallback: number) => {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : fallback;
  return Math.max(0, Math.min(500_000, v));
};

const normalizeConfigCallPricing = (raw: Record<string, unknown> | undefined): ConfigCallPricing => {
  const match = (raw?.match ?? {}) as Record<string, unknown>;
  const chat = (raw?.chat ?? {}) as Record<string, unknown>;
  const messages = (raw?.messages ?? {}) as Record<string, unknown>;
  return {
    match: {
      voicePerMinute: clampCallPrice(match.voicePerMinute, DEFAULT_CONFIG_CALL_PRICING.match.voicePerMinute),
      videoFirstMinute: clampCallPrice(match.videoFirstMinute, DEFAULT_CONFIG_CALL_PRICING.match.videoFirstMinute),
      videoAfterMinute: clampCallPrice(match.videoAfterMinute, DEFAULT_CONFIG_CALL_PRICING.match.videoAfterMinute),
    },
    chat: {
      voicePerMinute: clampCallPrice(chat.voicePerMinute, DEFAULT_CONFIG_CALL_PRICING.chat.voicePerMinute),
      videoFirstMinute: clampCallPrice(chat.videoFirstMinute, DEFAULT_CONFIG_CALL_PRICING.chat.videoFirstMinute),
      videoAfterMinute: clampCallPrice(chat.videoAfterMinute, DEFAULT_CONFIG_CALL_PRICING.chat.videoAfterMinute),
    },
    messages: {
      enabled: messages.enabled !== false,
      textMessage: clampCallPrice(messages.textMessage, DEFAULT_CONFIG_CALL_PRICING.messages.textMessage),
      voiceMessage: clampCallPrice(messages.voiceMessage, DEFAULT_CONFIG_CALL_PRICING.messages.voiceMessage),
      imageMessage: clampCallPrice(messages.imageMessage, DEFAULT_CONFIG_CALL_PRICING.messages.imageMessage),
    },
    updatedAt: typeof raw?.updatedAt === 'number' ? raw.updatedAt : undefined,
  };
};

export const getConfigCallPricing = async (): Promise<ConfigCallPricing> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'callPricing'));
    if (snap.exists()) return normalizeConfigCallPricing(snap.data());
  } catch {}
  return DEFAULT_CONFIG_CALL_PRICING;
};

export const saveConfigCallPricing = async (pricing: ConfigCallPricing): Promise<void> => {
  await setDoc(
    doc(firestore, 'config', 'callPricing'),
    { ...normalizeConfigCallPricing(pricing as unknown as Record<string, unknown>), updatedAt: Date.now(), _permKey: 'call-pricing' },
    { merge: true },
  );
};

// ==================== ADMINS & COUNTRY PERMISSIONS ====================

/**
 * صلاحية مستقلة لكل صفحة في لوحة التحكم — المفتاح مطابق تماماً لـ routePath في navConfig.ts
 * (مصدر واحد للحقيقة، بلا جدول تطابق منفصل قد ينحرف عنه).
 */
export const PERMISSION_SECTIONS = [
  { key: 'analytics', label: 'الإحصائيات والأرباح' },
  { key: 'call-usage', label: 'استهلاك دقائق المزوّد' },
  { key: 'users', label: 'المستخدمون' },
  { key: 'staff', label: 'موظفو التطبيق' },
  { key: 'kyc-requests', label: 'طلبات التحقق من الهوية' },
  { key: 'rooms', label: 'الغرف الصوتية' },
  { key: 'room-decor', label: 'تخصيص الروم (إطارات/خلفيات)' },
  { key: 'room-reactions', label: 'الملصقات والتعبيرات (Stickers & Reactions)' },
  { key: 'agencies', label: 'الوكالات' },
  { key: 'agency-levels', label: 'مستويات الوكالة' },
  { key: 'agency-prince', label: 'أمير الوكلاء' },
  { key: 'agency-applications', label: 'طلبات فتح الوكالة' },
  { key: 'wallet', label: 'الشحن والسحب' },
  { key: 'withdrawals', label: 'طلبات السحب' },
  { key: 'bot', label: 'بوت تيليغرام (شحن)' },
  { key: 'packages', label: 'باقات الشحن' },
  { key: 'gifts', label: 'الهدايا' },
  { key: 'store', label: 'متجر التطبيق' },
  { key: 'lucky-bag', label: 'حقيبة الحظ' },
  { key: 'room-throne', label: 'عرش الغرفة' },
  { key: 'vip', label: 'العضويات VIP' },
  { key: 'aristocracy', label: 'الأرستقراطية' },
  { key: 'rewards-center', label: 'مركز المكافآت' },
  { key: 'host-tasks', label: 'مهام المضيفة' },
  { key: 'titles', label: 'الألقاب (لقبي)' },
  { key: 'gift-privileges', label: 'منح الامتيازات' },
  { key: 'privacy', label: 'الخصوصية' },
  { key: 'call-pricing', label: 'تسعير المكالمات والمطابقة' },
  { key: 'posts', label: 'المنشورات / اللحظات' },
  { key: 'games', label: 'الألعاب' },
  { key: 'relationships', label: 'العلاقات' },
  { key: 'chat-backgrounds', label: 'خلفيات المحادثة' },
  { key: 'notifications', label: 'إشعارات المستخدمين' },
  { key: 'about-pages', label: 'حول التطبيق' },
  { key: 'support', label: 'مركز الدعم' },
  { key: 'reports', label: 'البلاغات' },
  { key: 'settings', label: 'الإعدادات' },
  { key: 'app-release', label: 'إصدار التطبيق (APK)' },
] as const;

export type PermissionKey = string;

/** أقسام NAV_SECTIONS نفسها تُستخدم لتجميع مصفوفة الصلاحيات في واجهة Admins.tsx — راجع src/lib/navConfig.ts */

export interface AdminProfile {
  uid: string;
  email: string;
  name: string;
  role: 'super' | 'country';
  countries: string[];
  permissions: Record<string, boolean>;
  disabled?: boolean;
  createdAt?: number;
}

// نطاق المشرف الحالي (يُحمّل بعد الدخول) — تستخدمه الـ getters للفلترة بالدولة
let adminScope: AdminProfile | null = null;
export const getAdminScope = (): AdminProfile | null => adminScope;
export const setAdminScope = (s: AdminProfile | null): void => {
  adminScope = s;
  setCountryScopeProfile(
    s
      ? { role: s.role, countries: s.countries }
      : null,
  );
};

/** مدير النظام يرى الكل؛ مشرف الدولة يرى دوله فقط */
export const isSuperAdmin = (): boolean => !adminScope || adminScope.role === 'super';

export const hasPermission = (key: PermissionKey): boolean => {
  if (isSuperAdmin()) return true;
  return adminScope?.permissions?.[key] === true;
};

/** يحمّل ملف المشرف الحالي ويضبط النطاق */
export const loadCurrentAdminProfile = async (): Promise<AdminProfile | null> => {
  const uid = auth.currentUser?.uid ?? localStorage.getItem('admin_uid');
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(firestore, 'admins', uid));
    if (!snap.exists()) {
      setAdminScope(null);
      setCountryScopeProfile(null);
      return null;
    }
    const d = snap.data() as any;
    const profile: AdminProfile = {
      uid,
      email: String(d.email ?? ''),
      name: String(d.name ?? 'مشرف'),
      role: d.role === 'country' ? 'country' : 'super',
      countries: Array.isArray(d.countries) ? d.countries.map((c: string) => String(c).toUpperCase()) : [],
      permissions: d.permissions ?? {},
      disabled: d.disabled === true,
      createdAt: d.createdAt,
    };
    setAdminScope(profile);
    return profile;
  } catch {
    return null;
  }
};

export const listAdmins = async (): Promise<AdminProfile[]> => {
  try {
    const snap = await getDocs(query(collection(firestore, 'admins'), limit(200)));
    return snap.docs.map((dd) => {
      const d = dd.data() as any;
      return {
        uid: dd.id,
        email: String(d.email ?? ''),
        name: String(d.name ?? 'مشرف'),
        role: d.role === 'country' ? 'country' : 'super',
        countries: Array.isArray(d.countries) ? d.countries : [],
        permissions: d.permissions ?? {},
        disabled: d.disabled === true,
        createdAt: d.createdAt,
      } as AdminProfile;
    }).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } catch (e) {
    console.error('listAdmins:', e);
    return [];
  }
};

export const createAdminUser = async (input: {
  email: string; password: string; name: string;
  role: 'super' | 'country'; countries: string[]; permissions: Record<string, boolean>;
}): Promise<{ ok: boolean; uid: string }> => {
  const fn = httpsCallable<typeof input, { ok: boolean; uid: string }>(functions, 'createAdminUser');
  const res = await fn(input);
  return res.data;
};

export const updateAdminUser = async (input: {
  targetUid: string; name?: string; role?: 'super' | 'country';
  countries?: string[]; permissions?: Record<string, boolean>; disabled?: boolean;
}): Promise<void> => {
  const fn = httpsCallable(functions, 'updateAdminUser');
  await fn(input);
};

export const deleteAdminUser = async (targetUid: string): Promise<void> => {
  const fn = httpsCallable(functions, 'deleteAdminUser');
  await fn({ targetUid });
};

// ==================== PLATFORM STAFF (موظفو التطبيق) ====================

export type PlatformStaffRole = 'manager' | 'super_admin' | 'admin';

export interface PlatformStaffRow {
  uid: string;
  publicAccountId: string;
  displayName: string;
  email: string;
  avatar: string;
  country: string;
  staffRole: PlatformStaffRole;
  staffCountries: string[];
  staffFrameUrl?: string;
  staffBadgeUrl?: string;
  staffEntryVideoUrl?: string;
  staffEntryVideoUrlMp4?: string;
  staffAgencyId?: string;
  staffAgencyName?: string;
  staffActive: boolean;
  createdAt: number;
}

export interface AdminCreateStaffInput {
  email: string;
  password: string;
  displayName: string;
  gender?: 'male' | 'female';
  country?: string;
  staffRole: PlatformStaffRole;
  staffCountries?: string[];
  avatar?: string;
  staffFrameUrl?: string;
  staffBadgeUrl?: string;
  staffEntryVideoUrl?: string;
  staffEntryVideoUrlMp4?: string;
  staffAgencyId?: string;
  staffAgencyName?: string;
  staffAgencyLogo?: string;
  staffAgencyBanner?: string;
}

export const listPlatformStaffUsers = async (): Promise<PlatformStaffRow[]> => {
  const q = query(
    collection(firestore, 'users'),
    where('staffRole', 'in', ['manager', 'super_admin', 'admin']),
    limit(200),
  );
  const snap = await getDocs(q);
  const rows: PlatformStaffRow[] = [];
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const role = data.staffRole as PlatformStaffRole;
    if (!role) continue;
    rows.push({
      uid: d.id,
      publicAccountId: formatPublicAccountId(data.publicAccountId, d.id),
      displayName: String(data.displayName ?? 'موظف'),
      email: String(data.email ?? ''),
      avatar: String(data.avatar ?? ''),
      country: String(data.country ?? 'PS'),
      staffRole: role,
      staffCountries: Array.isArray(data.staffCountries)
        ? (data.staffCountries as string[]).map((c) => String(c).toUpperCase())
        : [],
      staffFrameUrl: data.staffFrameUrl ? String(data.staffFrameUrl) : undefined,
      staffBadgeUrl: data.staffBadgeUrl ? String(data.staffBadgeUrl) : undefined,
      staffEntryVideoUrl: data.staffEntryVideoUrl ? String(data.staffEntryVideoUrl) : undefined,
      staffEntryVideoUrlMp4: data.staffEntryVideoUrlMp4 ? String(data.staffEntryVideoUrlMp4) : undefined,
      staffAgencyId: data.staffAgencyId ? String(data.staffAgencyId) : undefined,
      staffAgencyName: data.staffAgencyName ? String(data.staffAgencyName) : undefined,
      staffActive: data.staffActive !== false,
      createdAt: Number(data.createdAt ?? 0),
    });
  }
  rows.sort((a, b) => b.createdAt - a.createdAt);
  return enrichStaffAgencyNames(rows);
};

async function enrichStaffAgencyNames(rows: PlatformStaffRow[]): Promise<PlatformStaffRow[]> {
  const missing = rows.filter((r) => r.staffRole === 'super_admin' && r.staffAgencyId && !r.staffAgencyName);
  if (missing.length === 0) return rows;
  const agencyIds = [...new Set(missing.map((r) => r.staffAgencyId!))];
  const names = new Map<string, string>();
  await Promise.all(
    agencyIds.map(async (id) => {
      const snap = await getDoc(doc(firestore, 'agencies', id));
      if (snap.exists()) {
        const data = snap.data() as Record<string, unknown>;
        names.set(id, String(data.name ?? ''));
      }
    }),
  );
  return rows.map((r) =>
    r.staffAgencyId && !r.staffAgencyName && names.has(r.staffAgencyId)
      ? { ...r, staffAgencyName: names.get(r.staffAgencyId) }
      : r,
  );
}

export const adminCreateStaffUser = async (
  input: AdminCreateStaffInput,
): Promise<{ uid: string; publicAccountId: string; displayName: string; agencyId?: string }> => {
  const fn = httpsCallable<
    AdminCreateStaffInput,
    { ok: boolean; uid: string; publicAccountId: string; displayName: string; agencyId?: string }
  >(functions, 'adminCreateStaffUser');
  const res = await fn(input);
  return {
    uid: res.data.uid,
    publicAccountId: res.data.publicAccountId,
    displayName: res.data.displayName,
    agencyId: res.data.agencyId,
  };
};

export const adminUpdateStaffUser = async (input: {
  uid: string;
  staffRole?: PlatformStaffRole | null;
  staffCountries?: string[];
  staffFrameUrl?: string | null;
  staffBadgeUrl?: string | null;
  staffEntryVideoUrl?: string | null;
  staffEntryVideoUrlMp4?: string | null;
  staffAgencyId?: string | null;
  staffAgencyName?: string | null;
  staffAgencyLogo?: string | null;
  staffAgencyBanner?: string | null;
  staffActive?: boolean;
  avatar?: string;
  displayName?: string;
}): Promise<void> => {
  const fn = httpsCallable(functions, 'adminUpdateStaffUser');
  await fn(input);
};

export const adminRemoveStaffUser = async (uid: string): Promise<void> => {
  const fn = httpsCallable(functions, 'adminRemoveStaffUser');
  await fn({ uid });
};

// ==================== ADMIN CHECK ====================
/**
 * يتحقق هل المستخدم الحالي مسجّل في collection admins
 */
export const checkIsAdmin = async (): Promise<boolean> => {
  const uid = auth.currentUser?.uid ?? localStorage.getItem('admin_uid');
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(firestore, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
};

/**
 * تهيئة أولية شاملة — يملأ كل إعدادات config بالقيم الافتراضية
 * يُستخدم عند أول تشغيل لتظهر البيانات في التطبيق فوراً
 */
export const seedAllConfig = async (): Promise<{ ok: boolean; message: string }> => {
  try {
    await Promise.all([
      saveConfigGifts(DEFAULT_CONFIG_GIFTS),
      saveConfigVipTiers(DEFAULT_CONFIG_VIP),
      saveConfigPackages(DEFAULT_CONFIG_PACKAGES, DEFAULT_RECHARGE_PACKAGE_TAGS),
      saveConfigGames(DEFAULT_CONFIG_GAMES),
      saveConfigCallPricing(DEFAULT_CONFIG_CALL_PRICING),
      saveConfigChatBackgrounds(DEFAULT_CONFIG_CHAT_BACKGROUNDS),
      saveConfigSettings({
        coinRate: 10000,
        minWithdraw: 10,
        minHostWithdraw: 10,
        minAgentWithdraw: 10,
        hostWithdrawAmounts: [10, 20, 40, 70, 100, 140, 200],
        agentWithdrawAmounts: [20, 55, 90, 130, 210, 300, 400, 510, 900],
        allowCustomHostWithdraw: true,
        allowCustomAgentWithdraw: true,
        hostAgentWithdrawWeekDays: [6],
        hostSelfWithdrawAnytime: true,
        agentWithdrawCooldownDays: 30,
        agentBatchDivisor: 5,
        pearlUsdRate: 1000,
        giftCommission: 30,
        agencyCommission: 20,
        bdReferralCommissionPercent: 10,
        bdReferralBenefitMonths: 6,
        transferCommission: 5,
        minTransferAmount: 100,
        coinsToPearlsRate: 50000,
        casinoToCoinsRate: 9000,
        casinoToPearlsRate: 1,
        selfWithdrawCommission: 10,
        agentWithdrawCommission: 2,
        maintenanceMode: false,
        allowRegistration: true,
        requireVerification: false,
        welcomeBonus: 0,
        firstRechargeBonus: 50_000,
      }),
    ]);
    await logAdminAction('تهيئة أولية', 'كل الإعدادات', 'هدايا + VIP + باقات + إعدادات');
    return { ok: true, message: 'تمت التهيئة بنجاح — البيانات الآن متاحة في التطبيق' };
  } catch (e: any) {
    return { ok: false, message: e.message ?? 'فشلت التهيئة' };
  }
};

/**
 * تسجيل الحساب الحالي كأدمن ذاتياً
 * يعمل فقط إذا كانت collection admins فارغة (أول أدمن) — تحقّق من القواعد
 */
export const selfRegisterFirstAdmin = async (): Promise<{ ok: boolean; message: string }> => {
  const uid = auth.currentUser?.uid;
  const email = auth.currentUser?.email;
  if (!uid) return { ok: false, message: 'سجّل الدخول أولاً' };
  try {
    await setDoc(doc(firestore, 'admins', uid), {
      email: email ?? '',
      name: 'مدير النظام',
      role: 'super',
      createdAt: Date.now(),
    });
    return { ok: true, message: 'تم تسجيلك كأدمن' };
  } catch (e: any) {
    return {
      ok: false,
      message: 'فشل التسجيل التلقائي — أضف حسابك يدوياً من Firebase Console (راجع SETUP_ADMIN.md)',
    };
  }
};

// ==================== ADVANCED ANALYTICS ====================
export interface AnalyticsDateRange {
  fromMs: number;
  toMs: number;
}

export function startOfDayMs(date: Date = new Date()): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDayMs(date: Date = new Date()): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function getAnalyticsPresetRange(
  preset: 'today' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth',
): AnalyticsDateRange {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { fromMs: startOfDayMs(now), toMs: endOfDayMs(now) };
    case 'last7': {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { fromMs: startOfDayMs(from), toMs: endOfDayMs(now) };
    }
    case 'last30': {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { fromMs: startOfDayMs(from), toMs: endOfDayMs(now) };
    }
    case 'thisMonth': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { fromMs: startOfDayMs(from), toMs: endOfDayMs(now) };
    }
    case 'lastMonth': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { fromMs: startOfDayMs(from), toMs: endOfDayMs(to) };
    }
  }
}

function txInRange(createdAt: number | undefined, range?: AnalyticsDateRange): boolean {
  if (!range) return true;
  const ts = createdAt ?? 0;
  return ts >= range.fromMs && ts <= range.toMs;
}

async function fetchTransactionsForAnalytics(range?: AnalyticsDateRange): Promise<AdminTransaction[]> {
  const limitCount = range ? 5000 : 2000;
  try {
    const q = range
      ? query(
          collection(firestore, 'transactions'),
          where('createdAt', '>=', range.fromMs),
          where('createdAt', '<=', range.toMs),
          orderBy('createdAt', 'desc'),
          limit(scopedFetchLimit(limitCount)),
        )
      : query(
          collection(firestore, 'transactions'),
          orderBy('createdAt', 'desc'),
          limit(scopedFetchLimit(limitCount)),
        );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    if (isSuperCountryScope()) return rows;
    await preloadUserCountries(rows.map((t) => String(t.uid ?? '')));
    return rows.filter((t) => isInAdminCountryScope(getCachedUserCountry(String(t.uid ?? ''))));
  } catch (e) {
    console.error('fetchTransactionsForAnalytics:', e);
    return [];
  }
}

async function fetchGameTransactionsForAnalytics(range?: AnalyticsDateRange): Promise<AdminTransaction[]> {
  const limitCount = range ? 5000 : 2000;
  try {
    const q = range
      ? query(
          collection(firestore, 'gameTransactions'),
          where('createdAt', '>=', range.fromMs),
          where('createdAt', '<=', range.toMs),
          orderBy('createdAt', 'desc'),
          limit(scopedFetchLimit(limitCount)),
        )
      : query(
          collection(firestore, 'gameTransactions'),
          orderBy('createdAt', 'desc'),
          limit(scopedFetchLimit(limitCount)),
        );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    if (isSuperCountryScope()) return rows;
    await preloadUserCountries(rows.map((t) => String(t.uid ?? '')));
    return rows.filter((t) => isInAdminCountryScope(getCachedUserCountry(String(t.uid ?? ''))));
  } catch (e) {
    console.error('fetchGameTransactionsForAnalytics:', e);
    return [];
  }
}

export interface AdvancedAnalytics {
  dau: number;
  wau: number;
  mau: number;
  retentionRate: number;
  arpu: number;
  arppu: number;
  payingUsers: number;
  conversionRate: number;
  totalRevenue: number;
  newUsersInPeriod: number;
  rangeFiltered: boolean;
  topSpenders: { uid: string; name: string; spent: number }[];
  gameHouseProfit: number;
  gameTotalBets: number;
  gameTotalWins: number;
}

export const getAdvancedAnalytics = async (
  range?: AnalyticsDateRange,
): Promise<AdvancedAnalytics> => {
  const empty: AdvancedAnalytics = {
    dau: 0, wau: 0, mau: 0, retentionRate: 0,
    arpu: 0, arppu: 0, payingUsers: 0, conversionRate: 0,
    totalRevenue: 0, newUsersInPeriod: 0, rangeFiltered: !!range,
    topSpenders: [], gameHouseProfit: 0, gameTotalBets: 0, gameTotalWins: 0,
  };
  try {
    const [usersSnap, txRows, gameRows] = await Promise.all([
      getDocs(collection(firestore, 'users')),
      fetchTransactionsForAnalytics(range),
      fetchGameTransactionsForAnalytics(range),
    ]);

    const now = Date.now();
    const dayAgo = now - 86400000;
    const weekAgo = now - 7 * 86400000;
    const monthAgo = now - 30 * 86400000;

    let dau = 0;
    let wau = 0;
    let mau = 0;
    let registeredWeekAgo = 0;
    let stillActiveFromWeekAgo = 0;
    let scopedUserCount = 0;
    let newUsersInPeriod = 0;
    const nameMap: Record<string, string> = {};

    usersSnap.forEach((d) => {
      const u = d.data();
      const country = countryFromUserDoc(u as Record<string, unknown>);
      if (!isInAdminCountryScope(country)) return;
      scopedUserCount++;
      nameMap[d.id] = u.displayName ?? 'مستخدم';
      const seen = u.lastSeen ?? u.createdAt ?? 0;
      const created = u.createdAt ?? 0;

      if (range) {
        if (seen >= range.fromMs && seen <= range.toMs) dau++;
        if (created >= range.fromMs && created <= range.toMs) newUsersInPeriod++;
        wau = newUsersInPeriod;
        mau = scopedUserCount;
      } else {
      if (seen >= dayAgo) dau++;
      if (seen >= weekAgo) wau++;
      if (seen >= monthAgo) mau++;
        if (created <= weekAgo) {
        registeredWeekAgo++;
        if (seen >= weekAgo) stillActiveFromWeekAgo++;
        }
      }
    });

    const retentionRate = range
      ? 0
      : registeredWeekAgo > 0
        ? Math.round((stillActiveFromWeekAgo / registeredWeekAgo) * 100)
        : 0;

    const spentByUser: Record<string, number> = {};
    let totalRevenue = 0;
    for (const t of txRows) {
      if (!txInRange(t.createdAt, range)) continue;
      if (t.type === 'recharge' && t.status === 'completed') {
        const amt = Math.abs(t.amount ?? 0);
        totalRevenue += amt;
        const uid = String(t.uid ?? '');
        if (uid) spentByUser[uid] = (spentByUser[uid] ?? 0) + amt;
      }
    }

    const payingUsers = Object.keys(spentByUser).length;
    const arpu = scopedUserCount > 0 ? Math.round(totalRevenue / scopedUserCount) : 0;
    const arppu = payingUsers > 0 ? Math.round(totalRevenue / payingUsers) : 0;
    const conversionRate = scopedUserCount > 0
      ? Math.round((payingUsers / scopedUserCount) * 1000) / 10
      : 0;

    const topSpenders = Object.entries(spentByUser)
      .map(([uid, spent]) => ({ uid, name: nameMap[uid] ?? 'مستخدم', spent }))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 10);

    let gameTotalBets = 0;
    let gameTotalWins = 0;
    for (const t of gameRows) {
      if (!txInRange(t.createdAt, range)) continue;
      gameTotalBets += (t as any).stake ?? 0;
      gameTotalWins += (t as any).winAmount ?? 0;
    }
    const gameHouseProfit = gameTotalBets - gameTotalWins;

    return {
      dau,
      wau,
      mau,
      retentionRate,
      arpu,
      arppu,
      payingUsers,
      conversionRate,
      totalRevenue,
      newUsersInPeriod,
      rangeFiltered: !!range,
      topSpenders,
      gameHouseProfit,
      gameTotalBets,
      gameTotalWins,
    };
  } catch (e) {
    console.error('getAdvancedAnalytics:', e);
    return empty;
  }
};

export const getTransactions = async (
  limitCount = 100,
  range?: AnalyticsDateRange,
): Promise<AdminTransaction[]> => {
  try {
    const fetchLimit = range ? Math.max(limitCount * 4, 500) : scopedFetchLimit(limitCount);
    const q = range
      ? query(
          collection(firestore, 'transactions'),
          where('createdAt', '>=', range.fromMs),
          where('createdAt', '<=', range.toMs),
          orderBy('createdAt', 'desc'),
          limit(fetchLimit),
        )
      : query(
          collection(firestore, 'transactions'),
          orderBy('createdAt', 'desc'),
          limit(scopedFetchLimit(limitCount)),
        );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    if (isSuperCountryScope()) return rows.slice(0, limitCount);
    await preloadUserCountries(rows.map((t) => String(t.uid ?? '')));
    const filtered: AdminTransaction[] = [];
    for (const t of rows) {
      if (isInAdminCountryScope(await getUserCountry(String(t.uid ?? '')))) {
        filtered.push(t);
      }
      if (filtered.length >= limitCount) break;
    }
    return filtered;
  } catch (e) {
    console.error('getTransactions:', e);
    return [];
  }
};

// ==================== POSTS / MOMENTS ====================
export interface AdminPost {
  id: string;
  uid: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  images?: string[];
  hashtags?: string[];
  likes: number;
  comments: number;
  shares: number;
  status: 'active' | 'hidden' | 'removed';
  createdAt: number;
}

export const getPosts = async (limitCount = 100): Promise<AdminPost[]> => {
  try {
    const q = query(
      collection(firestore, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(scopedFetchLimit(limitCount)),
    );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        uid: String(data.uid ?? ''),
        authorName: String(data.authorName ?? 'مستخدم'),
        authorAvatar: String(data.authorAvatar ?? ''),
        text: String(data.text ?? ''),
        images: Array.isArray(data.images) ? (data.images as string[]) : [],
        hashtags: Array.isArray(data.hashtags) ? (data.hashtags as string[]) : [],
        likes: Number(data.likes ?? 0),
        comments: Number(data.comments ?? 0),
        shares: Number(data.shares ?? 0),
        status: (data.status as AdminPost['status']) ?? 'active',
        createdAt: Number(data.createdAt ?? 0),
      };
    });
    if (isSuperCountryScope()) return rows.slice(0, limitCount);
    await preloadUserCountries(rows.map((p) => p.uid));
    return rows
      .filter((p) => isInAdminCountryScope(getCachedUserCountry(p.uid)))
      .slice(0, limitCount);
  } catch (e) {
    console.error('getPosts:', e);
    return [];
  }
};

async function assertPostIdInScope(postId: string): Promise<void> {
  const snap = await getDoc(doc(firestore, 'posts', postId));
  if (!snap.exists()) throw new Error('المنشور غير موجود');
  const uid = String((snap.data() as Record<string, unknown>).uid ?? '');
  await assertUidInAdminCountryScope(uid);
}

export const hidePost = async (postId: string): Promise<void> => {
  await assertPostIdInScope(postId);
  await updateDoc(doc(firestore, 'posts', postId), { status: 'hidden' });
};

export const restorePost = async (postId: string): Promise<void> => {
  await assertPostIdInScope(postId);
  await updateDoc(doc(firestore, 'posts', postId), { status: 'active' });
};

export const deletePostAdmin = async (postId: string): Promise<void> => {
  await assertPostIdInScope(postId);
  const fn = httpsCallable<{ postId: string }, { ok: boolean; deleted?: boolean }>(
    functions,
    'adminDeletePost',
  );
  await fn({ postId });
};

/** يضيف status: active للمنشورات القديمة — عبر Cloud Function (أدمن) */
export const backfillPostStatuses = async (): Promise<number> => {
  const { httpsCallable } = await import('firebase/functions');
  const { functions } = await import('@/lib/firebase');
  try {
    const fn = httpsCallable<unknown, { updated: number }>(functions, 'backfillPostStatuses');
    const result = await fn({});
    return result.data.updated ?? 0;
  } catch {
    // fallback: تحديث مباشر من اللوحة إن فشلت الدالة
    const snap = await getDocs(query(collection(firestore, 'posts'), limit(500)));
    let updated = 0;
    await Promise.all(
      snap.docs.map(async (d) => {
        if (!d.data().status) {
          await updateDoc(d.ref, { status: 'active' });
          updated += 1;
        }
      }),
    );
    return updated;
  }
};

// ==================== AGENCY APPLICATIONS ====================
export interface AdminAgencyApplication {
  id: string;
  applicantUid: string;
  applicantName: string;
  applicantPhone: string;
  countryCode: string;
  agencyName: string;
  status: string;
  proposedHosts: Array<{
    uid: string;
    displayName: string;
    avatar?: string;
    profileGender?: string;
    genderVerified?: boolean;
    verifiedAt?: number;
    verifiedBy?: string;
  }>;
  proposedHostUids: string[];
  minHostsRequired: number;
  femaleHostCount?: number;
  applicantPublicAccountId?: string;
  whatsappNumber?: string;
  assignedTeam?: 'gcc' | 'global';
  reviewDeadline?: number;
  inviteCode?: string;
  hostsDeadline?: number;
  source?: string;
  rejectionReason?: string;
  agencyId?: string;
  createdAt: number;
  updatedAt: number;
}

export const getAgencyApplications = async (): Promise<AdminAgencyApplication[]> => {
  try {
    const snap = await getDocs(
      query(collection(firestore, 'agencyApplications'), limit(200)),
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as object) }) as AdminAgencyApplication)
      .filter((a) => isInAdminCountryScope(a.countryCode))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } catch (e) {
    console.error('getAgencyApplications:', e);
    return [];
  }
};

export const reviewAgencyApplicationAdmin = async (
  applicationId: string,
  action: 'approve' | 'reject',
  rejectionReason?: string,
) => {
  const fn = httpsCallable(functions, 'reviewAgencyApplication');
  return fn({ applicationId, action, rejectionReason });
};

export const adminVerifyAgencyHostAdmin = async (
  applicationId: string,
  hostUid: string,
) => {
  const fn = httpsCallable(functions, 'adminVerifyAgencyHost');
  return fn({ applicationId, hostUid });
};

export const activateAgencyApplicationAdmin = async (applicationId: string) => {
  const fn = httpsCallable(functions, 'activateAgencyApplication');
  return fn({ applicationId });
};

export const adminExpressActivateApplication = async (applicationId: string) => {
  const fn = httpsCallable(functions, 'adminExpressActivateApplication');
  return fn({ applicationId });
};

export const adminCreateAgencyDirect = async (input: {
  ownerUid: string;
  agencyName: string;
  countryCode?: string;
  hostUids?: string[];
  applicationId?: string;
}) => {
  const fn = httpsCallable(functions, 'adminCreateAgencyDirect');
  return fn(input);
};

export const getAgencyApplicationStats = async (): Promise<{
  pending: number;
  awaiting_hosts: number;
  ready: number;
  total: number;
}> => {
  const list = await getAgencyApplications();
  return {
    pending: list.filter((a) => a.status === 'pending').length,
    awaiting_hosts: list.filter((a) => a.status === 'awaiting_hosts').length,
    ready: list.filter((a) => a.status === 'ready').length,
    total: list.length,
  };
};

export const countVerifiedHosts = (app: AdminAgencyApplication): number =>
  (app.proposedHosts ?? []).filter((h) => h.genderVerified).length;

/** عدد المضيفات الإناث الموثّقات (من الطلب أو سجل الوكالة) */
export const agencyFemaleHostCount = (
  app: AdminAgencyApplication,
  agency?: AgencyDoc | null,
): number => {
  const fromAgency = agency?.femaleHostCount;
  if (typeof fromAgency === 'number' && fromAgency >= 0) return fromAgency;
  const fromApp = app.femaleHostCount;
  if (typeof fromApp === 'number' && fromApp >= 0) return fromApp;
  return countVerifiedHosts(app);
};

export interface AgencyMember {
  id: string;
  uid: string;
  uidName: string;
  uidAvatar?: string;
  agencyId: string;
  role: string;
  hostVerified: boolean;
  isFemaleHost: boolean;
  verifiedAt?: number;
  verifiedBy?: string;
  joinedAt: number;
}

export interface AgencyDoc {
  id: string;
  name: string;
  femaleHostCount: number;
  minHostsRequired: number;
  memberCount: number;
  status: string;
  inviteCode?: string;
  hostsDeadline?: number;
}

export const getAgencyById = async (agencyId: string): Promise<AgencyDoc | null> => {
  try {
    const snap = await getDoc(doc(firestore, 'agencies', agencyId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as object) } as AgencyDoc;
  } catch {
    return null;
  }
};

export const getAgencyMembers = async (agencyId: string): Promise<AgencyMember[]> => {
  await assertAgencyIdInScope(agencyId);
  try {
    const snap = await getDocs(
      query(collection(firestore, 'agencyMembers'), where('agencyId', '==', agencyId), limit(200)),
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as object) }) as AgencyMember)
      .sort((a, b) => (b.joinedAt ?? 0) - (a.joinedAt ?? 0));
  } catch {
    return [];
  }
};

// ==================== AGENCY DETAIL (تفاصيل وتحكّم كامل) ====================

/** تفاصيل الوكالة الكاملة كما هي في Firestore */
export interface AgencyFullDetail {
  id: string;
  name: string;
  ownerUid: string;
  ownerName: string;
  country: string;
  status: string;
  isVerified: boolean;
  inviteCode: string;
  memberCount: number;
  femaleHostCount: number;
  minHostsRequired: number;
  earnings: number;
  rating: number;
  createdAt: number;
  hostsDeadline?: number;
  liveRoomId?: string;
  maxSeatsCount?: number;
  /** مستوى الفترة (1–15) — من Firestore أو الغرفة */
  periodLevel?: number;
  /** true = المستوى مُحدَّد يدوياً من لوحة التحكم */
  periodLevelManual?: boolean;
  /** المستوى المطبّق حالياً على غرفة RTDB */
  appliedPeriodLevel?: number;
}

/** عضو وكالة مدمج مع محفظته من وثيقة المستخدم */
export interface AgencyMemberDetailed extends AgencyMember {
  coins: number;
  pearls: number;
  pearlsEarned: number;
  pearlsTransferredToAgent: number;
  availablePearls: number;
  isBanned: boolean;
  avatar: string;
  displayName: string;
  lastSeen: number;
  country: string;
  level: number;
}

export const getAgencyFullDetail = async (
  agencyId: string,
): Promise<AgencyFullDetail | null> => {
  try {
    const snap = await getDoc(doc(firestore, 'agencies', agencyId));
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    const country = String(d.country ?? d.countryCode ?? '—');
    if (!isInAdminCountryScope(country)) return null;
    const liveRoomId = d.liveRoomId ? String(d.liveRoomId) : undefined;
    const storedLevel = Number(d.periodLevel) || 0;
    let appliedPeriodLevel: number | undefined;
    if (liveRoomId) {
      try {
        const roomSnap = await rtdbGet(ref(realtimeDb, `rooms/${liveRoomId}`));
        if (roomSnap.exists()) {
          const rv = Number((roomSnap.val() as Record<string, unknown>)?.agencyPeriodLevel);
          if (rv >= 1) appliedPeriodLevel = rv;
        }
      } catch {
        /* ignore RTDB read errors */
      }
    }
    return {
      id: snap.id,
      name: String(d.name ?? d.agencyName ?? '—'),
      ownerUid: String(d.ownerUid ?? ''),
      ownerName: String(d.ownerName ?? '—'),
      country,
      status: String(d.status ?? 'active'),
      isVerified: Boolean(d.isVerified),
      inviteCode: String(d.inviteCode ?? ''),
      memberCount: Number(d.memberCount ?? d.members ?? 0) || 0,
      femaleHostCount: Number(d.femaleHostCount ?? 0) || 0,
      minHostsRequired: Number(d.minHostsRequired ?? 0) || 0,
      earnings: Number(d.earnings ?? d.totalEarnings ?? 0) || 0,
      rating: Number(d.rating ?? 0) || 0,
      createdAt: Number(d.createdAt ?? 0) || 0,
      hostsDeadline: d.hostsDeadline ? Number(d.hostsDeadline) : undefined,
      liveRoomId,
      maxSeatsCount: [9, 11, 16, 19, 21].includes(Number(d.maxSeatsCount))
        ? Number(d.maxSeatsCount)
        : 9,
      periodLevel: storedLevel >= 1 ? storedLevel : appliedPeriodLevel,
      periodLevelManual: d.periodLevelManual === true,
      appliedPeriodLevel,
    };
  } catch (e) {
    console.error('getAgencyFullDetail:', e);
    return null;
  }
};

/** الأعضاء + محافظهم (عملات/ماسة) عبر دمج وثيقة المستخدم */
export const getAgencyMembersDetailed = async (
  agencyId: string,
): Promise<AgencyMemberDetailed[]> => {
  const members = await getAgencyMembers(agencyId);
  const enriched = await Promise.all(
    members.map(async (m): Promise<AgencyMemberDetailed> => {
      let coins = 0;
      let pearls = 0;
      let isBanned = false;
      let avatar = m.uidAvatar ?? '';
      let displayName = m.uidName ?? '—';
      let lastSeen = 0;
      let country = '—';
      let level = 0;
      try {
        const uSnap = await getDoc(doc(firestore, 'users', m.uid));
        if (uSnap.exists()) {
          const u = uSnap.data() as any;
          coins = u.stats?.coins ?? u.coins ?? 0;
          pearls = u.stats?.pearls ?? u.pearls ?? 0;
          isBanned = u.isBanned === true;
          avatar = u.avatar ?? u.profile?.avatar ?? avatar;
          displayName = u.displayName ?? u.profile?.displayName ?? displayName;
          lastSeen = Number(u.lastSeen ?? u.lastActive ?? 0) || 0;
          country = String(u.country ?? u.profile?.country ?? '—');
          level = Number(u.level ?? u.stats?.level ?? 0) || 0;
        }
      } catch {}
      const pearlsEarned = Number((m as any).pearlsEarned) || 0;
      const pearlsTransferredToAgent = Number((m as any).pearlsTransferredToAgent) || 0;
      return {
        ...m,
        coins,
        pearls,
        pearlsEarned,
        pearlsTransferredToAgent,
        availablePearls: Math.max(0, pearlsEarned - pearlsTransferredToAgent),
        isBanned,
        avatar,
        displayName,
        lastSeen,
        country,
        level,
      };
    }),
  );
  // ترتيب: المالك ثم الوكلاء ثم الأعلى أرباحاً
  return enriched.sort((a, b) => b.pearlsEarned - a.pearlsEarned);
};

/** تعديل أرباح عضو (pearlsEarned) في الوكالة يدوياً */
export const setAgencyMemberPearlsEarned = async (
  memberDocId: string,
  newPearlsEarned: number,
  agencyId: string,
): Promise<void> => {
  await assertAgencyIdInScope(agencyId);
  await updateDoc(doc(firestore, 'agencyMembers', memberDocId), {
    pearlsEarned: Math.max(0, Math.round(newPearlsEarned)),
  });
};

export interface AssignAgencyMemberResult {
  uid: string;
  displayName: string;
  publicAccountId: string;
  role: string;
  isFemaleHost: boolean;
  alreadyMember: boolean;
}

/**
 * ربط مستخدم بوكالة كمضيف (أنثى موثّقة) أو عضو (ذكر).
 * يقبل Firebase UID أو معرّف الحساب (8 أرقام).
 */
export const assignAgencyMember = async (
  agencyId: string,
  userIdentifier: string,
): Promise<AssignAgencyMemberResult> => {
  await assertAgencyIdInScope(agencyId);

  const uid = await resolveUserAccountId(userIdentifier.trim());
  if (!uid) throw new Error('USER_NOT_FOUND');
  await assertUidInAdminCountryScope(uid);

  const agencyRef = doc(firestore, 'agencies', agencyId);
  const userRef = doc(firestore, 'users', uid);
  const [agencySnap, userSnap] = await Promise.all([getDoc(agencyRef), getDoc(userRef)]);
  if (!agencySnap.exists()) throw new Error('AGENCY_NOT_FOUND');
  if (!userSnap.exists()) throw new Error('USER_NOT_FOUND');

  const agency = agencySnap.data() as Record<string, unknown>;
  const user = userSnap.data() as Record<string, unknown>;
  const agencyName = String(agency.name ?? agency.agencyName ?? '—');
  const ownerUid = String(agency.ownerUid ?? '');

  if (uid === ownerUid) {
    throw new Error('USER_IS_AGENCY_OWNER');
  }

  const activeAgencyId = await resolveUserActiveAgencyId(uid);
  if (activeAgencyId && activeAgencyId !== agencyId) {
    throw new Error('USER_IN_OTHER_AGENCY');
  }

  const ownedAgencySnap = await getDocs(
    query(collection(firestore, 'agencies'), where('ownerUid', '==', uid), limit(1)),
  );
  if (!ownedAgencySnap.empty && ownedAgencySnap.docs[0].id !== agencyId) {
    throw new Error('USER_IN_OTHER_AGENCY');
  }

  const anyMemberSnap = await getDocs(
    query(collection(firestore, 'agencyMembers'), where('uid', '==', uid), limit(5)),
  );
  const otherMemberships = anyMemberSnap.docs
    .map((d) => String(d.data().agencyId ?? '').trim())
    .filter((id) => id && id !== agencyId);
  if (otherMemberships.length > 0) {
    throw new Error('USER_IN_OTHER_AGENCY');
  }

  const existingAgencyId = activeAgencyId ?? '';

  const gender = String((user.profile as any)?.gender ?? user.gender ?? '');
  const isFemale = gender === 'female';
  const isFemaleHost = isFemale;
  const userIsVerified = user.isVerified === true;
  const isVerifiedHost = isFemaleHost && userIsVerified;
  const role = isVerifiedHost ? 'host' : 'member';
  const displayName = String((user.profile as any)?.displayName ?? user.displayName ?? 'مستخدم');
  const avatar = String((user.profile as any)?.avatar ?? user.avatar ?? '');
  const publicAccountId = formatPublicAccountId(
    user.publicAccountId != null ? String(user.publicAccountId) : undefined,
    uid,
  );
  const now = Date.now();
  const adminUid = auth.currentUser?.uid ?? 'admin';

  const existingMemberSnap = await getDocs(
    query(
      collection(firestore, 'agencyMembers'),
      where('uid', '==', uid),
      where('agencyId', '==', agencyId),
      limit(1),
    ),
  );

  if (!existingMemberSnap.empty) {
    const memberDoc = existingMemberSnap.docs[0];
    const memberData = memberDoc.data() as Record<string, unknown>;
    const wasFemaleHost = memberData.isFemaleHost === true;

    if (isFemaleHost && !wasFemaleHost) {
      await updateDoc(memberDoc.ref, {
        role: isVerifiedHost ? 'host' : 'member',
        hostVerified: isVerifiedHost,
        isFemaleHost: true,
        verifiedAt: isVerifiedHost ? now : null,
        verifiedBy: isVerifiedHost ? adminUid : null,
      });
      await updateDoc(userRef, {
        agencyId,
        agencyName,
        agencyRole: isVerifiedHost ? 'host' : 'member',
        accountKind: isVerifiedHost ? 'host' : 'member',
        isFemaleHost: true,
      });
      if (isVerifiedHost) {
      await updateDoc(agencyRef, {
        femaleHostCount: increment(1),
        updatedAt: now,
      });
      }
    }

    return {
      uid,
      displayName,
      publicAccountId,
      role: isVerifiedHost ? 'host' : String(memberData.role ?? 'member'),
      isFemaleHost: isFemaleHost || wasFemaleHost,
      alreadyMember: true,
    };
  }

  const memberRef = doc(collection(firestore, 'agencyMembers'));
  const isNewToAgency = !existingAgencyId;

  await deleteDoc(doc(firestore, 'agencies', agencyId, 'removedMembers', uid)).catch(() => {});

  await setDoc(memberRef, {
    uid,
    uidName: displayName,
    uidAvatar: avatar,
    agencyId,
    agencyName,
    role,
    hostVerified: isVerifiedHost,
    isFemaleHost,
    verifiedAt: isVerifiedHost ? now : null,
    verifiedBy: isVerifiedHost ? adminUid : null,
    pearlsEarned: 0,
    pearlsTransferredToAgent: 0,
    joinedAt: now,
  });

  const userPatch: Record<string, unknown> = {
    agencyId,
    agencyName,
    agencyRole: role,
  };
  if (isFemaleHost) {
    userPatch.accountKind = isVerifiedHost ? 'host' : 'member';
    userPatch.isFemaleHost = true;
  } else {
    userPatch.accountKind = 'member';
    userPatch.isFemaleHost = false;
  }
  await updateDoc(userRef, userPatch);

  const agencyPatch: Record<string, unknown> = { updatedAt: now };
  if (isNewToAgency) {
    agencyPatch.memberCount = increment(1);
  }
  if (isVerifiedHost) {
    agencyPatch.femaleHostCount = increment(1);
  }
  await updateDoc(agencyRef, agencyPatch);

  return {
    uid,
    displayName,
    publicAccountId,
    role,
    isFemaleHost,
    alreadyMember: false,
  };
};

/** إزالة عضو من الوكالة عبر Cloud Function (تنظيف شات + حظر إعادة الانضمام + إشعارات) */
export const removeAgencyMember = async (
  memberDocId: string,
  uid: string,
  agencyId: string,
  _wasFemaleHost: boolean,
): Promise<void> => {
  await assertAgencyIdInScope(agencyId);
  await assertUidInAdminCountryScope(uid);
  const fn = httpsCallable<{ memberDocId: string; asAdmin: boolean }, { ok: boolean }>(
    functions,
    'removeAgencyMember',
  );
  await fn({ memberDocId, asAdmin: true });
};

/** تعديل بيانات الوكالة (الاسم / الحد الأدنى للمضيفات) */
export const updateAgencyInfo = async (
  agencyId: string,
  data: { name?: string; minHostsRequired?: number },
): Promise<void> => {
  await assertAgencyIdInScope(agencyId);
  const payload: Record<string, unknown> = {};
  if (typeof data.name === 'string' && data.name.trim()) payload.name = data.name.trim();
  if (typeof data.minHostsRequired === 'number' && data.minHostsRequired >= 0) {
    payload.minHostsRequired = Math.round(data.minHostsRequired);
  }
  if (Object.keys(payload).length === 0) return;
  await updateDoc(doc(firestore, 'agencies', agencyId), payload);
};

export const AGENCY_SEAT_OPTIONS = [9, 11, 16, 19, 21] as const;
export type AgencySeatCount = (typeof AGENCY_SEAT_OPTIONS)[number];

export const AGENCY_LEVEL_MIN = 1;
export const AGENCY_LEVEL_MAX = 999;
export const AGENCY_THRONE_UNLOCK_LEVEL = 15;
export const AGENCY_LEVEL_OPTIONS = Array.from(
  { length: 50 },
  (_, i) => i + 1,
) as readonly number[];
export type AgencyPeriodLevel = (typeof AGENCY_LEVEL_OPTIONS)[number];

function rebuildRoomSeatsForCount(
  roomData: Record<string, unknown>,
  newSeatsCount: number,
): Record<string, unknown> {
  const hostUid = String(roomData.hostUid ?? '');
  const prevSeats = (roomData.seats ?? {}) as Record<string, Record<string, unknown>>;
  const hostSeat = prevSeats.seat_0 ?? {};
  const seats: Record<string, unknown> = {};
  for (let i = 0; i < newSeatsCount; i++) {
    if (i === 0) {
      seats[`seat_${i}`] = {
        uid: hostUid,
        displayName: hostSeat.displayName ?? roomData.hostName ?? 'مضيف',
        avatar: hostSeat.avatar ?? roomData.hostAvatar ?? '',
        isMuted: false,
        coins: typeof hostSeat.coins === 'number' ? hostSeat.coins : 0,
        level: typeof hostSeat.level === 'number' ? hostSeat.level : 1,
        isVIP: hostSeat.isVIP === true,
        vipLevel: typeof hostSeat.vipLevel === 'number' ? hostSeat.vipLevel : 0,
        joinedAt: typeof hostSeat.joinedAt === 'number' ? hostSeat.joinedAt : Date.now(),
      };
    } else {
      seats[`seat_${i}`] = { uid: '' };
    }
  }
  for (const [key, seat] of Object.entries(prevSeats)) {
    const idx = parseInt(String(key).replace('seat_', ''), 10);
    if (idx === 0 || Number.isNaN(idx) || idx >= newSeatsCount) continue;
    if (seat?.uid && String(seat.uid) !== '') {
      seats[key] = { ...seat };
    }
  }
  return seats;
}

/** زيادة/تعديل الحد الأقصى لعدد المايكات في غرفة الوكالة */
export const setAgencyMaxSeatsCount = async (
  agencyId: string,
  maxSeatsCount: AgencySeatCount,
  options?: { applySeatsToLiveRoom?: AgencySeatCount },
): Promise<void> => {
  await assertAgencyIdInScope(agencyId);
  if (!AGENCY_SEAT_OPTIONS.includes(maxSeatsCount)) {
    throw new Error('عدد المايكات غير مدعوم');
  }

  const agencySnap = await getDoc(doc(firestore, 'agencies', agencyId));
  if (!agencySnap.exists()) throw new Error('الوكالة غير موجودة');
  const agency = agencySnap.data() as Record<string, unknown>;
  const liveRoomId = String(agency.liveRoomId ?? '');

  await updateDoc(doc(firestore, 'agencies', agencyId), {
    maxSeatsCount,
    updatedAt: Date.now(),
  });

  if (!liveRoomId) return;

  const { update } = await import('firebase/database');
  const roomRef = ref(realtimeDb, `rooms/${liveRoomId}`);
  const roomSnap = await rtdbGet(roomRef);
  if (!roomSnap.exists()) return;

  const roomData = roomSnap.val() as Record<string, unknown>;
  const patch: Record<string, unknown> = {
    maxSeatsCount,
    updatedAt: Date.now(),
  };

  const applyCount = options?.applySeatsToLiveRoom;
  if (applyCount != null) {
    if (!AGENCY_SEAT_OPTIONS.includes(applyCount)) {
      throw new Error('عدد المايكات غير مدعوم');
    }
    if (applyCount > maxSeatsCount) {
      throw new Error('لا يمكن تطبيق عدد أكبر من الحد المسموح');
    }
    patch.seatsCount = applyCount;
    patch.seats = rebuildRoomSeatsForCount(roomData, applyCount);
  }

  await update(roomRef, patch);
};

/** تعديل مستوى الوكالة (1–15) — يُطبَّق على Firestore وغرفة RTDB */
export const setAgencyPeriodLevel = async (
  agencyId: string,
  level: number,
): Promise<void> => {
  await assertAgencyIdInScope(agencyId);
  const lv = Math.round(Number(level));
  if (lv < AGENCY_LEVEL_MIN || lv > AGENCY_LEVEL_MAX) {
    throw new Error(`المستوى يجب أن يكون بين ${AGENCY_LEVEL_MIN} و ${AGENCY_LEVEL_MAX}`);
  }

  const agencySnap = await getDoc(doc(firestore, 'agencies', agencyId));
  if (!agencySnap.exists()) throw new Error('الوكالة غير موجودة');
  const agency = agencySnap.data() as Record<string, unknown>;
  const liveRoomId = String(agency.liveRoomId ?? '');
  const agencyName = String(agency.name ?? agency.agencyName ?? agencyId);

  await updateDoc(doc(firestore, 'agencies', agencyId), {
    periodLevel: lv,
    periodLevelManual: true,
    updatedAt: Date.now(),
  });

  if (!liveRoomId) return;

  const { update } = await import('firebase/database');
  const roomRef = ref(realtimeDb, `rooms/${liveRoomId}`);
  const roomSnap = await rtdbGet(roomRef);
  if (!roomSnap.exists()) return;

  const patch: Record<string, unknown> = {
    agencyPeriodLevel: lv,
    updatedAt: Date.now(),
  };
  if (lv < AGENCY_THRONE_UNLOCK_LEVEL) {
    patch.throneEnabled = false;
  }
  await update(roomRef, patch);

  await logAdminAction('تعديل مستوى الوكالة', `${agencyName} → L${lv}`, agencyId);
};

/** إلغاء التعديل اليدوي — يعود الحساب التلقائي من أرباح الأسبوع */
export const clearAgencyPeriodLevelOverride = async (agencyId: string): Promise<void> => {
  await assertAgencyIdInScope(agencyId);
  const agencySnap = await getDoc(doc(firestore, 'agencies', agencyId));
  if (!agencySnap.exists()) throw new Error('الوكالة غير موجودة');
  const agency = agencySnap.data() as Record<string, unknown>;
  const agencyName = String(agency.name ?? agency.agencyName ?? agencyId);

  await updateDoc(doc(firestore, 'agencies', agencyId), {
    periodLevelManual: false,
    updatedAt: Date.now(),
  });

  await logAdminAction('إلغاء تعديل مستوى الوكالة اليدوي', agencyName, agencyId);
};

/** تطبيق عدد المقاعد/المايكات على أي غرفة RTDB (عادية أو وكالة) */
export const setRoomSeatsCount = async (
  roomId: string,
  seatsCount: AgencySeatCount,
  options?: { syncAgencyMax?: boolean },
): Promise<void> => {
  if (!AGENCY_SEAT_OPTIONS.includes(seatsCount)) {
    throw new Error('عدد المقاعد غير مدعوم');
  }

  const rooms = await getRooms();
  const listed = rooms.find((r) => r.id === roomId);
  if (listed) assertCountryAccess(listed.country);

  const { update } = await import('firebase/database');
  const roomRef = ref(realtimeDb, `rooms/${roomId}`);
  const roomSnap = await rtdbGet(roomRef);
  if (!roomSnap.exists()) throw new Error('الغرفة غير موجودة');

  const roomData = roomSnap.val() as Record<string, unknown>;
  const patch: Record<string, unknown> = {
    seatsCount,
    maxSeatsCount: seatsCount,
    seats: rebuildRoomSeatsForCount(roomData, seatsCount),
    updatedAt: Date.now(),
  };
  await update(roomRef, patch);

  const agencyId = String(roomData.agencyId ?? '');
  if (options?.syncAgencyMax !== false && agencyId) {
    try {
      await updateDoc(doc(firestore, 'agencies', agencyId), {
        maxSeatsCount: seatsCount,
        updatedAt: Date.now(),
      });
    } catch {
      /* الوكالة قد تكون محذوفة */
    }
  }
};

export type AgencySeatRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AdminAgencySeatRequest {
  id: string;
  agencyId: string;
  roomId: string;
  requesterUid: string;
  requesterName: string;
  requestedSeatsCount: AgencySeatCount;
  currentMaxSeats: number;
  currentSeatsCount: number;
  status: AgencySeatRequestStatus;
  createdAt: number;
  updatedAt: number;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: number;
}

export const getAgencySeatRequests = async (
  agencyId: string,
  status: AgencySeatRequestStatus = 'pending',
): Promise<AdminAgencySeatRequest[]> => {
  await assertAgencyIdInScope(agencyId);
  const q = query(
    collection(firestore, 'agencySeatRequests'),
    where('agencyId', '==', agencyId),
    where('status', '==', status),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as AdminAgencySeatRequest))
    .sort((a, b) => b.createdAt - a.createdAt);
};

export const reviewAgencySeatRequest = async (
  requestId: string,
  action: 'approve' | 'reject',
  options?: { applyToRoom?: boolean; rejectionReason?: string },
): Promise<void> => {
  const reqRef = doc(firestore, 'agencySeatRequests', requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) throw new Error('الطلب غير موجود');
  const req = { id: reqSnap.id, ...reqSnap.data() } as AdminAgencySeatRequest;
  if (req.status !== 'pending') throw new Error('تمت معالجة هذا الطلب مسبقاً');

  await assertAgencyIdInScope(req.agencyId);

  if (action === 'approve') {
    const applyCount = options?.applyToRoom ? req.requestedSeatsCount : undefined;
    await setAgencyMaxSeatsCount(req.agencyId, req.requestedSeatsCount, {
      applySeatsToLiveRoom: applyCount,
    });
    await updateDoc(reqRef, {
      status: 'approved',
      updatedAt: Date.now(),
      reviewedAt: Date.now(),
      reviewedBy: auth.currentUser?.uid ?? '',
    });
    await logAdminAction(
      'الموافقة على طلب زيادة المايكات',
      `${req.requesterName} → ${req.requestedSeatsCount}`,
      req.agencyId,
    );
    return;
  }

  await updateDoc(reqRef, {
    status: 'rejected',
    updatedAt: Date.now(),
    reviewedAt: Date.now(),
    reviewedBy: auth.currentUser?.uid ?? '',
    rejectionReason: options?.rejectionReason?.trim() || 'مرفوض',
  });
  await logAdminAction(
    'رفض طلب زيادة المايكات',
    `${req.requesterName} → ${req.requestedSeatsCount}`,
    req.agencyId,
  );
};

export type AgencyPartyRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface AdminAgencyPartyRequest {
  id: string;
  agencyId: string;
  agencyName?: string;
  roomId: string;
  requesterUid: string;
  requesterName: string;
  description: string;
  coverUrl?: string;
  eventType: string;
  startAt: number;
  durationMinutes: number;
  allowPublicPromotion: boolean;
  status: AgencyPartyRequestStatus;
  createdAt: number;
  updatedAt: number;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: number;
  stoppedAt?: number;
  stoppedBy?: string;
  stopReason?: string;
}

export const PARTY_EVENT_TYPE_LABELS: Record<string, string> = {
  dating: 'تعارف وعلاقات',
  music: 'موسيقى',
  games: 'ألعاب',
  talk: 'حوار ونقاش',
  celebration: 'احتفالات',
  other: 'أخرى',
};

export type PartyLifecyclePhase =
  | 'pending'
  | 'scheduled'
  | 'live'
  | 'ended'
  | 'cancelled'
  | 'rejected';

export const PARTY_LIFECYCLE_LABELS: Record<PartyLifecyclePhase, string> = {
  pending: 'بانتظار الموافقة',
  scheduled: 'مجدولة',
  live: 'قائمة الآن',
  ended: 'منتهية',
  cancelled: 'موقوفة',
  rejected: 'مرفوضة',
};

export function partyEventEndAt(
  item: Pick<AdminAgencyPartyRequest, 'startAt' | 'durationMinutes' | 'stoppedAt'>,
): number {
  const naturalEnd = item.startAt + item.durationMinutes * 60_000;
  if (item.stoppedAt && item.stoppedAt >= item.startAt && item.stoppedAt < naturalEnd) {
    return item.stoppedAt;
  }
  return naturalEnd;
}

export function getPartyLifecyclePhase(
  item: AdminAgencyPartyRequest,
  now = Date.now(),
): PartyLifecyclePhase {
  if (item.status === 'pending') return 'pending';
  if (item.status === 'rejected') return 'rejected';
  if (item.status === 'cancelled') return 'cancelled';
  if (item.status === 'approved') {
    const endAt = partyEventEndAt(item);
    if (now >= endAt) return 'ended';
    if (now < item.startAt) return 'scheduled';
    return 'live';
  }
  return 'ended';
}

export interface AdminPartyLiveStats {
  audienceCount: number;
  roomMemberCount: number;
  supportCoins: number;
  giftCount: number;
}

export async function getPartyLiveStats(
  roomId: string,
  window: { from: number; to: number },
): Promise<AdminPartyLiveStats> {
  const empty: AdminPartyLiveStats = {
    audienceCount: 0,
    roomMemberCount: 0,
    supportCoins: 0,
    giftCount: 0,
  };
  if (!roomId) return empty;
  try {
    const [audSnap, roomSnap, msgSnap] = await Promise.all([
      rtdbGet(ref(realtimeDb, `roomAudience/${roomId}`)),
      rtdbGet(ref(realtimeDb, `rooms/${roomId}`)),
      rtdbGet(
        rtdbQuery(
          ref(realtimeDb, `roomMessages/${roomId}`),
          orderByChild('createdAt'),
          limitToLast(250),
        ),
      ),
    ]);
    let audienceCount = 0;
    if (audSnap.exists()) {
      audienceCount = Object.keys(audSnap.val() ?? {}).length;
    }
    let roomMemberCount = audienceCount;
    if (roomSnap.exists()) {
      roomMemberCount = Number(roomSnap.val()?.memberCount ?? 0) || audienceCount;
    }
    let supportCoins = 0;
    let giftCount = 0;
    if (msgSnap.exists()) {
      for (const msg of Object.values(msgSnap.val() ?? {}) as Array<Record<string, unknown>>) {
        if (msg.type !== 'gift') continue;
        const ts = typeof msg.createdAt === 'number' ? msg.createdAt : 0;
        if (ts < window.from || ts > window.to) continue;
        const qty = Number(msg.giftQuantity) || 1;
        const val = Number(msg.giftValue) || 0;
        supportCoins += val * qty;
        giftCount += qty;
      }
    }
    return { audienceCount, roomMemberCount, supportCoins, giftCount };
  } catch (e) {
    console.error('getPartyLiveStats:', e);
    return empty;
  }
}

export const getAgencyPartyRequests = async (
  agencyId: string,
  status: AgencyPartyRequestStatus = 'pending',
): Promise<AdminAgencyPartyRequest[]> => {
  await assertAgencyIdInScope(agencyId);
  const q = query(
    collection(firestore, 'agencyPartyRequests'),
    where('agencyId', '==', agencyId),
    where('status', '==', status),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as AdminAgencyPartyRequest))
    .sort((a, b) => b.createdAt - a.createdAt);
};

/** كل طلبات الحفلات المعلّقة ضمن نطاق دول الأدمن */
export const getAllPendingPartyRequests = async (): Promise<AdminAgencyPartyRequest[]> => {
  try {
    const agencies = await getAgencies();
    const scopedIds = new Set(agencies.map((a) => a.id));
    const q = query(
      collection(firestore, 'agencyPartyRequests'),
      where('status', '==', 'pending'),
      limit(100),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as AdminAgencyPartyRequest))
      .filter((r) => scopedIds.has(r.agencyId))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (e) {
    console.error('getAllPendingPartyRequests:', e);
    return [];
  }
};

export const getPendingPartyRequestsCount = async (): Promise<number> => {
  const list = await getAllPendingPartyRequests();
  return list.length;
};

export const reviewAgencyPartyRequest = async (
  requestId: string,
  action: 'approve' | 'reject',
  options?: { rejectionReason?: string },
): Promise<void> => {
  const reqRef = doc(firestore, 'agencyPartyRequests', requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) throw new Error('الطلب غير موجود');
  const req = { id: reqSnap.id, ...reqSnap.data() } as AdminAgencyPartyRequest;
  if (req.status !== 'pending') throw new Error('تمت معالجة هذا الطلب مسبقاً');

  await assertAgencyIdInScope(req.agencyId);

  if (action === 'approve') {
    await updateDoc(reqRef, {
      status: 'approved',
      updatedAt: Date.now(),
      reviewedAt: Date.now(),
      reviewedBy: auth.currentUser?.uid ?? '',
    });
    await logAdminAction(
      'الموافقة على طلب حفلة',
      `${req.requesterName}: ${req.description.slice(0, 40)}`,
      req.agencyId,
    );
    return;
  }

  await updateDoc(reqRef, {
    status: 'rejected',
    updatedAt: Date.now(),
    reviewedAt: Date.now(),
    reviewedBy: auth.currentUser?.uid ?? '',
    rejectionReason: options?.rejectionReason?.trim() || 'مرفوض',
  });
  await logAdminAction(
    'رفض طلب حفلة',
    `${req.requesterName}: ${req.description.slice(0, 40)}`,
    req.agencyId,
  );
};

/** كل فعاليات/حفلات الوكالة (كل الحالات) */
export const getAgencyPartyEventsAll = async (
  agencyId: string,
): Promise<AdminAgencyPartyRequest[]> => {
  await assertAgencyIdInScope(agencyId);
  const q = query(
    collection(firestore, 'agencyPartyRequests'),
    where('agencyId', '==', agencyId),
    limit(100),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as AdminAgencyPartyRequest))
    .sort((a, b) => b.startAt - a.startAt);
};

/** إيقاف حفلة/فعالية (قائمة أو مجدولة) — تختفي من التطبيق فوراً */
export const stopAgencyPartyEvent = async (
  requestId: string,
  options?: { reason?: string },
): Promise<void> => {
  const reqRef = doc(firestore, 'agencyPartyRequests', requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) throw new Error('الفعالية غير موجودة');
  const req = { id: reqSnap.id, ...reqSnap.data() } as AdminAgencyPartyRequest;
  await assertAgencyIdInScope(req.agencyId);

  const phase = getPartyLifecyclePhase(req);
  if (phase !== 'live' && phase !== 'scheduled') {
    if (req.status === 'pending') throw new Error('الطلب لم يُوافق عليه بعد — استخدم رفض الطلب');
    throw new Error('لا يمكن إيقاف هذه الفعالية');
  }
  if (req.status !== 'approved') {
    throw new Error('يمكن إيقاف الفعاليات الموافق عليها فقط');
  }

  const reason = options?.reason?.trim() || 'أوقفتها الإدارة';
  await updateDoc(reqRef, {
    status: 'cancelled',
    stoppedAt: Date.now(),
    stoppedBy: auth.currentUser?.uid ?? '',
    stopReason: reason,
    updatedAt: Date.now(),
  });
  await logAdminAction(
    'إيقاف حفلة/فعالية',
    `${req.description.slice(0, 40)} — ${reason}`,
    req.agencyId,
  );
};

// ===== نشاط الوكالة المالي (هدايا/أرباح/تحويلات) =====

const PEARL_INCOME_TX_TYPES = new Set([
  'gift_received', 'call_earning', 'transfer_received',
  'treasure_won', 'seat_fee_received', 'lucky_bag_won', 'locked_media_earn',
]);

export interface AgencyActivityTx {
  id: string;
  uid: string;
  memberName: string;
  type: string;
  amount: number;
  currency: string;
  callType?: string;
  fromUid?: string;
  createdAt: number;
}

export interface AgencyActivity {
  recent: AgencyActivityTx[];
  /** مجاميع آخر 7 أيام (الأقدم→الأحدث) */
  weekly: { day: string; total: number }[];
  totalLast7d: number;
}

/**
 * يجمع معاملات الدخل لأعضاء الوكالة (لكل عضو أحدث معاملاته) ويبني سجلاً + رسماً أسبوعياً.
 * يستخدم فهرس transactions(uid + createdAt) الموجود.
 */
export const getAgencyEarningsActivity = async (
  members: { uid: string; displayName: string }[],
): Promise<AgencyActivity> => {
  // نحد لأعلى 20 عضواً لتفادي عدد كبير من الاستعلامات
  const top = members.slice(0, 20);
  const nameByUid: Record<string, string> = {};
  top.forEach((m) => { nameByUid[m.uid] = m.displayName; });

  const perMember = await Promise.all(
    top.map(async (m) => {
      try {
        const snap = await getDocs(query(
          collection(firestore, 'transactions'),
          where('uid', '==', m.uid),
          orderBy('createdAt', 'desc'),
          limit(15),
        ));
        return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      } catch {
        return [];
      }
    }),
  );

  const all: AgencyActivityTx[] = [];
  perMember.flat().forEach((tx: any) => {
    if (!PEARL_INCOME_TX_TYPES.has(String(tx.type ?? ''))) return;
    all.push({
      id: tx.id,
      uid: String(tx.uid ?? ''),
      memberName: nameByUid[String(tx.uid ?? '')] ?? 'عضو',
      type: String(tx.type ?? ''),
      amount: Number(tx.amount) || 0,
      currency: String(tx.currency ?? 'pearls'),
      callType: tx.callType,
      fromUid: tx.fromUid,
      createdAt: Number(tx.createdAt) || 0,
    });
  });
  all.sort((a, b) => b.createdAt - a.createdAt);

  // مجاميع آخر 7 أيام
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const weekly: { day: string; total: number }[] = [];
  let totalLast7d = 0;
  for (let i = 6; i >= 0; i--) {
    const start = new Date(now - i * dayMs);
    start.setHours(0, 0, 0, 0);
    const end = start.getTime() + dayMs;
    const total = all
      .filter((t) => t.createdAt >= start.getTime() && t.createdAt < end)
      .reduce((s, t) => s + t.amount, 0);
    totalLast7d += total;
    weekly.push({
      day: start.toLocaleDateString('ar', { weekday: 'short' }),
      total,
    });
  }

  return { recent: all.slice(0, 50), weekly, totalLast7d };
};

export type AgencyAdminAnalyticsPeriod = 'week' | 'last_week' | '4weeks_day' | '4weeks_week';
export type AgencyAdminIncomeFilter = 'all' | 'chat' | 'gifts' | 'calls' | 'refund' | 'other';

export interface AgencyAdminAnalytics {
  agencyId: string;
  series: { label: string; value: number }[];
  total: number;
  todayTotal: number;
  hosts: Array<{
    uid: string;
    name: string;
    avatar: string;
    earnings: number;
    totalPearlsEarned: number;
  }>;
}

export const getAgencyAdminAnalytics = async (
  agencyId: string,
  period: AgencyAdminAnalyticsPeriod = 'week',
  incomeType: AgencyAdminIncomeFilter = 'all',
): Promise<AgencyAdminAnalytics> => {
  await assertAgencyIdInScope(agencyId);
  const fn = httpsCallable<
    { agencyId: string; period: string; dataType: string; incomeType: string },
    AgencyAdminAnalytics & { series: { label: string; value: number }[] }
  >(functions, 'getAgencyAdminAnalytics');
  const res = await fn({ agencyId, period, dataType: 'income', incomeType });
  return res.data;
};

export interface AgencyRefundAdminRow {
  id: string;
  hostName: string;
  supporterName: string;
  amount: number;
  reason: string;
  createdAt: number;
}

export const getAgencyRefundsAdmin = async (agencyId: string): Promise<AgencyRefundAdminRow[]> => {
  await assertAgencyIdInScope(agencyId);
  const fn = httpsCallable<
    { agencyId: string },
    { refunds: Array<{
      id: string;
      hostName: string;
      supporterName: string;
      amount: number;
      reason: string;
      createdAt: number;
    }> }
  >(functions, 'listAgencyRefunds');
  const res = await fn({ agencyId });
  return res.data.refunds ?? [];
};

/** سحوبات الوكالة (بدون orderBy لتفادي فهرس مركّب — نرتّب في العميل) */
export interface AgencyWithdrawal {
  id: string;
  uid: string;
  uidName: string;
  type: string;
  amount: number;
  netAmount: number;
  status: string;
  createdAt: number;
}

export const getAgencyWithdrawals = async (agencyId: string): Promise<AgencyWithdrawal[]> => {
  await assertAgencyIdInScope(agencyId);
  try {
    const snap = await getDocs(query(
      collection(firestore, 'withdrawals'),
      where('agencyId', '==', agencyId),
      limit(100),
    ));
    return snap.docs
      .map((d) => {
        const w = d.data() as any;
        return {
          id: d.id,
          uid: String(w.uid ?? ''),
          uidName: String(w.uidName ?? '—'),
          type: String(w.type ?? 'self'),
          amount: Number(w.amount) || 0,
          netAmount: Number(w.netAmount) || 0,
          status: String(w.status ?? 'pending'),
          createdAt: Number(w.createdAt) || 0,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (e) {
    console.error('getAgencyWithdrawals:', e);
    return [];
  }
};

export interface AdminUserFull extends AdminUser {
  xp: number;
  vipPoints: number;
  vipPointsMonth: number;
  visitors: number;
  /** إصلاح #17 — عداد الزوار من stats.visitors */
  visitorsStats?: number;
  /** إصلاح #17 — عداد الزوار من data.visitors */
  visitorsDirect?: number;
  agencyName?: string;
  agencyRole?: string;
  /** كلمة مرور محفوظة من لوحة التحكم فقط — ليست كلمة التسجيل الذاتي */
  adminManagedPassword?: string;
  adminPasswordUpdatedAt?: number;
  userTitles?: {
    owned: { titleId: string; obtainedAt: number; expiresAt: number | null }[];
    equipped: (string | null)[];
  };
  tags?: string[];
  registeredDevices?: AdminRegisteredDevice[];
  lastLoginAt?: number;
  lastLoginIp?: string;
  lastLoginMethod?: string;
  lastLoginLocation?: AdminLoginLocation;
  lastLoginDeviceId?: string;
  location?: AdminLoginLocation & { geohash?: string; updatedAt?: number };
  /** حالة الحساب المشتقة من isBanned/accountStatus */
  accountStatus?: 'pending_deletion';
  deletionRequestedAt?: number;
  isSuspended?: boolean;
  suspendedUntil?: number;
  suspendReason?: string;
}

export interface AdminLoginLocation {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
}

export interface AdminRegisteredDevice {
  id: string;
  name: string;
  platform: string;
  lastActiveAt: number;
  brand?: string;
  model?: string;
  osVersion?: string;
  deviceIdentifier?: string;
  lastIp?: string;
  lastLocation?: AdminLoginLocation;
  loginCount?: number;
  connectionType?: string;
}

export interface AdminLoginSession {
  id: string;
  deviceId: string;
  method: string;
  ip: string;
  deviceName: string;
  platform: string;
  brand?: string;
  model?: string;
  osVersion?: string;
  deviceIdentifier?: string;
  appVersion?: string;
  location?: AdminLoginLocation | null;
  createdAt: number;
  connectionType?: string;
  flaggedSuspicious?: boolean;
}

export interface AdminUserWithdrawal {
  id: string;
  type: string;
  amount: number;
  netAmount: number;
  status: string;
  createdAt: number;
}

export interface AdminGameTx {
  id: string;
  gameId?: string;
  stake: number;
  winAmount: number;
  createdAt: number;
}

export const TX_TYPE_LABELS: Record<string, string> = {
  gift_received: 'هدية مستلمة',
  gift_sent: 'هدية مُرسلة',
  call_earning: 'أرباح مكالمة',
  call_spent: 'مكالمة مدفوعة',
  transfer_received: 'تحويل وارد',
  transfer_sent: 'تحويل صادر',
  treasure_won: 'كنز',
  seat_fee_received: 'رسوم مقعد',
  lucky_bag_won: 'حقيبة حظ',
  locked_media_earn: 'وسائط مقفلة',
  recharge: 'شحن',
  withdraw: 'سحب',
  purchase: 'شراء',
  agent_collected: 'تحصيل وكيل',
  exchange: 'تحويل عملات',
  casino_exchange: 'كازينو',
  host_task_reward: 'مكافأة مهمة مضيفة',
  game: 'لعبة',
  admin_grant: 'منح إداري',
};

export const txTypeLabel = (type: string): string => TX_TYPE_LABELS[type] ?? type;

export const getUserFullProfile = async (uid: string): Promise<AdminUserFull | null> => {
  const base = await getUserById(uid);
  if (!base) return null;
  try {
    const [snap, credSnap] = await Promise.all([
      getDoc(doc(firestore, 'users', uid)),
      getDoc(doc(firestore, 'adminUserCredentials', uid)),
    ]);
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    const stats = (data.stats as Record<string, unknown>) ?? {};
    const cred = credSnap.exists() ? (credSnap.data() as Record<string, unknown>) : null;
    // إصلاح #17 — كلا حقلَي الزوار لمعرفة أيهما صحيح (stats.visitors vs data.visitors)
    const statsVisitors = Number(stats.visitors ?? 0) || 0;
    const dataVisitors = Number(data.visitors ?? 0) || 0;
    // نختار الأكبر كقيمة عرض؛ الإدمن يرى كليهما في UserDetail
    const visitors = Math.max(statsVisitors, dataVisitors);
    return {
      ...base,
      xp: Number(data.xp ?? stats.xp ?? 0) || 0,
      vipPoints: Number(data.vipPoints ?? 0) || 0,
      vipPointsMonth: Number(data.vipPointsMonth ?? 0) || 0,
      visitors,
      /** الحقلان الأصليان — مفيدان للتشخيص في UserDetail */
      visitorsStats: statsVisitors,
      visitorsDirect: dataVisitors,
      agencyName: data.agencyName != null ? String(data.agencyName) : undefined,
      agencyRole: data.agencyRole != null ? String(data.agencyRole) : undefined,
      adminManagedPassword: cred?.password != null ? String(cred.password) : undefined,
      adminPasswordUpdatedAt: cred?.updatedAt != null ? Number(cred.updatedAt) || 0 : undefined,
      userTitles: data.userTitles as AdminUserFull['userTitles'],
      tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
      registeredDevices: Array.isArray(data.registeredDevices)
        ? (data.registeredDevices as AdminRegisteredDevice[])
        : [],
      lastLoginAt: data.lastLoginAt != null ? Number(data.lastLoginAt) || 0 : undefined,
      lastLoginIp: data.lastLoginIp != null ? String(data.lastLoginIp) : undefined,
      lastLoginMethod: data.lastLoginMethod != null ? String(data.lastLoginMethod) : undefined,
      lastLoginLocation: data.lastLoginLocation as AdminLoginLocation | undefined,
      lastLoginDeviceId: data.lastLoginDeviceId != null ? String(data.lastLoginDeviceId) : undefined,
      location: data.location as AdminUserFull['location'],
      accountStatus: data.accountStatus === 'pending_deletion' ? 'pending_deletion' : undefined,
      deletionRequestedAt: data.deletionRequestedAt != null ? Number(data.deletionRequestedAt) || 0 : undefined,
      isSuspended: data.isSuspended === true,
      suspendedUntil: data.suspendedUntil != null ? Number(data.suspendedUntil) || 0 : undefined,
      suspendReason: data.suspendReason != null ? String(data.suspendReason) : undefined,
    };
  } catch (e) {
    console.error('getUserFullProfile:', e);
    return { ...base, xp: 0, vipPoints: 0, vipPointsMonth: 0, visitors: 0 };
  }
};

export const getUserLoginSessions = async (uid: string, limitCount = 50): Promise<AdminLoginSession[]> => {
  await assertUidInAdminCountryScope(uid);
  try {
    const snap = await getDocs(query(
      collection(firestore, 'users', uid, 'loginSessions'),
      orderBy('createdAt', 'desc'),
      limit(limitCount),
    ));
    return snap.docs.map((d) => {
      const s = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        deviceId: String(s.deviceId ?? ''),
        method: String(s.method ?? ''),
        ip: String(s.ip ?? ''),
        deviceName: String(s.deviceName ?? ''),
        platform: String(s.platform ?? ''),
        brand: s.brand != null ? String(s.brand) : undefined,
        model: s.model != null ? String(s.model) : undefined,
        osVersion: s.osVersion != null ? String(s.osVersion) : undefined,
        deviceIdentifier: s.deviceIdentifier != null ? String(s.deviceIdentifier) : undefined,
        appVersion: s.appVersion != null ? String(s.appVersion) : undefined,
        location: (s.location as AdminLoginLocation | null) ?? null,
        createdAt: Number(s.createdAt) || 0,
        connectionType: s.connectionType != null ? String(s.connectionType) : undefined,
        flaggedSuspicious: s.flaggedSuspicious === true,
      };
    });
  } catch (e) {
    console.error('getUserLoginSessions:', e);
    return [];
  }
};

export const getUserWithdrawals = async (uid: string, limitCount = 40): Promise<AdminUserWithdrawal[]> => {
  await assertUidInAdminCountryScope(uid);
  try {
    const snap = await getDocs(query(
      collection(firestore, 'withdrawals'),
      where('uid', '==', uid),
      limit(limitCount),
    ));
    return snap.docs
      .map((d) => {
        const w = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          type: String(w.type ?? 'self'),
          amount: Number(w.amount) || 0,
          netAmount: Number(w.netAmount) || 0,
          status: String(w.status ?? 'pending'),
          createdAt: Number(w.createdAt) || 0,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (e) {
    console.error('getUserWithdrawals:', e);
    return [];
  }
};

export const getUserGameTransactions = async (uid: string, limitCount = 40): Promise<AdminGameTx[]> => {
  await assertUidInAdminCountryScope(uid);
  try {
    const snap = await getDocs(query(
      collection(firestore, 'gameTransactions'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(limitCount),
    ));
    return snap.docs.map((d) => {
      const g = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        gameId: g.gameId != null ? String(g.gameId) : undefined,
        stake: Number(g.stake) || 0,
        winAmount: Number(g.winAmount) || 0,
        createdAt: Number(g.createdAt) || 0,
      };
    });
  } catch (e) {
    console.error('getUserGameTransactions:', e);
    return [];
  }
};

/** آخر معاملات عضو محدّد (لنافذة التفاصيل) */
export const getMemberTransactions = async (uid: string, limitCount = 25): Promise<AdminTransaction[]> => {
  await assertUidInAdminCountryScope(uid);
  try {
    const snap = await getDocs(query(
      collection(firestore, 'transactions'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(limitCount),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  } catch (e) {
    console.error('getMemberTransactions:', e);
    return [];
  }
};

export const agencyApplicationStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    pending: 'قيد المراجعة',
    awaiting_hosts: 'بانتظار توثيق المضيفات',
    ready: 'جاهز للتفعيل',
    active: 'مفعّل',
    rejected: 'مرفوض',
    expired: 'منتهي الصلاحية',
  };
  return map[status] ?? status;
};

// ==================== CALL / PROVIDER USAGE ====================
/**
 * إحصاءات استهلاك دقائق المزوّد (Agora) لمكالمات الصوت/الفيديو والمطابقة.
 * المصدر: مجموعة callSessions — الحقول minutesCharged / type / source / billed
 * / totalCoinsSpent / totalPearlsEarned. القيم تعكس الدقائق المُحتسَبة فعلياً.
 */
export type CallUsageRange = '1' | '7' | '30' | '90' | 'all';

export interface CallUsageCell {
  minutes: number;
  realMinutes: number;
  sessions: number;
  coins: number;
  pearls: number;
}

export interface CallUsageStats {
  range: CallUsageRange;
  totalMinutes: number;
  totalRealMinutes: number;
  totalSessions: number;
  totalCoins: number;
  totalPearls: number;
  byType: { voice: number; video: number };
  bySource: { chat: number; match: number };
  grid: {
    chatVoice: CallUsageCell;
    chatVideo: CallUsageCell;
    matchVoice: CallUsageCell;
    matchVideo: CallUsageCell;
  };
  billedSessions: number;
  unbilledSessions: number;
  fetchedCount: number;
  reachedLimit: boolean;
}

const emptyUsageCell = (): CallUsageCell => ({ minutes: 0, realMinutes: 0, sessions: 0, coins: 0, pearls: 0 });

export const getCallUsageStats = async (range: CallUsageRange = '30'): Promise<CallUsageStats> => {
  const FETCH_LIMIT = 10000;
  const constraints: any[] = [];
  if (range !== 'all') {
    const cutoff = Date.now() - Number(range) * 24 * 60 * 60 * 1000;
    constraints.push(where('createdAt', '>=', cutoff));
  }
  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(FETCH_LIMIT));

  const snap = await getDocs(query(collection(firestore, 'callSessions'), ...constraints));

  const grid = {
    chatVoice: emptyUsageCell(),
    chatVideo: emptyUsageCell(),
    matchVoice: emptyUsageCell(),
    matchVideo: emptyUsageCell(),
  };
  let billedSessions = 0;
  let unbilledSessions = 0;

  snap.forEach((d) => {
    const s = d.data() as any;
    const minutes = Number(s.minutesCharged) || 0;
    const realMinutes = (Number(s.durationSeconds) || 0) / 60;
    const coins = Number(s.totalCoinsSpent) || 0;
    const pearls = Number(s.totalPearlsEarned) || 0;
    const isVideo = s.type === 'video';
    const isMatch = s.source === 'match';
    const cell = isMatch
      ? isVideo ? grid.matchVideo : grid.matchVoice
      : isVideo ? grid.chatVideo : grid.chatVoice;
    cell.minutes += minutes;
    cell.realMinutes += realMinutes;
    cell.sessions += 1;
    cell.coins += coins;
    cell.pearls += pearls;
    if (s.billed === true) billedSessions += 1;
    else unbilledSessions += 1;
  });

  const cells = [grid.chatVoice, grid.chatVideo, grid.matchVoice, grid.matchVideo];
  const sum = (sel: (c: CallUsageCell) => number) => cells.reduce((a, c) => a + sel(c), 0);

  return {
    range,
    totalMinutes: sum((c) => c.minutes),
    totalRealMinutes: sum((c) => c.realMinutes),
    totalSessions: sum((c) => c.sessions),
    totalCoins: sum((c) => c.coins),
    totalPearls: sum((c) => c.pearls),
    byType: {
      voice: grid.chatVoice.realMinutes + grid.matchVoice.realMinutes,
      video: grid.chatVideo.realMinutes + grid.matchVideo.realMinutes,
    },
    bySource: {
      chat: grid.chatVoice.realMinutes + grid.chatVideo.realMinutes,
      match: grid.matchVoice.realMinutes + grid.matchVideo.realMinutes,
    },
    grid,
    billedSessions,
    unbilledSessions,
    fetchedCount: snap.size,
    reachedLimit: snap.size >= FETCH_LIMIT,
  };
};

// ==================== PROVIDER COSTS & LIVEKIT USAGE ====================
import { DEFAULT_PROVIDER_COSTS, type ProviderCosts } from '@/constants/providerCosts';
export { DEFAULT_PROVIDER_COSTS, type ProviderCosts };

export const getProviderCosts = async (): Promise<ProviderCosts> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'providers'));
    if (!snap.exists()) return DEFAULT_PROVIDER_COSTS;
    const data = snap.data();
    return {
      agoraVoicePerMin: Number(data.agoraVoicePerMin) || DEFAULT_PROVIDER_COSTS.agoraVoicePerMin,
      agoraVideoPerMin: Number(data.agoraVideoPerMin) || DEFAULT_PROVIDER_COSTS.agoraVideoPerMin,
      livekitPerMin: Number(data.livekitPerMin) || DEFAULT_PROVIDER_COSTS.livekitPerMin,
      currency: String(data.currency || DEFAULT_PROVIDER_COSTS.currency),
    };
  } catch (e) {
    console.error('getProviderCosts:', e);
    return DEFAULT_PROVIDER_COSTS;
  }
};

export const saveProviderCosts = async (costs: ProviderCosts): Promise<void> => {
  await setDoc(doc(firestore, 'config', 'providers'), {
    agoraVoicePerMin: Number(costs.agoraVoicePerMin) || 0,
    agoraVideoPerMin: Number(costs.agoraVideoPerMin) || 0,
    livekitPerMin: Number(costs.livekitPerMin) || 0,
    currency: String(costs.currency || 'USD').slice(0, 6),
    updatedAt: Date.now(),
    _permKey: 'analytics',
  }, { merge: true });
};

export interface LiveKitUsageStats {
  hasData: boolean;
  minutes: number;
  sessions: number;
  reachedLimit: boolean;
}

export const getLiveKitUsage = async (range: CallUsageRange = '30'): Promise<LiveKitUsageStats> => {
  try {
    const FETCH_LIMIT = 10000;
    const constraints: any[] = [where('provider', '==', 'livekit')];
    if (range !== 'all') {
      const cutoff = Date.now() - Number(range) * 24 * 60 * 60 * 1000;
      constraints.push(where('createdAt', '>=', cutoff));
    }
    constraints.push(orderBy('createdAt', 'desc'));
    constraints.push(limit(FETCH_LIMIT));

    const snap = await getDocs(query(collection(firestore, 'providerSessions'), ...constraints));
    
    let minutes = 0;
    let sessions = 0;
    snap.forEach((d) => {
      const data = d.data();
      minutes += Number(data.minutes) || 0;
      sessions += 1;
    });

    return {
      hasData: snap.size > 0,
      minutes,
      sessions,
      reachedLimit: snap.size >= FETCH_LIMIT,
    };
  } catch (e) {
    console.error('getLiveKitUsage:', e);
    return {
      hasData: false,
      minutes: 0,
      sessions: 0,
      reachedLimit: false,
    };
  }
};

// ==================== HELPERS ====================
export const formatNumber = (n: number | null | undefined): string => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toLocaleString('en-US');
};

export const formatDate = (ts: number): string => {
  if (!ts) return '-';
  return new Date(ts).toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
};

export const timeAgo = (ts: number): string => {
  if (!ts) return '-';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `قبل ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `قبل ${hrs} س`;
  const days = Math.floor(hrs / 24);
  return `قبل ${days} يوم`;
};

// ==================== CHAT CONTENT FILTER (#9) ====================
/**
 * إصلاح #9 — فلتر محتوى الدردشة: كلمات محجوبة، انماط، خطوات خارجية
 * يقرأها التطبيق من config/chatFilter لتصفية الرسائل
 */
export interface ConfigChatFilter {
  enabled: boolean;
  /** وضع تحذير فقط بدل الحجب */
  warnOnlyMode: boolean;
  /** كلمات/عبارات تُحجب تلقائياً (حساسية غير مفرّقة للحالة) */
  blockedWords: string[];
  /** انماط يو ركس regex تُحجب منها (أرقام هواتف، روابط، ...) */
  blockedPatterns: string[];
  /** أسماء تطبيقات خارجية محجوبة (telegram, whatsapp, ...) */
  blockedAppNames: string[];
  /** تحديث آخر بواسطة الإدمن */
  updatedAt?: number;
}

export const DEFAULT_CHAT_FILTER: ConfigChatFilter = {
  enabled: false,
  warnOnlyMode: false,
  blockedWords: [],
  blockedPatterns: [
    '(?:\\+?\\d[\\s\\-.]?){7,14}\\d',   // أرقام هواتف
    'https?:\/\/[^\\s]+',               // روابط HTTP
    't\\.me\/[^\\s]+',                  // روابط Telegram
    'wa\\.me\/[^\\s]+',                 // روابط WhatsApp
  ],
  blockedAppNames: ['telegram', 'تيليغرام', 'whatsapp', 'واتسآب', 'snapchat', 'instagram', 'سنابشات', 'tiktok'],
};

export const getConfigChatFilter = async (): Promise<ConfigChatFilter> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'chatFilter'));
    if (snap.exists()) {
      return { ...DEFAULT_CHAT_FILTER, ...snap.data() } as ConfigChatFilter;
    }
  } catch { /* ignore */ }
  return DEFAULT_CHAT_FILTER;
};

export const saveConfigChatFilter = async (config: ConfigChatFilter): Promise<void> => {
  await setDoc(
    doc(firestore, 'config', 'chatFilter'),
    {
      ...config,
      blockedWords: config.blockedWords.map((w) => w.trim()).filter(Boolean),
      blockedPatterns: config.blockedPatterns.map((p) => p.trim()).filter(Boolean),
      blockedAppNames: config.blockedAppNames.map((a) => a.trim().toLowerCase()).filter(Boolean),
      updatedAt: Date.now(),
      _permKey: 'settings',
    },
    { merge: true },
  );
};

