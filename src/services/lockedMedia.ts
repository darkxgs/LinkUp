/**
 * Locked & Timed Media Messages Service
 *
 * يدعم إرسال صورة/صوت/فيديو مع:
 *  - قفل بالكوينز (المستلم يدفع ليفتح) — السعر ثابت من الإدارة
 *  - توقيت العرض:
 *      'once'  → تظهر مرة واحدة ثم تختفي نهائياً
 *      'timed' → تظهر X ثانية ثم تختفي ولا يمكن إعادة الفتح
 *
 * توزيع الكوينز عند الفتح (عبر Cloud Function unlockChatMessage):
 *  - كامل المبلغ → المرسل (بدون عمولة)
 */

import {
  doc,
  updateDoc,
  collection,
  addDoc,
  increment,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { firestore, auth, storage } from './firebase/index';
import { isBlockedBetween } from './firebase/blocks';
import { buildConversationUnhidePatchForBoth } from './firebase/chat';
import { ensureCallableAuth } from './firebase/authReady';
import { callCallableWithAuth } from './firebase/callableHttp';
import { DEFAULT_SETTINGS } from './firebase/config';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';

export type LockedMediaType = 'image' | 'voice' | 'video';
export type ExpireMode = 'once' | 'timed';

/** سعر فتح الرسالة المقفلة — يتجاهل 0 من الإعدادات */
export const MIN_LOCKED_MESSAGE_PRICE = 10;
export const MAX_LOCKED_MESSAGE_PRICE = 500_000;

export const resolveLockedMessagePrice = (raw?: number): number => {
  if (typeof raw === 'number' && raw > 0) {
    return Math.min(MAX_LOCKED_MESSAGE_PRICE, Math.max(MIN_LOCKED_MESSAGE_PRICE, raw));
  }
  return DEFAULT_SETTINGS.lockedMessagePrice;
};

export interface SendLockedMediaParams {
  conversationId: string;
  toUid: string;
  localUri: string;
  mediaType: LockedMediaType;
  /** هل الرسالة مقفلة بالكوينز؟ */
  isLocked: boolean;
  /** تفعيل توقيت العرض (once / timed) */
  enableTimer?: boolean;
  /** نمط الاختفاء — يُستخدم فقط عند enableTimer */
  expireMode?: ExpireMode;
  /** ثواني العرض (لـ timed). 0 = بدون عدّاد */
  viewDuration?: number;
  /** سعر الفتح من الإعدادات المحلية (يتجنّب قراءة Firestore عند الإرسال) */
  unlockPrice?: number;
  /** مدّة الصوت/الفيديو بالثواني */
  duration?: number;
  /** thumbnail للفيديو (اختياري) */
  thumbnailUri?: string;
  dimensions?: { width: number; height: number };
}

/**
 * رفع ملف وسائط إلى Storage وإرجاع رابطه
 */
const uploadMedia = async (
  localUri: string,
  path: string,
  contentType: string,
): Promise<string> => {
  const response = await fetch(localUri);
  const blob = await response.blob();

  const MAX = contentType.startsWith('video') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
  if (blob.size > MAX) {
    throw new Error(
      contentType.startsWith('video')
        ? 'حجم الفيديو كبير جداً (الحد 50MB)'
        : 'حجم الملف كبير جداً (الحد 10MB)',
    );
  }

  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, blob, { contentType });
  return getDownloadURL(fileRef);
};

/**
 * إرسال رسالة وسائط (مع خيار القفل والتوقيت)
 */
export const sendLockedMediaMessage = async (
  params: SendLockedMediaParams,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجّل');

  const {
    conversationId,
    toUid,
    localUri,
    mediaType,
    isLocked,
    enableTimer = false,
    expireMode = 'once',
    viewDuration = 0,
    unlockPrice: unlockPriceParam,
    duration,
    thumbnailUri,
    dimensions,
  } = params;

  if (await isBlockedBetween(user.uid, toUid)) {
    throw new Error('BLOCKED');
  }

  // الصور المقفلة/المؤقتة كانت تُرفع بدقّة كاملة بلا ضغط (بخلاف مسار الصور العادي
  // sendImageMessage) فتتأخّر كثيراً بالوصول للطرف الآخر — نضغطها بنفس الإعداد
  // (1280px/JPEG q0.72) قبل الرفع. الصور فقط؛ الصوت/الفيديو يجب ألا يمرّا بالضغط
  // (compressImageForUpload يعيد ترميزهما JPEG فيُفسدهما). يعود للأصل عند فشل الضغط.
  let uploadUri = localUri;
  if (mediaType === 'image') {
    const { compressImageForUpload, COMPRESS_PRESETS } = await import('@/utils/imageCompress');
    uploadUri = await compressImageForUpload(localUri, COMPRESS_PRESETS.chat);
  }

  const ts = Date.now();
  // بعد الضغط تصبح الصورة JPEG دائماً — نثبّت الامتداد/النوع ليطابق كائن Storage.
  const ext =
    mediaType === 'image' ? 'jpg' :
    localUri.split('.').pop()?.toLowerCase() ??
      (mediaType === 'video' ? 'mp4' : 'm4a');
  const contentType =
    mediaType === 'image' ? 'image/jpeg' :
    mediaType === 'video' ? `video/${ext}` :
    'audio/m4a';

  const storageFolder =
    mediaType === 'image' ? 'chat_images' :
    mediaType === 'voice' ? 'chat_voices' :
    'chat_videos';

  const mediaPath = `${storageFolder}/${conversationId}/${user.uid}_${ts}.${ext}`;
  const thumbPath =
    mediaType === 'video' && thumbnailUri
      ? `chat_images/${conversationId}/${user.uid}_${ts}_thumb.jpg`
      : null;

  const [mediaUrl, videoThumbnail] = await Promise.all([
    uploadMedia(uploadUri, mediaPath, contentType),
    thumbPath
      ? uploadMedia(thumbnailUri!, thumbPath, 'image/jpeg').catch(() => undefined)
      : Promise.resolve(undefined),
  ]);

  const msgData: Record<string, unknown> = {
    conversationId,
    fromUid: user.uid,
    toUid,
    text: '',
    type: mediaType,
    createdAt: ts,
    isRead: false,
    isLocked,
    unlockedBy: [],
    viewedBy: [],
  };

  if (isLocked) {
    msgData.unlockPrice = resolveLockedMessagePrice(unlockPriceParam);
  }

  if (enableTimer) {
    msgData.expireMode = expireMode;
    msgData.viewDuration = viewDuration;
  }

  if (mediaType === 'image') {
    msgData.imageUrl = mediaUrl;
    if (dimensions) {
      msgData.imageWidth = dimensions.width;
      msgData.imageHeight = dimensions.height;
    }
  } else if (mediaType === 'voice') {
    msgData.voiceUrl = mediaUrl;
    msgData.voiceDuration = Math.round(duration ?? 0);
  } else if (mediaType === 'video') {
    msgData.videoUrl = mediaUrl;
    msgData.videoDuration = Math.round(duration ?? 0);
    if (videoThumbnail) msgData.videoThumbnail = videoThumbnail;
  }

  await addDoc(collection(firestore, 'messages'), msgData);

  const preview =
    mediaType === 'image' ? 'صورة' :
    mediaType === 'video' ? 'فيديو' :
    'رسالة صوتية';
  const lockLabel = isLocked ? '[مقفل] ' : '';

  await updateDoc(doc(firestore, 'conversations', conversationId), {
    lastMessage: `${lockLabel}${preview}`,
    lastMessageAt: ts,
    [`unreadBy.${toUid}`]: increment(1),
    ...buildConversationUnhidePatchForBoth(user.uid, toUid),
  });
};

/**
 * فتح رسالة مقفلة بدفع الكوينز — عبر Cloud Function (آمن وذري)
 */
export const unlockMessage = async (
  messageId: string,
): Promise<{ success: boolean; mediaUrl?: string; senderEarned?: number }> => {
  const user = await ensureCallableAuth();
  const idToken = await user.getIdToken();
  const res = await callCallableWithAuth<
    { messageId: string },
    { ok: boolean; mediaUrl?: string; senderEarned?: number; alreadyUnlocked?: boolean }
  >('unlockChatMessage', { messageId }, idToken);
  return {
    success: true,
    mediaUrl: res.mediaUrl,
    senderEarned: res.senderEarned,
  };
};

/**
 * تعليم رسالة "once" كمشاهَدة (بعد انتهاء وقت العرض)
 */
export const markMessageViewed = async (messageId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await updateDoc(doc(firestore, 'messages', messageId), {
      viewedBy: arrayUnion(user.uid),
    });
  } catch {
    // فشل صامت
  }
};

/**
 * إعادة قفل رسالة timed (بعد انتهاء وقت العرض لرسالة مقفلة بالكوينز)
 */
export const relockMessage = async (messageId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await updateDoc(doc(firestore, 'messages', messageId), {
      unlockedBy: arrayRemove(user.uid),
    });
  } catch {
    // فشل صامت
  }
};

/**
 * هل يستطيع المستخدم رؤية محتوى هذه الرسالة الآن؟
 */
export const canViewMedia = (
  msg: ChatMessageLike,
  myUid: string,
): { canView: boolean; needsUnlock: boolean; expired: boolean } => {
  if (msg.fromUid === myUid) {
    return { canView: true, needsUnlock: false, expired: false };
  }

  if (msg.isLocked && !(msg.unlockedBy ?? []).includes(myUid)) {
    return { canView: false, needsUnlock: true, expired: false };
  }

  if (
    (msg.expireMode === 'once' || msg.expireMode === 'timed') &&
    (msg.viewedBy ?? []).includes(myUid)
  ) {
    return { canView: false, needsUnlock: false, expired: true };
  }

  return { canView: true, needsUnlock: false, expired: false };
};

interface ChatMessageLike {
  fromUid: string;
  toUid: string;
  isLocked?: boolean;
  unlockedBy?: string[];
  expireMode?: ExpireMode;
  viewedBy?: string[];
}
