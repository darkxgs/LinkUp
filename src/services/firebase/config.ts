/**
 * Config Service — المصدر الموحّد للإعدادات القابلة للتحكم من لوحة الأدمن
 *
 * كل العناصر (هدايا، VIP، باقات شحن، إعدادات) تُقرأ من Firestore:
 *   config/gifts          → { items: Gift[] }
 *   config/vipTiers       → { tiers: VipTier[] }
 *   config/rechargePackages → { packages: RechargePackage[] }
 *   config/settings       → AppSettings
 *
 * إذا كانت فاضية في Firestore، نستخدم القيم الافتراضية (fallback)
 * بحيث لا ينكسر التطبيق قبل أن يضيف الأدمن البيانات.
 *
 * تُستخدم onSnapshot للتحديث الفوري (real-time) عند تعديل الأدمن.
 */

import { doc, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from './index';
import { GIFTS_CATALOG, type Gift, type GiftCategoryConfig } from './shop';
import { normalizeGiftFromConfig } from '@/components/ui/giftUtils';
import { normalizeGiftCategory, sortGiftCategories } from '@/utils/giftCategories';
import { sortRechargePackageTags } from '@/utils/rechargePackageTags';

// ==================== TYPES ====================
export interface VipTier {
  level: number;
  name: string;
  price: number;
  color: string;
  iconName: string;
  perks: string[];
  coinBonus: number; // % إضافي على العملات
  validityDays: number;
}

export interface RechargePackageTag {
  id: string;
  labels: Record<string, string>;
  emoji?: string;
  color?: string;
  borderColor?: string;
  order?: number;
  enabled?: boolean;
}

export interface RechargePackage {
  id: string;
  coins: number;
  bonus: number; // عملات إضافية
  priceUSD: number;
  priceLabel: string;
  tagId?: string;
  /** @deprecated استخدم tagId */
  isPopular?: boolean;
  /** @deprecated استخدم tagId */
  isBestValue?: boolean;
}

function normalizeRechargePackage(raw: RechargePackage): RechargePackage {
  let tagId = raw.tagId?.trim() || undefined;
  if (!tagId) {
    if (raw.isBestValue) tagId = 'best_value';
    else if (raw.isPopular) tagId = 'popular';
  }
  const out: RechargePackage = {
    id: raw.id,
    coins: raw.coins,
    bonus: raw.bonus ?? 0,
    priceUSD: raw.priceUSD,
    priceLabel: raw.priceLabel,
  };
  if (tagId) out.tagId = tagId;
  return out;
}

export interface AppSettings {
  coinRate: number;          // عملة لكل دولار
  minWithdraw: number;       // الحد الأدنى العام (ماسة) — للتوافق
  minHostWithdraw: number;   // الحد الأدنى للمضيفة
  minAgentWithdraw: number;  // الحد الأدنى للوكيل
  hostWithdrawAmounts: number[];   // مبالغ سحب المضيفة (ماسة)
  agentWithdrawAmounts: number[];  // مبالغ سحب الوكيل (ماسة)
  allowCustomHostWithdraw: boolean;
  allowCustomAgentWithdraw: boolean;
  hostAgentWithdrawWeekDays: number[]; // أيام السحب عبر الوكيل (0=أحد … 6=سبت)
  hostSelfWithdrawAnytime: boolean;
  agentWithdrawCooldownDays: number;   // فترة انتظار سحب الوكيل (أيام)
  agentBatchDivisor: number;           // مضاعفات السحب (مثلاً 5)
  pearlUsdRate: number;                // كم ماسة = 1 دولار للعرض
  giftCommission: number;    // عمولة الهدايا %
  agencyCommission: number;  // عمولة الوكالات %
  bdReferralCommissionPercent: number; // نسبة BD من دخل الوكالة المُحالة %
  bdReferralBenefitMonths: number;     // مدة استفادة BD (أشهر)
  transferCommission: number; // عمولة تحويل العملات بين المستخدمين %
  minTransferAmount: number;  // الحد الأدنى لتحويلة واحدة
  // معدّلات التحويل — كم وحدة مصدر = 1 وحدة هدف
  coinsToPearlsRate: number;       // 50,000 كوين = 1 ماسة
  casinoToCoinsRate: number;       // 1 كازينو → 10,000 كوين
  casinoToPearlsRate: number;      // 1 كازينو → 1 ماسة
  // عمولات السحب (الأدمن يتحكّم)
  selfWithdrawCommission: number;  // % سحب ذاتي (افتراضي 10)
  agentWithdrawCommission: number; // % سحب عبر وكيل (افتراضي 2)
  // الرسائل المقفلة (تُفتح بالكوينز)
  lockedMessagePrice: number;      // سعر فتح الرسالة بالكوينز (ثابت)
  lockedMessageCommission: number; // % عمولة الإدارة من فتح الرسالة
  maintenanceMode: boolean;
  allowRegistration: boolean;
  requireVerification: boolean;
  welcomeBonus: number;      // مكافأة التسجيل
  /** هدية أول شحن للحساب العادي (كوينز) */
  firstRechargeBonus: number;
  /** شحن داخل التطبيق (بوابة دفع) — false = شحن عبر الإدارة فقط */
  inAppRechargeEnabled: boolean;
  challengeWinnerPercent: number;  // % نسبة الفائز من إجمالي رهان التحديات
  challengeAppCommission: number;  // % عمولة التطبيق من تحديات الألعاب
  /**
   * فلترة المحتوى — مصطلحات محظورة (أسماء تطبيقات منافسة…) تمنع إرسال الرسالة.
   * تُدمج مع القائمة الافتراضية في utils/moderation.ts (مطابقة غير حساسة
   * لحالة الأحرف/التشكيل، عربي + لاتيني). تصل للخدمات عبر ConfigContext.
   */
  moderation: { bannedTerms: string[] };
}

// ==================== DEFAULTS (Fallback) ====================
export const DEFAULT_VIP_TIERS: VipTier[] = [
  { level: 1, name: 'VIP فضي', price: 5000, color: '#9CA3AF', iconName: 'Crown', coinBonus: 5, validityDays: 30, perks: ['إطار فضي', 'دخول مميز', '+5% عملات'] },
  { level: 2, name: 'VIP ذهبي', price: 15000, color: '#FCD34D', iconName: 'Crown', coinBonus: 10, validityDays: 30, perks: ['إطار ذهبي', 'تأثير دخول', '+10% عملات', 'شارة ذهبية'] },
  { level: 3, name: 'VIP ماسي', price: 50000, color: '#C61414', iconName: 'Diamond', coinBonus: 20, validityDays: 30, perks: ['إطار ماسي', 'تأثيرات حصرية', '+20% عملات', 'دعم أولوية'] },
  { level: 4, name: 'VIP أسطوري', price: 150000, color: '#E11414', iconName: 'Sparkles', coinBonus: 50, validityDays: 30, perks: ['كل المزايا', 'هدايا حصرية', '+50% عملات', 'مدير حساب'] },
];

export const DEFAULT_RECHARGE_PACKAGE_TAGS: RechargePackageTag[] = [
  {
    id: 'popular',
    labels: { ar: 'الأكثر شيوعاً', en: 'Most Popular' },
    emoji: '🔥',
    color: '#E11414',
    borderColor: '#E11414',
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

export const DEFAULT_RECHARGE_PACKAGES: RechargePackage[] = [
  { id: 'pkg1', coins: 10_000, bonus: 0, priceUSD: 1, priceLabel: '$1' },
  { id: 'pkg2', coins: 50_000, bonus: 2_500, priceUSD: 5, priceLabel: '$5' },
  { id: 'pkg3', coins: 100_000, bonus: 10_000, priceUSD: 10, priceLabel: '$10', tagId: 'popular' },
  { id: 'pkg4', coins: 500_000, bonus: 75_000, priceUSD: 50, priceLabel: '$50' },
  { id: 'pkg5', coins: 1_000_000, bonus: 200_000, priceUSD: 100, priceLabel: '$100', tagId: 'best_value' },
  { id: 'pkg6', coins: 5_000_000, bonus: 1_500_000, priceUSD: 500, priceLabel: '$500' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  coinRate: 10_000,
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
  coinsToPearlsRate: 50_000,
  casinoToCoinsRate: 10_000,
  casinoToPearlsRate: 1,
  selfWithdrawCommission: 10,
  agentWithdrawCommission: 2,
  lockedMessagePrice: 200,     // 200 كوين لفتح الرسالة المقفلة
  lockedMessageCommission: 20, // 20% عمولة الإدارة
  maintenanceMode: false,
  allowRegistration: true,
  requireVerification: false,
  welcomeBonus: 0, // معطّل — لا يُمنح رصيد عند التسجيل
  firstRechargeBonus: 50_000,
  inAppRechargeEnabled: false,
  challengeWinnerPercent: 80,
  challengeAppCommission: 20,
  // فارغة = الاكتفاء بالقائمة الافتراضية في utils/moderation.ts حتى يضبط الأدمن قائمته
  moderation: { bannedTerms: [] },
};

// ==================== REAL-TIME SUBSCRIPTIONS ====================

/** الاستماع للهدايا — يحدّث فوراً عند تعديل الأدمن */
export const subscribeToGifts = (cb: (gifts: Gift[]) => void): (() => void) => {
  const ref = doc(firestore, 'config', 'gifts');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists() && snap.data().items?.length) {
        const items = (snap.data().items as Gift[]).map((g) =>
          normalizeGiftFromConfig(g) as Gift,
        );
        cb(items);
      } else {
        cb(GIFTS_CATALOG);
      }
    },
    () => cb(GIFTS_CATALOG),
  );
};

/** تصنيفات الهدايا — من لوحة التحكم فقط، بدون قيم ثابتة */
export const subscribeToGiftCategories = (
  cb: (categories: GiftCategoryConfig[]) => void,
): (() => void) => {
  const ref = doc(firestore, 'config', 'gifts');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists() && snap.data().categories?.length) {
        const cats = sortGiftCategories(
          (snap.data().categories as GiftCategoryConfig[]).map(normalizeGiftCategory),
        );
        cb(cats);
      } else {
        cb([]);
      }
    },
    () => cb([]),
  );
};

/** الاستماع لباقات VIP */
export const subscribeToVipTiers = (cb: (tiers: VipTier[]) => void): (() => void) => {
  const ref = doc(firestore, 'config', 'vipTiers');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists() && snap.data().tiers?.length) {
        cb(snap.data().tiers as VipTier[]);
      } else {
        cb(DEFAULT_VIP_TIERS);
      }
    },
    () => cb(DEFAULT_VIP_TIERS),
  );
};

/** الاستماع لباقات الشحن */
export const subscribeToRechargePackages = (cb: (pkgs: RechargePackage[]) => void): (() => void) => {
  const ref = doc(firestore, 'config', 'rechargePackages');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists() && snap.data().packages?.length) {
        cb((snap.data().packages as RechargePackage[]).map(normalizeRechargePackage));
      } else {
        cb(DEFAULT_RECHARGE_PACKAGES);
      }
    },
    () => cb(DEFAULT_RECHARGE_PACKAGES),
  );
};

/** تصنيفات/شارات باقات الشحن — من لوحة التحكم */
export const subscribeToRechargePackageTags = (
  cb: (tags: RechargePackageTag[]) => void,
): (() => void) => {
  const ref = doc(firestore, 'config', 'rechargePackages');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const raw = (snap.data().tags ?? snap.data().categories ?? []) as RechargePackageTag[];
        if (raw.length) {
          cb(sortRechargePackageTags(raw));
          return;
        }
      }
      cb(DEFAULT_RECHARGE_PACKAGE_TAGS);
    },
    () => cb(DEFAULT_RECHARGE_PACKAGE_TAGS),
  );
};

/** الاستماع للإعدادات العامة */
export const subscribeToSettings = (cb: (settings: AppSettings) => void): (() => void) => {
  const ref = doc(firestore, 'config', 'settings');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        cb({ ...DEFAULT_SETTINGS, ...(snap.data() as AppSettings) });
      } else {
        cb(DEFAULT_SETTINGS);
      }
    },
    () => cb(DEFAULT_SETTINGS),
  );
};

// ==================== ONE-TIME GETTERS (للحالات اللي ما تحتاج real-time) ====================
export const getGiftsOnce = async (): Promise<Gift[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'gifts'));
    if (snap.exists() && snap.data().items?.length) {
      return (snap.data().items as Gift[]).map((g) => normalizeGiftFromConfig(g) as Gift);
    }
  } catch {}
  return GIFTS_CATALOG;
};

export const getSettingsOnce = async (): Promise<AppSettings> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'settings'));
    if (snap.exists()) return { ...DEFAULT_SETTINGS, ...(snap.data() as AppSettings) };
  } catch {}
  return DEFAULT_SETTINGS;
};

export const getVipTiersOnce = async (): Promise<VipTier[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'vipTiers'));
    if (snap.exists() && snap.data().tiers?.length) return snap.data().tiers as VipTier[];
  } catch {}
  return DEFAULT_VIP_TIERS;
};

export const getRechargePackagesOnce = async (): Promise<RechargePackage[]> => {
  try {
    const snap = await getDoc(doc(firestore, 'config', 'rechargePackages'));
    if (snap.exists() && snap.data().packages?.length) {
      return (snap.data().packages as RechargePackage[]).map(normalizeRechargePackage);
    }
  } catch {}
  return DEFAULT_RECHARGE_PACKAGES;
};

// ==================== SEED (تهيئة أولية — تُستدعى مرة من اللوحة) ====================
export const seedConfigDefaults = async (): Promise<void> => {
  await Promise.all([
    setDoc(doc(firestore, 'config', 'gifts'), { items: GIFTS_CATALOG }, { merge: true }),
    setDoc(doc(firestore, 'config', 'vipTiers'), { tiers: DEFAULT_VIP_TIERS }, { merge: true }),
    setDoc(doc(firestore, 'config', 'rechargePackages'), { packages: DEFAULT_RECHARGE_PACKAGES }, { merge: true }),
    setDoc(doc(firestore, 'config', 'settings'), DEFAULT_SETTINGS, { merge: true }),
  ]);
};
