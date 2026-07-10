/**
 * إشعارات SVIP — تذكير بالحفاظ، انتهاء الباقة، تهنئة بالشحن
 * تُنشئ مستنداً في notifications → يُرسل Push تلقائياً عبر Cloud Function
 */
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { firestore } from './index';
import { createNotification } from './notifications';
import {
  getVipSystemOnce,
  levelDefFor,
  pointsToMaintain,
  type VipSystemConfig,
} from './vipSystem';
import i18n from '@/localization/i18n';

export type VipNotifyScenario =
  | 'maintain_reminder'
  | 'expiry_warning'
  | 'downgrade_warning'
  | 'recharge_success';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function sendVipNotifOnce(
  uid: string,
  dedupeKey: string,
  title: string,
  body: string,
  scenario: VipNotifyScenario,
  route = '/wallet/recharge',
  period: 'day' | 'month' = 'day',
): Promise<boolean> {
  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return false;

  const log = (snap.data().vipNotifLog ?? {}) as Record<string, number>;
  const fullKey = period === 'month' ? `${dedupeKey}_${monthKey()}` : `${dedupeKey}_${todayKey()}`;
  if (log[fullKey]) return false;

  await createNotification({
    uid,
    type: 'system',
    message: body === title ? title : `${title}\n${body}`,
    data: {
      type: 'vip_status',
      scenario,
      title,
      body,
      route,
    },
  });

  await updateDoc(userRef, {
    [`vipNotifLog.${fullKey}`]: Date.now(),
    updatedAt: Date.now(),
  });
  return true;
}

/** تهنئة عند كل شحن ناجح للمشترك SVIP */
export async function notifyVipRechargeSuccess(uid: string, levelLabel: string): Promise<void> {
  const title = i18n.t('vipNotify.rechargeSuccessTitle');
  const body = i18n.t('vipNotify.rechargeSuccessBody', { level: levelLabel });
  await createNotification({
    uid,
    type: 'system',
    message: `${title}\n${body}`,
    data: {
      type: 'vip_status',
      scenario: 'recharge_success',
      title,
      body,
      route: '/vip',
    },
  });
}

/** إشعار «الحفاظ على المستوى» — تمديد صلاحية، ليس عملية شحن/شراء */
export async function notifyVipMaintainSuccess(uid: string, levelLabel: string): Promise<void> {
  const title = i18n.t('vipNotify.maintainSuccessTitle', 'تم الحفاظ على مستواك ✨');
  const body = i18n.t('vipNotify.maintainSuccessBody', {
    level: levelLabel,
    defaultValue: `تم تمديد صلاحية ${levelLabel} — واصل جمع النقاط للحفاظ عليه الشهر القادم.`,
  });
  await createNotification({
    uid,
    type: 'system',
    message: `${title}\n${body}`,
    data: {
      type: 'vip_status',
      scenario: 'maintain_success',
      title,
      body,
      route: '/vip',
    },
  });
}

export type VipReminderState = {
  show: boolean;
  daysLeft: number | null;
  levelLabel: string;
  remaining: number;
  required: number;
  downgradeLabel: string;
  kind: 'expiry' | 'maintain' | null;
};

export function computeVipReminderState(
  data: Record<string, unknown>,
  config: VipSystemConfig,
): VipReminderState {
  const empty: VipReminderState = {
    show: false,
    daysLeft: null,
    levelLabel: '',
    remaining: 0,
    required: 0,
    downgradeLabel: 'SVIP1',
    kind: null,
  };

  const level = Number(data.vipLevel ?? 0);
  if (level < 1) return empty;

  const def = levelDefFor(level, config.levels);
  if (!def) return empty;

  const expires = data.vipExpiresAt != null ? Number(data.vipExpiresAt) : null;
  const now = Date.now();
  const warningDays = config.expiryWarningDays ?? 5;
  const daysUntilExpiry = expires ? Math.ceil((expires - now) / 86400000) : null;

  const maintain = pointsToMaintain(
    level,
    Number(data.vipPointsMonth ?? 0),
    config.levels,
    data.vipMonthKey as string | undefined,
  );

  const downgradeLabel =
    levelDefFor(config.downgradeToLevel ?? 1, config.levels)?.label ?? 'SVIP1';

  if (
    daysUntilExpiry !== null
    && daysUntilExpiry > 0
    && daysUntilExpiry <= warningDays
    && !maintain.canMaintain
  ) {
    return {
      show: true,
      daysLeft: daysUntilExpiry,
      levelLabel: def.label,
      remaining: maintain.remaining,
      required: maintain.required,
      downgradeLabel,
      kind: 'expiry',
    };
  }

  if (level >= 1 && !maintain.canMaintain && maintain.remaining > 0) {
    return {
      show: true,
      daysLeft: daysUntilExpiry,
      levelLabel: def.label,
      remaining: maintain.remaining,
      required: maintain.required,
      downgradeLabel,
      kind: 'maintain',
    };
  }

  return empty;
}

/** فحص وإرسال تذكيرات يومية (داخل التطبيق + Push) */
export async function processVipReminderNotifications(uid: string): Promise<void> {
  const config = await getVipSystemOnce();
  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const data = snap.data() as Record<string, unknown>;
  const state = computeVipReminderState(data, config);
  if (!state.show) return;

  const downgradeLabel = state.downgradeLabel;

  if (state.kind === 'expiry' && state.daysLeft != null) {
    await sendVipNotifOnce(
      uid,
      'expiry_warning',
      i18n.t('vipNotify.expiryTitle'),
      i18n.t('vipNotify.expiryBody', {
        days: state.daysLeft,
        level: state.levelLabel,
      }),
      'expiry_warning',
      '/wallet/recharge',
    );
    return;
  }

  if (state.kind === 'maintain') {
    await sendVipNotifOnce(
      uid,
      'maintain_reminder',
      i18n.t('vipNotify.maintainTitle'),
      i18n.t('vipNotify.maintainBody', {
        count: state.remaining,
        level: state.levelLabel,
        downgrade: downgradeLabel,
      }),
      'maintain_reminder',
      '/wallet/recharge',
    );

    const d = new Date();
    const daysLeftInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate();
    if (daysLeftInMonth <= 3) {
      await sendVipNotifOnce(
        uid,
        'downgrade_warning',
        i18n.t('vipNotify.downgradeTitle'),
        i18n.t('vipNotify.downgradeBody', {
          level: state.levelLabel,
          downgrade: downgradeLabel,
        }),
        'downgrade_warning',
        '/wallet/recharge',
        'month',
      );
    }
  }
}
