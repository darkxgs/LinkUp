/**
 * إشعارات النشاط — إعجاب، تعليق، متابعة، رسائل…
 * تُكتب في Firestore ثم Cloud Function يرسل Push تلقائياً.
 */

import { doc, getDoc } from 'firebase/firestore';
import { firestore, auth } from './index';
import { createNotification, type NotificationType } from './notifications';
import { resolveDisplayName } from '@/utils/displayName';
import { resolveUserDocAvatar } from '@/utils/userAvatar';
import i18n from '@/localization/i18n';

async function getSenderProfile(): Promise<{
  uid: string;
  name: string;
  avatar: string;
} | null> {
  const user = auth.currentUser;
  if (!user) return null;

  const snap = await getDoc(doc(firestore, 'users', user.uid));
  const data = snap.exists() ? snap.data() : {};
  const name = resolveDisplayName(
    {
      displayName: (data.displayName as string) ?? user.displayName,
      email: (data.email as string) ?? user.email ?? undefined,
    },
    i18n.t('notifications.systemSender'),
  );
  const avatar = resolveUserDocAvatar(data, user.uid) || user.photoURL || '';

  return { uid: user.uid, name, avatar };
}

type ActivityInput = {
  toUid: string;
  type: NotificationType;
  message: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function notifyActivity(input: ActivityInput): Promise<void> {
  const sender = await getSenderProfile();
  if (!sender || !input.toUid || input.toUid === sender.uid) return;

  try {
    await createNotification({
      uid: input.toUid,
      type: input.type,
      fromUid: sender.uid,
      fromName: sender.name,
      fromAvatar: sender.avatar || undefined,
      message: input.message,
      data: {
        ...(input.data ?? {}),
        title: input.title,
        body: input.body,
        type: input.type,
        fromUid: sender.uid,
      },
      isRead: false,
    });
  } catch (e) {
    console.warn('notifyActivity:', e);
  }
}

export async function notifyPostLike(postId: string, authorUid: string): Promise<void> {
  const sender = await getSenderProfile();
  if (!sender || authorUid === sender.uid) return;

  const title = i18n.t('notifications.pushTitle');
  const body = i18n.t('notifications.likeMessage', { name: sender.name });
  await notifyActivity({
    toUid: authorUid,
    type: 'like',
    title,
    body,
    message: body,
    data: { postId },
  });
}

export async function notifyPostComment(
  postId: string,
  authorUid: string,
  commentText: string,
): Promise<void> {
  const sender = await getSenderProfile();
  if (!sender || authorUid === sender.uid) return;

  const preview =
    commentText.length > 60 ? `${commentText.slice(0, 57)}…` : commentText;
  const title = i18n.t('notifications.pushTitle');
  const body = i18n.t('notifications.commentMessage', {
    name: sender.name,
    preview,
  });
  await notifyActivity({
    toUid: authorUid,
    type: 'comment',
    title,
    body,
    message: body,
    data: { postId, commentPreview: preview },
  });
}

/** صاحب المنشور ردّ على تعليق — إشعار لصاحب التعليق الأصلي */
export async function notifyCommentReply(
  postId: string,
  commentAuthorUid: string,
  replyText: string,
  _commentAuthorName: string,
): Promise<void> {
  const sender = await getSenderProfile();
  if (!sender || commentAuthorUid === sender.uid) return;

  const preview =
    replyText.length > 60 ? `${replyText.slice(0, 57)}…` : replyText;
  const title = i18n.t('notifications.pushTitle');
  const body = i18n.t('notifications.commentReplyMessage', {
    name: sender.name,
    preview,
  });
  await notifyActivity({
    toUid: commentAuthorUid,
    type: 'comment',
    title,
    body,
    message: body,
    data: { postId, commentPreview: preview, isReply: true },
  });
}

export async function notifyNewFollower(followedUid: string): Promise<void> {
  const sender = await getSenderProfile();
  if (!sender || followedUid === sender.uid) return;

  const title = i18n.t('notifications.pushTitle');
  const body = i18n.t('notifications.followMessage', { name: sender.name });
  await notifyActivity({
    toUid: followedUid,
    type: 'follow',
    title,
    body,
    message: body,
  });
}

export async function notifyChatMessage(
  toUid: string,
  conversationId: string,
  preview: string,
): Promise<void> {
  const sender = await getSenderProfile();
  if (!sender || toUid === sender.uid) return;

  const trimmed = preview.trim() || i18n.t('notifications.newMessage');
  const title = sender.name;
  const body = trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
  await notifyActivity({
    toUid,
    type: 'message',
    title,
    body,
    message: i18n.t('notifications.messagePreview', { name: sender.name, preview: body }),
    data: { conversationId, fromUid: sender.uid },
  });
}

export async function notifyProfileVisit(_profileUid: string): Promise<void> {
  // الزوار يُسجّلون عبر recordProfileVisit — بدون إشعار (صفحة الزوار فقط)
}

export async function notifyMention(
  postId: string,
  mentionedUid: string,
  commentText: string,
): Promise<void> {
  const sender = await getSenderProfile();
  if (!sender || mentionedUid === sender.uid) return;

  const preview =
    commentText.length > 60 ? `${commentText.slice(0, 57)}…` : commentText;
  const title = i18n.t('notifications.pushTitle');
  const body = i18n.t('notifications.mentionMessage', {
    name: sender.name,
    preview,
  });
  await notifyActivity({
    toUid: mentionedUid,
    type: 'mention',
    title,
    body,
    message: body,
    data: { postId, commentPreview: preview },
  });
}

/** إشعار المتابعين بمنشور جديد */
export async function notifyFollowersOfNewPost(
  postId: string,
  postText: string,
): Promise<void> {
  const sender = await getSenderProfile();
  if (!sender) return;

  const { getFollowers } = await import('./follow');
  const followers = await getFollowers(sender.uid, 500);
  if (followers.length === 0) return;

  const preview =
    postText.trim().length > 60
      ? `${postText.trim().slice(0, 57)}…`
      : postText.trim() || i18n.t('feed.newPost');
  const title = i18n.t('notifications.pushTitle');
  const body = i18n.t('notifications.newPostMessage', {
    name: sender.name,
    preview,
  });

  await Promise.all(
    followers.map((followerUid) =>
      notifyActivity({
        toUid: followerUid,
        type: 'post',
        title,
        body,
        message: body,
        data: { postId, route: `/post/${postId}` },
      }).catch(() => {}),
    ),
  );
}

export async function notifyPostGift(
  postId: string,
  authorUid: string,
  giftName: string,
  quantity: number,
): Promise<void> {
  const sender = await getSenderProfile();
  if (!sender || authorUid === sender.uid) return;

  const label = quantity > 1 ? `${giftName} ×${quantity}` : giftName;
  const title = i18n.t('notifications.pushTitle');
  const body = i18n.t('notifications.postGiftMessage', {
    name: sender.name,
    gift: label,
  });
  await notifyActivity({
    toUid: authorUid,
    type: 'gift',
    title,
    body,
    message: body,
    data: { postId, route: `/post/${postId}` },
  });
}
