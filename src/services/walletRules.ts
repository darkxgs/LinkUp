/**
 * قواعد المحفظة — سحب وتحويل (تُقرأ من config/settings)
 */
import type { AppSettings } from './firebase/config';
import { DEFAULT_SETTINGS } from './firebase/config';

export const DEFAULT_HOST_WITHDRAW_AMOUNTS = [10, 20, 40, 70, 100, 140, 200];
export const DEFAULT_AGENT_WITHDRAW_AMOUNTS = [20, 55, 90, 130, 210, 300, 400, 510, 900];

export type WalletRules = {
  minHostWithdraw: number;
  minAgentWithdraw: number;
  hostWithdrawAmounts: number[];
  agentWithdrawAmounts: number[];
  allowCustomHostWithdraw: boolean;
  allowCustomAgentWithdraw: boolean;
  hostAgentWithdrawWeekDays: number[];
  hostSelfWithdrawAnytime: boolean;
  agentWithdrawCooldownDays: number;
  agentBatchDivisor: number;
  coinsToPearlsRate: number;
  casinoToCoinsRate: number;
  selfWithdrawCommission: number;
  agentWithdrawCommission: number;
  pearlUsdRate: number;
};

export function parseWalletRules(raw?: Partial<AppSettings> | null): WalletRules {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  return {
    minHostWithdraw: s.minHostWithdraw ?? s.minWithdraw ?? 10,
    minAgentWithdraw: s.minAgentWithdraw ?? s.minWithdraw ?? 10,
    hostWithdrawAmounts:
      Array.isArray(s.hostWithdrawAmounts) && s.hostWithdrawAmounts.length
        ? s.hostWithdrawAmounts.map(Number).filter((n) => n > 0)
        : DEFAULT_HOST_WITHDRAW_AMOUNTS,
    agentWithdrawAmounts:
      Array.isArray(s.agentWithdrawAmounts) && s.agentWithdrawAmounts.length
        ? s.agentWithdrawAmounts.map(Number).filter((n) => n > 0)
        : DEFAULT_AGENT_WITHDRAW_AMOUNTS,
    allowCustomHostWithdraw: s.allowCustomHostWithdraw !== false,
    allowCustomAgentWithdraw: s.allowCustomAgentWithdraw !== false,
    hostAgentWithdrawWeekDays:
      Array.isArray(s.hostAgentWithdrawWeekDays) && s.hostAgentWithdrawWeekDays.length
        ? s.hostAgentWithdrawWeekDays.map(Number)
        : [6],
    hostSelfWithdrawAnytime: s.hostSelfWithdrawAnytime !== false,
    agentWithdrawCooldownDays: s.agentWithdrawCooldownDays ?? 30,
    agentBatchDivisor: Math.max(1, s.agentBatchDivisor ?? 5),
    coinsToPearlsRate: s.coinsToPearlsRate,
    casinoToCoinsRate: s.casinoToCoinsRate,
    selfWithdrawCommission: s.selfWithdrawCommission,
    agentWithdrawCommission: s.agentWithdrawCommission,
    pearlUsdRate: s.pearlUsdRate ?? 1000,
  };
}

/** هل اليوم مسموح للمضيفة بالسحب عبر الوكيل؟ */
export function isHostAgentWithdrawDayAllowed(rules: WalletRules, date = new Date()): boolean {
  const day = date.getDay();
  return rules.hostAgentWithdrawWeekDays.includes(day);
}

export function validateHostWithdrawAmount(
  amount: number,
  rules: WalletRules,
  opts?: { allowCustom?: boolean },
): string | null {
  const amt = Math.floor(amount);
  if (amt < rules.minHostWithdraw) {
    return `الحد الأدنى للسحب ${rules.minHostWithdraw} ماسة`;
  }
  const inPresets = rules.hostWithdrawAmounts.includes(amt);
  const customOk = (opts?.allowCustom ?? rules.allowCustomHostWithdraw) && amt >= rules.minHostWithdraw;
  if (!inPresets && !customOk) {
    return `اختر مبلغاً من القائمة: ${rules.hostWithdrawAmounts.join('، ')} ماسة`;
  }
  return null;
}

export function validateAgentSelfWithdrawAmount(
  amount: number,
  rules: WalletRules,
): string | null {
  const amt = Math.floor(amount);
  if (amt < rules.minAgentWithdraw) {
    return `الحد الأدنى للسحب ${rules.minAgentWithdraw} ماسة`;
  }
  if (amt % rules.agentBatchDivisor !== 0) {
    return `يجب أن يكون المبلغ من مضاعفات ${rules.agentBatchDivisor}`;
  }
  const inPresets = rules.agentWithdrawAmounts.includes(amt);
  if (!inPresets && !rules.allowCustomAgentWithdraw) {
    return `اختر مبلغاً من القائمة: ${rules.agentWithdrawAmounts.join('، ')} ماسة`;
  }
  return null;
}

export async function getAgentWithdrawCooldownRemainingMs(
  uid: string,
  cooldownDays: number,
  fetchLastSelfWithdraw: (uid: string) => Promise<number | null>,
): Promise<number> {
  const last = await fetchLastSelfWithdraw(uid);
  if (!last) return 0;
  const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - last;
  return Math.max(0, cooldownMs - elapsed);
}
