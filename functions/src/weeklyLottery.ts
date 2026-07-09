/**
 * اليانصيب الأسبوعي — جدول السيرفر (توقيت الرياض)
 * - يفتح السبت 12:00
 * - السحب السبت 11:00 (للأسبوع السابق)
 * - العداد والأسبوع من وقت السيرفر فقط
 */
import * as admin from 'firebase-admin';

export const LOTTERY_DRAW_HOUR = 11;
export const LOTTERY_OPEN_HOUR = 12;
const MS_HOUR = 3_600_000;
/** الرياض UTC+3 دائماً */
const RIYADH_UTC_OFFSET_HOURS = 3;

export type LotteryPhase = 'selling' | 'announcing' | 'waiting_new_round';

export interface LotterySchedule {
  serverNowMs: number;
  weekId: string;
  roundStartMs: number;
  drawAtMs: number;
  nextRoundStartMs: number;
  countdownTargetMs: number;
  phase: LotteryPhase;
  salesOpen: boolean;
}

export interface WeeklyLotteryDrawRecord {
  weekId: string;
  winnerUid: string;
  winnerName: string;
  winnerPublicId?: string | null;
  prize: number;
  ticketCount: number;
  drawnAt: number;
}

function riyadhParts(ms: number) {
  const d = new Date(ms + RIYADH_UTC_OFFSET_HOURS * MS_HOUR);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    date: d.getUTCDate(),
    dow: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

function formatWeekId(y: number, m: number, day: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDays(y: number, m: number, day: number, delta: number) {
  const dt = new Date(Date.UTC(y, m, day));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() };
}

/** وقت محلي الرياض → UTC ms */
function riyadhLocalToUtcMs(y: number, m: number, day: number, hour: number, min = 0, sec = 0): number {
  return Date.UTC(y, m, day, hour - RIYADH_UTC_OFFSET_HOURS, min, sec, 0);
}

function buildScheduleForRoundStart(startY: number, startM: number, startD: number, nowMs: number): LotterySchedule {
  const weekId = formatWeekId(startY, startM, startD);
  const roundStartMs = riyadhLocalToUtcMs(startY, startM, startD, LOTTERY_OPEN_HOUR);
  const drawDay = addDays(startY, startM, startD, 7);
  const drawAtMs = riyadhLocalToUtcMs(drawDay.y, drawDay.m, drawDay.d, LOTTERY_DRAW_HOUR);
  const nextRoundStartMs = riyadhLocalToUtcMs(drawDay.y, drawDay.m, drawDay.d, LOTTERY_OPEN_HOUR);

  if (nowMs < roundStartMs) {
    return {
      serverNowMs: nowMs,
      weekId,
      roundStartMs,
      drawAtMs,
      nextRoundStartMs,
      countdownTargetMs: roundStartMs,
      phase: 'waiting_new_round',
      salesOpen: false,
    };
  }

  if (nowMs < drawAtMs) {
    return {
      serverNowMs: nowMs,
      weekId,
      roundStartMs,
      drawAtMs,
      nextRoundStartMs,
      countdownTargetMs: drawAtMs,
      phase: 'selling',
      salesOpen: true,
    };
  }

  if (nowMs < nextRoundStartMs) {
    return {
      serverNowMs: nowMs,
      weekId,
      roundStartMs,
      drawAtMs,
      nextRoundStartMs,
      countdownTargetMs: nextRoundStartMs,
      phase: 'announcing',
      salesOpen: false,
    };
  }

  return buildScheduleForRoundStart(drawDay.y, drawDay.m, drawDay.d, nowMs);
}

/** يحدد أسبوع اليانصيب الحالي وجدول السحب من وقت السيرفر */
export function computeLotterySchedule(nowMs = Date.now()): LotterySchedule {
  const p = riyadhParts(nowMs);

  if (p.dow === 6 && p.hour >= LOTTERY_OPEN_HOUR) {
    return buildScheduleForRoundStart(p.year, p.month, p.date, nowMs);
  }

  const daysSinceSaturday = (p.dow + 1) % 7;
  const back = p.dow === 6 ? 7 : daysSinceSaturday;
  const start = addDays(p.year, p.month, p.date, -back);
  return buildScheduleForRoundStart(start.y, start.m, start.d, nowMs);
}

/** أسبوع السحب عند السبت 11:00 — الجولة المنتهية */
export function getDrawWeekIdAt(nowMs = Date.now()): string {
  return computeLotterySchedule(nowMs).weekId;
}

async function readGamesGlobal(db: FirebaseFirestore.Firestore): Promise<{
  lotteryTicketPrice: number;
  lotteryGrandPrize: number;
}> {
  const snap = await db.collection('config').doc('games').get();
  const global = snap.exists ? (snap.data()?.global as Record<string, unknown> | undefined) : undefined;
  return {
    lotteryTicketPrice: Number(global?.lotteryTicketPrice) || 200_000,
    lotteryGrandPrize: Number(global?.lotteryGrandPrize) || 10_000_000,
  };
}

export async function executeWeeklyLotteryDraw(
  db: FirebaseFirestore.Firestore,
  weekId?: string,
): Promise<WeeklyLotteryDrawRecord | null> {
  const schedule = computeLotterySchedule(Date.now());
  const wk = weekId?.trim() || schedule.weekId;
  const drawRef = db.collection('weeklyLotteryDraws').doc(wk);
  const existing = await drawRef.get();
  if (existing.exists) {
    return { ...(existing.data() as WeeklyLotteryDrawRecord), weekId: wk };
  }

  const ticketsSnap = await db.collection('lotteryTickets').where('weekId', '==', wk).get();
  if (ticketsSnap.empty) {
    await db.collection('lotteryState').doc('featured').set(
      {
        weekId: wk,
        emptyDraw: true,
        drawnAt: Date.now(),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    return null;
  }

  const global = await readGamesGlobal(db);
  const tickets = ticketsSnap.docs;
  const winnerDoc = tickets[Math.floor(Math.random() * tickets.length)]!;
  const winnerData = winnerDoc.data();
  const winnerUid = String(winnerData.uid ?? '');
  if (!winnerUid) return null;

  const userSnap = await db.collection('users').doc(winnerUid).get();
  const user = userSnap.exists ? userSnap.data()! : {};
  const winnerName = String(
    winnerData.displayName
      ?? (user.profile as { displayName?: string } | undefined)?.displayName
      ?? user.displayName
      ?? 'فائز',
  );
  const winnerPublicId = user.publicAccountId != null ? String(user.publicAccountId) : null;
  const prize = global.lotteryGrandPrize;
  const now = Date.now();

  await db.collection('users').doc(winnerUid).update({
    'stats.coins': admin.firestore.FieldValue.increment(prize),
    coins: admin.firestore.FieldValue.increment(prize),
    updatedAt: now,
  }).catch(async () => {
    await db.collection('users').doc(winnerUid).set(
      { stats: { coins: prize }, coins: prize, updatedAt: now },
      { merge: true },
    );
  });

  await winnerDoc.ref.update({ isWinner: true, wonAt: now, prize });

  const draw: WeeklyLotteryDrawRecord = {
    weekId: wk,
    winnerUid,
    winnerName,
    winnerPublicId,
    prize,
    ticketCount: tickets.length,
    drawnAt: now,
  };

  await drawRef.set(draw);
  await db.collection('lotteryState').doc('featured').set({
    ...draw,
    emptyDraw: false,
    updatedAt: now,
  });

  return draw;
}

export function getCountdownParts(targetMs: number, nowMs: number) {
  const diff = Math.max(0, targetMs - nowMs);
  const totalSec = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}
