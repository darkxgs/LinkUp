/**
 * مكافأة أول شحن — 50,000 كوين للحساب العادي
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from './index';

export const FIRST_RECHARGE_BONUS_COINS = 50_000;

export function isRegularAccount(data: {
  isAgent?: boolean;
  isFemaleHost?: boolean;
  agencyRole?: string | null;
  isOfficial?: boolean;
  isRechargeBot?: boolean;
  isSupport?: boolean;
}): boolean {
  if (data.isAgent === true) return false;
  if (data.isFemaleHost === true) return false;
  const role = data.agencyRole;
  if (role === 'owner' || role === 'host' || role === 'agent') return false;
  if (data.isOfficial === true || data.isRechargeBot === true || data.isSupport === true) {
    return false;
  }
  return true;
}

export async function tryGrantFirstRechargeBonus(
  targetUid?: string,
): Promise<{ bonus: number; granted: boolean }> {
  try {
    const fn = httpsCallable<{ targetUid?: string }, { bonus?: number; granted?: boolean }>(
      functions,
      'tryFirstRechargeBonus',
    );
    const { data } = await fn(targetUid ? { targetUid } : {});
    const bonus = Math.max(0, Math.floor(Number(data?.bonus) || 0));
    return { bonus, granted: bonus > 0 || data?.granted === true };
  } catch (e) {
    console.warn('tryFirstRechargeBonus:', e);
    return { bonus: 0, granted: false };
  }
}
