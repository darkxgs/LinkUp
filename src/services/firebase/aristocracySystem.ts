/**
 * نظام الأرستقراطية — مستويات، شراء، تجديد، عائد الكوينز
 * Firestore: config/aristocracy
 */
import {
  doc,
  onSnapshot,
  getDoc,
  runTransaction,
  collection,
  addDoc,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import {
  buildBalanceIncrementPatch,
  statsFromFirestoreDoc,
} from '@/utils/userBalance';
import { applyXpGain } from './wealthLevel';

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Types ──────────────────────────────────────────────────────

export type AristocracyPrivilegeLayout = 'wide' | 'half' | 'icon';

export interface AristocracyPrivilege {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  assetKey: string;
  layout: AristocracyPrivilegeLayout;
  order: number;
  imageUrl?: string;
  /** فيديو الامتياز (مثل دخولية الفيديو) — مثل امتيازات SVIP */
  videoUrl?: string;
  videoUrlMp4?: string;
  enabled?: boolean;
}

export interface AristocracyLevel {
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
   * undefined = كل امتيازات المستوى الممنوح (سلوك افتراضي/قديم).
   * مصفوفة = فقط المفاتيح المحددة من لوحة التحكم.
   */
  svipPrivilegeKeys?: string[];
  honorPointsRequired: number;
  requiredVipLevel: number;
  themeKey: string;
  privileges: AristocracyPrivilege[];
  imageUrl?: string;
  backgroundImageUrl?: string;
  accentColor?: string;
  bgColors?: string[];
  exclusiveGiftIds?: string[];
  heroSubtitleAr?: string;
  heroSubtitleEn?: string;
}

export interface AristocracyConfig {
  enabled: boolean;
  titleAr: string;
  titleEn: string;
  gracePeriodDays: number;
  frozenExpireDays: number;
  maxValidityDays: number;
  levels: AristocracyLevel[];
  showPrivilegesSectionAr?: string;
  showPrivilegesSectionEn?: string;
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

export interface AristocracyUserState {
  level: number;
  expiresAt: number | null;
  autoRenew: boolean;
  grantedVipLevel: number;
  /** قائمة امتيازات SVIP المسموح ظهورها لهذا الحامل — undefined/null = الكل */
  svipPrivilegeKeys?: string[] | null;
  pendingReturns: number;
  frozenReturns: number;
  frozenAt: number | null;
  honorPoints: number;
  honorMonth: string;
}

const FIXED_ARISTOCRACY_LEVEL_IDS = ['noble', 'minister', 'prince', 'king', 'aristocrat'] as const;

// ─── Defaults (مطابقة جدول المنافس) ─────────────────────────────

const DEFAULT_PRIVS = (level: number): AristocracyPrivilege[] => {
  const base: AristocracyPrivilege[] = [
    { id: 'entry', titleAr: 'دخولية', titleEn: 'Entrance', descAr: 'مؤثرات دخول حصرية', descEn: 'Exclusive entrance', assetKey: 'entry', layout: 'half', order: 1 },
    { id: 'frame', titleAr: 'إطار', titleEn: 'Frame', descAr: 'إطار فاخر متحرك', descEn: 'Animated frame', assetKey: 'frame', layout: 'half', order: 2 },
    { id: 'profile-card', titleAr: 'بطاقة أرستقراطية الملف الشخصي', titleEn: 'Profile Card', descAr: 'تصميم فاخر لملفك', descEn: 'Premium profile card', assetKey: 'profileCard', layout: 'wide', order: 3 },
    { id: 'effects', titleAr: 'تفعيل التأثيرات', titleEn: 'Activate Effects', descAr: 'تأثيرات بصرية مميزة', descEn: 'Special visual effects', assetKey: 'effects', layout: 'half', order: 4 },
  ];
  if (level >= 5) {
    base.push({ id: 'badge', titleAr: 'وسام الهوية', titleEn: 'Identity Badge', descAr: 'وسام ذهبي على ملفك', descEn: 'Golden identity badge', assetKey: 'badge', layout: 'half', order: 5 });
  }
  if (level >= 7) {
    base.push({ id: 'bubble', titleAr: 'إطار الكتابة', titleEn: 'Chat Frame', descAr: 'رسائلك بارزة', descEn: 'Stand-out messages', assetKey: 'bubble', layout: 'wide', order: 6 });
  }
  return base;
};

export const DEFAULT_ARISTOCRACY_CONFIG: AristocracyConfig = {
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
  rulesIntroAr: [
    'الأرستقراطية هوية رفيعة المستوى تتكون من 5 مستويات ثابتة.',
    'كلما ارتفع المستوى زادت مزايا الهوية ونسبة عائد الكوينز.',
  ],
  rulesIntroEn: [
    'Aristocracy is a high-level identity with 5 fixed tiers.',
    'Higher tiers unlock more perks and higher coin returns.',
  ],
  rulesPurchaseAr: [
    'اختر المستوى وادفع بالكوينز — الصلاحية 30 يوماً.',
    'التجديد قبل الانتهاء أو خلال 5 أيام حماية بسعر أقل من التفعيل الأول.',
    'لا يمكن تمديد الصلاحية أكثر من 120 يوماً.',
    'يمكن الترقية لمستوى أعلى فقط وليس العكس.',
    'المستويات العليا قد تتطلب VIP معيناً لخصم التجديد.',
    'التجديد التلقائي يُفعّل قبل يوم من الانتهاء.',
    'كل شراء أو تجديد يزيد نقاط الثروة (1 كوين = 1 XP).',
    'يمكن إرسال مستوى لصديق بسعر التجديد إن كان أعلى من مستواه.',
  ],
  rulesPurchaseEn: [],
  rulesRewardsAr: [
    'بعد الشراء أو التجديد تحصل على عائد كوينز يُستلم يدوياً من صفحة أرستقراطيتي.',
    'إن انتهت الصلاحية دون استلام العائد يُجمّد لمدة 5 أيام حماية.',
    'بعد 60 يوماً دون تجديد يُفقد العائد المجمّد.',
    'إرسال الهدايا يزيد نقاط التشريف (1 كوين = 1 نقطة) أثناء الاشتراك.',
  ],
  rulesRewardsEn: [],
  rulesLegendAr: [
    'الأسطورة تُمنح عبر نشاط الترتيب الشهري وليست بالشراء المباشر.',
    'تتطلب الأسطورة مستوى ملك أو إمبراطور نشطاً.',
  ],
  rulesLegendEn: [],
  experienceCardRulesAr: [
    'بطاقة التجربة تمنح الامتيازات دون عائد الكوينز.',
    'لا يمكن إرسال بطاقات التجربة للآخرين.',
    'بطاقة نفس المستوى تمدد المدة؛ الأعلى يرقي ثم يعود للسابق بعد الانتهاء.',
  ],
  experienceCardRulesEn: [],
  levelTableNoteAr: 'بطاقة تجربة الأرستقراطية — جدول الأسعار',
  levelTableNoteEn: 'Aristocracy experience card pricing',
  levels: [
    { id: 'noble', level: 1, nameAr: 'النبيل', nameEn: 'Noble', enabled: true, comingSoon: false, activationCoins: 800_000, renewalCoins: 640_000, allowRenewal: true, validityDays: 30, coinReturnPercent: 80, coinReturnCoins: 0, grantedVipLevel: 10, honorPointsRequired: 300_000, requiredVipLevel: 0, themeKey: 'noble', privileges: DEFAULT_PRIVS(1) },
    { id: 'minister', level: 2, nameAr: 'الوزير', nameEn: 'Minister', enabled: true, comingSoon: false, activationCoins: 100_000, renewalCoins: 60_000, allowRenewal: true, validityDays: 30, coinReturnPercent: 100, coinReturnCoins: 0, grantedVipLevel: 11, honorPointsRequired: 0, requiredVipLevel: 0, themeKey: 'minister', privileges: DEFAULT_PRIVS(2) },
    { id: 'prince', level: 3, nameAr: 'الأمير', nameEn: 'Prince', enabled: true, comingSoon: false, activationCoins: 300_000, renewalCoins: 180_000, allowRenewal: true, validityDays: 30, coinReturnPercent: 100, coinReturnCoins: 0, grantedVipLevel: 11, honorPointsRequired: 0, requiredVipLevel: 0, themeKey: 'prince', privileges: DEFAULT_PRIVS(3) },
    { id: 'king', level: 4, nameAr: 'الملك', nameEn: 'King', enabled: true, comingSoon: false, activationCoins: 80_000_000, renewalCoins: 80_000_000, allowRenewal: true, validityDays: 30, coinReturnPercent: 80, coinReturnCoins: 0, grantedVipLevel: 12, honorPointsRequired: 600_000, requiredVipLevel: 0, themeKey: 'king', privileges: DEFAULT_PRIVS(4) },
    { id: 'aristocrat', level: 5, nameAr: 'الأرستقراطي', nameEn: 'Aristocrat', enabled: true, comingSoon: false, activationCoins: 100_000, renewalCoins: 0, allowRenewal: false, validityDays: 30, coinReturnPercent: 0, coinReturnCoins: 0, grantedVipLevel: 12, honorPointsRequired: 0, requiredVipLevel: 0, themeKey: 'aristocrat', privileges: DEFAULT_PRIVS(5) },
  ],
};

function normalizeAristocracyPrivilege(raw: AristocracyPrivilege): AristocracyPrivilege {
  return {
    ...raw,
    order: raw.order ?? 0,
    enabled: raw.enabled !== false,
    imageUrl: raw.imageUrl?.trim() || undefined,
    videoUrl: raw.videoUrl?.trim() || undefined,
    videoUrlMp4: raw.videoUrlMp4?.trim() || undefined,
  };
}

function aristocracyLevelSkeleton(id: string): AristocracyLevel {
  const sample = DEFAULT_ARISTOCRACY_CONFIG.levels.find((l) => l.id === id);
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
      grantedVipLevel: 0,
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

function normalizeAristocracyLevel(
  raw: Partial<AristocracyLevel>,
  fallback?: AristocracyLevel,
): AristocracyLevel {
  const base = fallback ?? aristocracyLevelSkeleton(String(raw.id ?? 'noble'));
  const level = raw.level ?? base.level;
  const privileges = Array.isArray(raw.privileges)
    ? raw.privileges.map(normalizeAristocracyPrivilege).filter((p) => p.enabled !== false).sort((a, b) => a.order - b.order)
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

export function normalizeAristocracyConfig(raw: Partial<AristocracyConfig>): AristocracyConfig {
  const defaults = DEFAULT_ARISTOCRACY_CONFIG;
  const { levels: _defaultLevels, ...defaultMeta } = defaults;
  const { levels: rawLevels, ...rawMeta } = raw;

  const merged: AristocracyConfig = {
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
    .filter((lv) => FIXED_ARISTOCRACY_LEVEL_IDS.includes(lv.id as typeof FIXED_ARISTOCRACY_LEVEL_IDS[number]))
    .sort((a, b) => a.level - b.level);

  for (const required of FIXED_ARISTOCRACY_LEVEL_IDS) {
    if (!normalizedLevels.some((lv) => lv.id === required)) {
      normalizedLevels.push(aristocracyLevelSkeleton(required));
    }
  }
  merged.levels = normalizedLevels.sort((a, b) => a.level - b.level);
  return merged;
}

// ─── User state helpers ─────────────────────────────────────────

export function readAristocracyState(
  data: Record<string, unknown> | null | undefined,
): AristocracyUserState {
  const raw = data?.aristocracy as Partial<AristocracyUserState> | undefined;
  return {
    level: Number(raw?.level ?? data?.aristocracyLevel ?? 0),
    expiresAt: raw?.expiresAt != null ? Number(raw.expiresAt) : (data?.aristocracyExpiresAt != null ? Number(data.aristocracyExpiresAt) : null),
    autoRenew: raw?.autoRenew === true || data?.aristocracyAutoRenew === true,
    grantedVipLevel: Number(raw?.grantedVipLevel ?? data?.aristocracyGrantedVipLevel ?? 0),
    svipPrivilegeKeys: (() => {
      const v = raw?.svipPrivilegeKeys ?? (data?.aristocracySvipPrivilegeKeys as unknown);
      return Array.isArray(v) ? v.map(String) : undefined;
    })(),
    pendingReturns: Number(raw?.pendingReturns ?? data?.aristocracyPendingReturns ?? 0),
    frozenReturns: Number(raw?.frozenReturns ?? data?.aristocracyFrozenReturns ?? 0),
    frozenAt: raw?.frozenAt != null ? Number(raw.frozenAt) : (data?.aristocracyFrozenAt != null ? Number(data.aristocracyFrozenAt) : null),
    honorPoints: Number(raw?.honorPoints ?? data?.aristocracyHonorPoints ?? 0),
    honorMonth: String(raw?.honorMonth ?? data?.aristocracyHonorMonth ?? ''),
  };
}

export function isAristocracyActive(state: AristocracyUserState): boolean {
  return (state.expiresAt ?? 0) > Date.now() && state.level > 0;
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Config subscription ──────────────────────────────────────────

export const subscribeToAristocracy = (
  cb: (config: AristocracyConfig) => void,
): (() => void) => {
  const ref = doc(firestore, 'config', 'aristocracy');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        cb(normalizeAristocracyConfig(snap.data() as Partial<AristocracyConfig>));
      } else {
        cb(DEFAULT_ARISTOCRACY_CONFIG);
      }
    },
    () => cb(DEFAULT_ARISTOCRACY_CONFIG),
  );
};

export const getAristocracyConfigOnce = async (): Promise<AristocracyConfig> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'aristocracy'));
    if (snap.exists()) {
      return normalizeAristocracyConfig(snap.data() as Partial<AristocracyConfig>);
    }
  } catch { /* fallback */ }
  return DEFAULT_ARISTOCRACY_CONFIG;
};

export function getAristocracyLevel(
  config: AristocracyConfig,
  idOrLevel: string | number,
): AristocracyLevel | undefined {
  if (typeof idOrLevel === 'number') {
    return config.levels.find((l) => l.level === idOrLevel);
  }
  return config.levels.find((l) => l.id === idOrLevel);
}

/** وسام الهوية — يظهر في صف أوسمة الملف الشخصي (assetKey: badge) */
export function resolveAristocracyBadgeUrl(
  userData: Record<string, unknown> | null | undefined,
  config: AristocracyConfig,
): string | undefined {
  const state = readAristocracyState(userData);
  if (!isAristocracyActive(state) || state.level <= 0) return undefined;
  const level = getAristocracyLevel(config, state.level);
  if (!level?.enabled || level.comingSoon) return undefined;
  const badge = level.privileges.find(
    (p) => p.enabled !== false && p.assetKey === 'badge' && p.imageUrl?.trim(),
  );
  return badge?.imageUrl?.trim() || undefined;
}

// ─── Pricing ────────────────────────────────────────────────────

export function resolvePurchasePrice(
  level: AristocracyLevel,
  state: AristocracyUserState,
  config: AristocracyConfig,
): { price: number; mode: 'activation' | 'renewal' | 'upgrade'; labelAr: string } {
  const now = Date.now();
  const active = isAristocracyActive(state);
  const graceEnd = (state.expiresAt ?? 0) + config.gracePeriodDays * DAY_MS;
  const inGrace = !active && state.expiresAt && state.expiresAt <= now && graceEnd > now;

  if (level.comingSoon || !level.enabled) {
    throw new Error('هذا المستوى غير متاح حالياً');
  }

  // يُسمح بشراء أي مستوى (تبديل) — المنع القديم «لا يمكن شراء مستوى أقل»
  // كان يجعل بعض المستويات مستحيلة الشراء لأن ترتيبها أدنى وسعرها أعلى
  // (الأمير 300K أغلى من الأرستقراطي 100K)
  if (active && level.level !== state.level) {
    return {
      price: level.activationCoins,
      mode: 'upgrade',
      labelAr: level.level > state.level ? 'ترقية' : 'تبديل',
    };
  }

  if ((active || inGrace) && level.level === state.level && level.allowRenewal !== false) {
    return { price: level.renewalCoins, mode: 'renewal', labelAr: 'تجديد' };
  }

  return { price: level.activationCoins, mode: 'activation', labelAr: 'تفعيل' };
}

function coinReturnAmount(price: number, percent: number): number {
  return Math.floor((price * percent) / 100);
}

function resolveCoinReturn(level: AristocracyLevel, price: number): number {
  if (level.coinReturnCoins != null && level.coinReturnCoins >= 0) {
    return Math.floor(level.coinReturnCoins);
  }
  return coinReturnAmount(price, level.coinReturnPercent);
}

function calcNewExpiry(
  currentExpiry: number | null,
  addDays: number,
  maxDays: number,
): number {
  const now = Date.now();
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
  const maxMs = now + maxDays * DAY_MS;
  const proposed = base + addDays * DAY_MS;
  return Math.min(proposed, maxMs);
}

// ─── Purchase / renew / upgrade ─────────────────────────────────

export const purchaseAristocracy = async (
  levelId: string,
): Promise<{ level: number; expiresAt: number; coinReturn: number }> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const config = await getAristocracyConfigOnce();
  const level = getAristocracyLevel(config, levelId);
  if (!level) throw new Error('المستوى غير موجود');

  const userRef = doc(firestore, 'users', me.uid);
  const now = Date.now();

  const result = await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');

    const data = snap.data() as Record<string, unknown>;
    const stats = statsFromFirestoreDoc(data);
    const state = readAristocracyState(data);
    const { price, mode } = resolvePurchasePrice(level, state, config);

    if (stats.coins < price) {
      throw new Error(
        `رصيدك ${stats.coins.toLocaleString('en-US')} — تحتاج ${price.toLocaleString('en-US')} كوين`,
      );
    }

    if (level.requiredVipLevel > 0 && Number(data.vipLevel ?? 0) < level.requiredVipLevel) {
      throw new Error(`يتطلب SVIP${level.requiredVipLevel} أو أعلى`);
    }

    const newExpiry = calcNewExpiry(state.expiresAt, level.validityDays, config.maxValidityDays);
    const returnCoins = resolveCoinReturn(level, price);

    const { level: wealthLevel, xp: wealthXp } = applyXpGain(
      stats.level,
      stats.xp,
      price,
    );

    const svipKeys = Array.isArray(level.svipPrivilegeKeys) ? level.svipPrivilegeKeys.map(String) : null;

    const newState: AristocracyUserState = {
      ...state,
      level: level.level,
      expiresAt: newExpiry,
      grantedVipLevel: Number(level.grantedVipLevel ?? 0),
      svipPrivilegeKeys: svipKeys,
      pendingReturns: state.pendingReturns + returnCoins,
      frozenReturns: 0,
      frozenAt: null,
    };

    const patch: Record<string, unknown> = {
      ...buildBalanceIncrementPatch('coins', -price),
      'stats.level': wealthLevel,
      'stats.xp': wealthXp,
      aristocracy: newState,
      aristocracyLevel: level.level,
      aristocracyExpiresAt: newExpiry,
      aristocracyGrantedVipLevel: newState.grantedVipLevel,
      aristocracySvipPrivilegeKeys: svipKeys,
      aristocracyPendingReturns: newState.pendingReturns,
      updatedAt: now,
    };

    tx.update(userRef, patch as any);

    return { level: level.level, expiresAt: newExpiry, coinReturn: returnCoins, price, mode, levelName: level.nameAr };
  });

  await addDoc(collection(firestore, 'transactions'), {
    uid: me.uid,
    type: 'aristocracy_purchase',
    levelId: level.id,
    level: result.level,
    amount: -result.price,
    currency: 'coins',
    itemName: result.levelName,
    purchaseMode: result.mode,
    coinReturn: result.coinReturn,
    status: 'completed',
    createdAt: now,
  });

  return { level: result.level, expiresAt: result.expiresAt, coinReturn: result.coinReturn };
};

/** استلام عائد الكوينز المعلّق */
export const claimAristocracyCoinReturns = async (): Promise<number> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const userRef = doc(firestore, 'users', me.uid);
  const now = Date.now();

  return runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('المستخدم غير موجود');

    const data = snap.data() as Record<string, unknown>;
    const state = readAristocracyState(data);

    if (!isAristocracyActive(state)) {
      throw new Error('الأرستقراطية غير مفعّلة — جدّد لتستلم العائد');
    }

    const amount = state.pendingReturns;
    if (amount <= 0) throw new Error('لا يوجد عائد للاستلام');

    tx.update(userRef, {
      ...buildBalanceIncrementPatch('coins', amount),
      aristocracy: { ...state, pendingReturns: 0 },
      aristocracyPendingReturns: 0,
      updatedAt: now,
    });

    return amount;
  });
};

/** تجميد العائد عند انتهاء الصلاحية (يُستدعى عند فتح الصفحة) */
export const syncAristocracyFrozenReturns = async (): Promise<void> => {
  const me = auth.currentUser;
  if (!me) return;

  const config = await getAristocracyConfigOnce();
  const userRef = doc(firestore, 'users', me.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const data = snap.data() as Record<string, unknown>;
  const state = readAristocracyState(data);
  const now = Date.now();

  if (isAristocracyActive(state)) return;

  const graceEnd = (state.expiresAt ?? 0) + config.gracePeriodDays * DAY_MS;
  const frozenExpire = (state.frozenAt ?? state.expiresAt ?? 0) + config.frozenExpireDays * DAY_MS;

  if (state.pendingReturns > 0 && state.expiresAt && state.expiresAt < now && now > graceEnd) {
    await runTransaction(firestore, async (tx) => {
      const s = await tx.get(userRef);
      if (!s.exists()) return;
      const st = readAristocracyState(s.data() as Record<string, unknown>);
      tx.update(userRef, {
        aristocracy: {
          ...st,
          pendingReturns: 0,
          frozenReturns: st.frozenReturns + st.pendingReturns,
          frozenAt: st.frozenAt ?? now,
        },
        aristocracyPendingReturns: 0,
        aristocracyFrozenReturns: st.frozenReturns + st.pendingReturns,
        aristocracyFrozenAt: st.frozenAt ?? now,
        updatedAt: now,
      });
    });
    return;
  }

  if (state.frozenReturns > 0 && state.frozenAt && now > frozenExpire) {
    await runTransaction(firestore, async (tx) => {
      tx.update(userRef, {
        aristocracy: { ...state, frozenReturns: 0, frozenAt: null },
        aristocracyFrozenReturns: 0,
        aristocracyFrozenAt: null,
        updatedAt: now,
      });
    });
  }
};

/** نقاط التشريف من الهدايا — 1 كوين = 1 نقطة */
export const addAristocracyHonorPoints = async (coinsSpent: number): Promise<void> => {
  const me = auth.currentUser;
  if (!me || coinsSpent <= 0) return;

  const userRef = doc(firestore, 'users', me.uid);
  const month = currentMonthKey();

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) return;

    const data = snap.data() as Record<string, unknown>;
    const state = readAristocracyState(data);
    if (!isAristocracyActive(state)) return;

    const honorMonth = state.honorMonth === month ? state.honorMonth : month;
    const honorPoints = (state.honorMonth === month ? state.honorPoints : 0) + coinsSpent;

    tx.update(userRef, {
      aristocracy: { ...state, honorPoints, honorMonth },
      aristocracyHonorPoints: honorPoints,
      aristocracyHonorMonth: honorMonth,
      updatedAt: Date.now(),
    });
  });
};

export const toggleAristocracyAutoRenew = async (enabled: boolean): Promise<void> => {
  const me = auth.currentUser;
  if (!me) throw new Error('يجب تسجيل الدخول');

  const userRef = doc(firestore, 'users', me.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('المستخدم غير موجود');

  const state = readAristocracyState(snap.data() as Record<string, unknown>);
  const config = await getAristocracyConfigOnce();
  const level = getAristocracyLevel(config, state.level);
  if (!isAristocracyActive(state) && enabled) {
    throw new Error('فعّل الأرستقراطية أولاً لتستخدم التجديد التلقائي');
  }
  if (enabled && level?.allowRenewal === false) {
    throw new Error('هذا المستوى لا يدعم التجديد التلقائي');
  }

  await runTransaction(firestore, async (tx) => {
    tx.update(userRef, {
      aristocracy: { ...state, autoRenew: enabled },
      aristocracyAutoRenew: enabled,
      updatedAt: Date.now(),
    });
  });
};
