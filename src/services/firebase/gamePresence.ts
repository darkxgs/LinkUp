/**
 * حضور الألعاب المباشر عبر Realtime Database — gamePresence/{category}/{uid}
 * يُسجَّل عند دخول المستخدم لقسم/لعبة، ويُحذف تلقائياً عند الخروج أو قطع الاتصال.
 * يُستخدم لعرض «عدد المتصلين الآن» على كروت الألعاب.
 */

import {
  ref,
  set,
  remove,
  onValue,
  off,
  onDisconnect,
  DataSnapshot,
} from 'firebase/database';
import { realtimeDb, auth } from './index';

export type GameCategory = 'challenges' | 'intelligence' | 'casino' | 'lottery';

export const GAME_CATEGORIES: GameCategory[] = [
  'challenges',
  'intelligence',
  'casino',
  'lottery',
];

export type GamePresenceCounts = Record<GameCategory, number>;

export const EMPTY_GAME_PRESENCE: GamePresenceCounts = {
  challenges: 0,
  intelligence: 0,
  casino: 0,
  lottery: 0,
};

/** يُعتبر اللاعب متصلاً إن كان طابعه الزمني أحدث من دقيقتين (حماية من الأشباح) */
const GAME_PRESENCE_TTL_MS = 2 * 60 * 1000;
/** نبضة تحديث الطابع الزمني للحفاظ على الحضور حياً */
const HEARTBEAT_MS = 45 * 1000;

/**
 * يسجّل حضور المستخدم الحالي في قسم لعبة معيّن.
 * يُعيد دالة تنظيف تُزيل الحضور عند الخروج من الشاشة.
 */
export function enterGamePresence(category: GameCategory): () => void {
  const user = auth.currentUser;
  if (!user) return () => {};

  const node = ref(realtimeDb, `gamePresence/${category}/${user.uid}`);
  let active = true;

  const write = () => {
    if (active) void set(node, Date.now()).catch(() => {});
  };

  write();
  void onDisconnect(node).remove().catch(() => {});
  const timer = setInterval(write, HEARTBEAT_MS);

  return () => {
    active = false;
    clearInterval(timer);
    void remove(node).catch(() => {});
  };
}

/**
 * بث مباشر لعدد المتصلين في كل قسم لعبة — مستمع واحد مشترَك مهما تعدد الطالبون.
 * (كان كل شاشة تفتح مستمعاً كاملاً على شجرة gamePresence + مؤقتاً خاصاً بها —
 * الرئيسية واكتشف معاً = ضعف التنزيل وإعادة الحساب مع كل نبضة لاعب، ومرقاب
 * [heat] أظهره ×2.)
 */
const presenceSubscribers = new Set<(counts: GamePresenceCounts) => void>();
let presenceTeardown: (() => void) | null = null;
let presenceLatestCounts: GamePresenceCounts | null = null;

function startSharedPresenceListener(): void {
  const rootRef = ref(realtimeDb, 'gamePresence');
  let latest: Record<string, unknown> = {};

  const compute = () => {
    const now = Date.now();
    const counts: GamePresenceCounts = { ...EMPTY_GAME_PRESENCE };
    for (const cat of GAME_CATEGORIES) {
      const users = (latest?.[cat] as Record<string, unknown>) ?? {};
      let count = 0;
      for (const value of Object.values(users)) {
        const n = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(n) && n > 0 && now - n < GAME_PRESENCE_TTL_MS) count += 1;
      }
      counts[cat] = count;
    }
    presenceLatestCounts = counts;
    for (const cb of presenceSubscribers) cb(counts);
  };

  const handler = (snap: DataSnapshot) => {
    latest = (snap.val() as Record<string, unknown>) ?? {};
    compute();
  };

  onValue(rootRef, handler, () => {
    presenceLatestCounts = { ...EMPTY_GAME_PRESENCE };
    for (const cb of presenceSubscribers) cb({ ...EMPTY_GAME_PRESENCE });
  });
  // إعادة الحساب دورياً لإسقاط الأشباح المنتهية حتى دون وصول لقطة جديدة
  const expiryTimer = setInterval(compute, 30 * 1000);

  presenceTeardown = () => {
    off(rootRef, 'value', handler);
    clearInterval(expiryTimer);
  };
}

export function subscribeToGamePresenceCounts(
  callback: (counts: GamePresenceCounts) => void,
): () => void {
  presenceSubscribers.add(callback);
  if (presenceLatestCounts) callback(presenceLatestCounts);
  if (!presenceTeardown) startSharedPresenceListener();

  return () => {
    presenceSubscribers.delete(callback);
    if (presenceSubscribers.size === 0 && presenceTeardown) {
      presenceTeardown();
      presenceTeardown = null;
      presenceLatestCounts = null;
    }
  };
}
