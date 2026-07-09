import {
  isBroadcastNotification,
  type Notification,
} from '@/services/firebase/notifications';

/** تبويبات شاشة الإشعارات */
export type NotificationFilterTab = 'posts' | 'follow' | 'messages' | 'system' | 'casino';

export const NOTIFICATION_FILTER_TABS: NotificationFilterTab[] = [
  'posts',
  'follow',
  'messages',
  'casino',
  'system',
];

const SYSTEM_NOTIF_TYPES = new Set(['system', 'moderation']);
const POST_NOTIF_TYPES = new Set(['like', 'comment', 'mention', 'gift', 'post']);
const FOLLOW_NOTIF_TYPES = new Set(['follow']);
const MESSAGE_NOTIF_TYPES = new Set(['message', 'room_invite']);

export const SYSTEM_DATA_TYPES = new Set([
  'admin_recharge',
  'report_update',
  'broadcast',
  'agency_application_approved',
  'agency_application_rejected',
  'agency_application_expired',
  'agency_application_ready',
  'agency_host_invite',
  'agency_host_joined',
  'agency_needs_verification',
  'vip_status',
  'withdrawal_status',
  'incoming_call',
  'kyc_pending',
  'kyc_rejected',
  'kyc_approved',
]);

export function resolveNotificationEffectiveType(notif: Notification): string {
  const dataType = notif.data?.type;
  if (typeof dataType === 'string' && dataType.length > 0) return dataType;
  return notif.type;
}

export function isSystemNotification(notif: Notification): boolean {
  return categorizeNotification(notif) === 'system';
}

/** تصنيف الإشعار حسب السيناريو */
export function categorizeNotification(notif: Notification): NotificationFilterTab {
  if (isBroadcastNotification(notif) || notif.data?.broadcastId) {
    return 'system';
  }

  const effectiveType = resolveNotificationEffectiveType(notif);

  if (SYSTEM_NOTIF_TYPES.has(notif.type)) return 'system';
  if (SYSTEM_DATA_TYPES.has(effectiveType)) return 'system';

  if (MESSAGE_NOTIF_TYPES.has(notif.type)) return 'messages';

  if (FOLLOW_NOTIF_TYPES.has(notif.type) || effectiveType === 'follow') {
    return 'follow';
  }

  if (POST_NOTIF_TYPES.has(notif.type)) return 'posts';

  return 'system';
}

export function filterNotificationsByTab(
  items: Notification[],
  tab: NotificationFilterTab,
): Notification[] {
  return items.filter((n) => {
    if (categorizeNotification(n) !== tab) return false;
    // رسائل شات مقروءة — لا تُعرض في تبويب الرسائل
    if (tab === 'messages' && n.type === 'message' && n.isRead) return false;
    return true;
  });
}

export function countUnreadInTab(
  items: Notification[],
  tab: NotificationFilterTab,
): number {
  return filterNotificationsByTab(items, tab).filter((n) => !n.isRead).length;
}
