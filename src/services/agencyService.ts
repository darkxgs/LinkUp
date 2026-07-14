/**
 * Agency Service — نظام الوكالات الكامل
 *
 * Collections:
 *   agencies/{id}         → بيانات الوكالة
 *   agencyMembers/{id}    → عضوية المضيف في وكالة (uid + agencyId)
 *   agencyInvites/{id}    → دعوات الانضمام
 *   agencyEarnings/{id}   → إحصائيات يومية (للتقارير)
 *
 * صلاحيات:
 *   - الوكيل (owner): يدعو، يدير، يجمع ماسة، يطّلع على الدخل
 *   - العضو: يطلب سحب بالنيابة، يرى وكالته في profile
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, update, get } from 'firebase/database';
import { firestore, auth, functions, realtimeDb } from './firebase/index';
import { ensureCallableAuth, translateCallableError } from './firebase/authReady';
import { callCallableHttp, callCallableWithAuth } from './firebase/callableHttp';
import {
  AGENCY_THRONE_UNLOCK_LEVEL,
  computeAgencyLevel,
  isAgencyThroneUnlockedByLevel,
  resolveAgencyLevelsConfig,
  type AgencyLevelsRuntimeConfig,
} from '@/services/agencyLevels';

export type AgencyMemberRole = 'member' | 'host';
export type InviteStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  // موافقة الانضمام: طلب عبر كود دعوة بانتظار موافقة الوكيل
  | 'requested'
  // موافقة الانضمام: دعوة مباشرة قبلتها المضيفة بانتظار تأكيد الوكيل النهائي
  | 'host_accepted';

export interface Agency {
  id: string;
  name: string;
  ownerUid: string;
  ownerName: string;
  ownerAvatar?: string;
  /** شعار الوكالة — وليس صورة المدير */
  logo?: string;
  banner?: string;
  description?: string;
  country?: string;
  inviteCode: string;
  memberCount: number;
  totalEarnings: number;
  isVerified: boolean;
  /** حالة الوكالة: pending = بانتظار المضيفات، active = مفعّلة، expired = منتهية */
  status?: 'pending' | 'active' | 'expired';
  femaleHostCount?: number;
  minHostsRequired?: number;
  hostsDeadline?: number;
  /** مستوى الفترة — يُحدَّد يدوياً من لوحة التحكم */
  periodLevel?: number;
  periodLevelManual?: boolean;
  /** دعم الفترة الحالية (كوينز هدايا داخل الوكالة) */
  periodSupportCoins?: number;
  periodSupportWeekKey?: string;
  /** الحد الأقصى لعدد المايكات — يحدده الأدمن، والوكيل يختار العدد الفعلي ضمنه */
  maxSeatsCount?: number;
  cardFrameId?: string;
  cardFrameUrl?: string;
  cardBackgroundUrl?: string;
  roomFrameId?: string;
  roomBackgroundUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgencyMemberPermissions {
  allowSelfWithdraw: boolean;
  allowAgentWithdraw: boolean;
  allowTransferToAgent: boolean;
}

export const DEFAULT_MEMBER_PERMISSIONS: AgencyMemberPermissions = {
  allowSelfWithdraw: true,
  allowAgentWithdraw: true,
  allowTransferToAgent: true,
};

export interface AgencyMember {
  id: string;
  uid: string;
  uidName: string;
  uidAvatar: string;
  agencyId: string;
  agencyName: string;
  role: AgencyMemberRole;
  pearlsEarned: number; // الماسة المكتسب في الوكالة
  pearlsTransferredToAgent: number; // الماسة المنقول للوكيل
  joinedAt: number;
  permissions?: AgencyMemberPermissions;
}

export interface AgencyInvite {
  id: string;
  agencyId: string;
  agencyName: string;
  agentUid: string;
  agentName: string;
  invitedUid: string;
  invitedName: string;
  invitedAvatar: string;
  status: InviteStatus;
  inviteMethod: 'code' | 'direct';
  createdAt: number;
  updatedAt: number;
}

// ========================================================
// CREATE & READ AGENCIES
// ========================================================

/**
 * إنشاء وكالة جديدة (للوكلاء المؤهلين)
 */
export const createAgency = async (
  name: string,
  description?: string,
  country?: string,
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  // فحص أن المستخدم ليس عنده وكالة
  const existing = await getDocs(
    query(collection(firestore, 'agencies'), where('ownerUid', '==', user.uid), limit(1)),
  );
  if (!existing.empty) {
    throw new Error('لديك وكالة بالفعل');
  }

  const userSnap = await getDoc(doc(firestore, 'users', user.uid));
  const userData = userSnap.exists() ? userSnap.data() : {};

  // توليد كود دعوة عشوائي (6 أحرف)
  const inviteCode = Math.random().toString(36).slice(2, 8).toLowerCase();

  const newRef = doc(collection(firestore, 'agencies'));
  await setDoc(newRef, {
    name: name.trim(),
    ownerUid: user.uid,
    ownerName: userData.profile?.displayName ?? userData.displayName ?? 'الوكيل',
    ownerAvatar: userData.profile?.avatar ?? userData.avatar ?? '',
    description: description?.trim() ?? '',
    country: country ?? '',
    inviteCode,
    memberCount: 0,
    totalEarnings: 0,
    isVerified: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // تحديث بيانات الوكيل
  await updateDoc(doc(firestore, 'users', user.uid), {
    agencyId: newRef.id,
    agencyRole: 'owner',
    isAgent: true,
  });

  return newRef.id;
};

/**
 * جلب وكالتي (إذا كنت وكيلاً)
 */
export const getMyAgency = async (): Promise<Agency | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const q = query(
      collection(firestore, 'agencies'),
      where('ownerUid', '==', user.uid),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const first = snap.docs[0];
    if (!first) return null;
    return { id: first.id, ...first.data() } as Agency;
  } catch {
    return null;
  }
};

/**
 * جلب الوكالة بـ ID
 */
export const getAgencyById = async (agencyId: string): Promise<Agency | null> => {
  try {
    const snap = await getDoc(doc(firestore, 'agencies', agencyId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Agency;
  } catch {
    return null;
  }
};

/**
 * الاستماع المباشر للوكالة
 */
/**
 * كاش في الذاكرة لآخر وكالة معروفة للمستخدم الحالي (مع uid لتفادي التسريب بين
 * الحسابات). يتيح لشاشة مركز الوكالة أن تُرسم فوراً عند إعادة الفتح بدل انتظار
 * أول لقطة من Firestore.
 */
let cachedMyAgency: { uid: string; agency: Agency } | null = null;

/** يرجّع الوكالة المخزّنة إن كانت تخصّ المستخدم الحالي، وإلا null */
export const getCachedMyAgency = (): Agency | null => {
  const uid = auth.currentUser?.uid;
  if (uid && cachedMyAgency && cachedMyAgency.uid === uid) return cachedMyAgency.agency;
  return null;
};

export const subscribeToMyAgency = (
  callback: (agency: Agency | null) => void,
): (() => void) => {
  const user = auth.currentUser;
  if (!user) return () => {};
  const q = query(
    collection(firestore, 'agencies'),
    where('ownerUid', '==', user.uid),
    limit(1),
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      if (cachedMyAgency?.uid === user.uid) cachedMyAgency = null;
      callback(null);
      return;
    }
    const first = snap.docs[0];
    if (!first) { callback(null); return; }
    const agency = { id: first.id, ...first.data() } as Agency;
    cachedMyAgency = { uid: user.uid, agency };
    callback(agency);
  });
};

/**
 * تحديث صورة/كفر الوكالة
 */
export const updateAgencyImages = async (
  agencyId: string,
  fields: { logo?: string; banner?: string },
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const agencyRef = doc(firestore, 'agencies', agencyId);
  const snap = await getDoc(agencyRef);
  if (!snap.exists()) throw new Error('الوكالة غير موجودة');
  if (snap.data()?.ownerUid !== user.uid) throw new Error('فقط مالك الوكالة يمكنه تعديل الصور');

  const update: Record<string, unknown> = { updatedAt: Date.now() };
  if (fields.logo !== undefined) update.logo = fields.logo;
  if (fields.banner !== undefined) update.banner = fields.banner;
  await updateDoc(agencyRef, update);
};

/**
 * مفتاح فترة الدعم الأسبوعية — مطابق حرفياً لدالة السيرفر getAgencyPeriodWeekKey.
 * ⚠️ الصيغة القديمة (منتصف ليل اليوم - 6 أيام) كانت تتغيّر كل يوم وتختلف بين
 * منطقة جهاز المستخدم وتوقيت خادم UTC، فكان العدّاد يُصفَّر يومياً والعميل
 * يعرض دائماً 0 (المساهمة لا تزيد والمستوى عالق). الصيغة الجديدة سلة أسبوعية
 * ثابتة بتوقيت الرياض (+3) لا تعتمد على منطقة الجهاز ولا الخادم.
 */
export function getAgencyPeriodWeekKey(ms = Date.now()): string {
  const DAY = 86400000;
  const TZ_OFFSET_MS = 3 * 60 * 60 * 1000; // Asia/Riyadh ثابت
  return `wk${Math.floor((ms + TZ_OFFSET_MS) / (7 * DAY))}`;
}

async function loadAgencyLevelsConfigDoc(): Promise<AgencyLevelsRuntimeConfig> {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'agencyLevels'));
    return resolveAgencyLevelsConfig(snap.exists() ? snap.data() : null);
  } catch {
    return resolveAgencyLevelsConfig();
  }
}

/** دعم الفترة الحالية بالكوينز */
export async function getAgencyPeriodSupportCoins(agencyId: string): Promise<number> {
  if (!agencyId) return 0;
  try {
    const snap = await getDoc(doc(firestore, 'agencies', agencyId));
    if (!snap.exists()) return 0;
    const data = snap.data();
    const weekKey = getAgencyPeriodWeekKey();
    if (String(data?.periodSupportWeekKey ?? '') !== weekKey) return 0;
    return Math.max(0, Number(data?.periodSupportCoins) || 0);
  } catch {
    return 0;
  }
}

/** يزيد عدّاد دعم الفترة عند إرسال هدايا في غرفة الوكالة */
export async function bumpAgencyPeriodSupport(agencyId: string, coins: number): Promise<void> {
  const amount = Math.floor(Number(coins) || 0);
  if (!agencyId || amount <= 0) return;

  const weekKey = getAgencyPeriodWeekKey();
  const agencyRef = doc(firestore, 'agencies', agencyId);
  const snap = await getDoc(agencyRef);
  if (!snap.exists()) return;

  const data = snap.data();
  if (String(data?.periodSupportWeekKey ?? '') === weekKey) {
    await updateDoc(agencyRef, { periodSupportCoins: increment(amount), updatedAt: Date.now() });
  } else {
    await updateDoc(agencyRef, {
      periodSupportWeekKey: weekKey,
      periodSupportCoins: amount,
      updatedAt: Date.now(),
    });
  }
}

export function subscribeToAgencyById(
  agencyId: string,
  callback: (agency: Agency | null) => void,
): () => void {
  if (!agencyId) {
    callback(null);
    return () => {};
  }
  return onSnapshot(
    doc(firestore, 'agencies', agencyId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback({ id: snap.id, ...snap.data() } as Agency);
    },
    () => callback(null),
  );
}

// ========================================================
// INVITES
// ========================================================

/**
 * الوكيل يدعو عضو بـ UID — عبر Cloud Function
 */
export const inviteUserToAgency = async (invitedUid: string): Promise<void> => {
  // #10: httpsCallable وحده غير موثوق على React Native (Gen2) —
  // كان يُرجع Unavailable/Failed رغم صحة الدعوة. HTTP+Bearer مع fallback للSDK.
  try {
    const user = await ensureCallableAuth();
    const token = await user.getIdToken();
    await callCallableWithAuth<{ invitedUid: string }, { ok: boolean; inviteId?: string }>(
      'sendAgencyHostInvite',
      { invitedUid },
      token,
    );
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

/** دعوة + إشعار in-app و push للمدعو (من الغرفة أو شاشة الدعوة) */
export async function inviteUserToAgencyWithNotification(params: {
  invitedUid: string;
  agencyId: string;
  agencyName: string;
  agentUid: string;
  agentName: string;
  agentAvatar?: string;
}): Promise<void> {
  await inviteUserToAgency(params.invitedUid);

  const { createNotification } = await import('@/services/firebase/notifications');
  const agencyLabel = params.agencyName.trim() || 'الوكالة';
  const agentLabel = params.agentName.trim() || 'مدير الوكالة';

  await createNotification({
    uid: params.invitedUid,
    type: 'system',
    fromUid: params.agentUid,
    fromName: agentLabel,
    fromAvatar: params.agentAvatar,
    message: `لقد تم دعوتك للانضمام إلى وكالة "${agencyLabel}"`,
    data: {
      title: 'دعوة انضمام لوكالة',
      body: `دعاك ${agentLabel} للانضمام إلى وكالة "${agencyLabel}" — اضغط للقبول مجاناً`,
      agencyId: params.agencyId,
      fromUid: params.agentUid,
      fromName: agentLabel,
      type: 'agency_host_invite',
      route: '/agency/my-invites',
    },
    isRead: false,
  });
}

/** وكالة نشطة — ليست منتهية أو مرفوضة */
function isAgencyStatusActive(status: unknown): boolean {
  const s = String(status ?? 'active');
  return s !== 'expired' && s !== 'rejected';
}

/**
 * معرّف الوكالة النشطة للمستخدم إن وُجد — يتجاهل السجلات اليتيمة وagencyId القديم.
 */
export async function getActiveAgencyIdForUser(uid: string): Promise<string | null> {
  if (!uid) return null;

  const [userSnap, memberSnap, ownedSnap] = await Promise.all([
    getDoc(doc(firestore, 'users', uid)),
    getDocs(query(collection(firestore, 'agencyMembers'), where('uid', '==', uid), limit(10))),
    getDocs(query(collection(firestore, 'agencies'), where('ownerUid', '==', uid), limit(3))),
  ]);

  const candidateIds = new Set<string>();
  for (const d of ownedSnap.docs) candidateIds.add(d.id);
  const userAgencyId = String(userSnap.data()?.agencyId ?? '').trim();
  if (userAgencyId) candidateIds.add(userAgencyId);
  for (const d of memberSnap.docs) {
    const id = String(d.data().agencyId ?? '').trim();
    if (id) candidateIds.add(id);
  }
  if (candidateIds.size === 0) return null;

  const agencySnaps = await Promise.all(
    [...candidateIds].map((id) => getDoc(doc(firestore, 'agencies', id))),
  );
  const activeAgencyIds = new Set(
    agencySnaps
      .filter((s) => s.exists() && isAgencyStatusActive(s.data()?.status))
      .map((s) => s.id),
  );
  if (activeAgencyIds.size === 0) return null;

  for (const d of ownedSnap.docs) {
    if (activeAgencyIds.has(d.id)) return d.id;
  }

  if (userAgencyId && activeAgencyIds.has(userAgencyId)) {
    const agencySnap = agencySnaps.find((s) => s.id === userAgencyId);
    const ownerUid = String(agencySnap?.data()?.ownerUid ?? '');
    if (ownerUid === uid) return userAgencyId;
    const hasMember = memberSnap.docs.some(
      (d) => String(d.data().agencyId ?? '').trim() === userAgencyId,
    );
    if (hasMember) return userAgencyId;
  }

  for (const d of memberSnap.docs) {
    const id = String(d.data().agencyId ?? '').trim();
    if (id && activeAgencyIds.has(id)) return id;
  }

  return null;
}

/** هل المستخدم مرتبط بوكالة نشطة (عضوية أو ملكية)؟ */
export async function userHasAgencyMembership(uid: string): Promise<boolean> {
  return (await getActiveAgencyIdForUser(uid)) != null;
}

/**
 * العضو يقبل دعوة باستخدام كود — عبر Cloud Function
 */
export const acceptAgencyInviteByCode = async (
  code: string,
): Promise<{ agencyId: string; agencyName: string; needsGenderVerification: boolean; pending?: boolean }> => {
  const current = auth.currentUser;
  if (!current?.uid) throw new Error('يجب تسجيل الدخول');
  // التوثيق اختياري عند الانضمام — الخادم يقبل غير الموثّقة كعضو ويعيد needsGenderVerification
  // للتوثيق لاحقاً. (أُزيلت بوابة عميل قديمة كانت ترمي «عليك توثيق الحساب» وتمنع الانضمام رغم أن الخادم يسمح.)

  // #10: نفس إصلاح الإرسال — مسار HTTP الموثوق بدل httpsCallable وحده
  try {
    const callableUser = await ensureCallableAuth();
    const token = await callableUser.getIdToken();
    const res = await callCallableWithAuth<
      { code: string },
      {
        ok: boolean;
        agencyId: string;
        agencyName: string;
        needsGenderVerification: boolean;
        // موافقة الانضمام مفعّلة: طلب معلّق بانتظار موافقة الوكيل بدل الانضمام الفوري
        pending?: boolean;
      }
    >('acceptAgencyHostInviteByCode', { code: code.trim() }, token);
    return {
      agencyId: res.agencyId,
      agencyName: res.agencyName,
      needsGenderVerification: res.needsGenderVerification ?? false,
      pending: res.pending === true,
    };
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

const AGENCY_INVITES_POLL_MS = 8000;

/**
 * تحديث سجل الدعوات (للوكيل) — عبر Cloud Function بدون استعلام مركّب على العميل
 */
export const subscribeToMyAgencyInvites = (
  callback: (invites: AgencyInvite[]) => void,
): (() => void) => {
  let cancelled = false;

  const load = async () => {
    try {
      // #10: مسار HTTP الموثوق — httpsCallable وحده كان يفشل على RN فيظهر السجل فارغاً
      const user = await ensureCallableAuth();
      const token = await user.getIdToken();
      const res = await callCallableWithAuth<
        Record<string, never>,
        { invites: AgencyInvite[] }
      >('listMyAgencyInvites', {}, token);
      if (!cancelled) {
        callback((res.invites ?? []) as AgencyInvite[]);
      }
    } catch {
      if (!cancelled) callback([]);
    }
  };

  void load();
  const timer = setInterval(() => void load(), AGENCY_INVITES_POLL_MS);

  return () => {
    cancelled = true;
    clearInterval(timer);
  };
};

// ========================================================
// MEMBERS
// ========================================================

/**
 * جلب أعضاء وكالتي (للوكيل)
 */
export const getMyAgencyMembers = async (): Promise<AgencyMember[]> => {
  const agency = await getMyAgency();
  if (!agency) return [];

  const q = query(
    collection(firestore, 'agencyMembers'),
    where('agencyId', '==', agency.id),
    orderBy('joinedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AgencyMember));
};

/**
 * الاستماع المباشر لأعضاء الوكالة
 */
export const subscribeToAgencyMembers = (
  agencyId: string,
  callback: (members: AgencyMember[]) => void,
): (() => void) => {
  const q = query(
    collection(firestore, 'agencyMembers'),
    where('agencyId', '==', agencyId),
    orderBy('joinedAt', 'desc'),
    limit(200),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AgencyMember)));
  });
};

/** هل المستخدم عضو مسجّل في وكالة معيّنة؟ */
export const isUidAgencyMember = async (agencyId: string, uid: string): Promise<boolean> => {
  if (!agencyId || !uid) return false;
  const q = query(
    collection(firestore, 'agencyMembers'),
    where('agencyId', '==', agencyId),
    where('uid', '==', uid),
    limit(1),
  );
  const snap = await getDocs(q);
  return !snap.empty;
};

/**
 * إنهاء عضوية في الوكالة (يفعلها الوكيل أو الأدمن).
 * إشعار المُزال يكتبه الـCF عبر notifyUser — لا تكرار من العميل.
 */
export const removeAgencyMember = async (memberId: string): Promise<void> => {
  // #10: httpsCallable وحده غير موثوق على React Native (Gen2) —
  // كان يفشل بـ«internal» عشوائياً. HTTP+Bearer مع fallback للSDK كبقية الملف.
  try {
    const user = await ensureCallableAuth();
    const token = await user.getIdToken();
    await callCallableWithAuth<{ memberDocId: string }, { ok: boolean }>(
      'removeAgencyMember',
      { memberDocId: memberId },
      token,
    );
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

/**
 * مغادرة المضيف لوكالته طوعاً — leaveAgency CF يُخطر الوكيل.
 */
export const leaveMyAgency = async (): Promise<void> => {
  try {
    const { suppressNextAgencyRemovalAlert } = await import(
      '@/components/AgencyMembershipWatcher'
    );
    suppressNextAgencyRemovalAlert();

    const user = await ensureCallableAuth();
    const token = await user.getIdToken();

    await callCallableWithAuth<
      Record<string, never>,
      { ok: boolean; agencyId?: string; agencyName?: string; ownerUid?: string }
    >('leaveAgency', {}, token);
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

// ========================================================
// EARNINGS / ANALYTICS
// ========================================================

export interface AgencyEarningsSummary {
  totalEarnings: number;
  todayEarnings: number;
  memberCount: number;
  topMembers: Array<{
    uid: string;
    name: string;
    avatar: string;
    earnings: number;
  }>;
  potentialBonus: number; // المكافأة المحتملة
  agentBonus: number; // ما يحصل عليه المدير
}

/**
 * كاش قصير الأمد + إزالة تكرار الطلبات لتحليلات الوكالة.
 * الرد الواحد يحوي (series + total + todayTotal + hosts)، وكانت شاشة المركز
 * تستدعيه مرّتين متوازيتين بنفس المعطيات عند كل فتح (الملخّص + الرسم البياني).
 * هذا الغلاف يجعل الاستدعاءين المتطابقين يتشاركان نفس طلب الشبكة، ويجعل
 * إعادة فتح الشاشة خلال المهلة فورية.
 */
const ANALYTICS_TTL_MS = 60_000;
const analyticsCache = new Map<string, { ts: number; data: AgencyManagerAnalytics }>();
const analyticsInflight = new Map<string, Promise<AgencyManagerAnalytics>>();

const analyticsKey = (p: string, d: string, i: string) => `${p}|${d}|${i}`;

const fetchAgencyAnalyticsCached = (
  input: { period?: AgencyAnalyticsPeriod; dataType?: AgencyDataType; incomeType?: AgencyIncomeFilter },
  opts?: { force?: boolean },
): Promise<AgencyManagerAnalytics> => {
  const period = (input.period ?? 'week') as string;
  const dataType = (input.dataType ?? 'income') as string;
  const incomeType = (input.incomeType ?? 'all') as string;
  const key = analyticsKey(period, dataType, incomeType);

  if (!opts?.force) {
    const cached = analyticsCache.get(key);
    if (cached && Date.now() - cached.ts < ANALYTICS_TTL_MS) {
      return Promise.resolve(cached.data);
    }
    const inflight = analyticsInflight.get(key);
    if (inflight) return inflight;
  }

  const fn = httpsCallable<typeof input, AgencyManagerAnalytics>(
    functions,
    'getAgencyManagerAnalytics',
  );
  const promise = fn({ period: input.period, dataType: input.dataType, incomeType: input.incomeType })
    .then((res) => {
      analyticsCache.set(key, { ts: Date.now(), data: res.data });
      analyticsInflight.delete(key);
      return res.data;
    })
    .catch((e) => {
      analyticsInflight.delete(key);
      throw e;
    });
  analyticsInflight.set(key, promise);
  return promise;
};

/** إبطال كاش التحليلات (يُستخدم مع السحب للتحديث) */
export const invalidateAgencyAnalyticsCache = (): void => {
  analyticsCache.clear();
  analyticsInflight.clear();
};

/**
 * جلب ملخص الدخل للوكالة (يستخدمه مركز الوكالة → تاب الدخل)
 *
 * @param period 'week' | '4weeks' | 'last_week'
 */
export const getAgencyEarningsSummary = async (
  period: 'week' | 'last_week' | '4weeks' = 'week',
  opts?: { force?: boolean },
): Promise<AgencyEarningsSummary> => {
  const agency = await getMyAgency();
  if (!agency) {
    return {
      totalEarnings: 0,
      todayEarnings: 0,
      memberCount: 0,
      topMembers: [],
      potentialBonus: 0,
      agentBonus: 0,
    };
  }

  const analyticsPeriod =
    period === '4weeks' ? '4weeks_day' : period;

  try {
    const data = await fetchAgencyAnalyticsCached(
      {
        period: analyticsPeriod as AgencyAnalyticsPeriod,
        dataType: 'income',
        incomeType: 'all',
      },
      { force: opts?.force },
    );
    const totalEarnings = data.total ?? 0;
    const todayEarnings = data.todayTotal ?? 0;
    const topMembers = (data.hosts ?? []).slice(0, 10).map((h) => ({
      uid: h.uid,
      name: h.name,
      avatar: h.avatar,
      earnings: h.earnings,
    }));

    let bonusPct = 0;
    if (totalEarnings >= 400000) bonusPct = 15;
    else if (totalEarnings >= 40000) bonusPct = 10;
    const agentBonus = Math.floor((totalEarnings * bonusPct) / 100);

    return {
      totalEarnings,
      todayEarnings,
      memberCount: data.hosts?.length ?? 0,
      topMembers,
      potentialBonus: agentBonus,
      agentBonus,
    };
  } catch {
    const members = await getMyAgencyMembers();
    const totalEarnings = members.reduce((sum, m) => sum + (m.pearlsEarned ?? 0), 0);
    const topMembers = [...members]
      .sort((a, b) => (b.pearlsEarned ?? 0) - (a.pearlsEarned ?? 0))
      .slice(0, 10)
      .map((m) => ({
        uid: m.uid,
        name: m.uidName,
        avatar: m.uidAvatar,
        earnings: m.pearlsEarned ?? 0,
      }));
    let bonusPct = 0;
    if (totalEarnings >= 400000) bonusPct = 15;
    else if (totalEarnings >= 40000) bonusPct = 10;
    const agentBonus = Math.floor((totalEarnings * bonusPct) / 100);
    return {
      totalEarnings,
      todayEarnings: 0,
      memberCount: members.length,
      topMembers,
      potentialBonus: agentBonus,
      agentBonus,
    };
  }
};

/** مستوى الوكالة الحالي — حسب دعم الفترة (كوينز) + يحترم التعديل اليدوي */
export async function getAgencyPeriodLevel(
  period: 'week' | 'last_week' | '4weeks' = 'week',
  agencyId?: string,
): Promise<number> {
  void period;
  const levelsCfg = await loadAgencyLevelsConfigDoc();
  const resolvedId = await resolveAgencyIdForPeriodLevel(agencyId);
  if (resolvedId) {
    try {
      const snap = await getDoc(doc(firestore, 'agencies', resolvedId));
      const data = snap.data();
      if (data?.periodLevelManual === true) {
        const manual = Number(data.periodLevel);
        if (manual >= 1) return manual;
      }
    } catch {
      /* fall through */
    }
  }
  const supportCoins = resolvedId ? await getAgencyPeriodSupportCoins(resolvedId) : 0;
  return computeAgencyLevel(supportCoins, levelsCfg);
}

async function resolveAgencyIdForPeriodLevel(agencyId?: string): Promise<string | null> {
  if (agencyId) return agencyId;
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const owned = await getDocs(
      query(collection(firestore, 'agencies'), where('ownerUid', '==', user.uid), limit(1)),
    );
    if (!owned.empty) return owned.docs[0]?.id ?? null;
    const userSnap = await getDoc(doc(firestore, 'users', user.uid));
    const fromUser = String(userSnap.data()?.agencyId ?? '').trim();
    return fromUser || null;
  } catch {
    return null;
  }
}

/** مستوى فعّال — يحترم التعديل اليدوي من لوحة التحكم إن وُجد */
export async function getAgencyEffectivePeriodLevel(agencyId: string): Promise<number> {
  return getAgencyPeriodLevel('week', agencyId);
}

/** يحدّث مستوى الوكالة على غرفة RTDB — للوكيل فقط */
export async function syncAgencyPeriodLevelToRoom(roomId: string): Promise<number> {
  const roomSnap = await get(ref(realtimeDb, `rooms/${roomId}`));
  const agencyId = String(roomSnap.val()?.agencyId ?? '');
  const level = agencyId
    ? await getAgencyEffectivePeriodLevel(agencyId)
    : await getAgencyPeriodLevel('week');
  const patch: Record<string, unknown> = {
    agencyPeriodLevel: level,
    updatedAt: Date.now(),
  };
  if (!isAgencyThroneUnlockedByLevel(level)) {
    patch.throneEnabled = false;
  }
  await update(ref(realtimeDb, `rooms/${roomId}`), patch);
  return level;
}

export { AGENCY_THRONE_UNLOCK_LEVEL, isAgencyThroneUnlockedByLevel } from '@/services/agencyLevels';

export type AgencyAnalyticsPeriod = 'week' | 'last_week' | '4weeks_day' | '4weeks_week';
export type AgencyDataType = 'income' | 'people';
export type AgencyIncomeFilter = 'all' | 'chat' | 'gifts' | 'calls' | 'refund' | 'other';

export interface AgencyAnalyticsSeriesPoint {
  label: string;
  value: number;
}

export interface AgencyAnalyticsHostRow {
  uid: string;
  name: string;
  avatar: string;
  earnings: number;
  totalPearlsEarned: number;
}

export interface AgencyManagerAnalytics {
  agencyId: string;
  period: AgencyAnalyticsPeriod;
  dataType: AgencyDataType;
  incomeType: AgencyIncomeFilter;
  series: AgencyAnalyticsSeriesPoint[];
  total: number;
  todayTotal: number;
  cycleEndsAt: number;
  hosts: AgencyAnalyticsHostRow[];
}

export const getAgencyManagerAnalytics = async (
  input: {
    period?: AgencyAnalyticsPeriod;
    dataType?: AgencyDataType;
    incomeType?: AgencyIncomeFilter;
  },
  opts?: { force?: boolean },
): Promise<AgencyManagerAnalytics> => {
  // يمرّ عبر الكاش المشترك حتى لا يتكرّر نفس الطلب مع ملخّص الدخل عند الفتح
  return fetchAgencyAnalyticsCached(input, opts);
};

export interface AgencyHostCompletionRow {
  uid: string;
  name: string;
  avatar: string;
  publicAccountId: string;
  completions: number;
  todayCompletions: number;
  pearlsThisWeek: number;
}

export const getAgencyHostCompletions = async (searchId?: string) => {
  const fn = httpsCallable<
    { searchId?: string },
    {
      agencyId: string;
      cycleEndsAt: number;
      totalCompletions: number;
      todayCompletions: number;
      hosts: AgencyHostCompletionRow[];
    }
  >(functions, 'getAgencyHostCompletions');
  const res = await fn({ searchId: searchId?.trim() || undefined });
  return res.data;
};

export interface AgencyRefundRow {
  id: string;
  agencyId: string;
  hostUid: string;
  hostName: string;
  supporterUid: string;
  supporterName: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: number;
}

export const listAgencyRefunds = async (agencyId?: string): Promise<AgencyRefundRow[]> => {
  const fn = httpsCallable<
    { agencyId?: string },
    { refunds: AgencyRefundRow[] }
  >(functions, 'listAgencyRefunds');
  const res = await fn(agencyId ? { agencyId } : {});
  return res.data.refunds ?? [];
};

export const agentRefundSupporterPearls = async (input: {
  hostIdentifier: string;
  supporterIdentifier: string;
  amount: number;
  reason?: string;
}) => {
  const fn = httpsCallable(functions, 'agentRefundSupporterPearls');
  return fn(input);
};

/**
 * جمع ماسة من عضو محدّد (يستخدم في شاشة "جمع الماسة بالنيابة")
 * هذه دالة وصفية فقط — التحويل الفعلي يتم عبر requestAgentWithdrawal من العضو
 */
export const getMemberPearlsForCollection = async (
  agencyId: string,
  startTime: number,
  endTime: number,
): Promise<Array<{
  member: AgencyMember;
  pendingWithdrawals: number;
  totalWithdrawn: number;
}>> => {
  // اقرأ كل أعضاء الوكالة
  const membersQ = query(
    collection(firestore, 'agencyMembers'),
    where('agencyId', '==', agencyId),
  );
  const membersSnap = await getDocs(membersQ);
  const members = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AgencyMember));

  // اقرأ السحوبات في الفترة
  const wQ = query(
    collection(firestore, 'withdrawals'),
    where('agencyId', '==', agencyId),
    where('type', '==', 'via_agent'),
    orderBy('createdAt', 'desc'),
    limit(500),
  );
  const wSnap = await getDocs(wQ);
  const withdrawals = wSnap.docs.map((d) => d.data() as any);

  // اجمع لكل عضو
  return members.map((m) => {
    const memberWithdrawals = withdrawals.filter(
      (w) => w.uid === m.uid && w.createdAt >= startTime && w.createdAt <= endTime,
    );
    const pending = memberWithdrawals
      .filter((w) => w.status === 'pending')
      .reduce((sum, w) => sum + (w.amount ?? 0), 0);
    const completed = memberWithdrawals
      .filter((w) => w.status === 'completed')
      .reduce((sum, w) => sum + (w.netAmount ?? 0), 0);
    return {
      member: m,
      pendingWithdrawals: pending,
      totalWithdrawn: completed,
    };
  });
};

export interface BdInviteRow {
  id: string;
  fromUid: string;
  fromAgencyId?: string;
  fromName: string;
  fromAgencyName: string;
  invitedUid: string;
  invitedName: string;
  invitedAvatar: string;
  commissionPercent?: number;
  benefitMonths?: number;
  status: string;
  createdAt: number;
  applicationId?: string;
  agencyId?: string;
}

export interface BdReferralConfig {
  commissionPercent: number;
  benefitMonths: number;
}

export interface BdReferredAgency {
  id: string;
  name: string;
  ownerName: string;
  ownerAvatar: string;
  status: string;
  commissionPercent: number;
  benefitMonths: number;
  benefitEndsAt: number;
  benefitActive: boolean;
  memberCount: number;
  femaleHostCount: number;
  activatedAt: number;
}

export interface BdUserLookup {
  uid: string;
  displayName: string;
  avatar: string;
  isAgent: boolean;
  hasAgency: boolean;
  publicAccountId: string;
}

/** بحث مستخدم لمركز BD — عبر Cloud Function */
export const lookupUserForBd = async (identifier: string): Promise<BdUserLookup> => {
  try {
    const user = await ensureCallableAuth();
    const token = await user.getIdToken();
    return await callCallableHttp<{ identifier: string }, BdUserLookup>(
      'lookupUserByIdentifier',
      { identifier: identifier.trim() },
      token,
    );
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

/** إرسال دعوة BD — عبر Cloud Function */
export const inviteAgencyOwner = async (invitedIdentifier: string): Promise<void> => {
  try {
    const user = await ensureCallableAuth();
    const token = await user.getIdToken();
    await callCallableHttp<{ invitedIdentifier: string }, { ok: boolean }>(
      'sendBdAgencyInvite',
      { invitedIdentifier: invitedIdentifier.trim() },
      token,
    );
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

/**
 * العضو يقبل دعوة مباشرة من الوكيل
 */
export const acceptDirectAgencyInvite = async (
  inviteId: string,
): Promise<{
  agencyId: string;
  agencyName: string;
  needsGenderVerification: boolean;
  pendingAgentConfirm?: boolean;
}> => {
  try {
    const current = auth.currentUser;
    if (!current?.uid) throw new Error('يجب تسجيل الدخول');
    // التوثيق اختياري عند الانضمام — الخادم يقبل غير الموثّقة كعضو (أُزيلت بوابة العميل القديمة)
    const user = await ensureCallableAuth();
    const token = await user.getIdToken();
    const res = await callCallableHttp<
      { inviteId: string },
      {
        ok: boolean;
        agencyId: string;
        agencyName: string;
        needsGenderVerification: boolean;
        // موافقة الانضمام مفعّلة: المضيفة قبلت والطلب بانتظار تأكيد الوكيل النهائي
        pendingAgentConfirm?: boolean;
      }
    >('acceptDirectAgencyInvite', { inviteId }, token);
    return {
      agencyId: res.agencyId,
      agencyName: res.agencyName,
      needsGenderVerification: res.needsGenderVerification ?? false,
      pendingAgentConfirm: res.pendingAgentConfirm === true,
    };
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

/** العضو يرفض دعوة مباشرة من الوكيل */
export const rejectDirectAgencyInvite = async (inviteId: string): Promise<void> => {
  try {
    const user = await ensureCallableAuth();
    const token = await user.getIdToken();
    await callCallableHttp<{ inviteId: string }, { ok: boolean }>(
      'rejectDirectAgencyInvite',
      { inviteId },
      token,
    );
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

// ========================================================
// JOIN REQUESTS (موافقة الانضمام — للوكيل)
// ========================================================

/** الوكيل يوافق على طلب انضمام معلّق — يُنهي الانضمام فعلياً */
export const approveAgencyJoinRequest = async (
  inviteId: string,
): Promise<{ agencyId: string; agencyName: string; joined: boolean; needsGenderVerification: boolean }> => {
  try {
    const user = await ensureCallableAuth();
    const token = await user.getIdToken();
    const res = await callCallableHttp<
      { inviteId: string },
      {
        ok: boolean;
        agencyId: string;
        agencyName: string;
        joined: boolean;
        needsHostVerification: boolean;
        needsGenderVerification: boolean;
      }
    >('approveAgencyJoinRequest', { inviteId }, token);
    return {
      agencyId: res.agencyId,
      agencyName: res.agencyName,
      joined: res.joined ?? false,
      needsGenderVerification: res.needsGenderVerification ?? false,
    };
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

/** الوكيل يرفض طلب انضمام معلّق */
export const rejectAgencyJoinRequest = async (inviteId: string): Promise<void> => {
  try {
    const user = await ensureCallableAuth();
    const token = await user.getIdToken();
    await callCallableHttp<{ inviteId: string }, { ok: boolean }>(
      'rejectAgencyJoinRequest',
      { inviteId },
      token,
    );
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

/** جلب طلبات الانضمام المعلّقة لوكالة المستخدم الحالي (للوكيل) */
export const fetchAgencyJoinRequests = async (): Promise<AgencyInvite[]> => {
  try {
    const user = await ensureCallableAuth();
    const token = await user.getIdToken();
    const res = await callCallableWithAuth<
      Record<string, never>,
      { requests: AgencyInvite[] }
    >('listAgencyJoinRequests', {}, token);
    return res.requests ?? [];
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

/** الوكيل يلغي دعوة معلّقة */
export const cancelAgencyHostInvite = async (inviteId: string): Promise<void> => {
  try {
    const user = await ensureCallableAuth();
    const token = await user.getIdToken();
    await callCallableHttp<{ inviteId: string }, { ok: boolean }>(
      'cancelAgencyHostInvite',
      { inviteId },
      token,
    );
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

/** جلب الدعوات المُستلَمة للمستخدم الحالي (كمدعو) */
export const fetchMyReceivedInvites = async (): Promise<AgencyInvite[]> => {
  try {
    const user = await ensureCallableAuth();
    const token = await user.getIdToken();
    const res = await callCallableWithAuth<
      Record<string, never>,
      { invites: AgencyInvite[] }
    >('listMyReceivedInvites', {}, token);
    return res.invites ?? [];
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

/** دعوات الوكالة المعلّقة للمستخدم الحالي — للمودال داخل الروم */
export function subscribeToMyReceivedAgencyInvites(
  callback: (invites: AgencyInvite[]) => void,
): () => void {
  const user = auth.currentUser;
  if (!user) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(firestore, 'agencyInvites'),
    where('invitedUid', '==', user.uid),
    where('status', '==', 'pending'),
    limit(20),
  );
  return onSnapshot(
    q,
    (snap) => {
      const invites = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as AgencyInvite))
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      callback(invites);
    },
    () => callback([]),
  );
}

/** غرفة الوكالة موجودة مسبقاً؟ — دخول مباشر بدون المرور بالدالة السحابية */
async function resolveExistingAgencyLiveRoomId(agencyId: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(firestore, 'agencies', agencyId));
    const liveRoomId = snap.exists() ? String(snap.data()?.liveRoomId ?? '') : '';
    if (!liveRoomId) return null;
    const roomSnap = await get(ref(realtimeDb, `rooms/${liveRoomId}`));
    return roomSnap.exists() ? liveRoomId : null;
  } catch {
    return null;
  }
}

/** غرفة الوكالة العامة — إنشاء/جلب عبر Cloud Function ثم الدخول كمستمع */
export const enterAgencyLiveRoom = async (agencyId: string): Promise<string> => {
  const id = agencyId.trim();
  try {
    // #10: httpsCallable وحده غير موثوق على React Native (Gen2) — كان يفشل
    // بـ «internal» فيمنع العودة لنفس الروم. HTTP+Bearer مع fallback للSDK.
    const user = await ensureCallableAuth();
    const token = await user.getIdToken();
    const res = await callCallableWithAuth<{ agencyId: string }, { roomId: string }>(
      'enterAgencyLiveRoom',
      { agencyId: id },
      token,
    );
    if (res?.roomId) return res.roomId;
  } catch (e) {
    // الدخول لا يُحجب على الدالة السحابية — الغرفة القائمة معروفة في Firestore
    const existing = await resolveExistingAgencyLiveRoomId(id);
    if (existing) return existing;
    throw new Error(translateCallableError(e));
  }
  const existing = await resolveExistingAgencyLiveRoomId(id);
  if (existing) return existing;
  throw new Error('تعذّر فتح غرفة الوكالة');
};

/** جلب دعوات BD — عبر Cloud Function (بدون فهرس Firestore على التطبيق) */
export const fetchMyBDInvites = async (): Promise<BdInviteRow[]> => {
  try {
    const user = await ensureCallableAuth();
    const token = await user.getIdToken();
    const res = await callCallableHttp<Record<string, never>, { invites: BdInviteRow[] }>(
      'listMyBdInvites',
      {},
      token,
    );
    return res.invites ?? [];
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

/** إعدادات إحالة BD من لوحة الإدارة */
export const fetchBdReferralConfig = async (): Promise<BdReferralConfig> => {
  try {
    const user = await ensureCallableAuth();
    const token = await user.getIdToken();
    return await callCallableHttp<Record<string, never>, BdReferralConfig>(
      'getBdReferralConfigPublic',
      {},
      token,
    );
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

/** الوكالات التي حوّلتها عبر مركز BD */
export const fetchMyBdReferredAgencies = async (): Promise<{
  agencies: BdReferredAgency[];
  bdReferralPearlsTotal: number;
}> => {
  try {
    const user = await ensureCallableAuth();
    const token = await user.getIdToken();
    const res = await callCallableHttp<
      Record<string, never>,
      { agencies: BdReferredAgency[]; bdReferralPearlsTotal: number }
    >('listMyBdReferredAgencies', {}, token);
    return {
      agencies: res.agencies ?? [],
      bdReferralPearlsTotal: res.bdReferralPearlsTotal ?? 0,
    };
  } catch (e) {
    throw new Error(translateCallableError(e));
  }
};

// ==================== MEMBER BALANCES ====================

export interface AgencyMemberBalance {
  id: string;
  uid: string;
  name: string;
  avatar: string;
  role: string;
  isFemaleHost: boolean;
  hostVerified: boolean;
  pearlsEarned: number;
  pearlsTransferredToAgent: number;
  availablePearls: number;
}

/** الوكيل: أرصدة ماسة جميع مضيفاته — عبر Cloud Function */
export const getAgencyMemberBalances = async (): Promise<AgencyMemberBalance[]> => {
  const fn = httpsCallable<
    Record<string, never>,
    { members: AgencyMemberBalance[]; agencyId: string }
  >(functions, 'getAgencyMemberBalances');
  const res = await fn({});
  return res.data.members ?? [];
};

// ==================== HOST DASHBOARD ====================

export interface HostCharger {
  uid: string;
  name: string;
  avatar: string;
  total: number;
}

export interface HostDashboardStats {
  agencyName: string;
  agencyId: string;
  pearlsEarned: number;
  availablePearls: number;
  hostRank: number | null;
  totalFemaleHosts: number;
  topChargers: HostCharger[];
}

/** المضيفة: إحصائياتها الخاصة داخل الوكالة — عبر Cloud Function */
export const getHostDashboardStats = async (): Promise<HostDashboardStats> => {
  const fn = httpsCallable<Record<string, never>, HostDashboardStats>(
    functions,
    'getHostDashboardStats',
  );
  const res = await fn({});
  return res.data;
};

/** تحديث صلاحيات مضيف معين في الوكالة — يتطلب أن يكون المستدعي هو مالك الوكالة */
export const updateMemberPermissions = async (
  memberId: string,
  permissions: AgencyMemberPermissions,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const memberSnap = await getDoc(doc(firestore, 'agencyMembers', memberId));
  if (!memberSnap.exists()) throw new Error('العضو غير موجود');
  const memberData = memberSnap.data();
  const agencyId = memberData?.agencyId;
  if (!agencyId) throw new Error('الوكالة غير محددة');

  const agencySnap = await getDoc(doc(firestore, 'agencies', agencyId));
  if (!agencySnap.exists()) throw new Error('الوكالة غير موجودة');
  if (agencySnap.data()?.ownerUid !== user.uid) {
    throw new Error('فقط مالك الوكالة يمكنه تعديل الصلاحيات');
  }

  await updateDoc(doc(firestore, 'agencyMembers', memberId), {
    permissions,
  });
};

/** جلب وثيقة العضوية الحالية للمستخدم الحالي */
export const getMyAgencyMembership = async (): Promise<AgencyMember | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  const q = query(
    collection(firestore, 'agencyMembers'),
    where('uid', '==', user.uid),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  if (!d) return null;
  return { id: d.id, ...d.data() } as AgencyMember;
};

/** الاستماع الحي للحد من صلاحيات المستخدم في وكالته */
export const subscribeToMyMembership = (
  callback: (member: AgencyMember | null) => void,
): (() => void) | null => {
  const user = auth.currentUser;
  if (!user) return null;
  const q = query(
    collection(firestore, 'agencyMembers'),
    where('uid', '==', user.uid),
    limit(1),
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      callback(null);
    } else {
      const d = snap.docs[0];
      if (!d) {
        callback(null);
      } else {
        callback({ id: d.id, ...d.data() } as AgencyMember);
      }
    }
  });
};

/**
 * تسجيل ماسة مكتسبة لعضو الوكالة عند استلام هدية في روم الوكالة.
 * يُحدّث pearlsEarned في وثيقة agencyMembers/{docId}.
 */
export async function recordAgencyMemberEarning(
  recipientUid: string,
  pearls: number,
): Promise<void> {
  if (!recipientUid || pearls <= 0) return;
  try {
    const q = query(
      collection(firestore, 'agencyMembers'),
      where('uid', '==', recipientUid),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const memberDoc = snap.docs[0]!;
    await updateDoc(memberDoc.ref, {
      pearlsEarned: increment(pearls),
    });
  } catch {}
}
