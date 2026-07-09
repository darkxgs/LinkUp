/**
 * توجيه موحّد عند الضغط على إشعار (inbox أو Push)
 */
import { getChallengeAppRoute } from '@/utils/challengeDeepLink';

export interface NotificationRouteInput {
  type?: string;
  notifType?: string;
  fromUid?: string;
  route?: string;
  message?: string;
  data?: Record<string, unknown>;
}

const KYC_NOTIFICATION_TYPES = new Set([
  'kyc_pending',
  'kyc_rejected',
  'kyc_approved',
  'kyc',
  'identity_verification',
  'agency_needs_verification',
]);

/** إشعار يتعلق بالتحقق من الهوية / KYC */
export function isIdentityVerificationNotification(input: NotificationRouteInput): boolean {
  const data = input.data ?? {};
  const scenario = typeof data.scenario === 'string' ? data.scenario : '';
  if (scenario === 'verification_required') return true;

  const dataType = typeof data.type === 'string' && data.type.length > 0 ? data.type : '';
  const type = dataType || input.notifType || input.type || '';
  if (KYC_NOTIFICATION_TYPES.has(type)) return true;

  const title = String(data.title ?? '');
  const body = String(data.body ?? '');
  const message = String(input.message ?? data.message ?? '');
  const text = `${title} ${body} ${message}`;
  return (
    text.includes('التحقق من الهوية') ||
    text.includes('التحقق مطلوب') ||
    text.includes('إكمال التحقق') ||
    text.includes('إكمال توثيق') ||
    text.includes('توثيق الحساب') ||
    text.includes('مركز التحقق')
  );
}

export function resolveNotificationRoute(input: NotificationRouteInput): string {
  if (typeof input.route === 'string' && input.route.startsWith('/')) {
    return input.route;
  }

  const data = input.data ?? {};
  if (typeof data.route === 'string' && data.route.startsWith('/')) {
    return data.route;
  }

  if (isIdentityVerificationNotification(input)) return '/wallet/kyc';

  const dataType = typeof data.type === 'string' && data.type.length > 0 ? data.type : '';
  const type = dataType || input.notifType || input.type || '';

  const scenario = typeof data.scenario === 'string' ? data.scenario : undefined;
  const fromUid =
    input.fromUid ??
    (typeof data.fromUid === 'string' ? data.fromUid : undefined);
  const postId = typeof data.postId === 'string' ? data.postId : undefined;
  const roomId = typeof data.roomId === 'string' ? data.roomId : undefined;

  if (type === 'incoming_call') return '/notifications';

  if (type === 'agency_application_approved' || type === 'agency_application_ready') {
    return '/agency/center';
  }
  if (type === 'agency_host_invite') return '/agency/my-invites';
  if (type === 'agency_host_joined') return '/agency/members';
  if (type === 'agency_application_expired' || type === 'agency_application_rejected') {
    return '/agency/center';
  }

  if (scenario === 'withdrawal_blocked' || scenario === 'withdrawal_unblocked') {
    return '/wallet/pearl-wallet';
  }
  if (type === 'withdrawal_status') return '/wallet/pearl-log';
  if (type === 'moderation' || input.type === 'moderation') {
    if (scenario === 'account_banned') return '/support';
    return '/notifications';
  }

  if (type === 'vip_status') {
    if (scenario === 'recharge_success') return '/vip';
    return '/wallet/recharge';
  }
  if (type === 'admin_recharge') return '/wallet';
  if (type === 'report_update') {
    const reportId = typeof data.reportId === 'string' ? data.reportId : undefined;
    if (reportId) return `/report/${reportId}`;
    return '/report/my';
  }
  if (type === 'broadcast' || data.broadcastId) return '/notifications';

  if (type === 'message' && fromUid) return `/chat/${fromUid}`;
  if ((type === 'like' || type === 'comment' || type === 'mention' || type === 'post') && postId) {
    return `/post/${postId}`;
  }
  if (type === 'gift' && postId) return `/post/${postId}`;
  if (type === 'gift' && typeof data.route === 'string' && data.route.startsWith('/store')) {
    return data.route;
  }
  if (type === 'follow' && fromUid) return `/profile/${fromUid}`;
  if (type === 'gift' && fromUid) return `/chat/${fromUid}`;
  if (type === 'visit') return '/visitors';
  if (type === 'room_invite' && roomId) return `/room/${roomId}`;
  if (type === 'mic_invite' && roomId) return `/room/${roomId}`;

  const challengeId =
    typeof data.challengeId === 'string'
      ? data.challengeId
      : typeof data.inviteChallengeId === 'string'
        ? data.inviteChallengeId
        : undefined;
  if (type === 'game_challenge' && challengeId) {
    if (fromUid) return `/chat/${fromUid}`;
    return getChallengeAppRoute(challengeId);
  }
  if (type === 'game_invite' && challengeId) {
    return getChallengeAppRoute(challengeId);
  }

  return '/notifications';
}

/** تحويل بيانات Push (كل القيم نصوص) إلى مدخلات التوجيه */
export function routeInputFromPushData(
  data: Record<string, string | undefined>,
): NotificationRouteInput {
  return {
    type: data.type,
    notifType: data.notifType,
    fromUid: data.fromUid,
    route: data.route,
    data: {
      type: data.notifType ?? data.type,
      scenario: data.scenario,
      postId: data.postId,
      roomId: data.roomId,
      broadcastId: data.broadcastId,
      reportId: data.reportId,
      fromUid: data.fromUid,
      conversationId: data.conversationId,
      challengeId: data.challengeId ?? data.inviteChallengeId,
      inviteChallengeId: data.inviteChallengeId ?? data.challengeId,
      title: data.title,
      body: data.body,
      message: data.message,
      route: data.route,
      itemType: data.itemType,
      itemId: data.itemId,
      itemName: data.itemName,
    },
  };
}
