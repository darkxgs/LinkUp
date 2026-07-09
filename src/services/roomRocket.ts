/**
 * Room Rocket — صاروخ الغرفة (3 مستويات: 40k / 80k / 120k كوين)
 * يتراكم الدعم من الهدايا أو التعبئة اليدوية — الإطلاق تلقائي عند بلوغ السعر فقط.
 */
import {
  ref,
  set,
  push,
  onValue,
  off,
  runTransaction,
  get,
  update,
} from 'firebase/database';
import {
  doc,
  getDoc,
  runTransaction as fsRunTransaction,
} from 'firebase/firestore';
import { realtimeDb, auth, firestore } from './firebase/index';
import { buildBalanceIncrementPatch, getUserCoins } from '@/utils/userBalance';
import { resolveDisplayName } from '@/utils/displayName';

export type RocketLevel = 1 | 2 | 3;

export const ROCKET_LEVEL_COINS: Record<RocketLevel, number> = {
  1: 40_000,
  2: 80_000,
  3: 120_000,
};

/**
 * مدة بقاء الصاروخ بعد إطلاقه قبل أن يختفي تلقائياً = ساعة واحدة.
 * - الإطلاق المنشور: يُخفى ويُحذف من قاعدة البيانات بعد ساعة.
 * - دورة التجميع: إن لم تبلغ الهدف خلال ساعة تُلغى وتبدأ من جديد.
 */
export const ROCKET_LAUNCH_TTL_MS = 60 * 60 * 1000;

/** هل ما زال الصاروخ نشطاً (لم تمرّ ساعة على إطلاقه)؟ */
export function isRocketLaunchActive(
  launch: { launchedAt?: number } | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!launch?.launchedAt) return false;
  return now - launch.launchedAt < ROCKET_LAUNCH_TTL_MS;
}

export interface RocketContributor {
  uid: string;
  name: string;
  avatar?: string;
  coins: number;
  level?: number;
  isVIP?: boolean;
  vipLevel?: number;
}

export interface RoomRocketLaunch {
  id: string;
  level: RocketLevel;
  senderUid: string;
  senderName: string;
  senderAvatar?: string;
  senderLevel?: number;
  senderIsVIP?: boolean;
  senderVipLevel?: number;
  totalCoins: number;
  topContributors: RocketContributor[];
  launchedAt: number;
}

export interface RoomRocketProgress {
  cycleTotal: number;
  maxLevelLaunched: number;
  contributors: Record<string, RocketContributor>;
  cycleStartedAt: number;
}

const DEFAULT_PROGRESS: RoomRocketProgress = {
  cycleTotal: 0,
  maxLevelLaunched: 0,
  contributors: {},
  cycleStartedAt: Date.now(),
};

function levelForTotal(total: number): RocketLevel | null {
  if (total >= ROCKET_LEVEL_COINS[3]) return 3;
  if (total >= ROCKET_LEVEL_COINS[2]) return 2;
  if (total >= ROCKET_LEVEL_COINS[1]) return 1;
  return null;
}

function nextLevelToLaunch(maxLevelLaunched: number, total: number): RocketLevel | null {
  const current = levelForTotal(total);
  if (!current || current <= maxLevelLaunched) return null;
  return (maxLevelLaunched + 1) as RocketLevel;
}

function sortContributors(map: Record<string, RocketContributor>): RocketContributor[] {
  return Object.values(map).sort((a, b) => b.coins - a.coins);
}

async function createLaunch(
  roomId: string,
  level: RocketLevel,
  progress: RoomRocketProgress,
  explicitSender?: RocketContributor,
): Promise<string> {
  const sorted = sortContributors(progress.contributors);
  const sender = explicitSender ?? sorted[0];
  if (!sender) throw new Error('لا يوجد مرسل');

  const launchesRef = ref(realtimeDb, `rooms/${roomId}/rocketLaunches`);
  const newRef = push(launchesRef);
  const launch: RoomRocketLaunch = {
    id: newRef.key!,
    level,
    senderUid: sender.uid,
    senderName: sender.name,
    senderAvatar: sender.avatar,
    senderLevel: sender.level,
    senderIsVIP: sender.isVIP,
    senderVipLevel: sender.vipLevel,
    totalCoins: ROCKET_LEVEL_COINS[level],
    topContributors: sorted.slice(0, 10),
    launchedAt: Date.now(),
  };

  await set(newRef, launch);
  await set(ref(realtimeDb, `rooms/${roomId}/rocketActiveLaunchId`), launch.id);
  return launch.id;
}

/** بعد تحديث التقدّم — إطلاق تلقائي لكل مستوى مكتمل */
async function autoLaunchFromProgress(
  roomId: string,
  progressRef: ReturnType<typeof ref>,
): Promise<string | null> {
  let launchId: string | null = null;
  const snap = await get(progressRef);
  let progress = (snap.val() as RoomRocketProgress) ?? DEFAULT_PROGRESS;

  while (true) {
    const level = nextLevelToLaunch(progress.maxLevelLaunched, progress.cycleTotal);
    if (!level) break;

    launchId = await createLaunch(roomId, level, progress);
    progress.maxLevelLaunched = level;

    if (level === 3) {
      progress = {
        cycleTotal: 0,
        maxLevelLaunched: 0,
        contributors: {},
        cycleStartedAt: Date.now(),
      };
    }

    await set(progressRef, progress);
  }

  return launchId;
}

async function addContributionToProgress(
  roomId: string,
  contributor: Omit<RocketContributor, 'coins'> & { coins: number },
): Promise<string | null> {
  if (!roomId || contributor.coins <= 0) return null;

  const progressRef = ref(realtimeDb, `rooms/${roomId}/rocketProgress`);

  await runTransaction(progressRef, (raw) => {
    const now = Date.now();
    let progress: RoomRocketProgress = raw
      ? {
          cycleTotal: Number(raw.cycleTotal) || 0,
          maxLevelLaunched: Number(raw.maxLevelLaunched) || 0,
          contributors: (raw.contributors as Record<string, RocketContributor>) ?? {},
          cycleStartedAt: Number(raw.cycleStartedAt) || now,
        }
      : { cycleTotal: 0, maxLevelLaunched: 0, contributors: {}, cycleStartedAt: now };

    if (now - progress.cycleStartedAt >= ROCKET_LAUNCH_TTL_MS) {
      progress = { cycleTotal: 0, maxLevelLaunched: 0, contributors: {}, cycleStartedAt: now };
    }

    progress.cycleTotal += contributor.coins;
    const prev = progress.contributors[contributor.uid];
    progress.contributors[contributor.uid] = {
      ...contributor,
      coins: (prev?.coins ?? 0) + contributor.coins,
    };

    return progress;
  });

  return autoLaunchFromProgress(roomId, progressRef);
}

/** إضافة مساهمة هدية للصاروخ + إطلاق تلقائي عند بلوغ المستوى */
export async function recordRocketGiftContribution(
  roomId: string,
  contributor: Omit<RocketContributor, 'coins'> & { coins: number },
): Promise<string | null> {
  return addContributionToProgress(roomId, contributor);
}

/** إضافة دعم يدوي (خصم كوينز) — يُضاف للتقدّم ويُطلق تلقائياً عند اكتمال السعر */
export async function contributeToRoomRocket(
  roomId: string,
  coinAmount: number,
): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const amount = Math.floor(Number(coinAmount));
  if (!amount || amount <= 0) throw new Error('المبلغ غير صالح');

  let senderName = user.displayName ?? 'مستخدم';
  let senderAvatar = user.photoURL ?? '';
  let senderLevel = 1;
  let senderIsVIP = false;
  let senderVipLevel: number | undefined;

  await fsRunTransaction(firestore, async (tx) => {
    const userRef = doc(firestore, 'users', user.uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error('حسابك غير موجود');
    const data = userSnap.data();
    const coins = getUserCoins(data as Record<string, unknown>);
    if (coins < amount) {
      throw new Error(`رصيدك غير كافٍ. تحتاج ${amount.toLocaleString()} كوين`);
    }

    senderName = resolveDisplayName(
      { displayName: data.profile?.displayName ?? data.displayName },
      senderName,
    );
    senderAvatar = data.profile?.avatar ?? data.avatar ?? senderAvatar;
    senderLevel = data.level ?? data.stats?.level ?? 1;
    senderIsVIP = Boolean(data.isVIP ?? data.profile?.isVIP);
    senderVipLevel = data.vipLevel ?? data.profile?.vipLevel;

    tx.update(userRef, buildBalanceIncrementPatch('coins', -amount));
  });

  return addContributionToProgress(roomId, {
    uid: user.uid,
    name: senderName,
    avatar: senderAvatar,
    coins: amount,
    level: senderLevel,
    isVIP: senderIsVIP,
    vipLevel: senderVipLevel,
  });
}

/**
 * @deprecated استخدم contributeToRoomRocket — الإطلاق لم يعد فورياً
 */
export async function launchRoomRocketDirect(
  roomId: string,
  level: RocketLevel,
): Promise<string | null> {
  return contributeToRoomRocket(roomId, ROCKET_LEVEL_COINS[level]);
}

export function subscribeToRoomRocketLaunches(
  roomId: string,
  callback: (launches: RoomRocketLaunch[]) => void,
): () => void {
  const launchesRef = ref(realtimeDb, `rooms/${roomId}/rocketLaunches`);
  const handler = onValue(launchesRef, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const val = snap.val() as Record<string, RoomRocketLaunch>;
    const now = Date.now();
    const all = Object.values(val);

    // تنظيف الإطلاقات المنتهية (> ساعة) من قاعدة البيانات حتى لا تتراكم وتظل معلّقة
    const expiredIds = all
      .filter((l) => !isRocketLaunchActive(l, now))
      .map((l) => l.id)
      .filter(Boolean);
    if (expiredIds.length) {
      const patch: Record<string, null> = {};
      expiredIds.forEach((id) => {
        patch[id] = null;
      });
      update(launchesRef, patch).catch(() => {});
    }

    const active = all
      .filter((l) => isRocketLaunchActive(l, now))
      .sort((a, b) => b.launchedAt - a.launchedAt);
    callback(active);
  });
  return () => off(launchesRef, 'value', handler);
}

export function subscribeToRoomRocketProgress(
  roomId: string,
  callback: (progress: RoomRocketProgress) => void,
): () => void {
  const progressRef = ref(realtimeDb, `rooms/${roomId}/rocketProgress`);
  const handler = onValue(progressRef, (snap) => {
    if (!snap.exists()) {
      callback(DEFAULT_PROGRESS);
      return;
    }
    const raw = snap.val();
    callback({
      cycleTotal: Number(raw.cycleTotal) || 0,
      maxLevelLaunched: Number(raw.maxLevelLaunched) || 0,
      contributors: raw.contributors ?? {},
      cycleStartedAt: Number(raw.cycleStartedAt) || Date.now(),
    });
  });
  return () => off(progressRef, 'value', handler);
}

export function getRocketProgressPercent(total: number, targetLevel: RocketLevel): number {
  const target = ROCKET_LEVEL_COINS[targetLevel];
  return Math.min(100, Math.round((total / target) * 100));
}
