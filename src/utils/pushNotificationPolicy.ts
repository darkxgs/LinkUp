/**
 * سياسة إظهار Push على الجهاز — الرسائل والتفاعلات داخل شاشة الإشعارات فقط
 */
export function shouldShowPushBanner(
  type: string,
  data?: Record<string, unknown>,
): boolean {
  const raw = data ?? {};
  const dataType =
    typeof raw.type === 'string' && raw.type.length > 0
      ? raw.type
      : typeof raw.notifType === 'string' && raw.notifType.length > 0
        ? raw.notifType
        : type;

  if (type === 'vip_status' || dataType === 'vip_status') return false;
  if (type === 'incoming_call' || dataType === 'incoming_call') return true;
  if (type === 'moderation' || dataType === 'moderation') return true;
  if (type === 'system' || dataType === 'system') return true;
  // الرسائل المباشرة + التفاعلات الاجتماعية تُظهر Push أيضاً (قرار المالك) —
  // الكتم لكل نوع يبقى محكوماً بتفضيلات المستخدم على السيرفر
  const social = ['message', 'gift', 'like', 'comment', 'mention', 'follow', 'room_invite'];
  if (social.includes(type) || social.includes(dataType)) return true;
  return false;
}
