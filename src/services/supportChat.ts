/**
 * محادثات الدعم — لم تنتقل بعد إلى v2؛ لا Firebase ولا كتابة في القاعدة القديمة.
 * التفاصيل في تعليق الدوال أدناه.
 */
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

/**
 * ⚠️ مركز الدعم لم ينتقل بعد إلى v2 — وهذه الدوال لا تكتب في قاعدة v1.
 *
 * v1's support inbox was «conversations where one participant is `linkup_support`»
 * in Firestore, replied to straight from the browser. v2 has conversations and
 * messages in Postgres, but no support IDENTITY and no admin path into private
 * chats — and adding one means deciding how far a moderator may read into
 * people's conversations. That is the owner's call, so nothing here guesses.
 *
 * Until that slice is built the page shows an empty inbox, and a reply attempt
 * says why instead of silently writing into the OLD database (which is
 * reference-only and must never be written to).
 */

const SUPPORT_NOT_READY =
  'مركز الدعم لم يُنقل بعد إلى قاعدة البيانات الجديدة — الرد من اللوحة معطّل مؤقتاً ' +
  'حتى تُبنى نقطة الدعم على السيرفر (تحتاج قرار المالك في حدود قراءة المحادثات).';

export async function getSupportConversations(): Promise<SupportConversation[]> {
  return [];
}

export function subscribeSupportConversations(
  callback: (convs: SupportConversation[]) => void,
): () => void {
  callback([]);
  return () => undefined;
}

export function subscribeSupportMessages(
  conversationId: string,
  callback: (messages: SupportMessage[]) => void,
): () => void {
  void conversationId;
  callback([]);
  return () => undefined;
}

export async function sendSupportReply(
  conversationId: string,
  userUid: string,
  text: string,
): Promise<void> {
  void conversationId;
  void userUid;
  void text;
  throw new Error(SUPPORT_NOT_READY);
}

export async function markSupportConversationRead(conversationId: string): Promise<void> {
  void conversationId;
}

export function countUnreadSupport(conversations: SupportConversation[]): number {
  return conversations.reduce((n, c) => n + (c.unreadCount > 0 ? 1 : 0), 0);
}
