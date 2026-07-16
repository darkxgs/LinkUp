/**
 * جداول رواتب LinkUp الرسمية + حساب الاستحقاق (payroll).
 *
 * المصدر: صور سياسة الرواتب من اجتماع الوكالات (سلّمها المالك 2026-07-15).
 * أرقام فلوس — لا تُخمَّن ولا تُعدَّل إلا بمرجع رسمي.
 *
 * معادلة استحقاق الوكيل (مؤكّدة):
 *   الاستحقاق (كوينز) = هدف المرحلة المحقَّقة × نسبة التحصيل%
 *   الماسات = الاستحقاق ÷ 50,000  (COINS_PER_DIAMOND)
 *   نسبة المكافأة% مالية فقط (تدخل الراتب $) ولا تُضاف للماسات.
 *   المرحلة = أعلى هدف ≤ إجمالي كوينز العمل (لا استحقاق على مرحلة غير محقَّقة).
 *   فوق 50M (UP50M): 75% على الإجمالي الفعلي.
 */

/** معدّل تحويل الكوينز إلى ماسة (موحّد للوكيل والمضيفة) */
export const COINS_PER_DIAMOND = 50_000;
/** رسوم السحب الذاتي */
export const AGENT_WITHDRAW_FEE_PCT = 2;
export const HOST_WITHDRAW_FEE_PCT = 10;
/** قيمة الماسة بالدولار (للعرض فقط: راتب$ = ماسات × 0.95) */
export const DIAMOND_USD = 0.95;

export interface SalaryTier {
  /** هدف كوينز العمل للمرحلة */
  target: number;
  /** نسبة التحصيل% (تُضرب في الهدف لحساب الاستحقاق) */
  collectionPct: number;
  /** الماسات المجمّعة (= target × collectionPct ÷ 50k) — للعرض/التحقق */
  diamonds: number;
  /** الراتب $ (= diamonds × 0.95) */
  salaryUsd: number;
  /** نسبة المكافأة% (مالية فقط) */
  bonusPct: number;
  /** الراتب الإجمالي $ (بعد المكافأة) */
  totalUsd: number;
  /** هدية كوينز عند بلوغ المرحلة (0 = لا يوجد) */
  giftCoins: number;
  /** مرحلة مفتوحة عليا (UP…) — النسبة تُطبَّق على الإجمالي الفعلي لا على الهدف */
  open?: boolean;
}

/** سياسة الوكلاء الشهرية — الاستحقاق على إجمالي كوينز عمل كل المضيفات في الشهر */
export const AGENT_MONTHLY_TIERS: readonly SalaryTier[] = [
  { target: 2_000_000, collectionPct: 30, diamonds: 12, salaryUsd: 11.4, bonusPct: 0, totalUsd: 11, giftCoins: 40_000 },
  { target: 5_000_000, collectionPct: 35, diamonds: 35, salaryUsd: 33.25, bonusPct: 2.5, totalUsd: 34, giftCoins: 100_000 },
  { target: 7_500_000, collectionPct: 40, diamonds: 60, salaryUsd: 57, bonusPct: 5, totalUsd: 60, giftCoins: 150_000 },
  { target: 10_000_000, collectionPct: 45, diamonds: 90, salaryUsd: 85.5, bonusPct: 8, totalUsd: 92, giftCoins: 200_000 },
  { target: 15_000_000, collectionPct: 50, diamonds: 150, salaryUsd: 142.5, bonusPct: 10, totalUsd: 157, giftCoins: 300_000 },
  { target: 20_000_000, collectionPct: 55, diamonds: 220, salaryUsd: 209, bonusPct: 12, totalUsd: 234, giftCoins: 400_000 },
  { target: 25_000_000, collectionPct: 60, diamonds: 300, salaryUsd: 285, bonusPct: 15, totalUsd: 328, giftCoins: 500_000 },
  { target: 30_000_000, collectionPct: 65, diamonds: 390, salaryUsd: 370.5, bonusPct: 20, totalUsd: 445, giftCoins: 600_000 },
  { target: 50_000_000, collectionPct: 70, diamonds: 700, salaryUsd: 665, bonusPct: 25, totalUsd: 831, giftCoins: 1_000_000 },
  // UP50M: 75% على الإجمالي الفعلي؛ الهدية 1.5% من الإجمالي، المكافأة 30%
  { target: 50_000_001, collectionPct: 75, diamonds: 0, salaryUsd: 0, bonusPct: 30, totalUsd: 0, giftCoins: 0, open: true },
];

/** سياسة المضيفات الأسبوعية — المضيفة تأخذ 100% من كوينز عملها (بلا نِسب) */
export const HOST_WEEKLY_TIERS: readonly SalaryTier[] = [
  { target: 100_000, collectionPct: 100, diamonds: 2, salaryUsd: 1.9, bonusPct: 0, totalUsd: 2, giftCoins: 0 },
  { target: 200_000, collectionPct: 100, diamonds: 4, salaryUsd: 3.8, bonusPct: 15, totalUsd: 4, giftCoins: 0 },
  { target: 500_000, collectionPct: 100, diamonds: 10, salaryUsd: 9.5, bonusPct: 30, totalUsd: 12, giftCoins: 0 },
  { target: 1_000_000, collectionPct: 100, diamonds: 20, salaryUsd: 19, bonusPct: 40, totalUsd: 27, giftCoins: 5_000 },
  { target: 2_000_000, collectionPct: 100, diamonds: 40, salaryUsd: 38, bonusPct: 50, totalUsd: 57, giftCoins: 10_000 },
  { target: 3_500_000, collectionPct: 100, diamonds: 70, salaryUsd: 66.5, bonusPct: 60, totalUsd: 106, giftCoins: 17_500 },
  { target: 5_000_000, collectionPct: 100, diamonds: 100, salaryUsd: 95, bonusPct: 70, totalUsd: 162, giftCoins: 25_000 },
  { target: 7_000_000, collectionPct: 100, diamonds: 140, salaryUsd: 133, bonusPct: 90, totalUsd: 253, giftCoins: 35_000 },
  { target: 10_000_000, collectionPct: 100, diamonds: 200, salaryUsd: 190, bonusPct: 120, totalUsd: 418, giftCoins: 50_000 },
  // UP10M: 150% مكافأة، الهدية 0.5% من الإجمالي
  { target: 10_000_001, collectionPct: 100, diamonds: 0, salaryUsd: 0, bonusPct: 150, totalUsd: 0, giftCoins: 0, open: true },
];

export interface SalaryEntitlement {
  /** المرحلة المحقَّقة (null إذا لم يبلغ أدنى مرحلة) */
  tier: SalaryTier | null;
  /** ترتيب المرحلة (0-based) أو -1 */
  tierIndex: number;
  /** الاستحقاق بالكوينز (يُحوَّل لمحفظة البروفايل) */
  entitlementCoins: number;
  /** الماسات المكافئة (الكوينز ÷ 50,000) */
  diamonds: number;
  /**
   * الكوينز المُستهلَكة من المحفظة عند السحب = هدف المرحلة المحقَّقة (للمرحلة
   * الثابتة) أو الإجمالي كله (للمرحلة المفتوحة). الزيادة فوقها (الإجمالي − المُستهلَك)
   * تبقى في المحفظة لتراكم الشهر التالي — لا تُصفَّر المحفظة.
   */
  consumedCoins: number;
  /** الراتب الإجمالي $ (للعرض) */
  totalUsd: number;
  /** المرحلة التالية (للعرض/التحفيز) أو null */
  nextTier: SalaryTier | null;
}

/**
 * أعلى مرحلة محقَّقة: آخر مرحلة هدفها ≤ الإجمالي. المرحلة المفتوحة (open) تُطبَّق
 * نسبتها على الإجمالي الفعلي؛ غيرها ثابتة (هدف المرحلة × النسبة).
 */
function resolveEntitlement(totalWorkCoins: number, tiers: readonly SalaryTier[]): SalaryEntitlement {
  const total = Math.max(0, Math.floor(Number(totalWorkCoins) || 0));
  let idx = -1;
  for (let i = 0; i < tiers.length; i++) {
    if (total >= tiers[i]!.target) idx = i;
    else break;
  }
  if (idx < 0) {
    return {
      tier: null,
      tierIndex: -1,
      entitlementCoins: 0,
      diamonds: 0,
      consumedCoins: 0,
      totalUsd: 0,
      nextTier: tiers[0] ?? null,
    };
  }
  const tier = tiers[idx]!;
  // المرحلة المفتوحة: النسبة على الإجمالي الفعلي ويُستهلك الكل؛ الثابتة: على هدف
  // المرحلة ويُستهلك الهدف فقط (الزيادة فوقه تتراكم للشهر التالي).
  const base = tier.open ? total : tier.target;
  const entitlementCoins = Math.floor((base * tier.collectionPct) / 100);
  const diamonds = Math.floor(entitlementCoins / COINS_PER_DIAMOND);
  return {
    tier,
    tierIndex: idx,
    entitlementCoins,
    diamonds,
    consumedCoins: base,
    totalUsd: tier.totalUsd,
    nextTier: tiers[idx + 1] ?? null,
  };
}

/** استحقاق الوكيل الشهري من إجمالي كوينز عمل الوكالة */
export function computeAgentEntitlement(totalAgencyWorkCoins: number): SalaryEntitlement {
  return resolveEntitlement(totalAgencyWorkCoins, AGENT_MONTHLY_TIERS);
}

/** استحقاق المضيفة الأسبوعي من كوينز عملها */
export function computeHostEntitlement(hostWorkCoins: number): SalaryEntitlement {
  return resolveEntitlement(hostWorkCoins, HOST_WEEKLY_TIERS);
}

/** صافي الماس بعد رسوم السحب الذاتي */
export function applyWithdrawFee(diamonds: number, feePct: number): number {
  const d = Math.max(0, Math.floor(Number(diamonds) || 0));
  return Math.floor(d * (1 - feePct / 100));
}
