/**
 * مشاركة منشور — رابط مختصر + deep link + شيت المشاركة
 */
import { Platform, Share } from 'react-native';
import { incrementShare } from '@/services/firebase/posts';
import {
  createPostShareMessage,
  getLocalPostShareFallback,
  getCachedPostShareMessage,
  cachePostShareMessage,
  type RoomShareMessage,
} from '@/services/firebase/shareLinks';
import { copyToClipboard } from '@/utils/copyToClipboard';

export type PostShareInput = {
  id: string;
  authorName: string;
  text?: string;
};

/** رابط فوري للنسخ — بدون انتظار Cloud Function */
export function getInstantPostShareMessage(post: PostShareInput): RoomShareMessage {
  const cached = getCachedPostShareMessage(post.id);
  if (cached) return cached;
  return getLocalPostShareFallback(post.id, post.authorName, post.text);
}

/** يجلب الرابط المختصر من السيرفر ويحدّث الكاش (خلفية) */
export async function prefetchPostShareMessage(post: PostShareInput): Promise<RoomShareMessage> {
  const cached = getCachedPostShareMessage(post.id);
  if (cached) return cached;

  try {
    const msg = await createPostShareMessage(post.id, post.authorName, post.text);
    cachePostShareMessage(post.id, msg);
    return msg;
  } catch {
    const fallback = getLocalPostShareFallback(post.id, post.authorName, post.text);
    cachePostShareMessage(post.id, fallback);
    return fallback;
  }
}

export async function resolvePostShareMessage(post: PostShareInput): Promise<RoomShareMessage> {
  return prefetchPostShareMessage(post);
}

function buildNativeShareOptions(msg: RoomShareMessage) {
  if (Platform.OS === 'ios') {
    return { message: msg.text };
  }
  return { message: msg.text, title: 'LinkUp' };
}

/** shared = أكّد المستخدم المشاركة (iOS) | cancelled = ألغى | opened = فُتحت القائمة فقط (Android) */
export type ExternalShareResult = 'shared' | 'cancelled' | 'opened';

export async function sharePostExternally(msg: RoomShareMessage): Promise<ExternalShareResult> {
  try {
    if (Platform.OS === 'android') {
      // Android يُحلّ الوعد فور فتح قائمة المشاركة — لا يمكن معرفة الإلغاء لاحقاً
      await Share.share(buildNativeShareOptions(msg));
      return 'opened';
    }

    const result = await Share.share(buildNativeShareOptions(msg));
    if (result.action === Share.dismissedAction) return 'cancelled';
    if (result.action === Share.sharedAction) return 'shared';
    return 'cancelled';
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'User did not share') return 'cancelled';
    throw e;
  }
}

export async function copyPostShareLink(msg: RoomShareMessage): Promise<boolean> {
  return copyToClipboard(msg.shortUrl);
}

export async function recordPostShare(postId: string): Promise<boolean> {
  return incrementShare(postId);
}

/** @deprecated استخدم PostShareSheet — يبقى للتوافق */
export async function sharePostQuick(
  post: PostShareInput,
  onShared?: () => void,
): Promise<void> {
  const msg = await resolvePostShareMessage(post);
  const outcome = await sharePostExternally(msg);
  if (outcome !== 'shared') return;
  void recordPostShare(post.id).then((added) => {
    if (added) onShared?.();
  });
}
