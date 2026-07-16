/**
 * خلفيات المحادثة — كتalog من config/chatBackgrounds (لوحة التحكم)
 */
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from './index';
import {
  DEFAULT_CHAT_BACKGROUNDS,
  normalizeChatBackgrounds,
  type ChatBackground,
} from '@/constants/chatBackgrounds';

export type { ChatBackground, ChatBackgroundBlob } from '@/constants/chatBackgrounds';

export const subscribeToChatBackgrounds = (
  cb: (items: ChatBackground[]) => void,
): (() => void) => {
  const ref = doc(firestore, 'config', 'chatBackgrounds');
  return onSnapshot(
    ref,
    (snap) => {
      const raw = (snap.exists() ? (snap.data().items as ChatBackground[]) : []) ?? [];
      // الخلفية الافتراضية داكنة دائماً (هوية الثيم الليلي) — نتجاهل نسخة اللوحة
      // الفاتحة القديمة لنفس المعرّف ما لم تكن صورة مخصّصة
      const themedDefault = DEFAULT_CHAT_BACKGROUNDS[0]!;
      const normalized = normalizeChatBackgrounds(raw).map((b) =>
        b.id === themedDefault.id && !b.imageUrl?.trim() ? { ...themedDefault, ...{ sort: b.sort } } : b,
      );
      cb(normalized.length ? normalized : DEFAULT_CHAT_BACKGROUNDS);
    },
    () => cb(DEFAULT_CHAT_BACKGROUNDS),
  );
};
