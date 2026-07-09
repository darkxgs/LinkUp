/**
 * Games Config — إعدادات الألعاب القابلة للتحكم من لوحة الأدمن
 *
 * يُقرأ من Firestore: config/games → { games: GameConfig[], global: GamesGlobalEconomy }
 * كل لعبة لها: تفعيل، حدود رهان، RTP، ومضاعفات.
 *
 * يُستخدم real-time عبر onSnapshot لينعكس تعديل الأدمن فوراً.
 */

import { doc, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from './index';

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

export interface SequenceMemoryStakeTiming {
  stake: number;
  memorizeSeconds: number;
  reconstructSeconds: number;
  sequenceLength: number;
}

export interface GameConfig {
  id: string;
  name: string;
  enabled: boolean;
  minBet: number;
  maxBet: number;
  rtp: number;
  multipliers: number[];
  /** sequence-memory — وقت الحفظ والترتيب حسب الدخولية */
  sequenceTimingByStake?: SequenceMemoryStakeTiming[];
}

/** إعدادات اقتصاد الألعاب العامة من لوحة التحكم */
export interface GamesGlobalEconomy {
  challengeWinnerPercent: number;
  challengeAppPercent: number;
  lotteryTicketPrice: number;
  lotteryGrandPrize: number;
  casinoToCoinsRate: number;
  coinsPerDollar: number;
  intelligenceStakeChips: number[];
  challengeStakeChips: number[];
  demoBalance: number;
  billiardsTurnMs: number;
  penaltyRounds: number;
  penaltyTurnSeconds: number;
  coinChallengeRounds: number;
  coinChallengeTurnSeconds: number;
  /** مرحلة حفظ التسلسل — تذكر التسلسل (ثوان) */
  sequenceMemoryMemorizeSeconds: number;
  /** مرحلة إعادة الترتيب — تذكر التسلسل (ثوان) */
  sequenceMemoryReconstructSeconds: number;
  /** مؤقّت سؤال ألعاب الذكاء «خمّن العلم» بالثواني — من لوحة التحكم */
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

export const DEFAULT_GAMES: GameConfig[] = [
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

/** القيمة الافتراضية لمضاعف ربح ألعاب الذكاء — يُستبدل بإعداد Firestore */
export const INTELLIGENCE_WIN_MULTIPLIER = 20;

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

function normalizeIntelligenceGame(merged: GameConfig, def: GameConfig): GameConfig {
  merged.minBet = Math.max(5000, merged.minBet);
  merged.maxBet = Math.min(50000, Math.max(merged.minBet, merged.maxBet));
  if (!merged.multipliers?.length) merged.multipliers = def.multipliers.length ? def.multipliers : [INTELLIGENCE_WIN_MULTIPLIER];
  return merged;
}

function mergeGamesConfig(saved?: GameConfig[]): GameConfig[] {
  const merged = DEFAULT_GAMES.map((def) => {
    const s = saved?.find((x) => x.id === def.id);
    if (!s) return def;
    const result: GameConfig = {
      ...def,
      ...s,
      multipliers:
        Array.isArray(s.multipliers) && s.multipliers.length > 0 ? s.multipliers : def.multipliers,
    };
    if (INTELLIGENCE_GAME_IDS.has(def.id)) return normalizeIntelligenceGame(result, def);
    return result;
  });

  for (const s of saved ?? []) {
    if (!merged.some((g) => g.id === s.id)) merged.push(s);
  }
  return merged;
}

export function getIntelligenceWinMultiplier(games: GameConfig[], gameId: string): number {
  const cfg = getGameConfig(games, gameId);
  const m = cfg.multipliers?.[0];
  return m && m > 0 ? m : INTELLIGENCE_WIN_MULTIPLIER;
}

export const subscribeToGamesConfig = (cb: (games: GameConfig[]) => void): (() => void) => {
  const ref = doc(firestore, 'config', 'games');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists() && snap.data().games?.length) {
        cb(mergeGamesConfig(snap.data().games as GameConfig[]));
      } else {
        cb(DEFAULT_GAMES);
      }
    },
    () => cb(DEFAULT_GAMES),
  );
};

export const subscribeToGamesGlobal = (cb: (global: GamesGlobalEconomy) => void): (() => void) => {
  const ref = doc(firestore, 'config', 'games');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists() && snap.data().global) {
        cb(normalizeGamesGlobal(snap.data().global as GamesGlobalEconomy));
      } else {
        cb(DEFAULT_GAMES_GLOBAL);
      }
    },
    () => cb(DEFAULT_GAMES_GLOBAL),
  );
};

export const getGamesConfigOnce = async (): Promise<GameConfig[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'games'));
    if (snap.exists() && snap.data().games?.length) {
      return mergeGamesConfig(snap.data().games as GameConfig[]);
    }
  } catch {}
  return DEFAULT_GAMES;
};

export const getGamesGlobalOnce = async (): Promise<GamesGlobalEconomy> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'games'));
    if (snap.exists() && snap.data().global) {
      return normalizeGamesGlobal(snap.data().global as GamesGlobalEconomy);
    }
  } catch {}
  return DEFAULT_GAMES_GLOBAL;
};

export const getGameConfig = (games: GameConfig[], id: string): GameConfig =>
  games.find((g) => g.id === id) ?? DEFAULT_GAMES.find((g) => g.id === id) ?? DEFAULT_GAMES[0]!;

export const seedGamesConfig = async (): Promise<void> => {
  await setDoc(
    doc(firestore, 'config', 'games'),
    { games: DEFAULT_GAMES, global: DEFAULT_GAMES_GLOBAL },
    { merge: true },
  );
};
