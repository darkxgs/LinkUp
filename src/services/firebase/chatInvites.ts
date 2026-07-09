/**
 * دعوات الغرفة والوكالة داخل المحادثات
 */
import { addDoc, collection, doc, increment, updateDoc } from 'firebase/firestore';
import { firestore, auth } from './index';
import { getUser } from './users';
import { isBlockedBetween } from './blocks';
import { resolveDisplayName } from '@/utils/displayName';
import { createNotification } from './notifications';
import { createRoomShareMessage, createPartyShareMessage, getLocalPartyShareFallback, createPostShareMessage, getLocalPostShareFallback } from './shareLinks';
import { buildConversationUnhidePatchForBoth } from './chat';

export interface RoomInviteChatPayload {
  roomId: string;
  roomName: string;
  shortUrl?: string;
  deepLink?: string;
}

export interface AgencyInviteChatPayload {
  agencyId: string;
  agencyName: string;
}

export interface PartyInviteChatPayload {
  partyId: string;
  roomId: string;
  partyTitle: string;
  agencyName?: string;
  shortUrl?: string;
  deepLink?: string;
}

async function writeInviteMessage(
  conversationId: string,
  toUid: string,
  data: Record<string, unknown>,
  lastPreview: string,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');
  if (await isBlockedBetween(user.uid, toUid)) {
    throw new Error('BLOCKED');
  }

  await addDoc(collection(firestore, 'messages'), {
    conversationId,
    fromUid: user.uid,
    toUid,
    createdAt: Date.now(),
    isRead: false,
    ...data,
  });

  const now = Date.now();
  await updateDoc(doc(firestore, 'conversations', conversationId), {
    lastMessage: lastPreview,
    lastMessageAt: now,
    [`unreadBy.${toUid}`]: increment(1),
    ...buildConversationUnhidePatchForBoth(user.uid, toUid),
  });
}

/** دعوة انضمام لغرفة صوتية داخل المحادثة */
export async function sendRoomInviteChatMessage(
  conversationId: string,
  toUid: string,
  payload: RoomInviteChatPayload,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  let shortUrl = payload.shortUrl;
  let deepLink = payload.deepLink;
  if (!shortUrl) {
    try {
      const share = await createRoomShareMessage(payload.roomId, payload.roomName);
      shortUrl = share.shortUrl;
      deepLink = share.deepLink;
    } catch {
      shortUrl = `linkup://room/${payload.roomId}`;
    }
  }

  const preview = `🎙️ دعوة للانضمام إلى غرفة "${payload.roomName}"`;
  await writeInviteMessage(conversationId, toUid, {
    type: 'room_invite',
    text: preview,
    inviteRoomId: payload.roomId,
    inviteRoomName: payload.roomName,
    inviteShortUrl: shortUrl ?? '',
    inviteDeepLink: deepLink ?? '',
  }, preview);

  const me = await getUser(user.uid);
  const fromName = resolveDisplayName({ displayName: me?.displayName });
  await createNotification({
    uid: toUid,
    type: 'room_invite',
    fromUid: user.uid,
    fromName,
    fromAvatar: me?.avatar,
    message: `دعاك ${fromName} للانضمام إلى غرفة "${payload.roomName}"`,
    data: { roomId: payload.roomId, conversationId },
  });

  const { notifyChatMessage } = await import('./activityNotifications');
  void notifyChatMessage(toUid, conversationId, preview);
}

/** دعوة حفل/احتفال وكالة داخل المحادثة */
export async function sendPartyInviteChatMessage(
  conversationId: string,
  toUid: string,
  payload: PartyInviteChatPayload,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  let shortUrl = payload.shortUrl;
  let deepLink = payload.deepLink;
  if (!shortUrl) {
    try {
      const share = await createPartyShareMessage(
        payload.partyId,
        payload.partyTitle,
        payload.agencyName,
      );
      shortUrl = share.shortUrl;
      deepLink = share.deepLink;
    } catch {
      const fallback = getLocalPartyShareFallback(
        payload.partyId,
        payload.partyTitle,
        payload.roomId,
      );
      shortUrl = fallback.shortUrl;
      deepLink = fallback.deepLink;
    }
  }

  const preview = `🎉 دعوة لحفل "${payload.partyTitle}"`;
  await writeInviteMessage(conversationId, toUid, {
    type: 'party_invite',
    text: preview,
    invitePartyId: payload.partyId,
    inviteRoomId: payload.roomId,
    invitePartyTitle: payload.partyTitle,
    inviteAgencyName: payload.agencyName ?? '',
    inviteShortUrl: shortUrl ?? '',
    inviteDeepLink: deepLink ?? '',
  }, preview);

  const me = await getUser(user.uid);
  const fromName = resolveDisplayName({ displayName: me?.displayName });
  await createNotification({
    uid: toUid,
    type: 'room_invite',
    fromUid: user.uid,
    fromName,
    fromAvatar: me?.avatar,
    message: `دعاك ${fromName} لحفل "${payload.partyTitle}"`,
    data: { roomId: payload.roomId, partyId: payload.partyId, conversationId },
  });

  const { notifyChatMessage } = await import('./activityNotifications');
  void notifyChatMessage(toUid, conversationId, preview);
}

/** دعوة انضمام للوكالة داخل المحادثة */
export async function sendAgencyInviteChatMessage(
  conversationId: string,
  toUid: string,
  payload: AgencyInviteChatPayload,
): Promise<void> {
  const preview = `🏢 دعوة للانضمام إلى وكالة "${payload.agencyName}"`;
  await writeInviteMessage(conversationId, toUid, {
    type: 'agency_invite',
    text: preview,
    inviteAgencyId: payload.agencyId,
    inviteAgencyName: payload.agencyName,
  }, preview);

  const user = auth.currentUser;
  if (!user) return;
  const me = await getUser(user.uid);
  const fromName = resolveDisplayName({ displayName: me?.displayName });
  await createNotification({
    uid: toUid,
    type: 'system',
    fromUid: user.uid,
    fromName,
    fromAvatar: me?.avatar,
    message: `دعاك ${fromName} للانضمام إلى وكالة "${payload.agencyName}"`,
    data: { agencyId: payload.agencyId, type: 'agency_host_invite', conversationId },
  });

  const { notifyChatMessage } = await import('./activityNotifications');
  void notifyChatMessage(toUid, conversationId, preview);
}

export interface PostShareChatPayload {
  postId: string;
  authorName: string;
  preview?: string;
}

/** مشاركة منشور داخل المحادثة */
export async function sendPostShareChatMessage(
  conversationId: string,
  toUid: string,
  payload: PostShareChatPayload,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  let shortUrl: string;
  let deepLink: string;
  try {
    const share = await createPostShareMessage(
      payload.postId,
      payload.authorName,
      payload.preview,
    );
    shortUrl = share.shortUrl;
    deepLink = share.deepLink;
  } catch {
    const fallback = getLocalPostShareFallback(
      payload.postId,
      payload.authorName,
      payload.preview,
    );
    shortUrl = fallback.shortUrl;
    deepLink = fallback.deepLink;
  }

  const preview = `📰 منشور من ${payload.authorName}`;
  await writeInviteMessage(conversationId, toUid, {
    type: 'post_share',
    text: preview,
    invitePostId: payload.postId,
    invitePostAuthor: payload.authorName,
    invitePostPreview: (payload.preview ?? '').trim().slice(0, 160),
    inviteShortUrl: shortUrl,
    inviteDeepLink: deepLink,
  }, preview);

  const { notifyChatMessage } = await import('./activityNotifications');
  void notifyChatMessage(toUid, conversationId, preview);
}
