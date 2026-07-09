/**
 * استخراج وحل @mentions في النصوص
 * يدعم: @12345678 (publicAccountId) أو @اسم_المستخدم
 */
import { resolveUserIdentifier } from '@/services/userIdentifier';
import { normalizePublicId } from '@/services/publicAccountIndex';

const MENTION_REGEX = /@(\d{8}|[\w\u0600-\u06FF][\w\u0600-\u06FF_.-]{1,31})/g;

/** نمط عرض المنشن في شات الروم — يدعم المعرف العام والأسماء بشرطة سفلية */
export const ROOM_MENTION_DISPLAY_REGEX =
  /@(\d{8}|[\w\u0600-\u06FF][\w\u0600-\u06FF_.^+-]{0,39})/g;

const BIDI_MARKS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

export type RoomMentionEntry = {
  uid: string;
  name: string;
};

const mentionResolveCache = new Map<string, RoomMentionEntry | null>();

export function normalizeMentionToken(raw: string): string {
  return raw.replace(/^@/, '').replace(BIDI_MARKS, '').trim();
}

export function mentionLookupKey(token: string): string {
  const clean = normalizeMentionToken(token);
  if (/^\d{8}$/.test(clean)) return normalizePublicId(clean);
  return clean.toLowerCase();
}

/** فهرس سريع من المتصلين بالروم — يحل المعرف العام والاسم */
export function buildRoomMentionIndex(
  members: Array<{ uid: string; name: string; publicAccountId?: string | number }>,
): Map<string, RoomMentionEntry> {
  const map = new Map<string, RoomMentionEntry>();
  for (const m of members) {
    if (!m.uid) continue;
    const name = (m.name ?? '').trim() || 'مستخدم';
    const entry: RoomMentionEntry = { uid: m.uid, name };
    const pub = m.publicAccountId != null ? normalizePublicId(String(m.publicAccountId)) : '';
    if (pub) map.set(pub, entry);
    const underscored = name.replace(/\s+/g, '_');
    if (underscored) map.set(underscored.toLowerCase(), entry);
  }
  return map;
}

export function lookupRoomMention(
  token: string,
  index: Map<string, RoomMentionEntry>,
  resolved: Record<string, RoomMentionEntry>,
): RoomMentionEntry | null {
  const key = mentionLookupKey(token);
  return index.get(key) ?? resolved[key] ?? null;
}

/** يحل منشن غير معروف (خارج الروم) عبر Firestore */
export async function resolveMentionEntry(token: string): Promise<RoomMentionEntry | null> {
  const key = mentionLookupKey(token);
  if (mentionResolveCache.has(key)) return mentionResolveCache.get(key) ?? null;

  const uid = await resolveUserIdentifier(normalizeMentionToken(token));
  if (!uid) {
    mentionResolveCache.set(key, null);
    return null;
  }

  try {
    const { getUser } = await import('@/services/firebase/users');
    const u = await getUser(uid);
    const name = (u?.displayName ?? '').trim() || 'مستخدم';
    const entry: RoomMentionEntry = { uid, name };
    mentionResolveCache.set(key, entry);
    const pub = u?.publicAccountId != null ? normalizePublicId(String(u.publicAccountId)) : '';
    if (pub) mentionResolveCache.set(pub, entry);
    const underscored = name.replace(/\s+/g, '_').toLowerCase();
    if (underscored) mentionResolveCache.set(underscored, entry);
    return entry;
  } catch {
    mentionResolveCache.set(key, null);
    return null;
  }
}

/** رمز المنشن: المعرف العام أولاً، وإلا الاسم بدون مسافات */
export function resolveMentionToken(displayName: string, publicAccountId?: string): string {
  const id = publicAccountId?.trim();
  if (id) return id;
  return displayName.trim().replace(/\s+/g, '_');
}

/** إدراج منشن في حقل الكتابة مع عزل اتجاه النص لدعم العربية */
export function buildRoomMentionInsert(token: string, previousText = ''): string {
  const clean = token.replace(/^@/, '').trim();
  if (!clean) return previousText;
  const mention = `@\u2068${clean}\u2069`;
  const prefix = previousText.trimEnd();
  return prefix ? `${prefix} ${mention} ` : `${mention} `;
}

/** إزالة علامات الاتجاه قبل الإرسال/التخزين */
export function sanitizeMentionTextForSend(text: string): string {
  return text.replace(BIDI_MARKS, '').replace(/\s+/g, ' ').trim();
}

/** استخراج رموز المنشن بدون @ */
export function extractMentionTokens(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION_REGEX)) {
    const token = match[1]?.trim();
    if (token) found.add(token);
  }
  return [...found];
}

/** تحويل الرموز إلى UIDs فريدة */
export async function resolveMentionTokens(tokens: string[]): Promise<string[]> {
  const uids = new Set<string>();
  await Promise.all(
    tokens.map(async (token) => {
      const uid = await resolveUserIdentifier(token);
      if (uid) uids.add(uid);
    }),
  );
  return [...uids];
}

/** استخراج UIDs المذكورين في نص */
export async function resolveMentionedUids(text: string): Promise<string[]> {
  const tokens = extractMentionTokens(text);
  if (!tokens.length) return [];
  return resolveMentionTokens(tokens);
}
