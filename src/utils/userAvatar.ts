import { getDefaultAvatar, type ProfileGender } from '@/constants/defaultAvatars';

type UserDocLike = Record<string, unknown> | undefined;

function profileOf(data: UserDocLike) {
  return data?.profile as
    | { avatar?: string; photos?: string[]; gender?: string }
    | undefined;
}

function firstPhoto(data: UserDocLike, profile: ReturnType<typeof profileOf>): string {
  const top = Array.isArray(data?.photos) ? (data!.photos as string[]) : [];
  const nested = profile?.photos ?? [];
  return top[0]?.trim() || nested[0]?.trim() || '';
}

/** صورة البروفايل الرسمية — avatar أولاً، الألبوم احتياط فقط */
export function resolveOfficialUserAvatar(data: UserDocLike, uid?: string): string {
  const profile = profileOf(data);
  const topAvatar = typeof data?.avatar === 'string' ? data.avatar.trim() : '';
  const nestedAvatar = profile?.avatar?.trim() || '';
  const albumPhoto = firstPhoto(data, profile);
  const url = topAvatar || nestedAvatar || albumPhoto;
  if (url) return url;

  const gender: ProfileGender =
    profile?.gender === 'female' || data?.gender === 'female' ? 'female' : 'male';
  return getDefaultAvatar(gender, uid ?? 'unknown');
}

/** للاكتشاف/المطابقة — يُفضّل صورة الألبوم للعرض الجذاب */
export function resolveDiscoverCardPhoto(data: UserDocLike, uid?: string): string {
  const profile = profileOf(data);
  const albumPhoto = firstPhoto(data, profile);
  const topAvatar = typeof data?.avatar === 'string' ? data.avatar.trim() : '';
  const nestedAvatar = profile?.avatar?.trim() || '';
  const url = albumPhoto || topAvatar || nestedAvatar;
  if (url) return url;

  const gender: ProfileGender =
    profile?.gender === 'female' || data?.gender === 'female' ? 'female' : 'male';
  return getDefaultAvatar(gender, uid ?? 'unknown');
}

/** صورة البروفايل من وثيقة users — للشات والغرف والإشعارات */
export function resolveUserDocAvatar(data: UserDocLike, uid?: string): string {
  return resolveOfficialUserAvatar(data, uid);
}

/** صورة الطرف الآخر في قائمة المحادثات — وثيقة users ثم المحادثة ثم افتراضي */
export function resolveConversationPeerAvatar(
  conv: { participantAvatars?: Record<string, string> },
  otherUid: string,
  userDoc?: UserDocLike,
): string {
  const fromUser = userDoc ? resolveUserDocAvatar(userDoc, otherUid).trim() : '';
  const stored = conv.participantAvatars?.[otherUid]?.trim() ?? '';
  if (fromUser && !stored) return fromUser;
  if (stored && !fromUser) return stored;
  if (fromUser && stored) {
    // تفضيل رابط حقيقي (Firebase/ألبوم) على dicebear المخزّن قديماً
    const fromUserIsDefault = fromUser.includes('dicebear.com');
    const storedIsDefault = stored.includes('dicebear.com');
    if (!fromUserIsDefault) return fromUser;
    if (!storedIsDefault) return stored;
    return fromUser;
  }
  return resolveUserDocAvatar(undefined, otherUid);
}

/** fromAvatar المحفوظ في الإشعار (قد يكون في data أيضاً) */
export function resolveNotificationStoredAvatar(notif: {
  fromAvatar?: string;
  fromUid?: string;
  data?: Record<string, unknown>;
}): string | undefined {
  const direct = notif.fromAvatar?.trim();
  if (direct) return direct;

  const data = notif.data ?? {};
  if (typeof data.fromAvatar === 'string' && data.fromAvatar.trim()) {
    return data.fromAvatar.trim();
  }
  if (typeof data.avatar === 'string' && data.avatar.trim()) {
    return data.avatar.trim();
  }
  return undefined;
}

/** صورة العرض النهائية — مخزّنة، أو من جلب Firestore، أو افتراضية حتمية */
export function resolveNotificationAvatar(
  notif: { fromAvatar?: string; fromUid?: string; data?: Record<string, unknown> },
  fetchedByUid: Record<string, string>,
): string | undefined {
  const stored = resolveNotificationStoredAvatar(notif);
  if (stored) return stored;

  const uid = notif.fromUid;
  if (!uid) return undefined;
  if (fetchedByUid[uid]) return fetchedByUid[uid];
  return getDefaultAvatar('male', uid);
}
