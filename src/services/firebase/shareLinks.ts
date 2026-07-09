/**
 * روابط مشاركة مختصرة عبر Cloud Function createShareLink
 * الرابط: https://linkuplivechat.com/r/{code}
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from './index';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
const DEFAULT_SHARE_BASE = 'https://linkuplivechat.com';

export type ShareLinkType = 'room' | 'profile' | 'post' | 'party';

export interface CreateShareLinkResult {
  code: string;
  shortUrl: string;
  deepLink: string;
  webLink: string;
  label: string;
  reused?: boolean;
}

export interface ResolveShareLinkResult {
  code: string;
  type: ShareLinkType;
  targetId: string;
  deepLink: string;
  route: string;
  label: string;
  shortUrl: string;
}

export interface RoomShareMessage {
  shortUrl: string;
  deepLink: string;
  text: string;
}

const shareLinkBase =
  (extra.shareLinkBase as string | undefined) ||
  process.env.EXPO_PUBLIC_SHARE_LINK_BASE ||
  DEFAULT_SHARE_BASE;

export const getShareLinkBase = (): string => shareLinkBase.replace(/\/$/, '');

/** نطاقات Deep Link المعتمدة */
export const SHARE_LINK_HOSTS = [
  'linkuplivechat.com',
  'www.linkuplivechat.com',
  'linkup-dc45f.web.app',
];

/** cache روابط المشاركة — لتسريع المشاركة المتكررة */
const postShareCache = new Map<string, RoomShareMessage>();

export function getCachedPostShareMessage(postId: string): RoomShareMessage | null {
  return postShareCache.get(postId) ?? null;
}

export function cachePostShareMessage(postId: string, msg: RoomShareMessage): void {
  postShareCache.set(postId, msg);
}

export async function createShareLink(
  type: ShareLinkType,
  targetId: string,
  label?: string,
): Promise<CreateShareLinkResult> {
  const fn = httpsCallable<
    { type: ShareLinkType; targetId: string; label?: string },
    CreateShareLinkResult
  >(functions, 'createShareLink');
  const { data } = await fn({ type, targetId, label });
  return data;
}

export async function resolveShareLink(code: string): Promise<ResolveShareLinkResult> {
  const fn = httpsCallable<{ code: string }, ResolveShareLinkResult>(
    functions,
    'resolveShareLink',
  );
  const { data } = await fn({ code: code.trim().toLowerCase() });
  return data;
}

export async function createRoomShareMessage(
  roomId: string,
  roomName: string,
): Promise<RoomShareMessage> {
  const link = await createShareLink('room', roomId, roomName);
  const text = `انضم لغرفة "${link.label || roomName}" على LinkUp\n${link.shortUrl}`;
  return { shortUrl: link.shortUrl, deepLink: link.deepLink, text };
}

export async function createProfileShareMessage(
  userId: string,
  displayName: string,
): Promise<RoomShareMessage> {
  const link = await createShareLink('profile', userId, displayName);
  const text = `تابع "${link.label || displayName}" على LinkUp\n${link.shortUrl}`;
  return { shortUrl: link.shortUrl, deepLink: link.deepLink, text };
}

export async function createPostShareMessage(
  postId: string,
  authorName: string,
  postText?: string,
): Promise<RoomShareMessage> {
  const label =
    postText && postText.trim()
      ? `${authorName}: ${postText.trim().slice(0, 48)}${postText.trim().length > 48 ? '…' : ''}`
      : authorName;
  const link = await createShareLink('post', postId, label);
  const text = `شاهد منشور "${link.label || authorName}" على LinkUp\n${link.shortUrl}`;
  return { shortUrl: link.shortUrl, deepLink: link.deepLink, text };
}

export async function createPartyShareMessage(
  partyId: string,
  partyTitle: string,
  agencyName?: string,
): Promise<RoomShareMessage> {
  const label = agencyName?.trim()
    ? `${partyTitle.trim()} — ${agencyName.trim()}`
    : partyTitle.trim();
  const link = await createShareLink('party', partyId, label);
  const text = `🎉 انضم للاحتفال "${link.label || partyTitle}" على LinkUp\n${link.shortUrl}`;
  return { shortUrl: link.shortUrl, deepLink: link.deepLink, text };
}

/** fallback محلي فوري — بدون انتظار الشبكة */
export function getLocalPostShareFallback(
  postId: string,
  authorName: string,
  postText?: string,
): RoomShareMessage {
  const deepLink = `linkup://post/${postId}`;
  const label =
    postText && postText.trim()
      ? `${authorName}: ${postText.trim().slice(0, 48)}${postText.trim().length > 48 ? '…' : ''}`
      : authorName;
  const text = `شاهد منشور "${label}" على LinkUp\n${deepLink}`;
  return { shortUrl: deepLink, deepLink, text };
}

/** fallback محلي عند فشل السيرفر */
export function getLocalRoomShareFallback(roomId: string, roomName: string): RoomShareMessage {
  const deepLink = `linkup://room/${roomId}`;
  const shortUrl = `${getShareLinkBase()}/room/${roomId}`;
  const text = `انضم لغرفة "${roomName}" على LinkUp\n${deepLink}`;
  return { shortUrl, deepLink, text };
}

/** fallback محلي عند فشل السيرفر */
export function getLocalPartyShareFallback(
  partyId: string,
  partyTitle: string,
  roomId: string,
): RoomShareMessage {
  const deepLink = `linkup://party/${partyId}`;
  const text = `🎉 انضم للاحتفال "${partyTitle}" على LinkUp\n${deepLink}\nlinkup://room/${roomId}`;
  return { shortUrl: deepLink, deepLink, text };
}
