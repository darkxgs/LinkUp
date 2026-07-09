/**
 * Casino Games Engine
 * يطبق خوارزميات الوثيقة الفنية لـ LinkUp
 *
 * الفئات الأساسية للرهان:
 * - $1 = 10,000 coins
 * - $5 = 50,000 coins
 * - $10 = 100,000 coins
 * - $50 = 500,000 coins
 * - $100 = 1,000,000 coins
 * - $1000 = 10,000,000 coins (Treasure Box فقط)
 *
 * كل الـ RNG محسوب لتطبيق RTP منطقي (Return to Player)
 * Casino Coins تربح في الفوز، Regular Coins تخسر في الرهان
 */

// ==================== TYPES ====================

export interface GameResult {
  win: boolean;
  multiplier: number;
  winAmount: number;
  result: any; // تفاصيل النتيجة
}

// ==================== STAKE TIERS ====================

export const STAKE_TIERS = {
  '1': { dollar: 1, coins: 10_000, label: '$1' },
  '5': { dollar: 5, coins: 50_000, label: '$5' },
  '10': { dollar: 10, coins: 100_000, label: '$10' },
  '50': { dollar: 50, coins: 500_000, label: '$50' },
  '100': { dollar: 100, coins: 1_000_000, label: '$100' },
  '1000': { dollar: 1000, coins: 10_000_000, label: '$1000' },
} as const;

export type StakeTier = keyof typeof STAKE_TIERS;

// ==================== 1. ROULETTE ====================
// روليت كلاسيكي 0-36 + 00
// - الأحمر: 1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
// - الأسود: 2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35
// - الأخضر: 0, 00

const ROULETTE_RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const ROULETTE_BLACK = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

export type RouletteBet =
  | { type: 'red' }
  | { type: 'black' }
  | { type: 'green' }
  | { type: 'even' }
  | { type: 'odd' }
  | { type: 'low' }  // 1-18
  | { type: 'high' } // 19-36
  | { type: 'number'; number: number };

export interface RouletteResult extends GameResult {
  result: { number: number; color: 'red' | 'black' | 'green' };
}

export const playRoulette = (bet: RouletteBet, stake: number): RouletteResult => {
  const number = Math.floor(Math.random() * 38); // 0-37 (37 = "00")
  const displayNumber = number === 37 ? 0 : number; // 00 is shown as 0
  const color: 'red' | 'black' | 'green' =
    ROULETTE_RED.includes(displayNumber)
      ? 'red'
      : ROULETTE_BLACK.includes(displayNumber)
      ? 'black'
      : 'green';

  let multiplier = 0;
  let win = false;

  switch (bet.type) {
    case 'red':
      if (color === 'red') { multiplier = 2; win = true; }
      break;
    case 'black':
      if (color === 'black') { multiplier = 2; win = true; }
      break;
    case 'green':
      if (color === 'green') { multiplier = 14; win = true; }
      break;
    case 'even':
      if (displayNumber > 0 && displayNumber % 2 === 0) { multiplier = 2; win = true; }
      break;
    case 'odd':
      if (displayNumber > 0 && displayNumber % 2 === 1) { multiplier = 2; win = true; }
      break;
    case 'low':
      if (displayNumber >= 1 && displayNumber <= 18) { multiplier = 2; win = true; }
      break;
    case 'high':
      if (displayNumber >= 19 && displayNumber <= 36) { multiplier = 2; win = true; }
      break;
    case 'number':
      if (bet.number === displayNumber) { multiplier = 35; win = true; }
      break;
  }

  return {
    win,
    multiplier,
    winAmount: win ? stake * multiplier : 0,
    result: { number: displayNumber, color },
  };
};

// ==================== 2. SLOT MACHINE (مع 3 مستويات) ====================
// نسب الفوز حسب الوثيقة:
// 3 برونزية: 2× (نسبة 12%)
// 3 فضية: 5× (نسبة 4%)
// 3 ذهبية: 10× (نسبة 1.5%)
// خسارة: 82.5%

export type SlotSymbol = 'bronze' | 'silver' | 'gold' | 'cherry' | 'lemon' | 'grape' | 'bell' | 'star' | 'wild';

export interface SlotResult extends GameResult {
  result: { symbols: SlotSymbol[]; line: 'top' | 'middle' | 'bottom' };
}

const SLOT_SYMBOLS_POOL: SlotSymbol[] = [
  'cherry', 'lemon', 'grape', 'bell', 'star', 'bronze', 'silver', 'gold', 'wild',
];

// خرائط لمشهد سلوت (3 reels × 3 rows)
export const playSlot = (stake: number, isFirstSpinEver: boolean = false): SlotResult => {
  // أول لفة في عمر الحساب = 3 برونزية مضمونة (حسب الوثيقة)
  if (isFirstSpinEver) {
    return {
      win: true,
      multiplier: 2,
      winAmount: stake * 2,
      result: { symbols: ['bronze', 'bronze', 'bronze'], line: 'middle' },
    };
  }

  const roll = Math.random();
  let symbols: SlotSymbol[];
  let multiplier = 0;

  if (roll < 0.015) {
    // 1.5% فوز ذهبي
    symbols = ['gold', 'gold', 'gold'];
    multiplier = 10;
  } else if (roll < 0.055) {
    // 4% فوز فضي
    symbols = ['silver', 'silver', 'silver'];
    multiplier = 5;
  } else if (roll < 0.175) {
    // 12% فوز برونزي
    symbols = ['bronze', 'bronze', 'bronze'];
    multiplier = 2;
  } else {
    // خسارة - رموز عشوائية مختلفة
    const a = SLOT_SYMBOLS_POOL[Math.floor(Math.random() * SLOT_SYMBOLS_POOL.length)]!;
    let b = SLOT_SYMBOLS_POOL[Math.floor(Math.random() * SLOT_SYMBOLS_POOL.length)]!;
    if (b === a) b = SLOT_SYMBOLS_POOL[(SLOT_SYMBOLS_POOL.indexOf(b) + 1) % SLOT_SYMBOLS_POOL.length]!;
    const c = SLOT_SYMBOLS_POOL[Math.floor(Math.random() * SLOT_SYMBOLS_POOL.length)]!;
    symbols = [a, b, c];
  }

  return {
    win: multiplier > 0,
    multiplier,
    winAmount: stake * multiplier,
    result: { symbols, line: 'middle' },
  };
};

// ==================== 3. WHEEL OF FORTUNE ====================
// عجلة دوارة بـ 8 خانات
// نسب الفوز:
// - 4 خانات خسارة (50%)
// - 2 خانة 2× (25%)
// - 1 خانة 3× (12.5%)
// - 1 خانة 5× (12.5%)

export interface WheelResult extends GameResult {
  result: { segment: number; segments: { multiplier: number; color: string }[] };
}

export const WHEEL_SEGMENTS = [
  { multiplier: 0, color: '#EF4444', label: 'خسارة' },
  { multiplier: 2, color: '#10B981', label: '×2' },
  { multiplier: 0, color: '#EF4444', label: 'خسارة' },
  { multiplier: 3, color: '#F59E0B', label: '×3' },
  { multiplier: 0, color: '#EF4444', label: 'خسارة' },
  { multiplier: 2, color: '#10B981', label: '×2' },
  { multiplier: 0, color: '#EF4444', label: 'خسارة' },
  { multiplier: 5, color: '#FCA5A5', label: '×5' },
];

export const playWheel = (stake: number): WheelResult => {
  const segment = Math.floor(Math.random() * 8);
  const mult = WHEEL_SEGMENTS[segment]!.multiplier;
  return {
    win: mult > 0,
    multiplier: mult,
    winAmount: stake * mult,
    result: { segment, segments: WHEEL_SEGMENTS },
  };
};

// ==================== 4. TREASURE BOX ====================
// 8 صناديق:
// - 1 صندوق ×2
// - 1 صندوق ×4
// - 1 صندوق ×10
// - 2 صناديق ×1 (استرجاع)
// - 3 صناديق ألغام (خسارة)

export type TreasureBoxContent = 'mine' | 'x1' | 'x2' | 'x4' | 'x10';

export interface TreasureBoxResult extends GameResult {
  result: { allBoxes: TreasureBoxContent[]; openedIndex: number };
}

export const TREASURE_LAYOUT: TreasureBoxContent[] = [
  'mine', 'x2', 'mine', 'x1', 'x4', 'mine', 'x10', 'x1',
];

export const playTreasureBox = (stake: number, openedIndex: number): TreasureBoxResult => {
  // خلط الصناديق عشوائياً
  const shuffled = [...TREASURE_LAYOUT];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  const opened = shuffled[openedIndex]!;
  let multiplier = 0;
  switch (opened) {
    case 'mine': multiplier = 0; break;
    case 'x1': multiplier = 1; break; // استرجاع
    case 'x2': multiplier = 2; break;
    case 'x4': multiplier = 4; break;
    case 'x10': multiplier = 10; break;
  }

  return {
    win: multiplier > 0,
    multiplier,
    winAmount: stake * multiplier,
    result: { allBoxes: shuffled, openedIndex },
  };
};

// ==================== 5. CRASH ROCKET ====================
// الصاروخ ينطلق ويتضاعف بـ 0.1 كل مرحلة (1.1, 1.2, ...)
// أقصى مضاعف 10×
// لحظة الانفجار عشوائية باستخدام distribution
// House edge ~3%

export const generateCrashPoint = (): number => {
  // RTP ~97% - house edge 3%
  // Probability distribution: P(X > x) = 0.97 / x
  const r = Math.random();
  if (r < 0.03) return 1.0; // 3% الانفجار فوراً
  // E[X] = 1.97 تقريباً
  const crash = 0.97 / (1 - r);
  return Math.min(10, Math.round(crash * 10) / 10); // أقصى 10×
};

export const playCrashRocket = (
  stake: number,
  crashPoint: number,
  cashoutAt: number | null, // null = لم يسحب
): GameResult => {
  if (cashoutAt === null || cashoutAt > crashPoint) {
    return { win: false, multiplier: 0, winAmount: 0, result: { crashPoint } };
  }
  return {
    win: true,
    multiplier: cashoutAt,
    winAmount: Math.floor(stake * cashoutAt),
    result: { crashPoint, cashoutAt },
  };
};

// ==================== 6. DUCK RACE ====================
// 10 بطات تتسابق
// المركز 1: ×2 (نسبة 10%)
// المركز 2: ×0.5 (نسبة 10%)
// المركز 3: ×0.3 (نسبة 10%)
// المراكز الأخرى: خسارة كاملة (نسبة 70%)

export interface DuckRaceResult extends GameResult {
  result: { selectedDuck: number; finalRanking: number[]; placement: number };
}

export const playDuckRace = (stake: number, selectedDuck: number): DuckRaceResult => {
  // توليد ترتيب نهائي عشوائي للـ 10 بطات
  const ducks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = ducks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ducks[i], ducks[j]] = [ducks[j]!, ducks[i]!];
  }

  const placement = ducks.indexOf(selectedDuck) + 1;
  let multiplier = 0;
  if (placement === 1) multiplier = 2;
  else if (placement === 2) multiplier = 0.5;
  else if (placement === 3) multiplier = 0.3;

  return {
    win: multiplier > 0,
    multiplier,
    winAmount: Math.floor(stake * multiplier),
    result: { selectedDuck, finalRanking: ducks, placement },
  };
};

// ==================== 7. LUCKY 777 ====================
// سلوت 3 خانات:
// - 777: ×25 (الجائزة الكبرى)
// - 3 عنب: ×3
// - 3 كرز: ×1.5
// - أي تشكيل آخر: خسارة

export type Lucky777Symbol = '7' | 'cherry' | 'grape' | 'lemon' | 'orange' | 'plum';

const LUCKY_777_SYMBOLS: Lucky777Symbol[] = ['7', 'cherry', 'grape', 'lemon', 'orange', 'plum'];

export interface Lucky777Result extends GameResult {
  result: { symbols: Lucky777Symbol[] };
}

export const playLucky777 = (stake: number): Lucky777Result => {
  const roll = Math.random();
  let symbols: Lucky777Symbol[];
  let multiplier = 0;

  if (roll < 0.005) {
    // 0.5% الجائزة الكبرى
    symbols = ['7', '7', '7'];
    multiplier = 25;
  } else if (roll < 0.025) {
    // 2% فوز عنب
    symbols = ['grape', 'grape', 'grape'];
    multiplier = 3;
  } else if (roll < 0.075) {
    // 5% فوز كرز
    symbols = ['cherry', 'cherry', 'cherry'];
    multiplier = 1.5;
  } else {
    // خسارة
    const getRandom = () => LUCKY_777_SYMBOLS[Math.floor(Math.random() * LUCKY_777_SYMBOLS.length)]!;
    symbols = [getRandom(), getRandom(), getRandom()];
    // تأكد من عدم تكرار 3 رموز متطابقة
    if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
      symbols[2] = symbols[2] === 'cherry' ? 'lemon' : 'cherry';
    }
  }

  return {
    win: multiplier > 0,
    multiplier,
    winAmount: Math.floor(stake * multiplier),
    result: { symbols },
  };
};

// ==================== 8. CHICKEN CROSS ====================
// مثل Crash Rocket لكن بـ 0.2 لكل خطوة
// تبدأ من 1× وتزيد بـ 0.2

export const generateChickenCrashStep = (): number => {
  // كل خطوة 5% احتمال الموت تقريباً (RTP ~95%)
  const r = Math.random();
  if (r < 0.04) return 0; // موت فوري في أول خطوة (احتمال نادر)
  // عدد الخطوات قبل الدهس
  return Math.floor(Math.log(Math.random()) / Math.log(0.94));
};

export interface ChickenCrossResult extends GameResult {
  result: { stepsTaken: number; deathStep: number };
}

export const playChickenCross = (
  stake: number,
  stepsTaken: number,
  deathStep: number,
): ChickenCrossResult => {
  if (stepsTaken >= deathStep) {
    return {
      win: false,
      multiplier: 0,
      winAmount: 0,
      result: { stepsTaken: deathStep, deathStep },
    };
  }
  const multiplier = 1 + stepsTaken * 0.2;
  return {
    win: true,
    multiplier,
    winAmount: Math.floor(stake * multiplier),
    result: { stepsTaken, deathStep },
  };
};

// ==================== 9. DICE ====================
// رمي حجرين النرد:
// - مجموع < 6: ×2 (احتمال 41.67%)
// - مجموع > 6: ×2 (احتمال 41.67%)
// - مجموع = 6: استرجاع (×1) - احتمال 16.67%

export type DicePrediction = 'lower' | 'higher';

export interface DiceResult extends GameResult {
  result: { dice1: number; dice2: number; sum: number; prediction: DicePrediction };
}

export const playDice = (stake: number, prediction: DicePrediction): DiceResult => {
  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;
  const sum = dice1 + dice2;

  let multiplier = 0;
  if (sum === 6) {
    multiplier = 1; // استرجاع
  } else if (
    (prediction === 'lower' && sum < 6) ||
    (prediction === 'higher' && sum > 6)
  ) {
    multiplier = 2;
  }

  return {
    win: multiplier > 0,
    multiplier,
    winAmount: stake * multiplier,
    result: { dice1, dice2, sum, prediction },
  };
};

// ==================== 10. GOLDEN TREE ====================
// 9 ثمار على الشجرة، اللاعب يقطف واحدة
// نسب الفوز:
// - 1 ذهبية: ×10 (11%)
// - 2 فضية: ×3 (22%)
// - 3 برونزية: ×1.5 (33%)
// - 3 فاسدة: خسارة (33%)

export type TreeFruit = 'golden' | 'silver' | 'bronze' | 'rotten';

export interface GoldenTreeResult extends GameResult {
  result: { allFruits: TreeFruit[]; pickedIndex: number };
}

export const playGoldenTree = (stake: number, pickedIndex: number): GoldenTreeResult => {
  // 9 فواكه: 1 ذهبية، 2 فضية، 3 برونزية، 3 فاسدة
  const fruits: TreeFruit[] = ['golden', 'silver', 'silver', 'bronze', 'bronze', 'bronze', 'rotten', 'rotten', 'rotten'];
  // خلط
  for (let i = fruits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fruits[i], fruits[j]] = [fruits[j]!, fruits[i]!];
  }

  const picked = fruits[pickedIndex]!;
  let multiplier = 0;
  switch (picked) {
    case 'golden': multiplier = 10; break;
    case 'silver': multiplier = 3; break;
    case 'bronze': multiplier = 1.5; break;
    case 'rotten': multiplier = 0; break;
  }

  return {
    win: multiplier > 0,
    multiplier,
    winAmount: Math.floor(stake * multiplier),
    result: { allFruits: fruits, pickedIndex },
  };
};

// ==================== INTELLIGENCE GAMES ====================
// ألعاب الذكاء - مرة واحدة يومياً لكل لعبة، صافي الربح = الدخولية × المضاعف

// 1. Flag Guess (500 علم)
export const FLAGS_DATABASE = [
  { code: 'SA', name: 'السعودية', emoji: '🇸🇦' },
  { code: 'AE', name: 'الإمارات', emoji: '🇦🇪' },
  { code: 'EG', name: 'مصر', emoji: '🇪🇬' },
  { code: 'JO', name: 'الأردن', emoji: '🇯🇴' },
  { code: 'PS', name: 'فلسطين', emoji: '🇵🇸' },
  { code: 'KW', name: 'الكويت', emoji: '🇰🇼' },
  { code: 'QA', name: 'قطر', emoji: '🇶🇦' },
  { code: 'BH', name: 'البحرين', emoji: '🇧🇭' },
  { code: 'OM', name: 'عُمان', emoji: '🇴🇲' },
  { code: 'YE', name: 'اليمن', emoji: '🇾🇪' },
  { code: 'SY', name: 'سوريا', emoji: '🇸🇾' },
  { code: 'LB', name: 'لبنان', emoji: '🇱🇧' },
  { code: 'IQ', name: 'العراق', emoji: '🇮🇶' },
  { code: 'LY', name: 'ليبيا', emoji: '🇱🇾' },
  { code: 'MA', name: 'المغرب', emoji: '🇲🇦' },
  { code: 'TN', name: 'تونس', emoji: '🇹🇳' },
  { code: 'DZ', name: 'الجزائر', emoji: '🇩🇿' },
  { code: 'SD', name: 'السودان', emoji: '🇸🇩' },
  { code: 'TR', name: 'تركيا', emoji: '🇹🇷' },
  { code: 'IR', name: 'إيران', emoji: '🇮🇷' },
  { code: 'US', name: 'الولايات المتحدة', emoji: '🇺🇸' },
  { code: 'GB', name: 'بريطانيا', emoji: '🇬🇧' },
  { code: 'FR', name: 'فرنسا', emoji: '🇫🇷' },
  { code: 'DE', name: 'ألمانيا', emoji: '🇩🇪' },
  { code: 'IT', name: 'إيطاليا', emoji: '🇮🇹' },
  { code: 'ES', name: 'إسبانيا', emoji: '🇪🇸' },
  { code: 'JP', name: 'اليابان', emoji: '🇯🇵' },
  { code: 'CN', name: 'الصين', emoji: '🇨🇳' },
  { code: 'IN', name: 'الهند', emoji: '🇮🇳' },
  { code: 'BR', name: 'البرازيل', emoji: '🇧🇷' },
  { code: 'RU', name: 'روسيا', emoji: '🇷🇺' },
  { code: 'CA', name: 'كندا', emoji: '🇨🇦' },
  { code: 'AU', name: 'أستراليا', emoji: '🇦🇺' },
  { code: 'KR', name: 'كوريا الجنوبية', emoji: '🇰🇷' },
  { code: 'MX', name: 'المكسيك', emoji: '🇲🇽' },
];

export const getRandomFlag = () => FLAGS_DATABASE[Math.floor(Math.random() * FLAGS_DATABASE.length)]!;

// 2. Memory Match - 7 أزواج = 14 ورقة
export const MEMORY_CARDS_PAIRS = [
  '🐶', '🐱', '🐭', '🦊', '🐼', '🐨', '🦁',
];

export const generateMemoryDeck = () => {
  const cards = [...MEMORY_CARDS_PAIRS, ...MEMORY_CARDS_PAIRS];
  // خلط
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return cards;
};

// 3. Sequence Memory - 8 عناصر
export const SEQUENCE_ELEMENTS = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬛'];

export const generateSequence = (length: number = 8) => {
  const seq: string[] = [];
  for (let i = 0; i < length; i++) {
    seq.push(SEQUENCE_ELEMENTS[Math.floor(Math.random() * SEQUENCE_ELEMENTS.length)]!);
  }
  return seq;
};

// ==================== CHALLENGE GAMES ====================
// ألعاب التحدي - 1v1 - الفائز 80%، التطبيق 20%

export const CHALLENGE_STAKES = {
  '1': { dollar: 1, coins: 10_000, label: '$1' },
  '5': { dollar: 5, coins: 50_000, label: '$5' },
  '10': { dollar: 10, coins: 100_000, label: '$10' },
} as const;

export const calculateChallengeWinnings = (totalPot: number): { winnerGets: number; appTakes: number } => {
  return {
    winnerGets: Math.floor(totalPot * 0.8),
    appTakes: Math.floor(totalPot * 0.2),
  };
};

// ==================== LOTTERY ====================
// تذكرة يانصيب أسبوعية = $20 = 200,000 coins
// الجائزة الكبرى = $1000

export const LOTTERY_TICKET_PRICE = 200_000;
export const LOTTERY_GRAND_PRIZE = 10_000_000; // 10M coins = $1000

// ==================== VALIDATION ====================

/**
 * تحقق من حد الرهان للعبة
 */
export const validateStake = (
  game: 'casino' | 'challenge' | 'treasure-box' | 'intelligence',
  stake: number,
): { valid: boolean; reason?: string } => {
  if (stake <= 0) return { valid: false, reason: 'المبلغ يجب أن يكون أكبر من صفر' };

  switch (game) {
    case 'casino':
      if (stake > 1_000_000) return { valid: false, reason: 'الحد الأقصى $100' };
      break;
    case 'treasure-box':
      if (stake > 10_000_000) return { valid: false, reason: 'الحد الأقصى $1000' };
      break;
    case 'challenge':
      if (stake > 100_000) return { valid: false, reason: 'الحد الأقصى للتحدي $10' };
      break;
    case 'intelligence':
      if (stake > 50_000) return { valid: false, reason: 'أقصى دخولية لألعاب الذكاء: 50,000 كوين' };
      break;
  }

  return { valid: true };
};

// ==================== FORMATTING ====================

export const formatStake = (coins: number): string => {
  if (coins >= 1_000_000) return `$${coins / 10_000}`;
  return `${coins.toLocaleString()} ك`;
};

export const formatCoins = (coins: number): string => {
  if (coins >= 1_000_000) return `${(coins / 1_000_000).toFixed(1)}M`;
  if (coins >= 1_000) return `${(coins / 1_000).toFixed(1)}K`;
  return coins.toString();
};
