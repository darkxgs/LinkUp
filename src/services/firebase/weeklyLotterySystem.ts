/**
 * نظام حدث اليانصيب الأسبوعي
 * Firestore: lotteryTickets, weeklyLotteryDraws, lotteryState/featured
 * الجدول والعداد من السيرفر فقط (Cloud Function)
 */
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  getDocs,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, functions } from './index';

export interface WeeklyLotteryDraw {
  weekId: string;
  winnerUid: string;
  winnerName: string;
  winnerPublicId?: string;
  prize: number;
  ticketCount: number;
  drawnAt: number;
}

export type LotteryPhase = 'selling' | 'sales_closed' | 'announcing' | 'waiting_new_round';

export interface WeeklyLotteryServerState {
  serverNowMs: number;
  weekId: string;
  phase: LotteryPhase;
  salesOpen: boolean;
  countdownTargetMs: number;
  /** يُغلق بيع التذاكر السبت 11:00 (الرياض) — السحب 12:00 والجولة الجديدة بعده مباشرة */
  salesCloseAtMs?: number;
  drawAtMs: number;
  nextRoundStartMs: number;
  totalTickets: number;
  myTickets: number;
  featuredWinner: WeeklyLotteryDraw | null;
  countdown: { days: number; hours: number; minutes: number; seconds: number };
}

/** @deprecated استخدم fetchWeeklyLotteryState — يبقى للتوافق القديم */
export function getCurrentLotteryWeekId(d = new Date()): string {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const dow = start.getDay();
  const daysSinceSaturday = (dow + 1) % 7;
  const back = dow === 6 && start.getHours() < 12 ? 7 : daysSinceSaturday;
  start.setDate(start.getDate() - back);
  return start.toISOString().slice(0, 10);
}

export function getWeekCountdownParts(endMs: number, now = Date.now()) {
  const diff = Math.max(0, endMs - now);
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
}

export function projectServerCountdown(
  state: Pick<WeeklyLotteryServerState, 'serverNowMs' | 'countdownTargetMs'>,
  fetchedAtClientMs: number,
) {
  const serverNow = state.serverNowMs + (Date.now() - fetchedAtClientMs);
  return getWeekCountdownParts(state.countdownTargetMs, serverNow);
}

/**
 * موعد السحب القادم محلياً — السبت 12:00 بتوقيت الرياض (UTC+3).
 * (يُغلق بيع التذاكر 11:00، السحب 12:00، والجولة الجديدة تبدأ بعده مباشرة.)
 * يُستخدم كبديل عندما يتعذّر نداء الخادم كي لا يبقى العدّاد 00:00:00.
 */
export function computeLocalNextDrawMs(now = Date.now()): number {
  const RIYADH_OFFSET_MS = 3 * 3_600_000;
  const DRAW_HOUR = 12;
  const r = new Date(now + RIYADH_OFFSET_MS); // ساعة حائط الرياض ممثلة كـ UTC
  let daysAhead = (6 - r.getUTCDay() + 7) % 7; // 6 = السبت
  if (daysAhead === 0 && r.getUTCHours() >= DRAW_HOUR) daysAhead = 7;
  const targetUtc = Date.UTC(
    r.getUTCFullYear(),
    r.getUTCMonth(),
    r.getUTCDate() + daysAhead,
    DRAW_HOUR, 0, 0,
  );
  return targetUtc - RIYADH_OFFSET_MS;
}

export const fetchWeeklyLotteryState = async (): Promise<WeeklyLotteryServerState> => {
  const fn = httpsCallable<Record<string, never>, WeeklyLotteryServerState & { ok: boolean }>(
    functions,
    'getWeeklyLotteryState',
  );
  const res = await fn({});
  const data = res.data;
  return {
    serverNowMs: data.serverNowMs,
    weekId: data.weekId,
    phase: data.phase,
    salesOpen: data.salesOpen,
    countdownTargetMs: data.countdownTargetMs,
    salesCloseAtMs: data.salesCloseAtMs,
    drawAtMs: data.drawAtMs,
    nextRoundStartMs: data.nextRoundStartMs,
    totalTickets: data.totalTickets,
    myTickets: data.myTickets,
    featuredWinner: data.featuredWinner as WeeklyLotteryDraw | null,
    countdown: data.countdown,
  };
};

export interface LotteryRoundDoc {
  weekId: string;
  salesOpen: boolean;
  salesClosedAt?: number;
  salesCloseAtMs?: number;
  drawAtMs?: number;
}

/**
 * وثيقة الجولة lotteryState/currentRound — يكتبها السيرفر:
 * مجدول 11:00 يقفل البيع (salesOpen=false)، ومجدول السحب 12:00 يفتح
 * الجولة الجديدة فور السحب. العميل يقفل/يفتح الشراء فورياً عبرها.
 */
export const subscribeToLotteryRound = (
  cb: (round: LotteryRoundDoc | null) => void,
): (() => void) =>
  onSnapshot(
    doc(firestore, 'lotteryState', 'currentRound'),
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const d = snap.data() as Partial<LotteryRoundDoc>;
      cb({
        weekId: String(d.weekId ?? ''),
        salesOpen: d.salesOpen !== false,
        salesClosedAt: Number(d.salesClosedAt) || undefined,
        salesCloseAtMs: Number(d.salesCloseAtMs) || undefined,
        drawAtMs: Number(d.drawAtMs) || undefined,
      });
    },
    () => cb(null),
  );

export const subscribeToFeaturedLotteryWinner = (
  cb: (winner: WeeklyLotteryDraw | null) => void,
): (() => void) =>
  onSnapshot(
    doc(firestore, 'lotteryState', 'featured'),
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as WeeklyLotteryDraw & { emptyDraw?: boolean };
      if (d.emptyDraw === true || !d.winnerUid) return;
      cb({
        weekId: String(d.weekId ?? snap.id),
        winnerUid: String(d.winnerUid ?? ''),
        winnerName: String(d.winnerName ?? 'فائز'),
        winnerPublicId: d.winnerPublicId != null ? String(d.winnerPublicId) : undefined,
        prize: Number(d.prize) || 0,
        ticketCount: Number(d.ticketCount) || 0,
        drawnAt: Number(d.drawnAt) || 0,
      });
    },
    () => {},
  );

export const subscribeToWeeklyLotteryDraws = (
  cb: (draws: WeeklyLotteryDraw[]) => void,
  max = 12,
): (() => void) => {
  const q = query(
    collection(firestore, 'weeklyLotteryDraws'),
    orderBy('drawnAt', 'desc'),
    limit(max),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(
        snap.docs.map((d) => ({ ...(d.data() as WeeklyLotteryDraw), weekId: d.id })),
      );
    },
    () => cb([]),
  );
};

export const countMyTicketsForWeek = async (uid: string, weekId: string): Promise<number> => {
  const q = query(
    collection(firestore, 'lotteryTickets'),
    where('uid', '==', uid),
    where('weekId', '==', weekId),
  );
  const snap = await getDocs(q);
  return snap.size;
};

export const getWeekTicketStats = async (weekId: string): Promise<{ totalTickets: number }> => {
  const q = query(
    collection(firestore, 'lotteryTickets'),
    where('weekId', '==', weekId),
  );
  const snap = await getDocs(q);
  return { totalTickets: snap.size };
};

/** @deprecated */
export function getCurrentWeekEndMs(d = new Date()): number {
  return d.getTime() + 7 * 86400000;
}
