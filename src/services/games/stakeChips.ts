import type { GameConfig, GamesGlobalEconomy } from '@/services/firebase/gamesConfig';

/** شرائح الدخولية الافتراضية لألعاب الذكاء */
export const INTELLIGENCE_STAKE_CHIPS = [5000, 10000, 25000, 50000] as const;

export function filterStakeChips(chips: number[], minBet: number, maxBet: number): number[] {
  const min = Math.max(1, Number(minBet) || 1);
  const max = Math.max(min, Number(maxBet) || min);
  const list = (chips || []).filter((v) => v >= min && v <= max);
  return list.length > 0 ? list : [min];
}

export function getIntelligenceStakeOptions(
  global: GamesGlobalEconomy,
  cfg: GameConfig,
): number[] {
  const chips = global.intelligenceStakeChips?.filter((n) => n > 0) ?? [];
  const source = chips.length ? chips : [...INTELLIGENCE_STAKE_CHIPS];
  return filterStakeChips(source, cfg.minBet, cfg.maxBet);
}

export function getIntelligenceBetLimits(cfg?: GameConfig): { minBet: number; maxBet: number } {
  const minBet = Math.max(5000, cfg?.minBet ?? 5000);
  const maxBet = Math.min(50000, Math.max(minBet, cfg?.maxBet ?? 50000));
  return { minBet, maxBet };
}

export function getChallengeStakeOptions(global: GamesGlobalEconomy, cfg: GameConfig): number[] {
  return filterStakeChips(global.challengeStakeChips, cfg.minBet, cfg.maxBet);
}

export function assertStakeAllowed(
  stake: number,
  cfg: GameConfig,
  chips: number[],
): { valid: boolean; reason?: string } {
  if (stake <= 0) return { valid: false, reason: 'قيمة الدخولية غير صالحة' };
  if (stake < cfg.minBet) {
    return { valid: false, reason: `أقل دخولية مسموحة: ${cfg.minBet.toLocaleString()} كوين` };
  }
  if (stake > cfg.maxBet) {
    return { valid: false, reason: `أقصى دخولية مسموحة: ${cfg.maxBet.toLocaleString()} كوين` };
  }
  if (chips.length > 0 && !chips.includes(stake)) {
    return { valid: false, reason: 'اختر إحدى فئات الدخولية المعتمدة' };
  }
  return { valid: true };
}

export const CHALLENGE_CONFIG_GAME_IDS: Record<string, string> = {
  penalty: 'penalty-kicks',
  'coin-flip': 'coin-challenge',
  billiards: 'pool',
};
