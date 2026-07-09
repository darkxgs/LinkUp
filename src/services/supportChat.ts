/**
 * محادثات الدعم — حساب linkup_support عبر Firestore
 */
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  onSnapshot,
  increment,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import {
  isSuperCountryScope,
  preloadUserCountries,
  getCachedUserCountry,
  isInAdminCountryScope,
} from '@/services/countryScope';

export const SUPPORT_UID = 'linkup_support';
export const SUPPORT_NAME = 'إدارة LinkUp';

export interface SupportConversation {
  id: string;
  userUid: string;
  userName: string;
  userAvatar: string;
  userPublicAccountId?: string;
  supportTopic?: string;
  lastMessage: string;
  lastMessageAt: number;
  unreadCount: number;
  isOfficialChat?: boolean;
}

export interface SupportMessage {
  id: string;
  conversationId: string;
  fromUid: string;
  toUid: string;
  text: string;
  type: 'text' | 'image' | 'voice' | 'file' | string;
  createdAt: number;
  isOfficial?: boolean;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  voiceUrl?: string;
  voiceDuration?: number;
  fileUrl?: string;
  fileName?: string;
  fileMime?: string;
  fileSize?: number;
}

function mapConversation(id: string, data: Record<string, unknown>): SupportConversation | null {
  const participants = (data.participants as string[]) ?? [];
  const userUid = participants.find((p) => p !== SUPPORT_UID);
  if (!userUid) return null;

  const names = (data.participantNames as Record<string, string>) ?? {};
  const avatars = (data.participantAvatars as Record<string, string>) ?? {};
  const unreadBy = (data.unreadBy as Record<string, number>) ?? {};

  return {
    id,
    userUid,
    userName: names[userUid] ?? 'مستخدم',
    userAvatar: avatars[userUid] ?? '',
    userPublicAccountId: (data.userPublicAccountId as string) || undefined,
    supportTopic: (data.supportTopic as string) || undefined,
    lastMessage: (data.lastMessage as string) ?? '',
    lastMessageAt: (data.lastMessageAt as number) ?? 0,
    unreadCount: unreadBy[SUPPORT_UID] ?? 0,
    isOfficialChat: data.isOfficialChat as boolean | undefined,
  };
}

async function filterSupportConversations(
  list: SupportConversation[],
): Promise<SupportConversation[]> {
  if (isSuperCountryScope()) return list;
  await preloadUserCountries(list.map((c) => c.userUid));
  return list.filter((c) => isInAdminCountryScope(getCachedUserCountry(c.userUid)));
}

export async function getSupportConversations(): Promise<SupportConversation[]> {
  const q = query(
    collection(firestore, 'conversations'),
    where('participants', 'array-contains', SUPPORT_UID),
    orderBy('lastMessageAt', 'desc'),
    limit(150),
  );
  const snap = await getDocs(q);
  const list: SupportConversation[] = [];
  for (const d of snap.docs) {
    const mapped = mapConversation(d.id, d.data() as Record<string, unknown>);
    if (mapped) list.push(mapped);
  }
  return filterSupportConversations(list);
}

export function subscribeSupportConversations(
  callback: (convs: SupportConversation[]) => void,
): () => void {
  const q = query(
    collection(firestore, 'conversations'),
    where('participants', 'array-contains', SUPPORT_UID),
    orderBy('lastMessageAt', 'desc'),
    limit(150),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: SupportConversation[] = [];
      for (const d of snap.docs) {
        const mapped = mapConversation(d.id, d.data() as Record<string, unknown>);
        if (mapped) list.push(mapped);
      }
      void filterSupportConversations(list).then(callback);
    },
    (err) => {
      console.error('subscribeSupportConversations:', err);
      callback([]);
    },
  );
}

export function subscribeSupportMessages(
  conversationId: string,
  callback: (messages: SupportMessage[]) => void,
): () => void {
  const q = query(
    collection(firestore, 'messages'),
    where('conversationId', '==', conversationId),
    limit(300),
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as SupportMessage,
    );
    msgs.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    callback(msgs);
  });
}

export async function sendSupportReply(
  conversationId: string,
  userUid: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  await addDoc(collection(firestore, 'messages'), {
    conversationId,
    fromUid: SUPPORT_UID,
    toUid: userUid,
    text: trimmed,
    type: 'text',
    createdAt: Date.now(),
    isRead: false,
    isOfficial: true,
  });

  await updateDoc(doc(firestore, 'conversations', conversationId), {
    lastMessage: trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed,
    lastMessageAt: Date.now(),
    [`unreadBy.${userUid}`]: increment(1),
    [`unreadBy.${SUPPORT_UID}`]: 0,
  });
}

export async function markSupportConversationRead(conversationId: string): Promise<void> {
  try {
    await updateDoc(doc(firestore, 'conversations', conversationId), {
      [`unreadBy.${SUPPORT_UID}`]: 0,
    });
  } catch {
    // ignore
  }
}

export function countUnreadSupport(conversations: SupportConversation[]): number {
  return conversations.reduce((n, c) => n + (c.unreadCount > 0 ? 1 : 0), 0);
}
