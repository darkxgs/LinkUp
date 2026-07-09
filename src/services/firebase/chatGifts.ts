/**
 * إرسال رسائل الهدايا في المحادثة — ملف منفصل لتجنب مشاكل hot-reload
 */
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import { isBlockedBetween } from './blocks';
import { buildConversationUnhidePatchForBoth } from './chat';

export type ChatGiftPayload = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  animationUrl?: string;
  soundUrl?: string;
  videoUrl?: string;
};

export async function sendGiftChatMessage(
  conversationId: string,
  toUid: string,
  gift: ChatGiftPayload,
  quantity = 1,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');
  if (await isBlockedBetween(user.uid, toUid)) {
    throw new Error('BLOCKED');
  }

  const qty = Math.max(1, Math.min(99, quantity));
  const preview = qty > 1 ? `🎁 ×${qty}` : '🎁';
  const now = Date.now();

  await addDoc(collection(firestore, 'messages'), {
    conversationId,
    fromUid: user.uid,
    toUid,
    text: preview,
    type: 'gift',
    giftId: gift.id,
    giftName: gift.name,
    giftQuantity: qty,
    giftPrice: gift.price * qty,
    imageUrl: gift.imageUrl ?? null,
    animationUrl: gift.animationUrl ?? null,
    soundUrl: gift.soundUrl ?? null,
    videoUrl: gift.videoUrl ?? null,
    createdAt: now,
    isRead: false,
  });

  await updateDoc(doc(firestore, 'conversations', conversationId), {
    lastMessage: preview,
    lastMessageAt: now,
    [`unreadBy.${toUid}`]: increment(1),
    ...buildConversationUnhidePatchForBoth(user.uid, toUid),
  });
}
