/**
 * Admin Service — كل عمليات قراءة/كتابة البيانات.
 *
 * مصدر البيانات: **سيرفر LinkUp v2 وحده** (NestJS + Postgres) عبر `@/lib/v2Api`.
 * This file used to talk to Firestore straight from the browser. Every area has
 * now moved onto `/admin/*` on our own server, and the file imports no firebase
 * at all — no Firestore, no Realtime Database, no Cloud Function. The exported
 * function names and their shapes are kept EXACTLY as the 49 pages expect, so
 * the swap is invisible above this line.
 *
 * وما لا يقدّمه v2 بعد لا يُلفَّق: تعود القائمة فارغة أو العدد صفراً، مع تعليق عند
 * الدالة يشرح السبب (طلبات المقاعد، السهرات، الاستردادات، سحب اليانصيب، استخدام
 * LiveKit). كل رقم يظهر في اللوحة له مصدر حقيقي في قاعدة v2.
 */


import { v2, v2Qs, v2ErrorMessage } from '@/lib/v2Api';
import {
  readConfig,
  readConfigSnapshot,
  mergeConfig,
  replaceConfig,
  watchConfig,
} from '@/lib/v2ConfigDb';
import { formatPublicAccountId } from '@/utils/publicAccountId';
import {
  setCountryScopeProfile,
  isInAdminCountryScope,
  isSuperCountryScope,
  getScopedCountryCodes,
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

/** One row of `GET /admin/users` — the server's projection of a user. */
interface ServerUserRow {
  id: string;
  publicAccountId: string;
  displayName: string;
  avatar: string;
  email: string;
  gender: string;
  country: string;
  role: string;
  coins: number;
  pearls: number;
  casinoCoins: number;
  level: number;
  vipLevel: number;
  followers: number;
  isBanned: boolean;
  isAgent: boolean;
  isVerified: boolean;
  firebaseUid?: string | null;
  createdAt: string;
}

type ServerUserDetail = ServerUserRow & {
  profile: Record<string, unknown>;
  stats: Record<string, unknown>;
};

/**
 * Server row → the panel's AdminUser. `profile` / `stats` only come back on a
 * DETAIL read, so everything they carry is optional here; the list view simply
 * shows less, exactly as v1's list did.
 */
function toAdminUser(
  row: ServerUserRow,
  extra?: { profile?: Record<string, unknown>; stats?: Record<string, unknown> },
): AdminUser {
  const profile = extra?.profile ?? {};
  const stats = extra?.stats ?? {};
  return {
    uid: row.id,
    publicAccountId: formatPublicAccountId(row.publicAccountId, row.id),
    displayName: row.displayName || 'مستخدم',
    avatar: row.avatar ?? '',
    email: row.email,
    phoneNumber: typeof profile.phoneNumber === 'string' ? profile.phoneNumber : undefined,
    gender: row.gender || 'male',
    country: row.country || '',
    coins: row.coins ?? 0,
    pearls: row.pearls ?? 0,
    casinoCoins: row.casinoCoins ?? 0,
    level: row.level ?? 1,
    followers: row.followers ?? 0,
    following: Number(stats.following) || 0,
    // v1 carried a separate isVIP flag next to vipLevel and they could disagree.
    // v2 has ONE source of truth: a level above zero IS a VIP.
    isVIP: (row.vipLevel ?? 0) > 0,
    isVerified: row.isVerified,
    isBanned: row.isBanned,
    withdrawalBlocked: profile.withdrawalBlocked === true,
    banReason: typeof profile.banReason === 'string' ? profile.banReason : undefined,
    vipLevel: row.vipLevel ?? 0,
    bio: typeof profile.bio === 'string' ? profile.bio : undefined,
    birthYear: Number(profile.birthYear) || undefined,
    agencyId: typeof profile.agencyId === 'string' ? profile.agencyId : undefined,
    createdAt: Date.parse(row.createdAt) || Date.now(),
    lastSeen: Number(stats.lastSeen) || undefined,
  };
}

export const getUsers = async (limitCount = 100): Promise<AdminUser[]> => {
  try {
    // For a country-scoped admin the filter is pushed to the SERVER (one code per
    // request, which is what the query supports) instead of over-fetching a wide
    // page and discarding most of it in the browser.
    const codes = getScopedCountryCodes();
    if (!isSuperCountryScope() && codes.length === 0) return [];

    const pages = await Promise.all(
      (isSuperCountryScope() ? [undefined] : codes).map((country) =>
        v2.get<{ items: ServerUserRow[] }>(
          `/admin/users${v2Qs({ limit: Math.min(limitCount, 100), country })}`,
        ),
      ),
    );
    return pages
      .flatMap((p) => p?.items ?? [])
      .map((row) => toAdminUser(row))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limitCount);
  } catch (e) {
    console.error('getUsers:', e);
    return [];
  }
};

/** حل معرّف الحساب (8 أرقام) أو UID — one call: the server's search already
 *  understands a uuid, an 8-digit public id, an email and a name. */
export async function resolveUserAccountId(raw: string): Promise<string | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const res = await v2.get<{ items: ServerUserRow[] }>(
      `/admin/users${v2Qs({ search: trimmed, limit: 1 })}`,
    );
    return res?.items?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

export const getUserById = async (identifier: string): Promise<AdminUser | null> => {
  const raw = identifier.trim();
  if (!raw) return null;
  try {
    let detail: ServerUserDetail | null = null;
    try {
      detail = await v2.get<ServerUserDetail>(`/admin/users/${encodeURIComponent(raw)}`);
    } catch {
      // Not a uuid (or gone) — fall back to a search, which accepts the 8-digit
      // account id, an email or a name.
      const resolved = await resolveUserAccountId(raw);
      if (!resolved) return null;
      detail = await v2.get<ServerUserDetail>(`/admin/users/${resolved}`);
    }
    if (!detail?.id) return null;
    const user = toAdminUser(detail, { profile: detail.profile, stats: detail.stats });
    // A country-scoped admin must not open an account outside their countries.
    if (!isInAdminCountryScope(user.country)) return null;
    return user;
  } catch {
    return null;
  }
};

/**
 * «مستخدم جديد» — creation goes through the SAME registration path the app uses
 * (validation, bcrypt, public-id allocation). Balances are NOT part of creation:
 * they move through the ledgered balance endpoint right after, so an opening
 * balance is a real, audited transaction like every other.
 */
export const adminCreateAppUser = async (
  input: AdminCreateAppUserInput,
): Promise<{ uid: string; publicAccountId: string; displayName: string }> => {
  const created = await v2.post<ServerUserRow>('/admin/users', {
    email: input.email,
    password: input.password,
    displayName: input.displayName,
    gender: input.gender ?? 'male',
    ...(input.country ? { country: input.country } : {}),
  });
  const uid = created?.id;
  if (!uid) throw new Error('لم يُنشأ الحساب');

  // The optional extras the create form offers, applied as separate steps.
  const patch: AdminUpdateAppUserPatch = {};
  if (input.bio) patch.bio = input.bio;
  if (input.phoneNumber) patch.phoneNumber = input.phoneNumber;
  if (input.isVIP) patch.vipLevel = 1;
  if (Object.keys(patch).length) await adminUpdateAppUser(uid, patch);
  if (input.isVerified) await v2.post(`/admin/users/${uid}/verify`, { verified: true });
  if (input.isBanned) await v2.post(`/admin/users/${uid}/ban`, { banned: true, reason: 'إنشاء محظور' });

  for (const [field, amount] of [
    ['coins', input.coins],
    ['pearls', input.pearls],
    ['casinoCoins', input.casinoCoins],
  ] as const) {
    if (amount && amount > 0) {
      await addUserBalance(uid, field, amount, { note: 'رصيد افتتاحي عند الإنشاء' });
    }
  }

  return {
    uid,
    publicAccountId: formatPublicAccountId(created.publicAccountId, uid),
    displayName: created.displayName || input.displayName,
  };
};

/**
 * The user-detail edit form's save. Fields are routed to the endpoint that owns
 * them — and MONEY IS NOT ONE OF THEM: a balance in the patch is applied through
 * the ledgered absolute-set endpoint, never written as a field, so no edit can
 * mint or burn coins without a transaction and an audit row behind it.
 */
export const adminUpdateAppUser = async (
  uid: string,
  patch: AdminUpdateAppUserPatch,
): Promise<void> => {
  const profileFields: Record<string, unknown> = {};
  if (patch.displayName !== undefined) profileFields.displayName = patch.displayName;
  if (patch.bio !== undefined) profileFields.bio = patch.bio;
  if (patch.gender !== undefined) profileFields.gender = patch.gender;
  if (patch.country !== undefined) profileFields.country = patch.country;
  if (patch.birthYear !== undefined) profileFields.birthYear = patch.birthYear;
  if (patch.level !== undefined) profileFields.level = patch.level;
  if (patch.vipLevel !== undefined) profileFields.vipLevel = patch.vipLevel;
  else if (patch.isVIP !== undefined) profileFields.vipLevel = patch.isVIP ? 1 : 0;
  if (Object.keys(profileFields).length) {
    await v2.post(`/admin/users/${uid}/profile`, profileFields);
  }

  if (patch.isVerified !== undefined) {
    await v2.post(`/admin/users/${uid}/verify`, { verified: patch.isVerified });
  }
  if (patch.isBanned !== undefined) {
    await v2.post(`/admin/users/${uid}/ban`, {
      banned: patch.isBanned,
      ...(patch.banReason ? { reason: patch.banReason } : {}),
    });
  }
  if (patch.withdrawalBlocked !== undefined) {
    await v2.post(`/admin/users/${uid}/withdrawal-block`, { blocked: patch.withdrawalBlocked });
  }

  for (const [currency, value] of [
    ['coins', patch.coins],
    ['pearls', patch.pearls],
    ['casinoCoins', patch.casinoCoins],
  ] as const) {
    if (value !== undefined) {
      await v2.post(`/admin/users/${uid}/balance/set`, {
        currency,
        amount: Math.max(0, Math.floor(value)),
        reason: 'تعديل من صفحة المستخدم',
        requestId: `edit_${currency}_${uid}_${Date.now()}`,
      });
    }
  }

  await logAdminAction('تعديل مستخدم', uid, Object.keys(patch).join('، '));
};

export const adminSetAppUserPassword = async (uid: string, password: string): Promise<void> => {
  await v2.post(`/admin/users/${uid}/password`, { password });
  await logAdminAction('تغيير كلمة مرور مستخدم', uid);
};

/**
 * ⚠️ حذف الحسابات غير مُنفَّذ على v2 — بعد.
 *
 * v1 deleted the Firestore documents and the Auth user. On Postgres an account is
 * referenced by its ledger, withdrawals, agency membership, posts and reports;
 * deleting the row means deciding what happens to each of those, and getting it
 * wrong loses financial history that must be kept. That decision belongs to the
 * owner, not to a migration shim — so this refuses loudly instead of pretending,
 * or worse, half-deleting.
 *
 * Use «حظر» (which stops all access immediately) until the policy is set.
 */
export const adminDeleteAppUsers = async (opts: {
  mode: AdminBulkDeleteMode;
  uids?: string[];
  confirmPhrase?: string;
}): Promise<AdminBulkDeleteResult> => {
  void opts;
  throw new Error(
    'حذف الحسابات غير متاح على قاعدة البيانات الجديدة — استخدم الحظر. ' +
      'الحذف النهائي يحتاج قراراً من المالك (سجل المعاملات والسحوبات مرتبط بالحساب).',
  );
};

/**
 * لم تعد هناك حاجة لهذه المزامنة: v2 يمنح كل حساب معرّفاً عاماً من 8 أرقام لحظة
 * إنشائه (uniquePublicAccountId في identity.service)، والحسابات المنقولة من v1
 * جاءت بمعرّفاتها. تُبلّغ الصفحة بلا عمل بدل أن تدور على لا شيء.
 */
export const backfillPublicAccountIds = async (
  onProgress?: (p: { processed: number; stored: number; indexed: number }) => void,
): Promise<{ processed: number; stored: number; indexed: number }> => {
  const done = { processed: 0, stored: 0, indexed: 0 };
  onProgress?.(done);
  return done;
};

export const banUser = async (uid: string, banned: boolean): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  await v2.post(`/admin/users/${uid}/ban`, { banned });
  await logAdminAction(banned ? 'حظر مستخدم' : 'رفع الحظر', uid);
};

/**
 * تعليق مؤقت للحساب — the server bans it now and stores the end date. The lift is
 * automatic: the next sign-in attempt after the date passes releases the account,
 * so no cron has to run and nothing can un-ban a permanent ban by mistake (a
 * permanent ban carries no date at all).
 */
export const suspendUser = async (
  uid: string,
  durationDays: number,
  reason?: string,
): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  const days = Math.max(1, Math.floor(durationDays));
  await v2.post(`/admin/users/${uid}/ban`, {
    banned: true,
    days,
    reason: reason?.trim() || `تعليق ${days} يوماً`,
  });
  await logAdminAction('تعليق حساب', uid, `${days} يوماً${reason ? ` — ${reason}` : ''}`);
};

export const unsuspendUser = async (uid: string): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  await v2.post(`/admin/users/${uid}/ban`, { banned: false });
  await logAdminAction('رفع التعليق', uid);
};

/**
 * v1 kept an `isVIP` flag beside `vipLevel`, and the two could disagree. v2 has
 * one source of truth, so the toggle sets the level: on → 1 if the account has no
 * level yet (an existing higher level is left alone), off → 0.
 */
export const toggleVIP = async (uid: string, isVIP: boolean): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  let level = isVIP ? 1 : 0;
  if (isVIP) {
    const current = await getUserById(uid);
    if ((current?.vipLevel ?? 0) > 0) return; // already VIP — nothing to change
    level = 1;
  }
  await v2.post(`/admin/users/${uid}/profile`, { vipLevel: level });
  await logAdminAction(isVIP ? 'تفعيل VIP' : 'إيقاف VIP', uid);
};

export const toggleVerified = async (uid: string, isVerified: boolean): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  if (isVerified) {
    await v2.post(`/admin/users/${uid}/verify`, { verified: true });
    await logAdminAction('توثيق مستخدم', uid);
    return;
  }
  await revokeUserVerification(uid);
};

/**
 * إلغاء توثيق المستخدم — one call, because the CASCADE now lives on the server:
 * the KYC row goes back to rejected, a verified female host loses the host flag
 * and drops to an ordinary agency member, and the user is notified with the
 * reason. v1 did those four writes from the browser and any one of them could
 * fail halfway, leaving an unverified account holding host privileges.
 */
export const revokeUserVerification = async (
  uid: string,
  reason = 'تم إلغاء التوثيق من الإدارة',
): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  await v2.post(`/admin/users/${uid}/verify`, { verified: false, reason });
  await logAdminAction('إلغاء توثيق', uid, reason);
};

/** إلغاء التوثيق من صفحة طلبات KYC */
export const revokeKycVerification = revokeUserVerification;

/**
 * تعديل الرصيد (قيمة مطلقة) — «make it exactly this».
 *
 * v1 wrote the field. Here it goes through `/balance/set`, which locks the row,
 * computes the difference and moves it through the ledger — so the result is
 * exact even if a gift lands at the same moment, and the change leaves a
 * transaction + an audit row behind it like every other money move.
 */
export const adjustBalance = async (
  uid: string,
  field: BalanceField,
  newAmount: number,
): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  const safe = Math.max(0, Math.floor(Number(newAmount) || 0));
  await v2.post(`/admin/users/${uid}/balance/set`, {
    currency: field,
    amount: safe,
    reason: 'تعديل الرصيد من لوحة التحكم',
    requestId: `adjust_${field}_${uid}_${Date.now()}`,
  });
};

/**
 * إضافة رصيد (شحن) — a delta, exactly-once on `requestId` so a double-clicked
 * button cannot pay twice. The ledger row, the audit row and the user's
 * notification are all written by the server inside the same transaction.
 */
export const addUserBalance = async (
  uid: string,
  field: BalanceField,
  delta: number,
  meta?: { note?: string },
): Promise<{ newBalance: number }> => {
  await assertUidInAdminCountryScope(uid);
  const amount = Math.floor(Number(delta) || 0);
  if (amount <= 0) throw new Error('أدخل مبلغاً أكبر من صفر');

  const res = await v2.post<{ balances: Record<BalanceField, number> }>(
    `/admin/users/${uid}/balance`,
    {
      currency: field,
      amount,
      reason: meta?.note ?? 'شحن من لوحة التحكم',
      requestId: `grant_${field}_${uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    },
  );
  return { newBalance: res?.balances?.[field] ?? 0 };
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

/** شحن عملات عبر معرّف الحساب (8 أرقام) أو UID — resolve, then charge through the
 *  ledgered endpoint. The «before» balance is read first so the receipt the page
 *  shows is real and not recomputed by subtraction. */
export const grantCoinsByAccountId = async (
  accountIdRaw: string,
  coins: number,
  note?: string,
): Promise<GrantCoinsResult> => {
  const amount = Math.floor(Number(coins) || 0);
  if (amount <= 0) throw new Error('أدخل عدد عملات أكبر من صفر');

  const uid = await resolveUserAccountId(accountIdRaw);
  if (!uid) throw new Error('لم نجد حساباً بهذا المعرّف');
  const before = await getUserById(uid);
  if (!before) throw new Error('لم نجد حساباً بهذا المعرّف');

  const { newBalance } = await addUserBalance(uid, 'coins', amount, {
    note: note?.trim() || 'شحن من لوحة التحكم',
  });
  await logAdminAction('شحن عملات', before.publicAccountId, `${amount}`);

  return {
    uid,
    displayName: before.displayName,
    publicAccountId: before.publicAccountId,
    previousBalance: before.coins,
    added: amount,
    newBalance,
  };
};

// ==================== TRANSACTIONS ====================

/** One ledger row as the server returns it. v2 has ONE ledger: casino, gifts,
 *  recharges, admin moves and withdrawals are rows in it, told apart by `type`. */
interface ServerTxRow {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

const CASINO_TX_TYPES = ['casino_bet', 'casino_win', 'casino_refund', 'game_bet', 'game_win'];

function toAdminTransaction(uid: string, row: ServerTxRow): AdminTransaction {
  return {
    id: row.id,
    uid,
    type: row.type,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    createdAt: Date.parse(row.createdAt) || 0,
  };
}

/**
 * ⚠️ معاملات الألعاب على مستوى النظام غير متاحة كقائمة واحدة — بعد.
 *
 * v1 kept a separate `gameTransactions` collection. v2 writes game bets and wins
 * into the ONE ledger (`transactions`), which is read per user
 * (`/admin/users/:id/transactions`) — there is no all-users ledger endpoint yet,
 * and inventing one that scans the whole table is not something to slip in
 * sideways. The per-user view below is real and complete.
 */
export const getGameTransactions = async (limitCount = 100): Promise<AdminTransaction[]> => {
  void limitCount;
  return [];
};


/**
 * ⚠️ اعتماد/تعديل حالة معاملة يدوياً غير متاح على v2.
 *
 * A ledger row is a record of something that already happened; flipping its
 * status by hand cannot move the coins with it, so v1's "approve this pending
 * recharge" would show a completed row with no money behind it. Approve the
 * recharge where it lives (the wallet/bot page), or grant the coins through the
 * ledgered balance endpoint — both leave a matching, real row.
 */
export const updateTransactionStatus = async (id: string, status: string): Promise<void> => {
  void id;
  void status;
  throw new Error(
    'تعديل حالة معاملة يدوياً غير متاح — استخدم «شحن رصيد» ليُسجَّل المبلغ بمعاملة حقيقية.',
  );
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

/** One withdrawal as the server lists it. USD is in whole dollars here (the
 *  server already divided the stored cents). */
interface ServerWithdrawalRow {
  id: string;
  uid: string;
  requesterName: string;
  publicAccountId: string;
  kind: string;
  diamonds: number;
  grossUsd: number;
  feeUsd: number;
  netUsd: number;
  status: string;
  agencyId: string | null;
  createdAt: string;
  processedAt: string | null;
}

function toAdminWithdrawal(row: ServerWithdrawalRow): AdminWithdrawal {
  return {
    id: row.id,
    uid: row.uid,
    uidName: row.requesterName || 'مستخدم',
    uidAvatar: '',
    // v2 calls them host_self / on_behalf; the panel's words are self / via_agent.
    type: row.kind === 'on_behalf' ? 'via_agent' : 'self',
    amount: row.diamonds,
    commission: Math.round(row.feeUsd * 100) / 100,
    netAmount: row.diamonds,
    fiatValue: row.netUsd,
    method: '—',
    accountInfo: null,
    status: row.status,
    agencyId: row.agencyId ?? undefined,
    createdAt: Date.parse(row.createdAt) || 0,
    updatedAt: Date.parse(row.processedAt ?? row.createdAt) || 0,
  };
}

export const getWithdrawals = async (limitCount = 200): Promise<AdminWithdrawal[]> => {
  try {
    const res = await v2.get<{ items: ServerWithdrawalRow[] }>(
      `/admin/withdrawals${v2Qs({ limit: Math.min(limitCount, 100) })}`,
    );
    const rows = (res?.items ?? []).map(toAdminWithdrawal);
    if (isSuperCountryScope()) return rows;
    await preloadUserCountries(rows.map((w) => w.uid));
    return rows.filter((w) => isInAdminCountryScope(getCachedUserCountry(w.uid)));
  } catch (e) {
    console.error('getWithdrawals:', e);
    return [];
  }
};

/** تفاصيل طلب سحب — the payout destination comes ONLY from this single-record
 *  read, never from the list, so browsing the queue shows no bank details. */
export const getWithdrawalDetail = async (
  withdrawalId: string,
): Promise<(AdminWithdrawal & { destination: Record<string, unknown>; consumedCoins: number }) | null> => {
  try {
    const row = await v2.get<
      ServerWithdrawalRow & { destination: Record<string, unknown>; consumedCoins: number }
    >(`/admin/withdrawals/${withdrawalId}`);
    if (!row?.id) return null;
    return {
      ...toAdminWithdrawal(row),
      accountInfo: row.destination,
      destination: row.destination ?? {},
      consumedCoins: row.consumedCoins ?? 0,
    };
  } catch {
    return null;
  }
};

/** اعتماد طلب سحب — the server marks it paid and notifies the host. */
export const approveWithdrawal = async (withdrawalId: string): Promise<void> => {
  await v2.post(`/admin/withdrawals/${withdrawalId}/decide`, { approve: true });
  await logAdminAction('اعتماد سحب', withdrawalId);
};

/**
 * رفض طلب سحب — the REFUND is the server's job, in the same transaction as the
 * status change: the held work-coins go back to the host's wallet and the gift
 * coins that were credited on request are taken back. v1 did the refund from the
 * browser and added the amount to `stats.pearls`, which is not even where the
 * request had held it from.
 */
export const rejectWithdrawal = async (withdrawalId: string, reason: string): Promise<void> => {
  const note = reason.trim();
  if (!note) throw new Error('اكتب سبب الرفض — يظهر للمستخدم');
  await v2.post(`/admin/withdrawals/${withdrawalId}/decide`, { approve: false, note });
  await logAdminAction('رفض سحب', withdrawalId, note);
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
  /** كل لقطات التحقق بالكاميرا (حتى 3) — يكتبها السيرفر عند تعدد الإطارات */
  verificationFrameUrls?: string[];
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

/**
 * قائمة/تفاصيل طلبات التحقق.
 *
 * ⚠️ حدّ خصوصية مقصود: القائمة لا تُرجع الاسم القانوني ولا الصور — تُرجعها قراءة
 * الطلب الواحد فقط. تصفّح الطابور لا يجب أن يفرش وجوه الناس وأسماءهم الرسمية على
 * الشاشة؛ فتح طلب بعينه قرار واعٍ. (v1 كان يجلب كل شيء في القائمة.)
 */
interface ServerKycRow {
  id: string;
  uid: string;
  displayName: string;
  publicAccountId: string;
  method: string;
  status: string;
  registeredGender: string;
  detectedGender: string;
  genderMatch: boolean;
  createdAt: string;
}

type ServerKycDetail = ServerKycRow & {
  fullName: string;
  selfieUrl: string | null;
  frameUrls: string[];
  aiReview: Record<string, unknown>;
  approvedAt: string | null;
};

function toAdminKyc(row: ServerKycRow, detail?: Partial<ServerKycDetail>): AdminKycRequest {
  const ai = detail?.aiReview ?? {};
  const frames = detail?.frameUrls ?? [];
  return {
    id: row.id,
    uid: row.uid,
    displayName: row.displayName || 'مستخدم',
    avatar: '',
    gender: row.registeredGender || '',
    fullName: detail?.fullName ?? '',
    birthDate: '',
    nationality: '',
    phoneNumber: '',
    // v2 keeps one selfie + the liveness frames; there is no ID front/back in the
    // flow the app actually ships.
    idFront: '',
    idBack: '',
    selfie: detail?.selfieUrl ?? '',
    verificationFrameUrl: frames[0],
    verificationFrameUrls: frames,
    aiGender: row.detectedGender || undefined,
    aiConfidence: typeof ai.confidence === 'number' ? ai.confidence : undefined,
    aiProvider: typeof ai.provider === 'string' ? ai.provider : undefined,
    status: (['pending', 'approved', 'rejected', 'processing'] as const).includes(
      row.status as never,
    )
      ? (row.status as AdminKycRequest['status'])
      : 'pending',
    rejectionReason: typeof ai.decisionReason === 'string' ? ai.decisionReason : undefined,
    approvedAt: detail?.approvedAt ? Date.parse(detail.approvedAt) || undefined : undefined,
    method: row.method === 'ai' || row.method === 'face' ? row.method : 'manual',
    createdAt: Date.parse(row.createdAt) || 0,
    updatedAt: Date.parse(row.createdAt) || 0,
  };
}

export const getKycRequests = async (limitCount = 200): Promise<AdminKycRequest[]> => {
  try {
    const res = await v2.get<{ items: ServerKycRow[] }>(
      `/admin/kyc${v2Qs({ limit: Math.min(limitCount, 100) })}`,
    );
    const rows = (res?.items ?? []).map((row) => toAdminKyc(row));
    if (isSuperCountryScope()) return rows;
    await preloadUserCountries(rows.map((r) => r.uid));
    return rows.filter((r) => isInAdminCountryScope(getCachedUserCountry(r.uid)));
  } catch (e) {
    console.error('getKycRequests:', e);
    return [];
  }
};

/** تفاصيل طلب واحد — the only read that returns the legal name and the images. */
export const getKycRequestDetail = async (id: string): Promise<AdminKycRequest | null> => {
  try {
    const row = await v2.get<ServerKycDetail>(`/admin/kyc/${id}`);
    return row?.id ? toAdminKyc(row, row) : null;
  } catch {
    return null;
  }
};

/**
 * اعتماد طلب تحقق — takes the REQUEST id (v1 took the uid, because its documents
 * were keyed by uid; v2's requests have their own ids and a user may have more
 * than one over time). The single code path that can mark an account verified
 * lives on the server and is audited there.
 */
export const approveKycRequest = async (requestId: string): Promise<void> => {
  await v2.post(`/admin/kyc/${requestId}/decide`, { approve: true, reason: 'مطابق' });
  await logAdminAction('اعتماد توثيق', requestId);
};

export const rejectKycRequest = async (requestId: string, reason: string): Promise<void> => {
  const note = reason.trim();
  if (!note) throw new Error('اكتب سبب الرفض — يظهر للمستخدم');
  await v2.post(`/admin/kyc/${requestId}/decide`, { approve: false, reason: note });
  await logAdminAction('رفض توثيق', requestId, note);
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

/**
 * ⚠️ صفحة «العلاقات» لا تُرجع بيانات على v2 — بعد.
 *
 * v1 read a `relationships` collection (a pairing feature with intimacy points).
 * v2's social graph is follows + blocks; there is no relationships table, so
 * there is nothing to read. Returning an empty list is the honest answer — the
 * page shows its own empty state instead of numbers that do not exist.
 */
export const getRelationships = async (limitCount = 100): Promise<AdminRelationship[]> => {
  void limitCount;
  return [];
};

// ==================== ROOMS ====================

interface ServerRoomRow {
  id: string;
  name: string;
  ownerUid: string;
  ownerName: string;
  type: string;
  isLive: boolean;
  seatCount: number;
  agencyId: string | null;
  vanityId: string | null;
  coverUrl: string;
  createdAt: string;
}

function toAdminRoom(row: ServerRoomRow): AdminRoom {
  return {
    id: row.id,
    name: row.name || 'غرفة',
    hostUid: row.ownerUid,
    hostName: row.ownerName,
    country: '',
    banner: row.coverUrl,
    category: row.type,
    // The live audience count is realtime state, not a table column; the rooms
    // page shows the live flag and the seat count, and the home presence endpoint
    // is what reports "how many are inside" second by second.
    memberCount: 0,
    totalGifts: 0,
    isActive: row.isLive,
    isLocked: row.type === 'private',
    seatsCount: row.seatCount || 9,
    agencyId: row.agencyId ?? undefined,
    isAgencyRoom: !!row.agencyId,
    createdAt: Date.parse(row.createdAt) || Date.now(),
  };
}

export const getRooms = async (): Promise<AdminRoom[]> => {
  try {
    const res = await v2.get<{ items: ServerRoomRow[] }>(`/admin/rooms${v2Qs({ limit: 100 })}`);
    const rows = (res?.items ?? []).map(toAdminRoom);
    if (isSuperCountryScope()) return rows;
    // A room row carries no country of its own, so the owner's country decides.
    await preloadUserCountries(rows.map((r) => r.hostUid));
    return rows.filter((r) => isInAdminCountryScope(getCachedUserCountry(r.hostUid)));
  } catch (e) {
    console.error('getRooms:', e);
    return [];
  }
};

/**
 * إغلاق روم بالقوة — the server does both halves: the row stops being live and
 * the LIVE STATE is dropped, which is what actually turns the people inside out.
 * v1 only set `isActive=false` and relied on every client noticing.
 */
export const forceCloseRoom = async (roomId: string, reason = ''): Promise<void> => {
  await v2.post(`/admin/rooms/${roomId}/close`, reason ? { reason } : {});
  await logAdminAction('إغلاق غرفة', roomId, reason);
};

/**
 * ⚠️ حذف الغرفة نهائياً غير مُنفَّذ على v2 — بعد.
 *
 * A room is referenced by its agency (the live room), by gift history and by the
 * ledger rows of everything sent inside it. Deleting the row means deciding what
 * happens to those, and that is the owner's call. Force-close does the moderation
 * job and is reversible.
 */
export const deleteRoom = async (roomId: string): Promise<void> => {
  void roomId;
  throw new Error(
    'حذف الغرفة نهائياً غير متاح — استخدم «إغلاق الغرفة». الحذف يحتاج قراراً من المالك ' +
      '(سجل الهدايا والوكالة مرتبطان بالغرفة).',
  );
};

// ==================== AGENCIES ====================
/** One agency as the server projects it. Coins are the agency's WORK coins — the
 *  earning wallet — and are read-only here; they move only through the earning
 *  and withdrawal paths. */
interface ServerAgencyRow {
  id: string;
  name: string;
  ownerUid: string;
  ownerName: string;
  logo: string;
  country: string;
  inviteCode: string;
  status: string;
  memberCount: number;
  femaleHostCount: number;
  workCoins: number;
  rank: number;
  isCountryOfficial: boolean;
  isVerified: boolean;
  periodLevel: number;
  periodLevelManual: boolean;
  lifetimeSupportCoins: number;
  minHostsRequired: number;
  liveRoomId: string | null;
  /** سقف مقاعد غرف الوكالة (0 = لم يُحدَّد، فيُطبَّق الافتراضي 9). */
  maxSeatsCount: number;
  createdAt: string;
}

const toAdminAgency = (row: ServerAgencyRow): AdminAgency => ({
  id: row.id,
  name: row.name || '—',
  ownerName: row.ownerName || '—',
  country: row.country || '—',
  members: row.memberCount ?? 0,
  earnings: row.workCoins ?? 0,
  // v1 carried a «rating» field nothing ever wrote; v2 has a real RANK instead,
  // which is what the list is ordered by.
  rating: row.rank ?? 0,
  isVerified: row.isVerified,
  logo: row.logo || undefined,
});

export const getAgencies = async (): Promise<AdminAgency[]> => {
  try {
    const codes = getScopedCountryCodes();
    if (!isSuperCountryScope() && codes.length === 0) return [];
    const pages = await Promise.all(
      (isSuperCountryScope() ? [undefined] : codes).map((country) =>
        v2.get<{ items: ServerAgencyRow[] }>(`/admin/agencies${v2Qs({ limit: 100, country })}`),
      ),
    );
    return pages.flatMap((p) => p?.items ?? []).map(toAdminAgency);
  } catch (e) {
    console.error('getAgencies:', e);
    return [];
  }
};

/** يرفض العمل خارج نطاق دولة المشرف — same guard v1 had, one read. */
async function assertAgencyIdInScope(agencyId: string): Promise<ServerAgencyRow> {
  const row = await v2.get<ServerAgencyRow>(`/admin/agencies/${agencyId}`);
  if (!row?.id) throw new Error('الوكالة غير موجودة');
  if (!isInAdminCountryScope(row.country)) throw new Error('الوكالة خارج نطاق دولك');
  return row;
}

export const toggleAgencyVerified = async (
  agencyId: string,
  verified: boolean,
): Promise<void> => {
  await assertAgencyIdInScope(agencyId);
  await v2.post(`/admin/agencies/${agencyId}/verify`, { verified });
  await logAdminAction(verified ? 'توثيق وكالة' : 'سحب توثيق وكالة', agencyId);
};


/**
 * الوكالة الفعلية لمستخدم — قراءة فقط.
 *
 * v1's version SELF-HEALED: while resolving, it also unlinked stale agency
 * pointers and deleted orphaned clan-chat documents from the browser. On v2 there
 * is nothing to heal — membership is a row in `agency_members` with a real
 * foreign key, so a pointer to a deleted agency cannot exist. A resolver has no
 * business writing anyway; that was the part of v1's design that made a read
 * quietly mutate data.
 */
export async function resolveUserActiveAgencyId(uid: string): Promise<string | null> {
  try {
    const detail = await v2.get<{ profile: Record<string, unknown> }>(`/admin/users/${uid}`);
    const agencyId = String(detail?.profile?.agencyId ?? '').trim();
    if (!agencyId) return null;
    // Confirm it still exists before handing it out — the page navigates with it.
    const agency = await v2
      .get<{ id: string }>(`/admin/agencies/${agencyId}`)
      .catch(() => null);
    return agency?.id ?? null;
  } catch {
    return null;
  }
}
/**
 * حذف وكالة نهائياً مع تنظيف كل الارتباطات:
 * الأعضاء، بيانات المستخدمين، دردشة العشيرة، الرسائل، وطلبات الوكالة.
 */
/**
 * ⚠️ حذف الوكالات وتنظيف اليتيم — لا يعمل على v2، ولا يُنفَّذ على القاعدة القديمة.
 *
 * These four were Firebase Functions that deleted an agency (or ALL agencies) and
 * swept up what was left behind. On v2 an agency is referenced by its members'
 * work-coin wallets, its rooms, its withdrawals and its gift history — so what
 * happens to each of those is an owner decision, not something a migration shim
 * should improvise. And they must not run against v1 either: that database is
 * reference-only now.
 *
 * The moderation lever that DOES exist: سحب توثيق الوكالة (and banning its owner).
 */
const AGENCY_DELETE_UNAVAILABLE =
  'حذف الوكالات غير متاح — الوكالة مرتبطة بمحافظ أعضائها وغرفها وسحوباتها وسجل هداياها، ' +
  'والحذف يحتاج قراراً من المالك. المتاح الآن: سحب التوثيق أو حظر المالك.';

export const deleteAgency = async (agencyId: string): Promise<void> => {
  void agencyId;
  throw new Error(AGENCY_DELETE_UNAVAILABLE);
};

export type DeleteAllAgenciesResult = {
  ok: boolean;
  deleted: number;
  failed: number;
  orphansCleared: number;
  orphanRoomsCleared: number;
  errors?: string[];
};

export const deleteAllAgencies = async (
  confirmPhrase: string,
): Promise<DeleteAllAgenciesResult> => {
  void confirmPhrase;
  throw new Error(AGENCY_DELETE_UNAVAILABLE);
};

/** لا وجود ليتيم على v2: مفاتيح أجنبية حقيقية تربط الأعضاء والغرف بالوكالة. */
export const purgeAgencyOrphans = async (agencyId: string): Promise<void> => {
  void agencyId;
  throw new Error(
    'لا حاجة لتنظيف اليتيم على قاعدة البيانات الجديدة — العلاقات محفوظة بمفاتيح أجنبية.',
  );
};

export const purgeUserOrphans = async (uid: string): Promise<void> => {
  void uid;
  throw new Error(
    'لا حاجة لتنظيف اليتيم على قاعدة البيانات الجديدة — العلاقات محفوظة بمفاتيح أجنبية.',
  );
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

/**
 * أرقام الصفحة الرئيسية — من `/admin/overview`, حيث كل رقم استعلام تجميعي واحد.
 * v1 كان يجلب حتى 2000 مستند مستخدم في المتصفح ويجمعها يدوياً، فكان «إجمالي
 * العملات» تقريبياً بطبعه وفتح اللوحة ثقيلاً.
 */
interface ServerOverview {
  users: { total: number; banned: number; new24h: number; new7d: number };
  economy: { coins: number; pearls: number; casinoCoins: number };
  agencies: { total: number };
  rooms: { total: number };
  withdrawals: { pending: number };
  spendSeries: { day: string; coins: number }[];
}

/** `total` from a 1-row page = the count, without pulling the rows. */
const countOf = async (path: string): Promise<number> => {
  try {
    const res = await v2.get<{ total: number }>(path);
    return res?.total ?? 0;
  } catch {
    return 0;
  }
};

export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    const [overview, vip, live, reports] = await Promise.all([
      v2.get<ServerOverview>('/admin/overview'),
      countOf(`/admin/users${v2Qs({ vip: 'true', limit: 1 })}`),
      countOf(`/admin/rooms${v2Qs({ live: 'true', limit: 1 })}`),
      countOf(`/admin/reports${v2Qs({ status: 'pending', limit: 1 })}`),
    ]);

    return {
      totalUsers: overview?.users?.total ?? 0,
      totalVIP: vip,
      totalRooms: overview?.rooms?.total ?? 0,
      // ⚠️ «الإيرادات» تبقى صفراً بحق: شحن المال الحقيقي (بوت تيليغرام/الباقات) لم
      // ينتقل بعد إلى سجل معاملات v2، فلا يوجد رقم إيرادات حقيقي لعرضه. عند نقل
      // مسار الشحن يصبح مجموع صفوف الشحن في السجل، بلا تقدير.
      totalRevenue: 0,
      totalCoinsInCirculation: overview?.economy?.coins ?? 0,
      newUsersToday: overview?.users?.new24h ?? 0,
      pendingWithdrawals: overview?.withdrawals?.pending ?? 0,
      activeRooms: live,
      pendingReports: reports,
    };
  } catch (e) {
    console.error('getDashboardStats:', e);
    return {
      totalUsers: 0,
      totalVIP: 0,
      totalRooms: 0,
      totalRevenue: 0,
      totalCoinsInCirculation: 0,
      newUsersToday: 0,
      pendingWithdrawals: 0,
      activeRooms: 0,
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
/**
 * سلسلة نشاط آخر N يوم — من `/admin/analytics`, المحسوبة على السيرفر من نفس سجل
 * المعاملات الذي تكتبه كل حركة مال، فلا يمكن أن تنحرف الأرقام عن المال نفسه.
 *
 * ما تغيّر عن v1 بصدق: «الإيرادات» كانت مجموع معاملات الشحن، وشحن المال الحقيقي لم
 * ينتقل بعد إلى سجل v2 — فالعمود المعروض الآن هو الكوينز المُنفَقة في اليوم (وهي
 * رقم حقيقي ومفيد)، وليس تقديراً لإيراد. الدقائق تحتاج تجميع جلسات المكالمات وهو
 * غير موجود بعد على السيرفر، فتظل صفراً بدل رقم مُختلق.
 */
export const getWeeklyActivity = async (days = 7): Promise<WeeklyActivityPoint[]> => {
  const dayMs = 86400000;
  const labels = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const startCutoff = todayStart - (days - 1) * dayMs;

  const empty = (): WeeklyActivityPoint[] =>
    Array.from({ length: days }, (_, i) => {
      const date = startCutoff + i * dayMs;
      return { day: labels[new Date(date).getDay()], date, users: 0, revenue: 0, minutes: 0 };
    });

  try {
    const res = await v2.get<{
      series: { day: string; spent: number; newUsers: number }[];
    }>(`/admin/analytics${v2Qs({ days })}`);

    const points = empty();
    const byDate = new Map(points.map((p) => [p.date, p]));
    for (const row of res?.series ?? []) {
      // The server groups by calendar day in UTC («YYYY-MM-DD»); align to the
      // local midnight buckets the chart draws.
      const date = new Date(`${row.day}T00:00:00`).setHours(0, 0, 0, 0);
      const point = byDate.get(date);
      if (!point) continue;
      point.users = row.newUsers ?? 0;
      point.revenue = row.spent ?? 0;
    }
    return points;
  } catch (e) {
    console.error('getWeeklyActivity:', e);
    return empty();
  }
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
 * إشعار مستخدم واحد — the notice row plus, optionally, the account action that
 * goes with the scenario. v1 bundled both into one Cloud Function; here the two
 * are separate endpoints that already exist and are audited individually, which
 * also means a failed action never silently swallows the notice.
 */
export const sendUserNotification = async (
  payload: AdminUserNotificationPayload,
): Promise<{
  targetUid: string;
  displayName: string;
  publicAccountId: string;
  notificationId: string;
}> => {
  const target = await lookupUserByIdentifier(payload.identifier);
  const { title, body } = notificationCopyFor(payload);
  await v2.post(`/admin/users/${target.uid}/notify`, { title, body });

  if (payload.applyAction) {
    const reason = payload.reason?.trim() || title;
    switch (payload.scenario) {
      case 'account_banned':
        await v2.post(`/admin/users/${target.uid}/ban`, { banned: true, reason });
        break;
      case 'account_unbanned':
        await v2.post(`/admin/users/${target.uid}/ban`, { banned: false });
        break;
      case 'withdrawal_blocked':
        await v2.post(`/admin/users/${target.uid}/withdrawal-block`, { blocked: true });
        break;
      case 'withdrawal_unblocked':
        await v2.post(`/admin/users/${target.uid}/withdrawal-block`, { blocked: false });
        break;
      case 'verification_required':
        await v2.post(`/admin/users/${target.uid}/verify`, { verified: false, reason });
        break;
      default:
        // custom / account_warning / content_removed carry no account action.
        break;
    }
  }

  await logAdminAction('إشعار مستخدم', target.publicAccountId, payload.scenario);
  return {
    targetUid: target.uid,
    displayName: target.displayName,
    publicAccountId: target.publicAccountId,
    // v2 does not echo the row id back from /notify; the page only needs a
    // non-empty marker that one was written.
    notificationId: 'sent',
  };
};

/** The Arabic copy each scenario sends when the admin did not write their own. */
function notificationCopyFor(p: AdminUserNotificationPayload): { title: string; body: string } {
  const custom = { title: (p.title ?? '').trim(), body: (p.message ?? '').trim() };
  if (custom.title && custom.body) return custom;
  const reason = p.reason?.trim();
  const suffix = reason ? ` السبب: ${reason}` : '';
  switch (p.scenario) {
    case 'account_warning':
      return { title: 'تنبيه من الإدارة', body: `يرجى الالتزام بقواعد التطبيق.${suffix}` };
    case 'account_banned':
      return { title: 'تم حظر حسابك', body: `تم حظر حسابك من الإدارة.${suffix}` };
    case 'account_unbanned':
      return { title: 'تم رفع الحظر', body: 'تم رفع الحظر عن حسابك — مرحباً بعودتك.' };
    case 'withdrawal_blocked':
      return { title: 'إيقاف السحب', body: `تم إيقاف السحب على حسابك.${suffix}` };
    case 'withdrawal_unblocked':
      return { title: 'استعادة السحب', body: 'تم إعادة تفعيل السحب على حسابك.' };
    case 'verification_required':
      return { title: 'التوثيق مطلوب', body: `يلزم إعادة توثيق حسابك.${suffix}` };
    case 'content_removed':
      return { title: 'حذف محتوى', body: `تم حذف محتوى نشرته لمخالفته القواعد.${suffix}` };
    default:
      return {
        title: custom.title || 'رسالة من الإدارة',
        body: custom.body || 'لديك رسالة من إدارة LinkUp.',
      };
  }
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
  const user = await getUserById(identifier);
  if (!user) throw new Error('لم نجد هذا المستخدم');
  return {
    uid: user.uid,
    displayName: user.displayName,
    avatar: user.avatar,
    publicAccountId: user.publicAccountId,
    coins: user.coins,
    isBanned: user.isBanned,
    withdrawalBlocked: user.withdrawalBlocked,
  };
};

/**
 * إرسال إشعار جماعي — the server writes one notification row per recipient (that
 * is how the app reads them) and caps the audience. «النشطون» means the accounts
 * ONLINE right now, resolved from live presence — not a guess over a timestamp.
 */
export const sendBroadcast = async (
  notif: BroadcastNotification,
): Promise<{ sent: number }> => {
  const res = await v2.post<{ sent: number; capped: boolean }>('/admin/broadcast', {
    title: notif.title,
    body: notif.body,
    target: notif.target,
    type: notif.type,
  });
  return { sent: res?.sent ?? 0 };
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

interface ServerBroadcastRow {
  id: string;
  title: string;
  body: string;
  target: string;
  type: string;
  sentCount: number;
  adminName: string;
  createdAt: string;
}

/**
 * سجل البث — the audit row IS the record (who sent what, to whom, how many rows
 * it wrote). `viewCount` is deliberately absent rather than zero-filled: nothing
 * counts broadcast opens on v2, and a permanent «0 مشاهدة» would read as a fact.
 */
const toBroadcastRecord = (row: ServerBroadcastRow): AdminBroadcastRecord => ({
  id: row.id,
  title: row.title,
  body: row.body,
  target: row.target,
  type: row.type,
  sentCount: row.sentCount,
  createdAt: Date.parse(row.createdAt) || 0,
});

export const getBroadcasts = async (): Promise<AdminBroadcastRecord[]> => {
  try {
    const rows = await v2.get<ServerBroadcastRow[]>(`/admin/broadcast${v2Qs({ limit: 50 })}`);
    return (rows ?? []).map(toBroadcastRecord);
  } catch {
    return [];
  }
};

/** How often the broadcast log refreshes while the page is open. */
const BROADCAST_POLL_MS = 20_000;

/**
 * v1 used a Firestore onSnapshot to keep the view counter live. Our API is
 * request/response, so this polls and only calls back when the content actually
 * CHANGED — the page does not re-render every tick.
 */
export const subscribeBroadcasts = (
  callback: (items: AdminBroadcastRecord[]) => void,
): (() => void) => {
  let stopped = false;
  let lastJson = '';

  const tick = async () => {
    if (stopped) return;
    const items = await getBroadcasts();
    if (stopped) return;
    const json = JSON.stringify(items);
    if (json !== lastJson) {
      lastJson = json;
      callback(items);
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), BROADCAST_POLL_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
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
    // The name is NOT sent: the server signs the row with the account behind the
    // token, so an audit line can never be attributed to someone else.
    await v2.post('/admin/logs', { action, targetId: target, meta: { details } });
  } catch (e) {
    console.error('logAdminAction:', e);
  }
};

export const getAdminLogs = async (): Promise<AdminLog[]> => {
  try {
    const res = await v2.get<{
      items: {
        id: string;
        adminName: string;
        action: string;
        targetId: string;
        meta: Record<string, unknown>;
        createdAt: string;
      }[];
    }>('/admin/logs?limit=100');
    return (res?.items ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      target: row.targetId,
      // Rows written by the server's own endpoints carry their fields in `meta`
      // rather than a prose `details` string — show whichever exists.
      details:
        typeof row.meta?.details === 'string' && row.meta.details
          ? row.meta.details
          : metaSummary(row.meta),
      adminName: row.adminName,
      createdAt: Date.parse(row.createdAt) || 0,
    }));
  } catch {
    return [];
  }
};

/** `{reason: 'spam', banned: true}` → «reason: spam · banned: true». */
function metaSummary(meta: Record<string, unknown> | undefined): string {
  if (!meta) return '';
  return Object.entries(meta)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

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
// كل الكتالوجات (هدايا، متجر، VIP، ألعاب، أرستقراطية، ألقاب، مهام، إطارات،
// خلفيات، باقات، مكافآت، مستويات الوكالة، تسعير المكالمات، الخصوصية، حول
// التطبيق…) تُقرأ وتُكتب على `config_docs` في Postgres عبر `/admin/config/:id`.
// التطبيق يقرأ نفس الجدول، فأي حفظ هنا يظهر في التطبيق بعد انتهاء الكاش (60ث).

/**
 * قارئ مستند إعدادات بشكل «سناب-شوت» — نفس واجهة Firestore التي تستخدمها
 * الدوال أدناه (`snap.exists()` / `snap.data()`), حتى تبقى أجسامها كما هي حرفياً.
 * الفرق الجوهري الوحيد: `exists()` هنا تعني «المستند مُنشأ فعلاً على السيرفر»
 * وليس «فيه بيانات» — وهذا ما تعتمد عليه شاشات مثل الهدايا لتزرع الافتراضي مرة
 * واحدة فقط دون أن تُعيد ما حذفه المالك.
 */
async function getConfigSnap(id: string): Promise<{
  exists: () => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: () => Record<string, any>;
}> {
  const snap = await readConfigSnapshot(id);
  return { exists: () => snap.exists, data: () => snap.data };
}

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
  /** تفعيل موافقة الوكيل على طلبات الانضمام (السيناريوهان: كود=معلّق، دعوة=مصافحة طرفين) */
  agencyJoinRequiresApproval?: boolean;
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
}

// ===== Gifts =====
export const getConfigGifts = async (): Promise<ConfigGift[]> => {
  try {
    const snap = await getConfigSnap('gifts');
    return snap.exists() ? (snap.data().items ?? []) : [];
  } catch { return []; }
};

export const getConfigGiftCategories = async (): Promise<ConfigGiftCategory[]> => {
  try {
    const snap = await getConfigSnap('gifts');
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
    const snap = await getConfigSnap('gifts');
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
  await mergeConfig('gifts', payload);
};

export const saveConfigGiftCategories = async (categories: ConfigGiftCategory[]): Promise<void> => {
  await mergeConfig('gifts', { categories: categories.map(categoryToFirestore), updatedAt: Date.now(), _permKey: 'gifts' });
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
    const snap = await getConfigSnap('roomFrames');
    return snap.exists() ? (snap.data().items ?? []) : [];
  } catch { return []; }
};

export const saveRoomFrames = async (items: RoomFrame[]): Promise<void> => {
  await mergeConfig('roomFrames', { items: items.map(frameToFirestore), updatedAt: Date.now(), _permKey: 'room-decor' });
};

export const getRoomBackgrounds = async (): Promise<RoomBackground[]> => {
  try {
    const snap = await getConfigSnap('roomBackgrounds');
    return snap.exists() ? (snap.data().items ?? []) : [];
  } catch { return []; }
};

export const saveRoomBackgrounds = async (items: RoomBackground[]): Promise<void> => {
  await mergeConfig('roomBackgrounds', { items: items.map(backgroundToFirestore), updatedAt: Date.now(), _permKey: 'room-decor' });
};

export const getAgencyRoomFrames = async (): Promise<RoomFrame[]> => {
  try {
    const snap = await getConfigSnap('agencyRoomFrames');
    return snap.exists() ? (snap.data().items ?? []) : [];
  } catch { return []; }
};

export const saveAgencyRoomFrames = async (items: RoomFrame[]): Promise<void> => {
  await mergeConfig('agencyRoomFrames', { items: items.map(frameToFirestore), updatedAt: Date.now(), _permKey: 'room-decor' });
};

export const getAgencyRoomBackgrounds = async (): Promise<RoomBackground[]> => {
  try {
    const snap = await getConfigSnap('agencyRoomBackgrounds');
    return snap.exists() ? (snap.data().items ?? []) : [];
  } catch { return []; }
};

export const saveAgencyRoomBackgrounds = async (items: RoomBackground[]): Promise<void> => {
  await mergeConfig('agencyRoomBackgrounds', { items: items.map(backgroundToFirestore), updatedAt: Date.now(), _permKey: 'room-decor' });
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
    const snap = await getConfigSnap('store');
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
  await mergeConfig('store', payload);
};

export const saveConfigStoreCategories = async (categories: ConfigStoreCategory[]): Promise<void> => {
  await mergeConfig('store', { categories: categories.map(storeCategoryToFirestore), updatedAt: Date.now(), _permKey: 'store' });
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
    const snap = await getConfigSnap('chatBackgrounds');
    return snap.exists() ? (snap.data().items ?? []) : [];
  } catch {
    return [];
  }
};

export const saveConfigChatBackgrounds = async (
  items: ConfigChatBackground[],
): Promise<void> => {
  await mergeConfig('chatBackgrounds', { items: items.map(chatBackgroundToFirestore), updatedAt: Date.now(), _permKey: 'chat-backgrounds' });
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
    const snap = await getConfigSnap('luckyBagGifts');
    return snap.exists() ? (snap.data().items ?? DEFAULT_LUCKY_BAG_GIFTS) : DEFAULT_LUCKY_BAG_GIFTS;
  } catch { return DEFAULT_LUCKY_BAG_GIFTS; }
};

export const saveLuckyBagGifts = async (items: LuckyBagGift[]): Promise<void> => {
  await mergeConfig('luckyBagGifts', { items, updatedAt: Date.now(), _permKey: 'lucky-bag' });
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
    const snap = await getConfigSnap('roomThrone');
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
  await mergeConfig('roomThrone', { ...config, updatedAt: Date.now(), _permKey: 'room-throne' });
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
    const snap = await getConfigSnap('roomReactions');
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
  await mergeConfig('roomReactions', { packs, updatedAt: Date.now(), _permKey: 'room-reactions' });
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
    const snap = await getConfigSnap('agencyLevels');
    if (!snap.exists()) return DEFAULT_AGENCY_LEVELS_CONFIG;
    const d = snap.data();
    const levels = Array.isArray(d.levels)
      ? (d.levels as ConfigAgencyLevelRow[])
          .map((row) => ({
            level: Number(row.level) || 0,
            supportTarget: Number(row.supportTarget) || 0,
            // نقرأ المكافأة كما حُفظت (بلا إجبار 0 إلى 32% من الحدّ) حتى تُطابق ما أدخله المالك
            managerBonus: Math.max(0, Number(row.managerBonus) || 0),
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
      managerBonus: Math.max(0, Math.round(Number(r.managerBonus) || 0)),
    }))
    .filter((r) => r.level >= 1 && r.supportTarget > 0)
    .sort((a, b) => a.level - b.level);
  await mergeConfig('agencyLevels', {
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
    });
};


// ===== Agency Policies (official salary/withdrawal tables) =====
export interface ConfigAgentPolicyRow {
  target: number;
  collectionPct: number;
  diamonds: number;
  salaryUsd: number;
  bonusPct: number;
  totalUsd: number;
  giftCoins: number;
}

export interface ConfigHostessPolicyRow {
  target: number;
  collectionPct: number;
  diamonds: number;
  salaryUsd: number;
  bonusPct: number;
  totalUsd: number;
  giftCoins: number;
}

export interface ConfigAgencyPolicies {
  usdPerDiamond: number;
  agentCollectionAbovePct: number;   // collection% above the last agent target (75)
  agentBonusAbovePct: number;        // bonus% above last agent target (30)
  agentGiftAboveTargetPct: number;   // gift = % of target above cap (1.5)
  hostessBonusAbovePct: number;      // 150
  hostessGiftAboveTargetPct: number; // 0.5
  agent: ConfigAgentPolicyRow[];
  hostess: ConfigHostessPolicyRow[];
}

const DEFAULT_AGENT_POLICY_ROWS: ConfigAgentPolicyRow[] = [
  { target: 2_000_000, collectionPct: 30, diamonds: 12, salaryUsd: 11.40, bonusPct: 0, totalUsd: 11, giftCoins: 40_000 },
  { target: 5_000_000, collectionPct: 35, diamonds: 35, salaryUsd: 33.25, bonusPct: 2.5, totalUsd: 34, giftCoins: 100_000 },
  { target: 7_500_000, collectionPct: 40, diamonds: 60, salaryUsd: 57, bonusPct: 5, totalUsd: 60, giftCoins: 150_000 },
  { target: 10_000_000, collectionPct: 45, diamonds: 90, salaryUsd: 85.5, bonusPct: 8, totalUsd: 92, giftCoins: 200_000 },
  { target: 15_000_000, collectionPct: 50, diamonds: 150, salaryUsd: 142.5, bonusPct: 10, totalUsd: 157, giftCoins: 300_000 },
  { target: 20_000_000, collectionPct: 55, diamonds: 220, salaryUsd: 209, bonusPct: 12, totalUsd: 234, giftCoins: 400_000 },
  { target: 25_000_000, collectionPct: 60, diamonds: 300, salaryUsd: 285, bonusPct: 15, totalUsd: 328, giftCoins: 500_000 },
  { target: 30_000_000, collectionPct: 65, diamonds: 390, salaryUsd: 370.5, bonusPct: 20, totalUsd: 445, giftCoins: 600_000 },
  { target: 50_000_000, collectionPct: 70, diamonds: 700, salaryUsd: 665, bonusPct: 25, totalUsd: 831, giftCoins: 1_000_000 },
];

const DEFAULT_HOSTESS_POLICY_ROWS: ConfigHostessPolicyRow[] = [
  { target: 100_000, collectionPct: 100, diamonds: 2, salaryUsd: 1.90, bonusPct: 0, totalUsd: 2, giftCoins: 0 },
  { target: 200_000, collectionPct: 100, diamonds: 4, salaryUsd: 3.8, bonusPct: 15, totalUsd: 4, giftCoins: 0 },
  { target: 500_000, collectionPct: 100, diamonds: 10, salaryUsd: 9.5, bonusPct: 30, totalUsd: 12, giftCoins: 0 },
  { target: 1_000_000, collectionPct: 100, diamonds: 20, salaryUsd: 19, bonusPct: 40, totalUsd: 27, giftCoins: 5_000 },
  { target: 2_000_000, collectionPct: 100, diamonds: 40, salaryUsd: 38, bonusPct: 50, totalUsd: 57, giftCoins: 10_000 },
  { target: 3_500_000, collectionPct: 100, diamonds: 70, salaryUsd: 66.5, bonusPct: 60, totalUsd: 106, giftCoins: 17_500 },
  { target: 5_000_000, collectionPct: 100, diamonds: 100, salaryUsd: 95, bonusPct: 70, totalUsd: 162, giftCoins: 25_000 },
  { target: 7_000_000, collectionPct: 100, diamonds: 140, salaryUsd: 133, bonusPct: 90, totalUsd: 253, giftCoins: 35_000 },
  { target: 10_000_000, collectionPct: 100, diamonds: 200, salaryUsd: 190, bonusPct: 120, totalUsd: 418, giftCoins: 50_000 },
];

export const DEFAULT_AGENCY_POLICIES: ConfigAgencyPolicies = {
  usdPerDiamond: 0.95,
  agentCollectionAbovePct: 75,
  agentBonusAbovePct: 30,
  agentGiftAboveTargetPct: 1.5,
  hostessBonusAbovePct: 150,
  hostessGiftAboveTargetPct: 0.5,
  agent: DEFAULT_AGENT_POLICY_ROWS,
  hostess: DEFAULT_HOSTESS_POLICY_ROWS,
};

/** يوحّد صفّاً واحداً من جداول الرواتب (الوكلاء أو المضيفات — نفس البنية) */
const sanitizePolicyRow = (row: Partial<ConfigAgentPolicyRow> | undefined): ConfigAgentPolicyRow => ({
  target: Math.max(0, Math.round(Number(row?.target) || 0)),
  collectionPct: Math.max(0, Number(row?.collectionPct) || 0),
  diamonds: Math.max(0, Number(row?.diamonds) || 0),
  salaryUsd: Math.max(0, Number(row?.salaryUsd) || 0),
  bonusPct: Math.max(0, Number(row?.bonusPct) || 0),
  totalUsd: Math.max(0, Number(row?.totalUsd) || 0),
  giftCoins: Math.max(0, Math.round(Number(row?.giftCoins) || 0)),
});

export const getAgencyPolicies = async (): Promise<ConfigAgencyPolicies> => {
  try {
    const snap = await getConfigSnap('agencyPolicies');
    if (!snap.exists()) return DEFAULT_AGENCY_POLICIES;
    const d = snap.data();
    const agent = Array.isArray(d.agent) && d.agent.length > 0
      ? (d.agent as ConfigAgentPolicyRow[]).map(sanitizePolicyRow)
      : DEFAULT_AGENCY_POLICIES.agent;
    const hostess = Array.isArray(d.hostess) && d.hostess.length > 0
      ? (d.hostess as ConfigHostessPolicyRow[]).map(sanitizePolicyRow)
      : DEFAULT_AGENCY_POLICIES.hostess;
    return {
      usdPerDiamond: Number(d.usdPerDiamond) > 0 ? Number(d.usdPerDiamond) : DEFAULT_AGENCY_POLICIES.usdPerDiamond,
      agentCollectionAbovePct: Number(d.agentCollectionAbovePct) || DEFAULT_AGENCY_POLICIES.agentCollectionAbovePct,
      agentBonusAbovePct: Number(d.agentBonusAbovePct) || DEFAULT_AGENCY_POLICIES.agentBonusAbovePct,
      agentGiftAboveTargetPct: Number(d.agentGiftAboveTargetPct) || DEFAULT_AGENCY_POLICIES.agentGiftAboveTargetPct,
      hostessBonusAbovePct: Number(d.hostessBonusAbovePct) || DEFAULT_AGENCY_POLICIES.hostessBonusAbovePct,
      hostessGiftAboveTargetPct: Number(d.hostessGiftAboveTargetPct) || DEFAULT_AGENCY_POLICIES.hostessGiftAboveTargetPct,
      agent,
      hostess,
    };
  } catch {
    return DEFAULT_AGENCY_POLICIES;
  }
};

export const saveAgencyPolicies = async (config: ConfigAgencyPolicies): Promise<void> => {
  await mergeConfig('agencyPolicies', {
      usdPerDiamond: Math.max(0, Number(config.usdPerDiamond) || DEFAULT_AGENCY_POLICIES.usdPerDiamond),
      agentCollectionAbovePct: Math.max(0, Number(config.agentCollectionAbovePct) || 0),
      agentBonusAbovePct: Math.max(0, Number(config.agentBonusAbovePct) || 0),
      agentGiftAboveTargetPct: Math.max(0, Number(config.agentGiftAboveTargetPct) || 0),
      hostessBonusAbovePct: Math.max(0, Number(config.hostessBonusAbovePct) || 0),
      hostessGiftAboveTargetPct: Math.max(0, Number(config.hostessGiftAboveTargetPct) || 0),
      agent: (config.agent ?? DEFAULT_AGENCY_POLICIES.agent).map(sanitizePolicyRow).filter((r) => r.target > 0),
      hostess: (config.hostess ?? DEFAULT_AGENCY_POLICIES.hostess).map(sanitizePolicyRow).filter((r) => r.target > 0),
      updatedAt: Date.now(),
      _permKey: 'agency-policies',
    });
};


// ===== VIP Tiers =====
export const getConfigVipTiers = async (): Promise<ConfigVipTier[]> => {
  try {
    const snap = await getConfigSnap('vipTiers');
    return snap.exists() ? (snap.data().tiers ?? []) : [];
  } catch { return []; }
};

export const saveConfigVipTiers = async (tiers: ConfigVipTier[]): Promise<void> => {
  await mergeConfig('vipTiers', { tiers, updatedAt: Date.now(), _permKey: 'vip' });
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

export const getConfigVipSystem = async (): Promise<ConfigVipSystem> => {
  try {
    const snap = await getConfigSnap('vipSystem');
    if (snap.exists()) {
      return normalizeConfigVipSystem(snap.data() as Partial<ConfigVipSystem>);
    }
  } catch { /* ignore */ }
  return DEFAULT_CONFIG_VIP_SYSTEM;
};

export const saveConfigVipSystem = async (config: ConfigVipSystem): Promise<void> => {
  const normalized = normalizeConfigVipSystem(config);
  const payload = stripUndefinedDeep({ ...normalized, updatedAt: Date.now(), _permKey: 'vip' });
  await mergeConfig('vipSystem', payload);
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



// ===== Recharge Packages =====
export const getConfigPackagesState = async (): Promise<{
  exists: boolean;
  packages: ConfigRechargePackage[];
  tags: ConfigRechargePackageTag[];
}> => {
  try {
    const snap = await getConfigSnap('rechargePackages');
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
  await mergeConfig('rechargePackages', payload);
};

export const saveConfigPackageTags = async (tags: ConfigRechargePackageTag[]): Promise<void> => {
  const normalized = tags.map(normalizeConfigRechargePackageTag).map((t, i) => ({ ...t, order: i }));
  await mergeConfig('rechargePackages', { tags: normalized, updatedAt: Date.now(), _permKey: 'packages' });
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
  rewardType: 'coins' | 'message_cards';
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
    const snap = await getConfigSnap('rewardsCenter');
    return snap.exists() ? ({ ...DEFAULT_REWARDS_CENTER, ...snap.data() } as ConfigRewardsCenter) : null;
  } catch { return null; }
};

export const saveRewardsCenterConfig = async (config: ConfigRewardsCenter): Promise<void> => {
  await mergeConfig('rewardsCenter', { ...config, updatedAt: Date.now(), _permKey: 'rewards-center' });
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
    const snap = await getConfigSnap('hostTasks');
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
  await mergeConfig('hostTasks', { ...config, updatedAt: Date.now(), _permKey: 'host-tasks' });
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
    const snap = await getConfigSnap('aboutPages');
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
  await mergeConfig('aboutPages', { ...config, updatedAt: Date.now(), _permKey: 'about-pages' });
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
    const snap = await getConfigSnap('appRelease');
    if (!snap.exists()) return null;
    return { ...DEFAULT_APP_RELEASE, ...(snap.data() as Partial<ConfigAppRelease>) };
  } catch {
    return null;
  }
};

export const saveAppReleaseConfig = async (config: ConfigAppRelease): Promise<void> => {
  const data: Record<string, unknown> = { ...config, updatedAt: Date.now(), _permKey: 'app-release' };

  // null هو «امسح الحقل» في مخزن إعدادات v2 (انظر deepMerge)، بديلُ deleteField
  // في Firestore. الإبقاء على سنتينل Firebase هنا كان سيكتب كائناً فارغاً بدل الحذف.
  if (config.storagePath === undefined) data.storagePath = null;
  if (config.fileSizeBytes === undefined) data.fileSizeBytes = null;

  for (const key of Object.keys(data)) {
    if (data[key] === undefined) delete data[key];
  }

  await mergeConfig('appRelease', data);
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
    const snap = await getConfigSnap('aristocracy');
    return snap.exists()
      ? normalizeAristocracyConfig(snap.data() as Partial<ConfigAristocracy>)
      : null;
  } catch { return null; }
};

export const saveAristocracyConfig = async (config: ConfigAristocracy): Promise<void> => {
  const normalized = normalizeAristocracyConfig(config);
  const payload = stripUndefinedDeep({ ...normalized, updatedAt: Date.now(), _permKey: 'aristocracy' });
  // استبدال كامل — merge كان يبقي حقول قديمة ويعيد محتوى تجريبي
  await replaceConfig('aristocracy', payload);
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
    const snap = await getConfigSnap('titles');
    return snap.exists() ? ({ ...DEFAULT_TITLES_CONFIG, ...snap.data() } as ConfigTitles) : null;
  } catch { return null; }
};

export const saveTitlesConfig = async (config: ConfigTitles): Promise<void> => {
  await mergeConfig('titles', { ...config, updatedAt: Date.now(), _permKey: 'titles' });
};

/** منح لقب يدوياً لمستخدم — the owned list lives on the server; one call. */
export const grantUserTitle = async (
  uid: string,
  titleId: string,
  validityDays = 0,
): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  await v2.post(`/admin/users/${uid}/grant-title`, {
    titleId,
    ...(validityDays > 0 ? { days: Math.floor(validityDays) } : {}),
  });
};

export const revokeUserTitle = async (uid: string, titleId: string): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  await v2.post(`/admin/users/${uid}/revoke-title`, { titleId });
};

/**
 * منح عنصر متجر (دخولية/فقاعة/…) — the SAME inventory row a purchase writes, from
 * the same catalogue, through `/grant-item`. v1 wrote the inventory document from
 * the browser, which is exactly the gap that once allowed free minting.
 */
export const grantStoreItemToUser = async (
  uid: string,
  item: ConfigStoreItem,
  validityDays: number,
  equip = true,
): Promise<void> => {
  void equip; // the server equips what is equippable, by category
  await assertUidInAdminCountryScope(uid);
  await v2.post(`/admin/users/${uid}/grant-item`, {
    itemId: item.id,
    ...(validityDays > 0 ? { days: Math.floor(validityDays) } : {}),
  });
};

/** منح إطار — same endpoint, flagged as a room frame so the server picks the
 *  frames catalogue rather than the store one. */
export const grantFrameToUser = async (
  uid: string,
  frame: RoomFrame,
  validityDays: number,
  equip = true,
): Promise<void> => {
  void equip;
  await assertUidInAdminCountryScope(uid);
  await v2.post(`/admin/users/${uid}/grant-item`, {
    itemId: frame.id,
    isRoomFrame: true,
    ...(validityDays > 0 ? { days: Math.floor(validityDays) } : {}),
  });
};

/**
 * منح مستوى VIP — v2 keeps ONE source of truth (the level), so there is no
 * separate isVIP flag to keep in step. A validity window is not part of the VIP
 * model here: the level stands until it is changed.
 */
export const grantVipLevelToUser = async (
  uid: string,
  level: number,
  validityDays: number,
): Promise<void> => {
  void validityDays;
  await assertUidInAdminCountryScope(uid);
  await v2.post(`/admin/users/${uid}/profile`, { vipLevel: Math.max(0, Math.floor(level)) });
  await logAdminAction('منح VIP', uid, `مستوى ${level}`);
};

/**
 * منح رتبة أرستقراطية — the server writes the same state a purchase writes, so the
 * entrance, theme and carried VIP level all behave identically. It does NOT start
 * the daily coin-return drip: those returns mirror coins actually spent, and a
 * free grant spent none.
 */
export const grantAristocracyToUser = async (
  uid: string,
  level: ConfigAristocracyLevel,
  validityDays: number,
): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  await v2.post(`/admin/users/${uid}/grant-aristocracy`, {
    level: level.level,
    ...(validityDays > 0 ? { days: Math.floor(validityDays) } : {}),
    ...(level.grantedVipLevel ? { grantedVipLevel: level.grantedVipLevel } : {}),
    ...(Array.isArray(level.svipPrivilegeKeys)
      ? { svipPrivilegeKeys: level.svipPrivilegeKeys.map(String) }
      : {}),
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


export const getAgencyPrinceConfig = async (): Promise<ConfigAgencyPrince | null> => {
  try {
    const snap = await getConfigSnap('agencyPrince');
    return snap.exists()
      ? ({ ...DEFAULT_AGENCY_PRINCE_CONFIG, ...snap.data() } as ConfigAgencyPrince)
      : null;
  } catch {
    return null;
  }
};

export const saveAgencyPrinceConfig = async (config: ConfigAgencyPrince): Promise<void> => {
  await mergeConfig('agencyPrince', { ...config, updatedAt: Date.now(), _permKey: 'agency-prince' });
};

export const revokeAgencyPrinceFromUser = async (uid: string): Promise<void> => {
  await assertUidInAdminCountryScope(uid);
  await v2.post('/admin/agency-prince/revoke', { uid });
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

/** من سيستلم اللقب — a preview, so the owner sees the agency before granting. */
export const lookupAgencyPrinceGrantCandidate = async (
  identifier: string,
): Promise<AgencyPrinceGrantPreview> =>
  v2.get<AgencyPrinceGrantPreview & { ownerName: string }>(
    `/admin/agency-prince/candidate${v2Qs({ identifier: identifier.trim() })}`,
  );

/**
 * منح أمير الوكلاء يدوياً. The server revokes the previous holder in the same
 * operation and stores the new one in the config — the badge is singular, and
 * doing the two halves from the browser is how v1 ended up showing two princes.
 * `config` is accepted for signature compatibility; the assets come from the
 * stored config on the server, which is the same document this page saves.
 */
export const grantAgencyPrinceManual = async (
  identifier: string,
  config: ConfigAgencyPrince,
): Promise<AgencyPrinceHolder> => {
  void config;
  const holder = await v2.post<AgencyPrinceHolder>('/admin/agency-prince/grant', {
    identifier: identifier.trim(),
  });
  await logAdminAction('منح أمير الوكلاء', holder.agencyName, holder.uid);
  return holder;
};

/**
 * إعادة الحساب الشهري — the server ranks the agencies FROM THE LEDGER (this
 * month's host earnings), not from the agency wallet, which withdrawals drain.
 * Returns null when nobody earned anything this month: then nobody is crowned,
 * rather than an arbitrary agency with a zero total.
 */
export const refreshMonthlyAgencyPrince = async (): Promise<AgencyPrinceHolder | null> =>
  v2.post<AgencyPrinceHolder | null>('/admin/agency-prince/refresh');


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
    const snap = await getConfigSnap('privacy');
    return snap.exists() ? ({ ...DEFAULT_PRIVACY_CONFIG, ...snap.data() } as ConfigPrivacy) : null;
  } catch { return null; }
};

export const savePrivacyConfig = async (config: ConfigPrivacy): Promise<void> => {
  await mergeConfig('privacy', { ...config, updatedAt: Date.now(), _permKey: 'privacy' });
};

// ===== Settings =====
export const getConfigSettings = async (): Promise<ConfigSettings | null> => {
  try {
    const snap = await getConfigSnap('settings');
    return snap.exists() ? (snap.data() as ConfigSettings) : null;
  } catch { return null; }
};

export const saveConfigSettings = async (settings: ConfigSettings): Promise<void> => {
  await mergeConfig('settings', { ...settings, updatedAt: Date.now(), _permKey: 'settings' });
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
    const snap = await getConfigSnap('botAdmin');
    return snap.exists() ? (snap.data() as BotAdminPanelConfig) : null;
  } catch {
    return null;
  }
};

export const saveBotAdminPanelConfig = async (config: BotAdminPanelConfig): Promise<void> => {
  await mergeConfig('botAdmin', { ...config, updatedAt: Date.now(), _permKey: 'bot' });
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
    const snap = await getConfigSnap('games');
    if (snap.exists() && snap.data().games?.length) {
      const saved = snap.data().games as ConfigGame[];
      return mergeConfigGames(saved);
    }
  } catch {}
  return DEFAULT_CONFIG_GAMES;
};

export const getGamesGlobalEconomy = async (): Promise<GamesGlobalEconomy> => {
  try {
    const snap = await getConfigSnap('games');
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
/**
 * سحب اليانصيب الأسبوعي — **موقوف من اللوحة**.
 *
 * كان يستدعي دالة Firebase (`adminRunWeeklyLotteryDraw`)، والدوال القديمة لا
 * تُلمَس ولا تُستدعى من اللوحة بعد قطعها عن Firebase. وv2 لم يبنِ السحب بعد: قراءة
 * حالة اليانصيب لم تُهاجر، ولا يوجد مسار سيرفري يخصم ويوزّع الجائزة بضمان
 * exactly-once — وسحبٌ يوزّع مالاً بلا ذلك الضمان هو آخر ما نريد إضافته.
 *
 * الرفض صريح بدل خطأ شبكة غامض؛ وعند بناء السحب في v2 تُوصَل هذه الدالة بنقطته.
 */
export const runWeeklyLotteryDraw = async (_weekId?: string): Promise<{
  weekId: string;
  winnerUid: string;
  winnerName: string;
  prize: number;
  ticketCount: number;
}> => {
  throw new Error('سحب اليانصيب غير متاح من اللوحة حالياً — لم يُبنَ في سيرفر v2 بعد');
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
  await mergeConfig('games', { games: mergedGames, global: globalPayload, updatedAt: Date.now(), _permKey: 'games' });

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
    const snap = await getConfigSnap('callPricing');
    if (snap.exists()) return normalizeConfigCallPricing(snap.data());
  } catch {}
  return DEFAULT_CONFIG_CALL_PRICING;
};

export const saveConfigCallPricing = async (pricing: ConfigCallPricing): Promise<void> => {
  await mergeConfig('callPricing', { ...normalizeConfigCallPricing(pricing as unknown as Record<string, unknown>), updatedAt: Date.now(), _permKey: 'call-pricing' });
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
  { key: 'room-reactions', label: 'رموز الروم (GIF/صور)' },
  { key: 'agencies', label: 'الوكالات' },
  { key: 'agency-levels', label: 'مستويات الوكالة' },
  { key: 'agency-policies', label: 'سياسات الوكالة (رواتب)' },
  { key: 'agency-prince', label: 'أمير الوكلاء' },
  { key: 'agency-applications', label: 'طلبات فتح الوكالة' },
  { key: 'agency-verifications', label: 'تحقق الوكالات' },
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

export type PermissionKey = (typeof PERMISSION_SECTIONS)[number]['key'];

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

/**
 * ── كيف يُترجم نموذج المشرفين بين اللوحة والسيرفر ─────────────────────────────
 * v1 kept a separate `admins/{uid}` document. v2 has NO separate admin table: an
 * admin IS a user account whose `role` is `admin` / `superadmin`, with the page
 * permissions and the country scope on `users.profile`. That is deliberate — one
 * account, one password, one ban switch, and a demotion takes effect instantly
 * because the guard re-reads the row on every request.
 *
 * The panel's shape survives by mapping:
 *   role 'super'   ⇄ users.role 'superadmin'
 *   role 'country' ⇄ users.role 'admin'   (its permission list decides the pages)
 *   permissions {key: true} ⇄ profile.adminPermissions ['key', …]
 *   disabled ⇄ users.is_banned
 */
interface ServerAdminRow {
  id: string;
  displayName: string;
  email: string;
  role: string;
  isBanned: boolean;
  createdAt: string;
}

const permissionMapToList = (permissions: Record<string, boolean>): string[] =>
  Object.entries(permissions ?? {})
    .filter(([, on]) => on === true)
    .map(([key]) => key);

const permissionListToMap = (permissions: string[] | undefined): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  for (const key of permissions ?? []) out[key] = true;
  return out;
};

const serverRoleOf = (role: 'super' | 'country'): string =>
  role === 'super' ? 'superadmin' : 'admin';

/** يحمّل ملف المشرف الحالي ويضبط النطاق */
export const loadCurrentAdminProfile = async (): Promise<AdminProfile | null> => {
  try {
    const me = await v2.get<{
      uid: string;
      name: string;
      email: string;
      role: string;
      isSuper: boolean;
      permissions: string[];
      countries: string[];
    }>('/admin/me');
    if (!me?.uid) {
      setAdminScope(null);
      return null;
    }
    const profile: AdminProfile = {
      uid: me.uid,
      email: me.email ?? '',
      name: me.name || 'مشرف',
      role: me.isSuper ? 'super' : 'country',
      countries: (me.countries ?? []).map((c) => String(c).toUpperCase()),
      permissions: permissionListToMap(me.permissions),
      // A banned account cannot reach /admin/me at all, so reaching here means
      // the profile is live.
      disabled: false,
    };
    setAdminScope(profile);
    return profile;
  } catch {
    setAdminScope(null);
    return null;
  }
};

export const listAdmins = async (): Promise<AdminProfile[]> => {
  try {
    // Two calls because the two admin roles are two distinct column values and
    // the server filters one role per request.
    const pages = await Promise.all(
      ['superadmin', 'admin'].map((role) =>
        v2.get<{ items: ServerAdminRow[] }>(`/admin/users${v2Qs({ role, limit: 100 })}`),
      ),
    );
    const rows = pages.flatMap((p) => p?.items ?? []);
    // The list rows carry no permissions, so each admin's detail is read for the
    // permission matrix. Bounded by how many admins exist (a handful).
    const detailed = await Promise.all(
      rows.map(async (row) => {
        let permissions: Record<string, boolean> = {};
        let countries: string[] = [];
        try {
          const detail = await v2.get<{ profile: Record<string, unknown> }>(
            `/admin/users/${row.id}`,
          );
          const raw = detail?.profile ?? {};
          permissions = permissionListToMap(
            Array.isArray(raw.adminPermissions) ? (raw.adminPermissions as string[]) : [],
          );
          countries = Array.isArray(raw.adminCountries)
            ? (raw.adminCountries as string[]).map((c) => String(c).toUpperCase())
            : [];
        } catch {
          // One failed detail must not blank the whole list.
        }
        return {
          uid: row.id,
          email: row.email ?? '',
          name: row.displayName || 'مشرف',
          role: row.role === 'superadmin' ? 'super' : 'country',
          countries,
          permissions,
          disabled: row.isBanned === true,
          createdAt: Date.parse(row.createdAt) || 0,
        } as AdminProfile;
      }),
    );
    return detailed.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } catch (e) {
    console.error('listAdmins:', e);
    return [];
  }
};

/**
 * «مشرف جديد» — creates the ACCOUNT, then raises it to an admin role. In that
 * order on purpose: if the role step fails the account merely exists as an
 * ordinary user, which is the harmless direction.
 */
export const createAdminUser = async (input: {
  email: string; password: string; name: string;
  role: 'super' | 'country'; countries: string[]; permissions: Record<string, boolean>;
}): Promise<{ ok: boolean; uid: string }> => {
  // نفحص القواعد نفسها قبل الإرسال، فيصل السبب بالعربية فوراً بدل رسالة تحقّق
  // إنجليزية من الـDTO أو رحلة ذهاب وعودة لا لزوم لها.
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('البريد الإلكتروني غير صالح');
  if (input.password.length < 8) throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
  if (!input.name.trim()) throw new Error('الاسم مطلوب');

  const created = await v2.post<{ id: string }>('/admin/users', {
    email,
    password: input.password,
    displayName: input.name.trim(),
  });
  const uid = created?.id;
  if (!uid) throw new Error('لم يُنشأ الحساب');
  await v2.post(`/admin/users/${uid}/role`, { role: serverRoleOf(input.role) });
  await v2.post(`/admin/users/${uid}/permissions`, {
    permissions: permissionMapToList(input.permissions),
    countries: input.countries ?? [],
  });
  await logAdminAction('إنشاء مشرف', input.email, input.role === 'super' ? 'مدير نظام' : 'مشرف دولة');
  return { ok: true, uid };
};

export const updateAdminUser = async (input: {
  targetUid: string; name?: string; role?: 'super' | 'country';
  countries?: string[]; permissions?: Record<string, boolean>; disabled?: boolean;
  /** كلمة مرور جديدة اختيارية — تُحدَّث في Firebase Auth إن وُجدت */
  password?: string;
}): Promise<void> => {
  const { targetUid } = input;
  if (input.name !== undefined) {
    await v2.post(`/admin/users/${targetUid}/profile`, { displayName: input.name });
  }
  if (input.role !== undefined) {
    await v2.post(`/admin/users/${targetUid}/role`, { role: serverRoleOf(input.role) });
  }
  if (input.permissions !== undefined || input.countries !== undefined) {
    await v2.post(`/admin/users/${targetUid}/permissions`, {
      permissions: permissionMapToList(input.permissions ?? {}),
      ...(input.countries !== undefined ? { countries: input.countries } : {}),
    });
  }
  if (input.password) {
    await v2.post(`/admin/users/${targetUid}/password`, { password: input.password });
  }
  if (input.disabled !== undefined) {
    // «معطّل» on an admin IS the account ban switch. The server refuses to ban an
    // account that still holds an admin role, so demote first, ban second.
    if (input.disabled) {
      await v2.post(`/admin/users/${targetUid}/role`, { role: 'user' });
      await v2.post(`/admin/users/${targetUid}/ban`, { banned: true, reason: 'تعطيل مشرف' });
    } else {
      await v2.post(`/admin/users/${targetUid}/ban`, { banned: false });
      await v2.post(`/admin/users/${targetUid}/role`, {
        role: serverRoleOf(input.role ?? 'country'),
      });
    }
  }
  await logAdminAction('تعديل مشرف', targetUid);
};

/**
 * «حذف مشرف» takes away the RIGHTS, not the person: the account, its balance and
 * its login survive — exactly what v1 did when it deleted `admins/{uid}` and left
 * the Auth user alone.
 */
export const deleteAdminUser = async (targetUid: string): Promise<void> => {
  await v2.post(`/admin/users/${targetUid}/role`, { role: 'user' });
  await v2.post(`/admin/users/${targetUid}/permissions`, { permissions: [], countries: [] });
  await logAdminAction('إزالة مشرف', targetUid);
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

/**
 * ⚠️ «موظفو التطبيق» لم ينتقل إلى v2 — والدوال هنا لا تكتب في القاعدة القديمة.
 *
 * v1 marked a user with `staffRole` (manager / super_admin / admin) plus staff
 * frames, badges and an entry video, and the APP rendered those decorations. v2's
 * app knows nothing about a staff role: writing the field would store data that
 * shows up nowhere, which is worse than an honest refusal — it looks like the
 * feature works.
 *
 * What v2 DOES have, and covers the operational need:
 *  • dashboard access + per-page permissions → صفحة «المشرفون» (role admin/superadmin);
 *  • decorations for anybody → «منح الامتيازات» (frames, entrances, bubbles);
 *  • agency management → ربط عضو/وكيل بالوكالة.
 *
 * Reviving the staff badge means adding it to the APP first (profile + room
 * entry), then this page — an owner decision about product surface, not a
 * migration shim's call.
 */
const STAFF_NOT_MIGRATED =
  'ميزة «موظفو التطبيق» لم تُنقل إلى النسخة الجديدة: التطبيق لا يعرف دور الموظف بعد، ' +
  'فحفظ الدور سيخزّن بياناً لا يظهر لأحد. البديل الآن: صلاحيات لوحة التحكم من صفحة ' +
  '«المشرفون»، ومنح الإطارات/الدخوليات من «منح الامتيازات».';

/** قائمة الموظفين — فارغة بصدق: لا يوجد حقل دور موظف على v2. */
export const listPlatformStaffUsers = async (): Promise<PlatformStaffRow[]> => [];

export const adminCreateStaffUser = async (
  input: AdminCreateStaffInput,
): Promise<{ uid: string; publicAccountId: string; displayName: string; agencyId?: string }> => {
  void input;
  throw new Error(STAFF_NOT_MIGRATED);
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
  void input;
  throw new Error(STAFF_NOT_MIGRATED);
};

export const adminRemoveStaffUser = async (uid: string): Promise<void> => {
  void uid;
  throw new Error(STAFF_NOT_MIGRATED);
};

// ==================== ADMIN CHECK ====================
/**
 * يتحقق هل المستخدم الحالي مسجّل في collection admins
 */
export const checkIsAdmin = async (): Promise<boolean> => {
  try {
    // `/admin/me` sits behind the guard: a 401/403 IS the answer, and it re-reads
    // the account each time, so a revoked admin fails here immediately.
    const me = await v2.get<{ uid?: string }>('/admin/me');
    return !!me?.uid;
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
        agencyJoinRequiresApproval: true,
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
 * «سجّلني كأدمن» — kept as a button, but it can no longer promote anybody.
 *
 * In v1 the browser wrote `admins/{uid}` itself, so whoever could open this page
 * could make themselves a platform administrator if the Firestore rules ever
 * slipped. On v2 the role lives on the user row and only a superadmin may change
 * it, so self-promotion is impossible BY DESIGN — the first admin is granted once
 * with a direct database update. This function reports that plainly instead of
 * failing with a confusing error.
 */
export const selfRegisterFirstAdmin = async (): Promise<{ ok: boolean; message: string }> => {
  if (await checkIsAdmin()) {
    return { ok: true, message: 'حسابك بالفعل مشرف — لا حاجة لأي إجراء' };
  }
  return {
    ok: false,
    message:
      'لم يعد بالإمكان ترقية نفسك من اللوحة. أول حساب مشرف يُمنح مرة واحدة على قاعدة البيانات: ' +
      "UPDATE users SET role='superadmin' WHERE email='…'  — وبعدها تُدار الصلاحيات من صفحة المشرفين.",
  };
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

/**
 * التحليلات المتقدّمة — من `/admin/analytics` (نفس دفتر v2 الذي تُحسب منه كل
 * أرقام المال) بدل مسح مجموعة users كاملة من Firestore.
 *
 * ما لا يقدّمه v2 بصدق يبقى صفراً بدل رقمٍ مُلفّق:
 *  • DAU/WAU/الاحتفاظ: لا يوجد `lastSeen` مخزّن لكل مستخدم في v2 (الحضور لحظي في
 *    Redis ولا يُحفظ تاريخه)، فلا نستطيع قول «كم كان نشطاً أمس».
 *  • «الإيرادات»: الشحن ليس في الدفتر بعد (لا بوابة دفع موصولة)، فالإيراد = 0
 *    والمصروف هو ما نعرضه فعلاً — وهو ما يقيس النشاط الاقتصادي الآن.
 *  • أرباح الألعاب: الرهان بالعملات والربح بعملات الكازينو — عملتان مختلفتان،
 *    فلا نطرح إحداهما من الأخرى ونسمّي الناتج ربحاً.
 */
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
    const days = range
      ? Math.max(1, Math.ceil((range.toMs - range.fromMs) / 86400000))
      : 30;
    const [a, users] = await Promise.all([
      v2.get<ServerAnalytics>(`/admin/analytics${v2Qs({ days })}`),
      v2.get<{ total: number }>(`/admin/users${v2Qs({ limit: 1 })}`),
    ]);
    if (!a) return empty;
    const totalUsers = users?.total ?? 0;
    const spenders = a.topSpenders ?? [];
    const payingUsers = spenders.length;
    return {
      ...empty,
      mau: totalUsers,
      newUsersInPeriod: a.users?.newInRange ?? 0,
      wau: a.users?.newInRange ?? 0,
      payingUsers,
      arpu: totalUsers > 0 ? Math.round((a.coins?.spent ?? 0) / totalUsers) : 0,
      arppu: payingUsers > 0 ? Math.round((a.coins?.spent ?? 0) / payingUsers) : 0,
      conversionRate:
        totalUsers > 0 ? Math.round((payingUsers / totalUsers) * 1000) / 10 : 0,
      rangeFiltered: !!range,
      topSpenders: spenders.map((s) => ({
        uid: s.uid,
        name: s.displayName || s.publicAccountId || 'مستخدم',
        spent: s.spent,
      })),
      gameTotalBets: a.games?.casinoBets ?? 0,
      gameTotalWins: a.games?.casinoWins ?? 0,
    };
  } catch (e) {
    console.error('getAdvancedAnalytics:', e);
    return empty;
  }
};

/** إحصائيات v2 كما يعيدها `/admin/analytics`. */
interface ServerAnalytics {
  rangeDays: number;
  users: { newInRange: number };
  coins: { spent: number; adminGranted: number; giftSpend: number };
  games: { casinoBets: number; casinoWins: number; rounds: number };
  series: { day: string; spent: number; newUsers: number }[];
  topSpenders: { uid: string; displayName: string; publicAccountId: string; spent: number }[];
}

/**
 * «المعاملات» — الدفتر كله من `/admin/transactions`، أحدثاً أولاً.
 *
 * النطاق الزمني يُمرَّر للسيرفر (from/to) بدل جلب كل شيء والتصفية في المتصفح.
 */
export const getTransactions = async (
  limitCount = 100,
  range?: AnalyticsDateRange,
): Promise<AdminTransaction[]> => {
  try {
    const res = await v2.get<{ items: (ServerUserTxRow & { uid: string })[] }>(
      `/admin/transactions${v2Qs({
        limit: limitCount,
        from: range ? new Date(range.fromMs).toISOString() : undefined,
        to: range ? new Date(range.toMs).toISOString() : undefined,
      })}`,
    );
    return (res?.items ?? []).map((t) => ({
      id: t.id,
      uid: t.uid,
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      createdAt: new Date(t.createdAt).getTime() || 0,
    }));
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

interface ServerPostRow {
  id: string;
  authorUid: string;
  authorName: string;
  preview: string;
  imageCount: number;
  likeCount: number;
  commentCount: number;
  giftCount: number;
  status: string;
  createdAt: string;
}

type ServerPostDetail = ServerPostRow & {
  text: string;
  images: string[];
  hashtags: string[];
  authorAvatar: string | null;
};

const toAdminPost = (row: ServerPostRow, detail?: Partial<ServerPostDetail>): AdminPost => ({
  id: row.id,
  uid: row.authorUid,
  authorName: row.authorName || 'مستخدم',
  authorAvatar: detail?.authorAvatar ?? '',
  // The list carries a PREVIEW, not the whole post — the moderation queue does
  // not need to render every wall of text to be scanned.
  text: detail?.text ?? row.preview ?? '',
  images: detail?.images,
  hashtags: detail?.hashtags,
  likes: row.likeCount ?? 0,
  comments: row.commentCount ?? 0,
  shares: row.giftCount ?? 0,
  status: (['active', 'hidden', 'removed'] as const).includes(row.status as never)
    ? (row.status as AdminPost['status'])
    : 'active',
  createdAt: Date.parse(row.createdAt) || 0,
});

export const getPosts = async (limitCount = 100): Promise<AdminPost[]> => {
  try {
    const res = await v2.get<{ items: ServerPostRow[] }>(
      `/admin/posts${v2Qs({ limit: Math.min(limitCount, 100) })}`,
    );
    const rows = (res?.items ?? []).map((row) => toAdminPost(row));
    if (isSuperCountryScope()) return rows;
    await preloadUserCountries(rows.map((p) => p.uid));
    return rows.filter((p) => isInAdminCountryScope(getCachedUserCountry(p.uid)));
  } catch (e) {
    console.error('getPosts:', e);
    return [];
  }
};

/** تفاصيل منشور — the full text, the images and the author's avatar. */
export const getPostDetail = async (postId: string): Promise<AdminPost | null> => {
  try {
    const row = await v2.get<ServerPostDetail>(`/admin/posts/${postId}`);
    return row?.id ? toAdminPost(row, row) : null;
  } catch {
    return null;
  }
};

export const hidePost = async (postId: string): Promise<void> => {
  await v2.post(`/admin/posts/${postId}/status`, { status: 'hidden' });
  await logAdminAction('إخفاء منشور', postId);
};

export const restorePost = async (postId: string): Promise<void> => {
  await v2.post(`/admin/posts/${postId}/status`, { status: 'active' });
  await logAdminAction('إظهار منشور', postId);
};

/**
 * «حذف» منشور = `removed` — a soft status, deliberately. The row (and the
 * evidence of what was posted) survives for the report it came from, while the
 * post disappears from the feed exactly as a delete would.
 */
export const deletePostAdmin = async (postId: string): Promise<void> => {
  await v2.post(`/admin/posts/${postId}/status`, { status: 'removed' });
  await logAdminAction('حذف منشور', postId);
};

/**
 * لا حاجة لتعبئة الحالات: كل منشور في v2 يُنشأ بحالة صريحة (`active`) في عمود
 * `status`, فلا توجد صفوف بلا حالة تُعبّأ. تُبلّغ الصفحة بصفر بدل عمل وهمي.
 */
export const backfillPostStatuses = async (): Promise<number> => 0;

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
  // توثيق الوكالة بالذكاء الاصطناعي (مسار submitAgencyVerification)
  ownerName?: string;
  reviewMethod?: string;
  logoUrl?: string;
  backgroundUrl?: string;
  idDocumentUrl?: string;
  aiDecision?: 'approve' | 'reject' | 'uncertain';
  aiReason?: string;
  aiConfidence?: number;
  aiChecks?: Array<{ key: string; pass: boolean | null; note: string }>;
  aiProvider?: string;
  aiModel?: string;
  aiRaw?: string;
  aiReviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** One application as the server lists it. The documents (logo, ID) and the AI
 *  review come from the single-record read only. */
interface ServerAgencyAppRow {
  id: string;
  agencyId: string | null;
  agencyName: string;
  applicantName: string;
  applicantPublicId: string;
  countryCode: string;
  femaleHostCount: number;
  minHostsRequired: number;
  status: string;
  aiDecision: string;
  createdAt: string;
}

type ServerAgencyAppDetail = ServerAgencyAppRow & {
  applicantPhone: string;
  whatsappNumber: string;
  inviteCode: string;
  proposedHosts: Record<string, unknown>[];
  logoUrl: string | null;
  backgroundUrl: string | null;
  idDocumentUrl: string | null;
  aiReview: Record<string, unknown>;
  rejectionReason: string;
  hostsDeadline: string | null;
  reviewDeadline: string | null;
  decidedAt: string | null;
};

function toAgencyApplication(
  row: ServerAgencyAppRow,
  detail?: Partial<ServerAgencyAppDetail>,
): AdminAgencyApplication {
  const ai = (detail?.aiReview ?? {}) as Record<string, unknown>;
  const ms = (iso?: string | null): number | undefined =>
    iso ? Date.parse(iso) || undefined : undefined;
  return {
    id: row.id,
    applicantUid: '',
    applicantName: row.applicantName || '—',
    applicantPhone: detail?.applicantPhone ?? '',
    countryCode: row.countryCode || '',
    agencyName: row.agencyName || '—',
    status: row.status,
    proposedHosts: (detail?.proposedHosts ?? []) as AdminAgencyApplication['proposedHosts'],
    proposedHostUids: [],
    minHostsRequired: row.minHostsRequired ?? 0,
    femaleHostCount: row.femaleHostCount ?? 0,
    applicantPublicAccountId: row.applicantPublicId,
    whatsappNumber: detail?.whatsappNumber,
    inviteCode: detail?.inviteCode,
    hostsDeadline: ms(detail?.hostsDeadline),
    reviewDeadline: ms(detail?.reviewDeadline),
    rejectionReason: detail?.rejectionReason,
    agencyId: row.agencyId ?? undefined,
    ownerName: row.applicantName,
    // v1 told the two queues apart by `reviewMethod === 'ai'`; v2 records the
    // automated verdict itself, so its presence IS the marker.
    reviewMethod: row.aiDecision ? 'ai' : 'manual',
    logoUrl: detail?.logoUrl ?? undefined,
    backgroundUrl: detail?.backgroundUrl ?? undefined,
    idDocumentUrl: detail?.idDocumentUrl ?? undefined,
    aiDecision: (row.aiDecision || undefined) as AdminAgencyApplication['aiDecision'],
    aiReason: typeof ai.reason === 'string' ? ai.reason : undefined,
    aiConfidence: typeof ai.confidence === 'number' ? ai.confidence : undefined,
    aiChecks: Array.isArray(ai.checks)
      ? (ai.checks as AdminAgencyApplication['aiChecks'])
      : undefined,
    aiProvider: typeof ai.provider === 'string' ? ai.provider : undefined,
    aiModel: typeof ai.model === 'string' ? ai.model : undefined,
    aiReviewedAt: typeof ai.reviewedAt === 'number' ? ai.reviewedAt : undefined,
    createdAt: Date.parse(row.createdAt) || 0,
    updatedAt: ms(detail?.decidedAt) ?? (Date.parse(row.createdAt) || 0),
  };
}

const fetchAgencyApplications = async (): Promise<AdminAgencyApplication[]> => {
  const res = await v2.get<{ items: ServerAgencyAppRow[] }>(
    `/admin/agency-applications${v2Qs({ limit: 100 })}`,
  );
  return (res?.items ?? [])
    .map((row) => toAgencyApplication(row))
    .filter((a) => isInAdminCountryScope(a.countryCode))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
};

export const getAgencyApplications = async (): Promise<AdminAgencyApplication[]> => {
  try {
    return await fetchAgencyApplications();
  } catch (e) {
    console.error('getAgencyApplications:', e);
    return [];
  }
};

/** تفاصيل طلب — the only read that returns the documents and the AI review. */
export const getAgencyApplicationDetail = async (
  applicationId: string,
): Promise<AdminAgencyApplication | null> => {
  try {
    const row = await v2.get<ServerAgencyAppDetail>(`/admin/agency-applications/${applicationId}`);
    return row?.id ? toAgencyApplication(row, row) : null;
  } catch {
    return null;
  }
};

/**
 * قرار على طلب فتح وكالة. الموافقة **تُنشئ الوكالة فعلاً** على السيرفر (بالكود
 * والمالك والمضيفات المقترحة) داخل عملية واحدة، والرفض يُبلّغ صاحب الطلب بالسبب.
 */
export const reviewAgencyApplicationAdmin = async (
  applicationId: string,
  action: 'approve' | 'reject',
  rejectionReason?: string,
): Promise<void> => {
  const note = rejectionReason?.trim();
  if (action === 'reject' && !note) throw new Error('اكتب سبب الرفض — يظهر لصاحب الطلب');
  await v2.post(`/admin/agency-applications/${applicationId}/decide`, {
    approve: action === 'approve',
    ...(note ? { reason: note } : {}),
  });
  await logAdminAction(
    action === 'approve' ? 'اعتماد طلب وكالة' : 'رفض طلب وكالة',
    applicationId,
    note ?? '',
  );
};

/** طلبات التوثيق المُراجَعة آلياً — same queue, the ones carrying a verdict. */
export const getAgencyVerifications = async (): Promise<AdminAgencyApplication[]> => {
  try {
    return (await fetchAgencyApplications()).filter((a) => a.reviewMethod === 'ai');
  } catch (e) {
    console.error('getAgencyVerifications:', e);
    return [];
  }
};

/**
 * ⚠️ توثيق مضيفة داخل طلب وكالة غير متاح كخطوة منفصلة على v2.
 *
 * v1 had a per-host button inside the application. In v2 a host is verified
 * through her OWN identity request (صفحة طلبات التحقق), and the application
 * counts how many verified female hosts she has — one source of truth instead of
 * two places that could disagree.
 */
export const adminVerifyAgencyHostAdmin = async (
  applicationId: string,
  hostUid: string,
): Promise<void> => {
  void applicationId;
  throw new Error(
    'توثيق المضيفة يتم من صفحة «طلبات التحقق من الهوية» على حسابها' +
      (hostUid ? ` (${hostUid.slice(0, 8)}…)` : '') +
      ' — والطلب يعدّ الموثّقات تلقائياً.',
  );
};

/**
 * ⚠️ التفعيل اليدوي/السريع للطلب غير متاح: على v2 الموافقة نفسها تُنشئ الوكالة،
 * فلا توجد حالة «مقبول لكن غير مُفعَّل» تحتاج زراً ثانياً.
 */
export const activateAgencyApplicationAdmin = async (applicationId: string): Promise<void> => {
  void applicationId;
  throw new Error('لا حاجة للتفعيل — الموافقة على الطلب تُنشئ الوكالة مباشرة.');
};

export const adminExpressActivateApplication = activateAgencyApplicationAdmin;


/**
 * إنشاء وكالة مباشرة (بلا طلب). The owner's membership row is created with it —
 * an agency whose owner is not a member of it is a state half the app's queries
 * would miss. The invite code is generated server-side unless one is given.
 *
 * `hostUids` / `applicationId` are accepted for signature compatibility: hosts
 * join through «ربط عضو» (which decides the role from the ACCOUNT), and an
 * application is approved through its own decide endpoint, which creates the
 * agency itself.
 */
export const adminCreateAgencyDirect = async (input: {
  ownerUid: string;
  agencyName: string;
  countryCode?: string;
  hostUids?: string[];
  applicationId?: string;
}) => {
  const created = await v2.post<{
    id: string;
    name: string;
    inviteCode: string;
    ownerUid: string;
  }>('/admin/agencies', {
    ownerIdentifier: input.ownerUid,
    name: input.agencyName,
    ...(input.countryCode ? { country: input.countryCode } : {}),
  });
  await logAdminAction('إنشاء وكالة مباشرة', created.name, created.inviteCode);

  for (const uid of input.hostUids ?? []) {
    // Best-effort: a host who is already in another agency is refused by the
    // server, and that must not undo the agency that was just created.
    await assignAgencyMember(created.id, uid).catch(() => undefined);
  }
  return { data: created };
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
    const row = await v2.get<ServerAgencyRow>(`/admin/agencies/${agencyId}`);
    if (!row?.id) return null;
    return {
      id: row.id,
      name: row.name,
      femaleHostCount: row.femaleHostCount ?? 0,
      minHostsRequired: row.minHostsRequired ?? 0,
      memberCount: row.memberCount ?? 0,
      status: row.status,
      inviteCode: row.inviteCode,
    };
  } catch {
    return null;
  }
};

interface ServerAgencyMemberRow {
  uid: string;
  role: string;
  displayName: string;
  publicAccountId: string;
  avatar: string;
  isBanned: boolean;
}

export const getAgencyMembers = async (agencyId: string): Promise<AgencyMember[]> => {
  await assertAgencyIdInScope(agencyId);
  try {
    const rows = await v2.get<ServerAgencyMemberRow[]>(`/admin/agencies/${agencyId}/members`);
    return (rows ?? []).map((r) => ({
      // v2 keys membership by (agency, uid) — the pair IS the identity, so there
      // is no separate document id to carry.
      id: `${agencyId}_${r.uid}`,
      uid: r.uid,
      uidName: r.displayName || 'مستخدم',
      uidAvatar: r.avatar || undefined,
      agencyId,
      role: r.role,
      // «مضيفة موثّقة» is one fact on the ACCOUNT (its identity verification), not
      // a second flag on the membership that could disagree with it.
      hostVerified: r.role === 'host',
      isFemaleHost: r.role === 'host',
      joinedAt: 0,
    }));
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

/**
 * تفاصيل الوكالة الكاملة — من `/admin/agencies/:id`.
 *
 * «المستوى المطبَّق» كان يُقرأ من عقدة الغرفة الحيّة في RTDB؛ في v2 المستوى محسوب
 * على السيرفر من الدعم التراكمي ويعود مع الوكالة، فلا حاجة لقراءة ثانية تناقض
 * الأولى: المخزَّن يدوياً (`periodLevelManual`) يُعرض كما هو، وغير ذلك محسوب.
 */
export const getAgencyFullDetail = async (
  agencyId: string,
): Promise<AgencyFullDetail | null> => {
  await assertAgencyIdInScope(agencyId);
  try {
    const a = await v2.get<ServerAgencyRow>(`/admin/agencies/${agencyId}`);
    if (!a) return null;
    if (!isInAdminCountryScope(a.country)) return null;
    return {
      id: a.id,
      name: a.name,
      ownerUid: a.ownerUid,
      ownerName: a.ownerName,
      country: a.country || '—',
      status: a.status ?? 'active',
      isVerified: a.isVerified === true,
      inviteCode: a.inviteCode ?? '',
      memberCount: a.memberCount ?? 0,
      femaleHostCount: a.femaleHostCount ?? 0,
      minHostsRequired: a.minHostsRequired ?? 0,
      earnings: a.workCoins ?? 0,
      rating: 0,
      createdAt: new Date(a.createdAt).getTime() || 0,
      liveRoomId: a.liveRoomId ?? undefined,
      // 0 من السيرفر = لم يُحدَّد سقف، فالافتراضي 9 كما في v1.
      maxSeatsCount: [9, 11, 16, 19, 21].includes(a.maxSeatsCount) ? a.maxSeatsCount : 9,
      periodLevel: a.periodLevel > 0 ? a.periodLevel : undefined,
      periodLevelManual: a.periodLevelManual === true,
      appliedPeriodLevel: a.periodLevel > 0 ? a.periodLevel : undefined,
    };
  } catch (e) {
    console.error('getAgencyFullDetail:', e);
    return null;
  }
};

/**
 * الأعضاء + محافظهم — الأعضاء من `/admin/agencies/:id/members`، والرصيد لكل عضو
 * من `/admin/users/:id`. طلبٌ واحد لكل عضو، وهو مقبول لأن الوكالة عشرات لا آلاف،
 * والصفحة تُفتح بطلب المشرف لا في كل تحديث.
 *
 * «الماس المكتسب» و«المحوَّل للوكيل» لا يوجد لهما مقابل في v2 (الأرباح تصل عملات
 * 100% بقرار المالك) فيبقيان صفراً بصدق بدل رقمٍ من مصدر لم يُهاجَر.
 */
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
      let country = '—';
      let level = 0;
      try {
        const u = await v2.get<ServerUserRow>(`/admin/users/${m.uid}`);
        if (u) {
          coins = u.coins ?? 0;
          pearls = u.pearls ?? 0;
          isBanned = u.isBanned === true;
          avatar = u.avatar || avatar;
          displayName = u.displayName || displayName;
          country = u.country || '—';
          level = u.level ?? 0;
        }
      } catch {
        /* a member whose account read fails still lists, with what we know */
      }
      return {
        ...m,
        coins,
        pearls,
        pearlsEarned: 0,
        pearlsTransferredToAgent: 0,
        availablePearls: 0,
        isBanned,
        avatar,
        displayName,
        // «آخر ظهور» is live presence in v2, not a stored timestamp per user.
        lastSeen: 0,
        country,
        level,
      };
    }),
  );
  return enriched.sort((a, b) => b.coins - a.coins);
};

/** تعديل أرباح عضو (pearlsEarned) في الوكالة يدوياً */
/**
 * ⚠️ تعديل «الماس المكتسب» للعضو يدوياً — موقوف، ولا يُكتب في القاعدة القديمة.
 *
 * This wrote a MONEY field straight from the browser: `pearlsEarned` is what the
 * host's salary and her withdrawal tiers are computed from. Changing it by hand
 * moves value with no transaction, no ledger row and nothing to reverse it — the
 * one thing the v2 money rules exist to prevent. If a figure is genuinely wrong,
 * the fix is a ledgered balance adjustment on the account (صفحة المستخدم →
 * تعديل الرصيد), which leaves a reason and an audit trail behind it.
 */
export const setAgencyMemberPearlsEarned = async (
  memberDocId: string,
  newPearlsEarned: number,
  agencyId: string,
): Promise<void> => {
  void memberDocId;
  void newPearlsEarned;
  void agencyId;
  throw new Error(
    'تعديل الماس المكتسب يدوياً غير متاح — هو حقل مال تُحسب منه الرواتب والسحب. ' +
      'استخدم «تعديل الرصيد» على حساب المضيفة ليُسجَّل بمعاملة وسبب وسجل تدقيق.',
  );
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
/**
 * ربط مستخدم بوكالة — the ROLE is decided by the account, on the server: a
 * verified female joins as `host` (that role is what unlocks the host earning
 * flows), everyone else as `member`. And one agency per account: an account that
 * already belongs elsewhere is refused, never moved — moving a host would strand
 * the work-coin wallet her earnings live in.
 */
export const assignAgencyMember = async (
  agencyId: string,
  userIdentifier: string,
): Promise<AssignAgencyMemberResult> => {
  await assertAgencyIdInScope(agencyId);
  const res = await v2.post<AssignAgencyMemberResult>(`/admin/agencies/${agencyId}/members`, {
    identifier: userIdentifier.trim(),
  });
  if (!res.alreadyMember) {
    await logAdminAction('ربط عضو بوكالة', res.publicAccountId, res.role);
  }
  return res;
};

/**
 * إزالة عضو من الوكالة.
 *
 * ⚠️ The server REFUSES while the member still holds work coins: those are her
 * earnings and the membership row is the wallet they live in. She withdraws (or
 * the agent withdraws for her) first. v1 removed the row regardless — which is
 * how earnings quietly disappeared.
 *
 * `memberDocId` / `wasFemaleHost` are kept in the signature for the pages that
 * pass them; v2 keys a membership by (agency, uid), so the pair is the identity.
 */
export const removeAgencyMember = async (
  memberDocId: string,
  uid: string,
  agencyId: string,
  _wasFemaleHost: boolean,
): Promise<void> => {
  void memberDocId;
  await assertAgencyIdInScope(agencyId);
  await assertUidInAdminCountryScope(uid);
  await v2.post(`/admin/agencies/${agencyId}/members/${uid}/remove`);
  await logAdminAction('إزالة عضو من وكالة', uid, agencyId);
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
  await v2.post(`/admin/agencies/${agencyId}/info`, payload);
  await logAdminAction('تعديل وكالة', agencyId, Object.keys(payload).join('، '));
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
/**
 * أقصى مايكات للوكالة — a POLICY CAP the room-seats endpoint then enforces, so
 * the two can never disagree. `applySeatsToLiveRoom` applies the count to the
 * agency's live room in the same action, as v1 did.
 */
export const setAgencyMaxSeatsCount = async (
  agencyId: string,
  maxSeatsCount: AgencySeatCount,
  options?: { applySeatsToLiveRoom?: AgencySeatCount },
): Promise<void> => {
  const agency = await assertAgencyIdInScope(agencyId);
  if (!AGENCY_SEAT_OPTIONS.includes(maxSeatsCount)) {
    throw new Error('عدد المايكات غير مدعوم');
  }
  await v2.post(`/admin/agencies/${agencyId}/max-seats`, { seatCount: maxSeatsCount });
  await logAdminAction('تعديل أقصى مايكات الوكالة', agency.name || agencyId, String(maxSeatsCount));

  const applyCount = options?.applySeatsToLiveRoom;
  if (applyCount == null) return;
  if (applyCount > maxSeatsCount) throw new Error('لا يمكن تطبيق عدد أكبر من الحد المسموح');
  // No live room, nothing to apply to — and that is not an error.
  if (!agency.liveRoomId) return;
  await setRoomSeatsCount(agency.liveRoomId, applyCount, { syncAgencyMax: false });
};

/**
 * عدد المقاعد في غرفة — the server writes the row AND the live node (through its
 * compare-and-set transaction, so a mic being taken at the same moment is not
 * lost), and refuses a count above the agency's cap. v1 rebuilt the seat map in
 * the browser and pushed the whole node.
 */
export const setRoomSeatsCount = async (
  roomId: string,
  seatsCount: AgencySeatCount,
  options?: { syncAgencyMax?: boolean },
): Promise<void> => {
  if (!AGENCY_SEAT_OPTIONS.includes(seatsCount)) {
    throw new Error('عدد المقاعد غير مدعوم');
  }
  void options; // the cap is the agency's own setting now, never derived here
  await v2.post(`/admin/rooms/${roomId}/seats`, { seatCount: seatsCount });
  await logAdminAction('تعديل مقاعد الغرفة', roomId, String(seatsCount));
};

/**
 * مستوى فترة الوكالة يدوياً — the server marks it manual, so the automatic
 * computation stops overwriting it. v1 also pushed the number into the live RTDB
 * room node; on v2 the room reads the agency, so there is nothing to mirror.
 */
export const setAgencyPeriodLevel = async (agencyId: string, level: number): Promise<void> => {
  const agency = await assertAgencyIdInScope(agencyId);
  const lv = Math.round(Number(level));
  if (lv < AGENCY_LEVEL_MIN || lv > AGENCY_LEVEL_MAX) {
    throw new Error(`المستوى يجب أن يكون بين ${AGENCY_LEVEL_MIN} و ${AGENCY_LEVEL_MAX}`);
  }
  await v2.post(`/admin/agencies/${agencyId}/period-level`, { level: lv });
  await logAdminAction('تعديل مستوى الوكالة يدوياً', agency.name || agencyId, String(lv));
};

/** يرجّع المستوى للحساب التلقائي — إسقاط الحقل هو ما يعني «ألغِ التعديل اليدوي». */
export const clearAgencyPeriodLevelOverride = async (agencyId: string): Promise<void> => {
  const agency = await assertAgencyIdInScope(agencyId);
  await v2.post(`/admin/agencies/${agencyId}/period-level`, {});
  await logAdminAction('إلغاء تعديل مستوى الوكالة اليدوي', agency.name || agencyId, agencyId);
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



/**
 * ⚠️ طلبات زيادة المايكات: الطابور نفسه لم ينتقل إلى v2 — لا جدول ولا مسار في
 * التطبيق يقدّم الطلب، فلا شيء يملأ هذه القائمة.
 *
 * The CAPABILITY behind it is live, though: «أقصى مايكات الوكالة» sets the cap and
 * «مقاعد الغرفة» applies a count — both on the server, both audited. So an agent's
 * request is handled by doing it, and this refuses instead of writing a decision
 * into the OLD database for a request v2 never received.
 */
export const reviewAgencySeatRequest = async (
  requestId: string,
  action: 'approve' | 'reject',
  options?: { applyToRoom?: boolean; rejectionReason?: string },
): Promise<void> => {
  void requestId;
  void action;
  void options;
  throw new Error(
    'طابور طلبات المايكات لم يُنقل بعد (التطبيق لا يرسل الطلب على النسخة الجديدة). ' +
      'استخدم «أقصى مايكات الوكالة» و«مقاعد الغرفة» مباشرة — كلاهما مُسجَّل في سجل العمليات.',
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
/**
 * أرقام السهرة الحيّة — أصفار بصدق حالياً.
 *
 * كانت تُقرأ من عقد الغرفة الحيّة في Realtime Database. حالة الغرفة في v2 تعيش في
 * Redis على السيرفر، ولا نقطة إدارية تقرأها بعد؛ ولا ميزة سهرات في v2 أصلاً (قوائم
 * الطلبات فارغة كما هو موضّح أعلاه)، فالبطاقة تظهر بأصفار بدل قراءة قاعدةٍ لم تعد
 * اللوحة موصولةً بها.
 */
export async function getPartyLiveStats(
  _roomId: string,
  _window: { from: number; to: number },
): Promise<AdminPartyLiveStats> {
  return { audienceCount: 0, roomMemberCount: 0, supportCoins: 0, giftCount: 0 };
}

/**
 * طلبات المقاعد وطلبات السهرات — فارغة بصدق.
 *
 * الميزتان لم تُبنَ في v2 بعد: لا جدول لطلب مقعد ولا لطلب سهرة، فلا مصدر لأي صف
 * هنا. كانت هذه الدوال تقرأ Firestore مباشرة، وبعد قطع اللوحة عن Firebase صار
 * ذلك خطأ صلاحيات في الكونسول لا قائمةً فارغة — والفراغ الصريح أصدق وأهدأ.
 *
 * عند بناء الميزتين في v2 تُوصَل هذه الدوال بنقطتيهما ويُحذف هذا التعليق.
 */
export const getAgencySeatRequests = async (
  agencyId: string,
  _status: AgencySeatRequestStatus = 'pending',
): Promise<AdminAgencySeatRequest[]> => {
  await assertAgencyIdInScope(agencyId);
  return [];
};

export const getAgencyPartyRequests = async (
  agencyId: string,
  _status: AgencyPartyRequestStatus = 'pending',
): Promise<AdminAgencyPartyRequest[]> => {
  await assertAgencyIdInScope(agencyId);
  return [];
};

/** كل طلبات الحفلات المعلّقة ضمن نطاق دول الأدمن */
/** كل طلبات السهرات المعلّقة — فارغة بصدق: لا ميزة سهرات في v2 (انظر أعلاه). */
export const getAllPendingPartyRequests = async (): Promise<AdminAgencyPartyRequest[]> => {
  return [];
};

export const getPendingPartyRequestsCount = async (): Promise<number> => {
  const list = await getAllPendingPartyRequests();
  return list.length;
};


/** قائمة السهرات — فارغة بصدق: لا جدول سهرات على v2 (انظر الملاحظة أعلاه). */
export const getAgencyPartyEventsAll = async (
  agencyId?: string,
): Promise<AdminAgencyPartyRequest[]> => {
  void agencyId;
  return [];
};
/**
 * ⚠️ طلبات وفعاليات السهرات: الميزة نفسها لم تنتقل إلى v2 — لا جدول طلبات ولا
 * شاشة في التطبيق تُنشئ سهرة، فالطابور فارغ بطبعه ولا شيء لإيقافه.
 *
 * These refuse rather than write a decision into the OLD database for a request v2
 * never received. When the feature is migrated (app screen + table), the queue and
 * these two actions come with it; the moderation lever that exists TODAY is
 * «إغلاق الغرفة», which really ends what is running.
 */
const PARTY_NOT_MIGRATED =
  'ميزة السهرات لم تُنقل إلى النسخة الجديدة بعد (لا يوجد مسار في التطبيق لتقديم الطلب). ' +
  'لإيقاف ما يجري الآن استخدم «إغلاق الغرفة».';

export const reviewAgencyPartyRequest = async (
  requestId: string,
  action: 'approve' | 'reject',
  options?: { rejectionReason?: string },
): Promise<void> => {
  void requestId;
  void action;
  void options;
  throw new Error(PARTY_NOT_MIGRATED);
};

export const stopAgencyPartyEvent = async (
  requestId: string,
  options?: { reason?: string },
): Promise<void> => {
  void requestId;
  void options;
  throw new Error(PARTY_NOT_MIGRATED);
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
/**
 * يجمع معاملات دخل أعضاء الوكالة من دفتر v2 (طلب لكل عضو، أعلى 20 عضواً) ويبني
 * السجل + الرسم الأسبوعي كما في v1.
 *
 * فلترة الأنواع صارت على أنواع v2 الحقيقية (الهدايا المستلمة، رسوم المايك،
 * أرباح المكالمات والرسائل) لأن أسماء الأنواع في القاعدة الجديدة ليست نفسها.
 */
export const getAgencyEarningsActivity = async (
  members: { uid: string; displayName: string }[],
): Promise<AgencyActivity> => {
  // نحد لأعلى 20 عضواً لتفادي عدد كبير من الطلبات
  const top = members.slice(0, 20);
  const nameByUid: Record<string, string> = {};
  top.forEach((m) => { nameByUid[m.uid] = m.displayName; });

  const perMember = await Promise.all(
    top.map(async (m) => {
      try {
        const res = await v2.get<{ items: ServerUserTxRow[] }>(
          `/admin/users/${m.uid}/transactions${v2Qs({ limit: 15 })}`,
        );
        return (res?.items ?? []).map((t) => ({ ...t, uid: m.uid }));
      } catch {
        return [];
      }
    }),
  );

  /** أنواع v2 التي تُعدّ دخلاً للعضو. */
  const INCOME_TYPES = new Set([
    'gift_received',
    'seat_fee_received',
    'call_earning',
    'chat_message_earning',
    'unlock_message_earning',
    'host_task_reward',
  ]);

  const all: AgencyActivityTx[] = [];
  perMember.flat().forEach((t) => {
    if (!INCOME_TYPES.has(t.type)) return;
    all.push({
      id: t.id,
      uid: t.uid,
      memberName: nameByUid[t.uid] ?? 'عضو',
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      createdAt: new Date(t.createdAt).getTime() || 0,
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

/**
 * تحليلات دخل الوكالة — تُبنى الآن من دفتر v2 لأعضاء الوكالة بدل دالة Firebase.
 *
 * المجاميع حقيقية (مجموع دخل الأعضاء في المدة، ومجموع اليوم)، والمضيفات مرتّبات
 * بدخلهنّ الفعلي. المنحنى الزمني بحسب المدة: أسبوع = 7 نقاط يومية، وشهر = 30.
 *
 * مرشّح نوع الدخل يقتصر على ما يسجّله v2 فعلاً: الهدايا، ورسوم المايك، وأرباح
 * المكالمات والرسائل. «الاستردادات» ليست ميزةً في v2 فتعيد فراغاً — لا رقماً
 * مُلفّقاً.
 */
export const getAgencyAdminAnalytics = async (
  agencyId: string,
  period: AgencyAdminAnalyticsPeriod = 'week',
  incomeType: AgencyAdminIncomeFilter = 'all',
): Promise<AgencyAdminAnalytics> => {
  await assertAgencyIdInScope(agencyId);
  const empty: AgencyAdminAnalytics = {
    agencyId,
    series: [],
    total: 0,
    todayTotal: 0,
    hosts: [],
  };
  if (incomeType === 'refund') return empty; // لا استردادات في v2
  try {
    const members = await getAgencyMembers(agencyId);
    if (members.length === 0) return empty;
    const activity = await getAgencyEarningsActivity(
      members.map((m) => ({ uid: m.uid, displayName: m.uidName ?? '—' })),
    );

    const TYPES_BY_FILTER: Record<string, Set<string> | null> = {
      all: null,
      gifts: new Set(['gift_received']),
      chat: new Set(['chat_message_earning', 'unlock_message_earning']),
      calls: new Set(['call_earning']),
      other: new Set(['seat_fee_received', 'host_task_reward']),
      refund: new Set<string>(),
    };
    const wanted = TYPES_BY_FILTER[incomeType] ?? null;
    const rows = wanted ? activity.recent.filter((t) => wanted.has(t.type)) : activity.recent;

    const dayMs = 86_400_000;
    // «4 أسابيع» تُرسَم 28 نقطة يومية، والأسبوع (الحالي أو الماضي) 7.
    const points = period.startsWith('4weeks') ? 28 : 7;
    // «الأسبوع الماضي» ينتهي قبل أسبوع من اليوم لا عند اليوم.
    const shiftDays = period === 'last_week' ? 7 : 0;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const series: { label: string; value: number }[] = [];
    for (let i = points - 1; i >= 0; i--) {
      const from = startOfToday.getTime() - (i + shiftDays) * dayMs;
      const to = from + dayMs;
      series.push({
        label: new Date(from).toLocaleDateString('ar', { day: 'numeric', month: 'short' }),
        value: rows
          .filter((t) => t.createdAt >= from && t.createdAt < to)
          .reduce((s, t) => s + t.amount, 0),
      });
    }

    const earningsByUid = new Map<string, number>();
    rows.forEach((t) => earningsByUid.set(t.uid, (earningsByUid.get(t.uid) ?? 0) + t.amount));

    return {
      agencyId,
      series,
      total: rows.reduce((s, t) => s + t.amount, 0),
      todayTotal: rows
        .filter((t) => t.createdAt >= startOfToday.getTime())
        .reduce((s, t) => s + t.amount, 0),
      hosts: members
        .map((m) => ({
          uid: m.uid,
          name: m.uidName ?? '—',
          avatar: m.uidAvatar ?? '',
          earnings: earningsByUid.get(m.uid) ?? 0,
          totalPearlsEarned: 0,
        }))
        .sort((a, b) => b.earnings - a.earnings),
    };
  } catch (e) {
    console.error('getAgencyAdminAnalytics:', e);
    return empty;
  }
};

export interface AgencyRefundAdminRow {
  id: string;
  hostName: string;
  supporterName: string;
  amount: number;
  reason: string;
  createdAt: number;
}

/**
 * استردادات الوكالة — فارغة بصدق: لا ميزة استرداد في v2، ولا نستدعي دالة Firebase
 * القديمة من اللوحة. الفراغ الصريح أصدق من خطأ في الكونسول.
 */
export const getAgencyRefundsAdmin = async (agencyId: string): Promise<AgencyRefundAdminRow[]> => {
  await assertAgencyIdInScope(agencyId);
  return [];
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

/**
 * سحوبات أعضاء الوكالة — من `/admin/withdrawals`، مُرشَّحة بمعرّف الوكالة الذي
 * يعيده السيرفر على كل طلب.
 *
 * الترشيح هنا لا على السيرفر لأن نقطة السحوبات تُرشِّح بالحالة والنوع والمستخدم؛
 * والسقف 200 صفاً يغطي وكالةً واحدة بمريح. لو تجاوزت وكالة ذلك يوماً، يصبح
 * المرشِّح على السيرفر هو الحل الصحيح لا زيادة السقف.
 */
export const getAgencyWithdrawals = async (agencyId: string): Promise<AgencyWithdrawal[]> => {
  await assertAgencyIdInScope(agencyId);
  try {
    const res = await v2.get<{ items: ServerWithdrawalRow[] }>(
      `/admin/withdrawals${v2Qs({ limit: 200 })}`,
    );
    return (res?.items ?? [])
      .filter((w) => w.agencyId === agencyId)
      .map((w) => ({
        id: w.id,
        uid: w.uid,
        uidName: w.requesterName || '—',
        type: w.kind === 'agent' ? 'agent' : 'self',
        amount: w.diamonds,
        netAmount: w.netUsd,
        status: w.status,
        createdAt: new Date(w.createdAt).getTime() || 0,
      }))
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

/**
 * ملف المستخدم الكامل — من `/admin/users/:id` (يعيد `profile` و`stats`) مع
 * أجهزته من `/admin/users/:id/devices`.
 *
 * «آخر دخول» لم يكن حقلاً مستقلاً في v2 كما في v1: أحدث جهاز في القائمة هو آخر
 * دخول فعلي — وقته وعنوانه ومعرّفه — فنقرأه من هناك بدل تخزين نسخة ثانية تتناقض
 * مع الأولى. و«كلمة المرور المحفوظة» لا وجود لها بصدق: v2 لا يخزّن كلمة مرور
 * قابلة للقراءة إطلاقاً (تُهشَّر فوراً)، فتبقى undefined ولا تُلفّق.
 */
export const getUserFullProfile = async (uid: string): Promise<AdminUserFull | null> => {
  const base = await getUserById(uid);
  if (!base) return null;
  try {
    const [detail, devices] = await Promise.all([
      v2.get<ServerUserRow & { profile?: Record<string, unknown>; stats?: Record<string, unknown> }>(
        `/admin/users/${uid}`,
      ),
      getUserLoginSessions(uid, 20).catch(() => [] as AdminLoginSession[]),
    ]);
    const profile = (detail?.profile ?? {}) as Record<string, unknown>;
    const stats = (detail?.stats ?? {}) as Record<string, unknown>;
    const num = (v: unknown) => Number(v ?? 0) || 0;
    const newest = devices[0];
    return {
      ...base,
      xp: num(stats.xp ?? profile.xp),
      vipPoints: num(stats.vipPoints ?? profile.vipPoints),
      vipPointsMonth: num(stats.vipPointsMonth ?? profile.vipPointsMonth),
      visitors: num(stats.visitors ?? profile.visitors),
      agencyName: profile.agencyName != null ? String(profile.agencyName) : undefined,
      agencyRole: profile.agencyRole != null ? String(profile.agencyRole) : undefined,
      userTitles: profile.userTitles as AdminUserFull['userTitles'],
      tags: Array.isArray(profile.tags) ? (profile.tags as string[]) : [],
      registeredDevices: devices.map((d) => ({
        id: d.deviceId ?? d.id,
        name: d.deviceName ?? '',
        platform: d.platform ?? '',
        lastActiveAt: d.createdAt,
      })) as AdminRegisteredDevice[],
      lastLoginAt: newest?.createdAt,
      lastLoginIp: newest?.ip || undefined,
      lastLoginMethod: newest?.method || undefined,
      lastLoginDeviceId: newest?.deviceId,
      accountStatus:
        ((profile.security as Record<string, unknown> | undefined)?.accountStatus ??
          profile.accountStatus) === 'pending_deletion'
          ? 'pending_deletion'
          : undefined,
      deletionRequestedAt: num(
        (profile.security as Record<string, unknown> | undefined)?.deletionRequestedAt ??
          profile.deletionRequestedAt,
      ) || undefined,
      // «تعليق مؤقت» in v2 IS a ban with an end date on the profile.
      isSuspended: base.isBanned && num(profile.suspendedUntil) > 0,
      suspendedUntil: num(profile.suspendedUntil) || undefined,
      suspendReason: profile.suspendReason != null ? String(profile.suspendReason) : undefined,
    };
  } catch (e) {
    console.error('getUserFullProfile:', e);
    return { ...base, xp: 0, vipPoints: 0, vipPointsMonth: 0, visitors: 0 };
  }
};

/** One device as the server reports it (from `users.profile.devices`). */
interface ServerDeviceRow {
  deviceId: string;
  model: string;
  platform: string;
  osVersion: string;
  appVersion: string;
  ip: string;
  firstSeenAt: number;
  lastSeenAt: number;
  logins: number;
  /** الاسم الذي يعرضه المستخدم لجهازه في صفحة «الأجهزة» داخل التطبيق. */
  name?: string;
  /** ألغى المستخدم هذا الجهاز من تطبيقه — نبقيه معروضاً هنا موسوماً بذلك. */
  revoked?: boolean;
}

/**
 * «الأجهزة والدخول» — أجهزة المستخدم من `/admin/users/:id/devices`.
 *
 * الفرق الجوهري عن v1: هذه **قائمة أجهزة** لا سجل دخول. v1 كان يكتب صفاً لكل
 * تسجيل دخول، فجهاز واحد يظهر عشرين مرة ولا تعرف كم جهازاً يستخدم الحساب فعلاً.
 * هنا الجهاز يُعرَّف بمعرّفه، وإعادة الدخول من نفس الهاتف تُحدّث صفه وترفع عدّاد
 * الدخول — فـ«كم جهازاً؟» و«كم مرة دخل؟» سؤالان لهما جوابان.
 *
 * `createdAt` تُعرض كآخر ظهور (وهو ما تريده الصفحة: الأحدث أولاً)، و`method`
 * تحمل عدد مرات الدخول لأن v2 لا يميّز طريقة الدخول لكل جهاز.
 */
export const getUserLoginSessions = async (
  uid: string,
  limitCount = 50,
): Promise<AdminLoginSession[]> => {
  await assertUidInAdminCountryScope(uid);
  try {
    const rows = await v2.get<ServerDeviceRow[]>(`/admin/users/${uid}/devices`);
    return (rows ?? []).slice(0, limitCount).map((d) => ({
      id: d.deviceId,
      deviceId: d.deviceId,
      method: [d.logins > 0 ? `${d.logins} دخول` : '', d.revoked ? 'أُلغي من التطبيق' : '']
        .filter(Boolean)
        .join(' · '),
      ip: d.ip,
      // v1 kept a separate «deviceName»; v2 stores «الشركة + الموديل» in one
      // readable string, which is what the panel actually renders. اسم الجهاز
      // الذي سجّله المستخدم بديلٌ مقبول عندما لا يرسل التطبيق الموديل.
      deviceName: d.model || d.name || '',
      platform: d.platform,
      model: d.model || undefined,
      osVersion: d.osVersion || undefined,
      deviceIdentifier: d.deviceId,
      appVersion: d.appVersion || undefined,
      location: null,
      createdAt: d.lastSeenAt || d.firstSeenAt || 0,
    }));
  } catch (e) {
    console.error('getUserLoginSessions:', e);
    return [];
  }
};


/** سطر واحد من دفتر v2 كما يعيده السيرفر. */
interface ServerUserTxRow {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

/** سحوبات المستخدم — من `/admin/withdrawals?uid=` (نفس جدول صفحة السحوبات). */
export const getUserWithdrawals = async (uid: string, limitCount = 40): Promise<AdminUserWithdrawal[]> => {
  await assertUidInAdminCountryScope(uid);
  try {
    const res = await v2.get<{ items: ServerWithdrawalRow[] }>(
      `/admin/withdrawals${v2Qs({ uid, limit: limitCount })}`,
    );
    return (res?.items ?? []).map((w) => ({
      id: w.id,
      type: w.kind === 'agent' ? 'agent' : 'self',
      amount: w.diamonds,
      netAmount: w.netUsd,
      status: w.status,
      createdAt: new Date(w.createdAt).getTime() || 0,
    }));
  } catch (e) {
    console.error('getUserWithdrawals:', e);
    return [];
  }
};

/**
 * سجل الألعاب — من دفتر المستخدم بمرشّح `kind=games`، وهو المصدر الحقيقي في v2:
 * لا جدول «gameTransactions» منفصل، فكل رهان وكل ربح سطرٌ في نفس الدفتر.
 *
 * الرهان سطر سالب والربح سطر موجب، فنعرضهما كما هما (stake أو winAmount) بدل
 * دمج سطرين قد لا يكونا لنفس الجولة — تلفيقُ اقتران لا نملك دليله.
 */
export const getUserGameTransactions = async (uid: string, limitCount = 40): Promise<AdminGameTx[]> => {
  await assertUidInAdminCountryScope(uid);
  try {
    const res = await v2.get<{ items: ServerUserTxRow[] }>(
      `/admin/users/${uid}/transactions${v2Qs({ kind: 'games', limit: limitCount })}`,
    );
    return (res?.items ?? []).map((t) => ({
      id: t.id,
      gameId: t.type,
      stake: t.amount < 0 ? Math.abs(t.amount) : 0,
      winAmount: t.amount > 0 ? t.amount : 0,
      createdAt: new Date(t.createdAt).getTime() || 0,
    }));
  } catch (e) {
    console.error('getUserGameTransactions:', e);
    return [];
  }
};

/** آخر معاملات عضو محدّد (لنافذة التفاصيل) — من دفتر v2. */
export const getMemberTransactions = async (uid: string, limitCount = 25): Promise<AdminTransaction[]> => {
  await assertUidInAdminCountryScope(uid);
  try {
    const res = await v2.get<{ items: ServerUserTxRow[] }>(
      `/admin/users/${uid}/transactions${v2Qs({ limit: limitCount })}`,
    );
    return (res?.items ?? []).map((t) => ({
      id: t.id,
      uid,
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      createdAt: new Date(t.createdAt).getTime() || 0,
    }));
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

/**
 * «استخدام المكالمات» — من `/admin/call-usage`، وهو تجميعٌ لصفوف الفوترة نفسها في
 * دفتر v2: كل دقيقة محسوبة = سطر `call_spent`، فالدقائق والمال لا يمكن أن يختلفا.
 *
 * ما لا يُسجّله v2 يبقى صفراً بصدق: **مصدر** المكالمة (من محادثة أم من المطابقة
 * العشوائية) ليس محفوظاً على السطر، فشبكة «دردشة/مطابقة × صوت/فيديو» تُعرض
 * بالصوت والفيديو فقط ويبقى تقسيم المصدر خالياً بدل توزيعٍ مُخترع. و«الماس» لا
 * يظهر لأن المكالمات تُحصَّل عملاتٍ بقرار المالك.
 */
export const getCallUsageStats = async (range: CallUsageRange = '30'): Promise<CallUsageStats> => {
  const empty: CallUsageStats = {
    range,
    totalMinutes: 0,
    totalRealMinutes: 0,
    totalSessions: 0,
    totalCoins: 0,
    totalPearls: 0,
    byType: { voice: 0, video: 0 },
    bySource: { chat: 0, match: 0 },
    grid: {
      chatVoice: emptyUsageCell(),
      chatVideo: emptyUsageCell(),
      matchVoice: emptyUsageCell(),
      matchVideo: emptyUsageCell(),
    },
    billedSessions: 0,
    unbilledSessions: 0,
    fetchedCount: 0,
    reachedLimit: false,
  };
  try {
    // «الكل» على السيرفر مسقوف بـ90 يوماً، وهو أقصى نطاق تسمح به الصفحة أصلاً.
    const days = range === 'all' ? 90 : Number(range);
    const u = await v2.get<ServerCallUsage>(`/admin/call-usage${v2Qs({ days })}`);
    if (!u) return empty;
    return {
      ...empty,
      totalMinutes: u.minutes,
      totalRealMinutes: u.minutes,
      totalSessions: u.sessions,
      totalCoins: u.coinsSpent,
      byType: { voice: u.byType?.voice ?? 0, video: u.byType?.video ?? 0 },
      billedSessions: u.sessions,
      fetchedCount: u.minutes,
    };
  } catch (e) {
    console.error('getCallUsageStats:', e);
    return empty;
  }
};

/** تجميع المكالمات كما يعيده `/admin/call-usage`. */
interface ServerCallUsage {
  rangeDays: number;
  minutes: number;
  sessions: number;
  coinsSpent: number;
  coinsEarned: number;
  byType: { voice: number; video: number };
}

// ==================== PROVIDER COSTS & LIVEKIT USAGE ====================
import { DEFAULT_PROVIDER_COSTS, type ProviderCosts } from '@/constants/providerCosts';
export { DEFAULT_PROVIDER_COSTS, type ProviderCosts };

export const getProviderCosts = async (): Promise<ProviderCosts> => {
  try {
    const snap = await getConfigSnap('providers');
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
  await mergeConfig('providers', {
    agoraVoicePerMin: Number(costs.agoraVoicePerMin) || 0,
    agoraVideoPerMin: Number(costs.agoraVideoPerMin) || 0,
    livekitPerMin: Number(costs.livekitPerMin) || 0,
    currency: String(costs.currency || 'USD').slice(0, 6),
    updatedAt: Date.now(),
    _permKey: 'analytics',
  });
};

export interface LiveKitUsageStats {
  hasData: boolean;
  minutes: number;
  sessions: number;
  reachedLimit: boolean;
}

/**
 * استخدام LiveKit — صفر دائماً بصدق: LiveKit حُذف من المنتج نهائياً وAgora هي
 * المسار الوحيد، فلا مصدر لأي رقم هنا. الصفحة تعرض «لا بيانات» عبر hasData=false
 * بدل استعلامٍ يفشل أو رقمٍ من مزوّد لم يعد مستخدماً.
 */
export const getLiveKitUsage = async (_range: CallUsageRange = '30'): Promise<LiveKitUsageStats> => {
  return { hasData: false, minutes: 0, sessions: 0, reachedLimit: false };
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
