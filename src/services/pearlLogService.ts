/**
 * سجل الماسة — جلب المعاملات عبر Cloud Function
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase/index';

export type PearlLogTab = 'income' | 'review' | 'audit' | 'withdraw' | 'refund';
export type PearlLogPeriod = 0 | 7 | 30 | 90;

export interface PearlLogItem {
  id: string;
  source: 'transaction' | 'withdrawal';
  uid: string;
  type: string;
  amount: number;
  currency: string;
  status?: string;
  createdAt: number;
  fromName?: string;
  toName?: string;
  itemName?: string;
  withdrawalId?: string;
  commission?: number;
  netAmount?: number;
}

export const fetchPearlLog = async (
  tab: PearlLogTab,
  periodDays: PearlLogPeriod = 0,
): Promise<PearlLogItem[]> => {
  const fn = httpsCallable<
    { tab: PearlLogTab; periodDays: number },
    { items: PearlLogItem[] }
  >(functions, 'listPearlLog');
  const res = await fn({ tab, periodDays });
  return (res.data.items ?? []) as PearlLogItem[];
};
