/**
 * مصدر واحد لأرصدة المستخدم — يمنع تعارض coins في الجذر vs stats.coins
 */
import { increment } from 'firebase/firestore';

type BalanceKey = 'coins' | 'pearls' | 'casinoCoins';
type SocialCountKey = 'followers' | 'following' | 'visitors' | 'totalRoomsCreated';

export type BalanceStats = {
  coins: number;
  pearls: number;
  casinoCoins: number;
  level: number;
  xp: number;
  followers: number;
  following: number;
  visitors: number;
  totalRoomsCreated: number;
};

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function pickField(
  stats: Record<string, unknown>,
  data: Record<string, unknown>,
  key: BalanceKey | SocialCountKey,
): number {
  const nested = toFiniteNumber(stats[key]);
  const flat = toFiniteNumber(data[key]);
  if (nested !== null && flat !== null) return Math.max(nested, flat);
  return nested ?? flat ?? 0;
}

/** عدّادات اجتماعية — stats.* هو المصدر؛ الجذر fallback فقط (ليس max) */
function pickSocialField(
  stats: Record<string, unknown>,
  data: Record<string, unknown>,
  key: SocialCountKey,
): number {
  const nested = toFiniteNumber(stats[key]);
  if (nested !== null) return nested;
  return toFiniteNumber(data[key]) ?? 0;
}

function pickLevel(stats: Record<string, unknown>, data: Record<string, unknown>): number {
  const nested = toFiniteNumber(stats.level);
  const flat = toFiniteNumber(data.level);
  if (nested !== null && flat !== null) return Math.max(nested, flat);
  return nested ?? flat ?? 1;
}

function pickXp(stats: Record<string, unknown>, data: Record<string, unknown>): number {
  const nested = toFiniteNumber(stats.xp);
  const flat = toFiniteNumber(data.xp);
  if (nested !== null && flat !== null) return Math.max(nested, flat);
  return nested ?? flat ?? 0;
}

/** مستوى الثروة الموحّد — يدمج stats.level والحقل المباشر */
export function resolveWealthLevel(data: Record<string, unknown> | null | undefined): number {
  if (!data) return 1;
  return statsFromFirestoreDoc(data).level;
}

/** مستوى الثروة من كائن User (auth/cache) — يدمج stats والحقول القديمة في الجذر */
export function resolveUserWealthLevel(
  user: { stats?: Partial<BalanceStats> } | null | undefined,
): number {
  if (!user) return 1;
  return resolveWealthLevel(user as unknown as Record<string, unknown>);
}

/** رصيد الكوينز/الماس الموحّد — يأخذ الأعلى عند وجود stats + جذر معاً */
export function getUserCoins(data: Record<string, unknown> | null | undefined): number {
  if (!data) return 0;
  return statsFromFirestoreDoc(data).coins;
}

export function getUserPearls(data: Record<string, unknown> | null | undefined): number {
  if (!data) return 0;
  return statsFromFirestoreDoc(data).pearls;
}

/** رصيد الماسة القابل للإنفاق من وثيقة المستخدم */
export function pearlBalanceFromDoc(data: Record<string, unknown> | null | undefined): number {
  return getUserPearls(data);
}

/** يصلّح انحراف stats.* عن الحقول في الجذر (يحفظ الأعلى — بدون خسارة) */
export async function reconcileUserBalances(uid: string): Promise<void> {
  try {
    const { doc: userRef, getDoc, updateDoc } = await import('firebase/firestore');
    const { firestore } = await import('@/services/firebase/index');
    const ref = userRef(firestore, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() as Record<string, unknown>;
    const merged = statsFromFirestoreDoc(data);
    const rawStats = (data.stats as Record<string, unknown>) ?? {};
    const desynced =
      (rawStats.coins !== undefined && data.coins !== undefined && Number(rawStats.coins) !== Number(data.coins)) ||
      (rawStats.pearls !== undefined && data.pearls !== undefined && Number(rawStats.pearls) !== Number(data.pearls)) ||
      (rawStats.casinoCoins !== undefined && data.casinoCoins !== undefined &&
        Number(rawStats.casinoCoins) !== Number(data.casinoCoins));
    if (!desynced) return;
    await updateDoc(
      ref,
      buildBalanceFirestoreUpdate({
        coins: merged.coins,
        pearls: merged.pearls,
        casinoCoins: merged.casinoCoins,
      }),
    );
  } catch (e) {
    console.warn('reconcileUserBalances:', e);
  }
}

/** قراءة الأرصدة من وثيقة Firestore (يدمج الحقول القديمة والجديدة) */
export function statsFromFirestoreDoc(data: Record<string, unknown>): BalanceStats {
  const stats = (data.stats as Record<string, unknown>) ?? {};
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;

  return {
    coins: pickField(stats, data, 'coins'),
    pearls: pickField(stats, data, 'pearls'),
    casinoCoins: pickField(stats, data, 'casinoCoins'),
    level: pickLevel(stats, data),
    xp: pickXp(stats, data),
    followers: pickSocialField(stats, data, 'followers'),
    following: pickSocialField(stats, data, 'following'),
    visitors: pickSocialField(stats, data, 'visitors'),
    totalRoomsCreated: pickSocialField(stats, data, 'totalRoomsCreated'),
  };
}

/** تحديث Firestore — يكتب stats.* والحقل المباشر معاً */
export function buildBalanceFirestoreUpdate(
  partial: Partial<Pick<BalanceStats, BalanceKey>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of ['coins', 'pearls', 'casinoCoins'] as const) {
    if (partial[key] !== undefined) {
      const v = Math.max(0, Math.floor(partial[key]!));
      out[`stats.${key}`] = v;
      out[key] = v;
    }
  }
  return out;
}

/** زيادة/نقصان ذرّي — stats + الجذر */
export function buildBalanceIncrementPatch(
  field: BalanceKey,
  delta: number,
): Record<string, ReturnType<typeof increment>> {
  return {
    [`stats.${field}`]: increment(delta),
    [field]: increment(delta),
  };
}

/** زيادة/نقصان ذرّي لعدادات المتابعة والزوار والغرف */
export function buildSocialIncrementPatch(
  field: SocialCountKey,
  delta: number,
): Record<string, ReturnType<typeof increment>> {
  return {
    [`stats.${field}`]: increment(delta),
    [field]: increment(delta),
  };
}

/** تعيين مطلق لعدادات اجتماعية — stats + الجذر (لمزامنة العدّاد مع follows) */
export function buildSocialFirestoreUpdate(
  partial: Partial<Pick<BalanceStats, SocialCountKey>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of ['followers', 'following', 'visitors', 'totalRoomsCreated'] as const) {
    if (partial[key] !== undefined) {
      const v = Math.max(0, Math.floor(partial[key]!));
      out[`stats.${key}`] = v;
      out[key] = v;
    }
  }
  return out;
}
