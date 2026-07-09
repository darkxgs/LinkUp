/**
 * دعوات تحدي عبر المحادثة — بطاقة «قبول التحدي والدخول» داخل الشات
 */
import { getOrCreateConversation, buildConversationUnhidePatchForBoth } from './chat';
import { getUser } from './users';
import { auth, firestore } from './index';
import { addDoc, collection, doc, increment, updateDoc } from 'firebase/firestore';
import type { ChallengeGameId } from './challenges';
import { getChallengeGameLabel } from '@/utils/challengeI18n';
import { getChallengeDeepLink } from '@/utils/challengeDeepLink';
import i18n from '@/localization/i18n';

export async function sendGameChallengeChatMessage(
  conversationId: string,
  toUid: string,
  payload: {
    challengeId: string;
    gameId: ChallengeGameId;
    bet: number;
    gameName: string;
  },
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  const preview = i18n.t('challenges.invite.chatPreview', {
    gameName: payload.gameName,
    bet: payload.bet.toLocaleString(),
  });
  const deepLink = getChallengeDeepLink(payload.challengeId);

  await addDoc(collection(firestore, 'messages'), {
    conversationId,
    fromUid: user.uid,
    toUid,
    createdAt: Date.now(),
    isRead: false,
    type: 'game_invite',
    text: `${preview}\n${deepLink}`,
    inviteChallengeId: payload.challengeId,
    inviteGameId: payload.gameId,
    inviteGameName: payload.gameName,
    inviteBet: payload.bet,
    inviteDeepLink: deepLink,
  });

  const now = Date.now();
  await updateDoc(doc(firestore, 'conversations', conversationId), {
    lastMessage: preview,
    lastMessageAt: now,
    [`unreadBy.${toUid}`]: increment(1),
    ...buildConversationUnhidePatchForBoth(user.uid, toUid),
  });
}

/** إرسال دعوة التحدي كرسالة شات + إشعار رسالة (بدون شاشة اتصال) */
export async function notifyChallengeInvite(input: {
  challengeId: string;
  gameId: ChallengeGameId;
  bet: number;
  toUid: string;
  toName: string;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.uid === input.toUid) return;

  const gameName = getChallengeGameLabel(input.gameId);
  const preview = i18n.t('challenges.invite.chatPreview', {
    gameName,
    bet: input.bet.toLocaleString(),
  });

  const convId = await getOrCreateConversation(
    input.toUid,
    input.toName,
    (await getUser(input.toUid))?.avatar ?? '',
  );

  await sendGameChallengeChatMessage(convId, input.toUid, {
    challengeId: input.challengeId,
    gameId: input.gameId,
    bet: input.bet,
    gameName,
  });

  const { notifyChatMessage } = await import('./activityNotifications');
  void notifyChatMessage(input.toUid, convId, preview);
}
