/**
 * مستويات الوكالة — حسب قيمة الدعم (كوينز) داخل الوكالة للفترة الحالية
 * القيم الافتراضية قابلة للتعديل من لوحة تحكم الأدmin (config/agencyLevels)
 */

export const AGENCY_THRONE_UNLOCK_LEVEL = 15;

/** شريحة حد مشرفي الإشراف حسب مستوى الوكالة */
export interface AgencySupervisorCapTier {
  minLevel: number;
  maxLevel: number;
  maxSupervisors: number;
}

export const DEFAULT_SUPERVISOR_CAP_TIERS: readonly AgencySupervisorCapTier[] = [
  { minLevel: 1, maxLevel: 9, maxSupervisors: 3 },
  { minLevel: 10, maxLevel: 19, maxSupervisors: 5 },
  { minLevel: 20, maxLevel: 999, maxSupervisors: 7 },
] as const;

export interface AgencyLevelDef {
  level: number;
  /** حد الدعم بالكوينز للوصول لهذا المستوى */
  supportTarget: number;
  /** @deprecated alias — استخدم supportTarget */
  hostTarget: number;
  managerBonus: number;
}

export interface AgencyLevelsRuntimeConfig {
  levels: AgencyLevelDef[];
  /** بعد آخر مستوى مُعرَّف: +1 مستوى كل N كوين */
  extendStepCoins: number;
  throneUnlockLevel: number;
  /** حد مشرفي الإشراف حسب مستوى الوكالة */
  supervisorCapTiers: AgencySupervisorCapTier[];
  /** إضافة لمالك يملك امتياز SVIP «زيادة مشرفين الغرفة» */
  vipSupervisorBonus: number;
}

/** عتبات الدعم الافتراضية (كوينز) — المستوى 15 يفتح العرش */
export const DEFAULT_AGENCY_LEVEL_THRESHOLDS: readonly Omit<AgencyLevelDef, 'hostTarget' | 'managerBonus'>[] = [
  { level: 1, supportTarget: 1_000_000 },
  { level: 2, supportTarget: 2_000_000 },
  { level: 3, supportTarget: 4_000_000 },
  { level: 4, supportTarget: 6_000_000 },
  { level: 5, supportTarget: 10_000_000 },
  { level: 6, supportTarget: 14_000_000 },
  { level: 7, supportTarget: 18_000_000 },
  { level: 8, supportTarget: 22_000_000 },
  { level: 9, supportTarget: 25_000_000 },
  { level: 10, supportTarget: 30_000_000 },
  { level: 11, supportTarget: 35_000_000 },
  { level: 12, supportTarget: 40_000_000 },
  { level: 13, supportTarget: 45_000_000 },
  { level: 14, supportTarget: 50_000_000 },
  { level: 15, supportTarget: 60_000_000 },
  { level: 16, supportTarget: 80_000_000 },
  { level: 17, supportTarget: 100_000_000 },
  { level: 18, supportTarget: 125_000_000 },
  { level: 19, supportTarget: 150_000_000 },
  { level: 20, supportTarget: 200_000_000 },
  { level: 21, supportTarget: 250_000_000 },
  { level: 22, supportTarget: 300_000_000 },
] as const;

export const DEFAULT_EXTEND_STEP_COINS = 25_000_000;

function bonusForTarget(target: number): number {
  return Math.floor(target * 0.32);
}

function normalizeLevelDef(raw: Partial<AgencyLevelDef> & { level: number }): AgencyLevelDef {
  const supportTarget =
    Number(raw.supportTarget) > 0
      ? Number(raw.supportTarget)
      : Number(raw.hostTarget) > 0
        ? Number(raw.hostTarget)
        : 0;
  return {
    level: raw.level,
    supportTarget,
    hostTarget: supportTarget,
    managerBonus:
      Number(raw.managerBonus) > 0 ? Number(raw.managerBonus) : bonusForTarget(supportTarget),
  };
}

export function buildDefaultAgencyLevels(): AgencyLevelDef[] {
  return DEFAULT_AGENCY_LEVEL_THRESHOLDS.map((row) => normalizeLevelDef(row));
}

function normalizeSupervisorCapTier(raw: Partial<AgencySupervisorCapTier>): AgencySupervisorCapTier | null {
  const minLevel = Math.max(1, Math.round(Number(raw.minLevel) || 0));
  const maxLevel = Math.max(minLevel, Math.round(Number(raw.maxLevel) || 0));
  const maxSupervisors = Math.max(0, Math.round(Number(raw.maxSupervisors) || 0));
  if (maxSupervisors <= 0) return null;
  return { minLevel, maxLevel, maxSupervisors };
}

export function buildDefaultSupervisorCapTiers(): AgencySupervisorCapTier[] {
  return DEFAULT_SUPERVISOR_CAP_TIERS.map((t) => ({ ...t }));
}

export function resolveAgencyLevelsConfig(
  remote?: Partial<AgencyLevelsRuntimeConfig> | null,
): AgencyLevelsRuntimeConfig {
  const rawLevels = Array.isArray(remote?.levels) ? remote!.levels : [];
  const levels =
    rawLevels.length > 0
      ? rawLevels
          .map((l) => normalizeLevelDef(l as AgencyLevelDef))
          .filter((l) => l.level >= 1 && l.supportTarget > 0)
          .sort((a, b) => a.level - b.level)
      : buildDefaultAgencyLevels();

  const rawTiers = Array.isArray(remote?.supervisorCapTiers) ? remote!.supervisorCapTiers : [];
  const supervisorCapTiers =
    rawTiers.length > 0
      ? rawTiers
          .map((t) => normalizeSupervisorCapTier(t as AgencySupervisorCapTier))
          .filter((t): t is AgencySupervisorCapTier => t != null)
          .sort((a, b) => a.minLevel - b.minLevel)
      : buildDefaultSupervisorCapTiers();

  return {
    levels,
    extendStepCoins:
      Number(remote?.extendStepCoins) > 0
        ? Number(remote!.extendStepCoins)
        : DEFAULT_EXTEND_STEP_COINS,
    throneUnlockLevel:
      Number(remote?.throneUnlockLevel) >= 1
        ? Number(remote!.throneUnlockLevel)
        : AGENCY_THRONE_UNLOCK_LEVEL,
    supervisorCapTiers:
      supervisorCapTiers.length > 0 ? supervisorCapTiers : buildDefaultSupervisorCapTiers(),
    vipSupervisorBonus: Math.max(0, Math.round(Number(remote?.vipSupervisorBonus) || 0)),
  };
}

/** عدد مشرفي الإشراف المسموح لمستوى وكالة معيّن */
export function resolveSupervisorCapForLevel(
  agencyLevel: number,
  cfg: AgencyLevelsRuntimeConfig = resolveAgencyLevelsConfig(),
  options?: { vipExtra?: boolean },
): number {
  const level = Math.max(1, Math.floor(Number(agencyLevel) || 0));
  const tiers = [...cfg.supervisorCapTiers].sort((a, b) => b.minLevel - a.minLevel);
  let cap = tiers[tiers.length - 1]?.maxSupervisors ?? 3;

  for (const tier of tiers) {
    if (level >= tier.minLevel && level <= tier.maxLevel) {
      cap = tier.maxSupervisors;
      break;
    }
  }

  if (options?.vipExtra && cfg.vipSupervisorBonus > 0) {
    cap += cfg.vipSupervisorBonus;
  }
  return cap;
}

/** @deprecated — استخدم AGENCY_LEVELS من resolveAgencyLevelsConfig */
export const AGENCY_LEVELS: readonly AgencyLevelDef[] = buildDefaultAgencyLevels();

export function getSupportTargetForLevel(
  level: number,
  cfg: AgencyLevelsRuntimeConfig = resolveAgencyLevelsConfig(),
): number {
  if (level <= 0) return 0;
  const exact = cfg.levels.find((l) => l.level === level);
  if (exact) return exact.supportTarget;

  const sorted = cfg.levels;
  if (sorted.length === 0) return 0;
  const last = sorted[sorted.length - 1]!;
  if (level <= last.level) {
    let prev = 0;
    for (const def of sorted) {
      if (def.level === level) return def.supportTarget;
      if (def.level < level) prev = def.supportTarget;
    }
    return prev;
  }

  const step = cfg.extendStepCoins;
  return last.supportTarget + (level - last.level) * step;
}

export function computeAgencyLevel(
  supportCoins: number,
  cfg: AgencyLevelsRuntimeConfig = resolveAgencyLevelsConfig(),
): number {
  const total = Math.max(0, Number(supportCoins) || 0);
  const sorted = cfg.levels;
  if (sorted.length === 0) return 0;

  let level = 0;
  for (const def of sorted) {
    if (total >= def.supportTarget) level = def.level;
    else break;
  }

  const last = sorted[sorted.length - 1]!;
  if (total > last.supportTarget && cfg.extendStepCoins > 0) {
    const extra = Math.floor((total - last.supportTarget) / cfg.extendStepCoins);
    level = Math.max(level, last.level + extra);
  }

  return level;
}

export interface AgencyLevelProgress {
  level: number;
  supportCoins: number;
  currentTarget: number;
  nextLevel: number | null;
  nextTarget: number | null;
  remainingCoins: number;
  progressRatio: number;
}

export function getAgencyLevelProgress(
  supportCoins: number,
  cfg: AgencyLevelsRuntimeConfig = resolveAgencyLevelsConfig(),
): AgencyLevelProgress {
  const total = Math.max(0, Number(supportCoins) || 0);
  const level = computeAgencyLevel(total, cfg);
  const currentTarget = getSupportTargetForLevel(level, cfg);
  const nextLevel = level > 0 ? level + 1 : 1;
  const nextTarget = getSupportTargetForLevel(nextLevel, cfg);
  const span = Math.max(1, nextTarget - currentTarget);
  const progressRatio = Math.min(1, Math.max(0, (total - currentTarget) / span));
  const remainingCoins = Math.max(0, nextTarget - total);

  return {
    level,
    supportCoins: total,
    currentTarget,
    nextLevel,
    nextTarget,
    remainingCoins,
    progressRatio,
  };
}

/** فهرس المستوى النشط — يحترم التعديل اليدوي من لوحة التحكم */
export function resolveAgencyPeriodLevelIndex(
  supportCoins: number,
  manualLevel?: number,
  manual?: boolean,
  cfg: AgencyLevelsRuntimeConfig = resolveAgencyLevelsConfig(),
): number {
  if (manual === true) {
    const lv = Number(manualLevel);
    if (lv >= 1) {
      const idx = cfg.levels.findIndex((l) => l.level === lv);
      if (idx >= 0) return idx;
      const maxLv = cfg.levels[cfg.levels.length - 1]?.level ?? 0;
      if (lv <= maxLv + 100) return cfg.levels.length - 1;
    }
  }

  const computed = computeAgencyLevel(supportCoins, cfg);
  if (computed <= 0) return -1;

  let idx = -1;
  for (let i = cfg.levels.length - 1; i >= 0; i--) {
    const lvl = cfg.levels[i];
    if (lvl && computed >= lvl.level) {
      idx = i;
      break;
    }
  }
  return idx >= 0 ? idx : cfg.levels.length - 1;
}

/** شارة مستوى الوكالة (مثل "LV9") من حقول وثيقة الوكالة — يحترم التثبيت اليدوي من لوحة التحكم */
export function resolveAgencyLevelLabelFromFields(
  lifetimeSupportCoins: number | undefined,
  periodLevel: number | undefined,
  periodLevelManual: boolean | undefined,
  cfg: AgencyLevelsRuntimeConfig = resolveAgencyLevelsConfig(),
): string | undefined {
  const coins = Math.max(0, Number(lifetimeSupportCoins) || 0);
  const idx = resolveAgencyPeriodLevelIndex(coins, periodLevel, periodLevelManual, cfg);
  const level = idx >= 0 ? cfg.levels[idx]?.level ?? 0 : 0;
  return level >= 1 ? `LV${level}` : undefined;
}

export function isAgencyThroneUnlockedByLevel(
  level: number | null | undefined,
  cfg: AgencyLevelsRuntimeConfig = resolveAgencyLevelsConfig(),
): boolean {
  return Number(level) >= cfg.throneUnlockLevel;
}

export function getAgencyLevelDef(
  level: number,
  cfg: AgencyLevelsRuntimeConfig = resolveAgencyLevelsConfig(),
): AgencyLevelDef | undefined {
  const target = getSupportTargetForLevel(level, cfg);
  if (target <= 0) return undefined;
  const found = cfg.levels.find((l) => l.level === level);
  if (found) return found;
  return {
    level,
    supportTarget: target,
    hostTarget: target,
    managerBonus: bonusForTarget(target),
  };
}
