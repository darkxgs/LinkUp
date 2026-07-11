/**
 * رفع أصول الهدايا إلى Firebase Storage
 */
import { getStorage, ref, uploadBytesResumable, getDownloadURL, listAll } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebase';
import app from './firebase';
import { compressMedia, type CompressProgress } from './compress';

const storage = getStorage(app);

const MAX_BYTES_BY_KIND: Record<'thumb' | 'animation' | 'sound' | 'video' | 'videoMp4', number> = {
  thumb: 10 * 1024 * 1024,
  animation: 25 * 1024 * 1024,
  sound: 50 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  videoMp4: 50 * 1024 * 1024,
};
const MAX_DECOR_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const ALLOWED_SOUND = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-m4a'];
const ALLOWED_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];

const mbLabel = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} ميجابايت`;

async function ensureStorageAuth(): Promise<void> {
  let user = auth.currentUser;
  if (!user) {
    user = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 4000);
      const unsub = auth.onAuthStateChanged((u) => {
        clearTimeout(timeout);
        unsub();
        resolve(u);
      });
    });
  }
  if (!user) {
    throw new Error('انتهت جلسة الدخول — سجّل الخروج ثم ادخل من جديد لرفع الملفات');
  }
  try {
    await user.getIdToken(true);
  } catch {
    throw new Error('انتهت جلسة الدخول — سجّل الخروج ثم ادخل من جديد لرفع الملفات');
  }
}

function storageErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code.includes('storage/unauthorized')) {
    return 'رفض الخادم الرفع — سجّل الخروج ثم ادخل من جديد، أو تأكد من نشر قواعد Storage';
  }
  if (code.includes('storage/canceled')) return 'تم إلغاء الرفع';
  if (code.includes('storage/quota-exceeded')) return 'مساحة التخزين ممتلئة';
  return (err as Error)?.message ?? 'فشل رفع الملف';
}

function resolveImageType(file: File): string {
  if (file.type && ALLOWED_IMAGE.includes(file.type)) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  const byExt: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', gif: 'image/gif',
  };
  if (ext && byExt[ext]) return byExt[ext];
  throw new Error('الصيغ المدعومة: PNG, JPG, WebP, GIF');
}

async function uploadToStorage(
  path: string,
  file: File,
  contentType: string,
  onProgress?: (ratio: number) => void,
): Promise<string> {
  await ensureStorageAuth();
  const storageRef = ref(storage, path);
  try {
    // ⚡ رفع قابل للاستئناف بدل uploadBytes: يصمد أمام تذبذب/انقطاع الشبكة (مهم للفيديو/الصور
    //    الكبيرة) ويوفّر نسبة تقدّم اختيارية للواجهة فلا يبدو الرفع «معلّقاً».
    const task = uploadBytesResumable(storageRef, file, { contentType });
    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snap) => {
          if (onProgress && snap.totalBytes > 0) {
            onProgress(snap.bytesTransferred / snap.totalBytes);
          }
        },
        reject,
        () => resolve(),
      );
    });
    return await getDownloadURL(storageRef);
  } catch (e) {
    throw new Error(storageErrorMessage(e));
  }
}

export async function uploadGiftAsset(
  file: File,
  giftId: string,
  kind: 'thumb' | 'animation' | 'sound' | 'video' | 'videoMp4',
  onProgress?: CompressProgress,
): Promise<string> {
  if (!giftId.trim()) throw new Error('احفظ معرّف الهدية أولاً أو أدخل اسم الهدية');
  if (kind !== 'sound') {
    // أصول الهدايا تُعرض بأحجام صغيرة جداً في شبكة الاختيار — نضغطها تلقائياً بجودة
    // خفيفة جداً مهما كان حجم الملف المرفوع، حتى تفتح شاشة الهدايا وتُعرض بسرعة فائقة
    // حتى على الإنترنت الضعيف. أي ملف أكبر من العتبة يُحوَّل تلقائياً لنسخة خفيفة.
    const giftOpts =
      kind === 'thumb'
        ? { maxImageDimension: 512, imageQuality: 72, imageMinBytes: 80 * 1024 }
        : kind === 'animation'
        ? { maxGifDimension: 360, gifFps: 12, gifMinBytes: 250 * 1024 }
        : undefined;
    file = await compressMedia(file, onProgress, giftOpts);
  }
  const maxBytes = MAX_BYTES_BY_KIND[kind];
  if (file.size > maxBytes) {
    throw new Error(`حجم الملف أكبر من ${mbLabel(maxBytes)}`);
  }

  if (kind === 'video') {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    if (!ALLOWED_VIDEO.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|m4v)$/i)) {
      throw new Error('الصيغ المدعومة للفيديو: MP4, MOV, WebM');
    }
    const contentType =
      file.type ||
      (ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4');
    return uploadToStorage(`config/gifts/${giftId}/video.${ext}`, file, contentType);
  }

  if (kind === 'videoMp4') {
    if (!ALLOWED_VIDEO.includes(file.type) && !file.name.match(/\.(mp4|mov|m4v)$/i)) {
      throw new Error('الصيغ المدعومة للاحتياطي: MP4, MOV');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const contentType = file.type || (ext === 'mov' ? 'video/quicktime' : 'video/mp4');
    return uploadToStorage(`config/gifts/${giftId}/video_ios.${ext}`, file, contentType);
  }

  if (kind === 'sound') {
    if (!ALLOWED_SOUND.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      throw new Error('الصيغ المدعومة للصوت: MP3, WAV, OGG');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
    return uploadToStorage(`config/gifts/${giftId}/sound.${ext}`, file, file.type || 'audio/mpeg');
  }

  const contentType = resolveImageType(file);
  if (kind === 'animation' && contentType !== 'image/gif' && !file.name.toLowerCase().endsWith('.gif')) {
    throw new Error('الهدية المتحركة تتطلب ملف GIF');
  }
  if (kind === 'thumb' && contentType === 'image/gif') {
    throw new Error('صورة القائمة: استخدم PNG أو JPG (GIF لنوع «متحركة» فقط)');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  return uploadToStorage(`config/gifts/${giftId}/${kind}.${ext}`, file, contentType);
}

export async function uploadVipAsset(
  file: File,
  id: string,
  kind: 'badge' | 'badgeAnim' | 'privilege' | 'background' | 'video' | 'videoMp4',
  onProgress?: CompressProgress,
): Promise<string> {
  if (!id.trim()) throw new Error('أدخل معرّف المستوى أو الامتياز أولاً');
  const compressOpts =
    kind === 'badge' || kind === 'privilege' || kind === 'background'
      ? { maxImageDimension: 2048, imageQuality: 92, imageMinBytes: 2 * 1024 * 1024 }
      : kind === 'badgeAnim'
        ? { maxGifDimension: 720, gifFps: 15, gifMinBytes: 1.5 * 1024 * 1024 }
        : undefined;
  file = await compressMedia(file, onProgress, compressOpts);

  if (kind === 'video') {
    if (file.size > 50 * 1024 * 1024) throw new Error(`حجم الملف أكبر من ${mbLabel(50 * 1024 * 1024)}`);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    if (!ALLOWED_VIDEO.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|m4v)$/i)) {
      throw new Error('الصيغ المدعومة للفيديو: MP4, MOV, WebM');
    }
    const contentType =
      file.type ||
      (ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4');
    return uploadToStorage(`config/vip/${id}/video.${ext}`, file, contentType);
  }

  if (kind === 'videoMp4') {
    if (file.size > 50 * 1024 * 1024) throw new Error(`حجم الملف أكبر من ${mbLabel(50 * 1024 * 1024)}`);
    if (!ALLOWED_VIDEO.includes(file.type) && !file.name.match(/\.(mp4|mov|m4v)$/i)) {
      throw new Error('الصيغ المدعومة للاحتياطي: MP4, MOV');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const contentType = file.type || (ext === 'mov' ? 'video/quicktime' : 'video/mp4');
    return uploadToStorage(`config/vip/${id}/video_ios.${ext}`, file, contentType);
  }

  const maxBytes =
    kind === 'badgeAnim'
      ? 25 * 1024 * 1024
      : kind === 'privilege' || kind === 'background'
      ? 35 * 1024 * 1024
      : 10 * 1024 * 1024;
  if (file.size > maxBytes) throw new Error(`حجم الملف أكبر من ${mbLabel(maxBytes)}`);
  const contentType = resolveImageType(file);
  if (kind === 'badgeAnim' && contentType !== 'image/gif' && !file.name.toLowerCase().endsWith('.gif')) {
    throw new Error('الشارة المتحركة تتطلب ملف GIF');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  return uploadToStorage(`config/vip/${id}/${kind}.${ext}`, file, contentType);
}

export async function uploadAristocracyAsset(
  file: File,
  id: string,
  kind: 'emblem' | 'privilege' | 'background' | 'video' | 'videoMp4',
  onProgress?: CompressProgress,
): Promise<string> {
  if (!id.trim()) throw new Error('أدخل معرّف التصنيف أو الامتياز أولاً');
  file = await compressMedia(file, onProgress);

  if (kind === 'video') {
    if (file.size > 50 * 1024 * 1024) throw new Error(`حجم الملف أكبر من ${mbLabel(50 * 1024 * 1024)}`);
    if (!ALLOWED_VIDEO.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|m4v)$/i)) {
      throw new Error('الصيغ المدعومة للفيديو: MP4, MOV, WebM');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const contentType =
      file.type ||
      (ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4');
    return uploadToStorage(`config/aristocracy/${id}/video.${ext}`, file, contentType);
  }

  if (kind === 'videoMp4') {
    if (file.size > 50 * 1024 * 1024) throw new Error(`حجم الملف أكبر من ${mbLabel(50 * 1024 * 1024)}`);
    if (!ALLOWED_VIDEO.includes(file.type) && !file.name.match(/\.(mp4|mov|m4v)$/i)) {
      throw new Error('الصيغ المدعومة للاحتياطي: MP4, MOV');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const contentType = file.type || (ext === 'mov' ? 'video/quicktime' : 'video/mp4');
    return uploadToStorage(`config/aristocracy/${id}/video_ios.${ext}`, file, contentType);
  }

  if (file.size > 35 * 1024 * 1024) throw new Error(`حجم الملف أكبر من ${mbLabel(35 * 1024 * 1024)}`);
  const contentType = resolveImageType(file);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  return uploadToStorage(`config/aristocracy/${id}/${kind}.${ext}`, file, contentType);
}

const ARISTOCRACY_LEVEL_FOLDER_IDS = ['noble', 'minister', 'prince', 'king', 'aristocrat'] as const;

export interface AristocracyPrivilegeMeta {
  levelId: string;
  privId: string;
  assetKey: string;
  titleAr?: string;
  titleEn?: string;
}

export interface DiscoveredAristocracyUpload extends AristocracyPrivilegeMeta {
  storageId: string;
  imageUrl?: string;
  videoUrl?: string;
  videoUrlMp4?: string;
}

export async function saveAristocracyPrivilegeMeta(
  storageId: string,
  meta: AristocracyPrivilegeMeta,
): Promise<void> {
  const blob = new Blob([JSON.stringify(meta)], { type: 'application/json' });
  const file = new File([blob], 'meta.json', { type: 'application/json' });
  await uploadToStorage(`config/aristocracy/${storageId}/meta.json`, file, 'application/json');
}

async function discoverAristocracyUploadedAssetsViaClient(): Promise<DiscoveredAristocracyUpload[]> {
  const rootRef = ref(storage, 'config/aristocracy');
  const listing = await listAll(rootRef);
  const results: DiscoveredAristocracyUpload[] = [];

  for (const prefix of listing.prefixes) {
    const storageId = prefix.name;
    if (ARISTOCRACY_LEVEL_FOLDER_IDS.includes(storageId as typeof ARISTOCRACY_LEVEL_FOLDER_IDS[number])) {
      continue;
    }

    let levelId = '';
    let privId = '';
    for (const lid of ARISTOCRACY_LEVEL_FOLDER_IDS) {
      if (storageId.startsWith(`${lid}_`)) {
        levelId = lid;
        privId = storageId.slice(lid.length + 1);
        break;
      }
    }
    if (!levelId || !privId) continue;

    const files = await listAll(prefix);
    let imageUrl: string | undefined;
    let videoUrl: string | undefined;
    let videoUrlMp4: string | undefined;
    let meta: AristocracyPrivilegeMeta | undefined;

    for (const item of files.items) {
      const name = item.name.toLowerCase();
      const url = await getDownloadURL(item);
      if (name === 'meta.json') {
        try {
          const res = await fetch(url);
          meta = (await res.json()) as AristocracyPrivilegeMeta;
        } catch {
          /* ignore invalid meta */
        }
        continue;
      }
      if (name.startsWith('privilege.') || name.startsWith('emblem.')) imageUrl = url;
      else if (name.startsWith('video_ios.')) videoUrlMp4 = url;
      else if (name.startsWith('video.')) videoUrl = url;
    }

    if (!imageUrl && !videoUrl && !videoUrlMp4) continue;

    const assetKey = meta?.assetKey || (videoUrl || videoUrlMp4 ? 'entry' : 'badge');
    results.push({
      storageId,
      levelId: meta?.levelId || levelId,
      privId: meta?.privId || privId,
      assetKey,
      titleAr: meta?.titleAr,
      titleEn: meta?.titleEn,
      imageUrl,
      videoUrl,
      videoUrlMp4,
    });
  }

  return results;
}

/** استعادة الملفات المرفوعة من Storage عند فقدان بيانات Firestore */
export async function discoverAristocracyUploadedAssets(): Promise<DiscoveredAristocracyUpload[]> {
  await ensureStorageAuth();
  try {
    const fn = httpsCallable<Record<string, never>, { uploads: DiscoveredAristocracyUpload[] }>(
      functions,
      'adminDiscoverAristocracyUploads',
    );
    const res = await fn({});
    return res.data.uploads ?? [];
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    if (code !== 'functions/not-found' && code !== 'functions/unavailable') {
      throw err;
    }
    try {
      return await discoverAristocracyUploadedAssetsViaClient();
    } catch (clientErr) {
      const clientCode = (clientErr as { code?: string })?.code ?? '';
      if (clientCode.includes('storage/unauthorized')) {
        throw new Error(
          'رفض Storage — انشر قواعد Storage والـ Cloud Function adminDiscoverAristocracyUploads ثم أعد المحاولة',
        );
      }
      throw clientErr;
    }
  }
}

export async function uploadAgencyPrinceAsset(
  file: File,
  kind: 'badge' | 'crown' | 'entry' | 'entry-animation' | 'entry-video' | 'entry-video-ios' | 'frame' | 'bubble',
  onProgress?: CompressProgress,
): Promise<string> {
  file = await compressMedia(file, onProgress);

  if (kind === 'entry-video') {
    if (file.size > 50 * 1024 * 1024) throw new Error(`حجم الملف أكبر من ${mbLabel(50 * 1024 * 1024)}`);
    if (!ALLOWED_VIDEO.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|m4v)$/i)) {
      throw new Error('الصيغ المدعومة للفيديو: MP4, MOV, WebM');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const contentType =
      file.type ||
      (ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4');
    return uploadToStorage(`config/agency-prince/entry-video.${ext}`, file, contentType);
  }

  if (kind === 'entry-video-ios') {
    if (file.size > 50 * 1024 * 1024) throw new Error(`حجم الملف أكبر من ${mbLabel(50 * 1024 * 1024)}`);
    if (!ALLOWED_VIDEO.includes(file.type) && !file.name.match(/\.(mp4|mov|m4v)$/i)) {
      throw new Error('الصيغ المدعومة للاحتياطي: MP4, MOV');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const contentType = file.type || (ext === 'mov' ? 'video/quicktime' : 'video/mp4');
    return uploadToStorage(`config/agency-prince/entry-video_ios.${ext}`, file, contentType);
  }

  if (file.size > 25 * 1024 * 1024) throw new Error(`حجم الملف أكبر من ${mbLabel(25 * 1024 * 1024)}`);
  const isVideo = kind === 'entry-animation' && /video|gif/i.test(file.type);
  const contentType = isVideo ? file.type : resolveImageType(file);
  const ext = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'png');
  return uploadToStorage(`config/agency-prince/${kind}.${ext}`, file, contentType);
}

export async function uploadStoreAsset(
  file: File,
  itemId: string,
  kind: 'image' | 'animation' | 'video' | 'videoMp4',
  onProgress?: CompressProgress,
): Promise<string> {
  if (!itemId.trim()) throw new Error('أدخل معرّف العنصر أولاً');
  file = await compressMedia(file, onProgress);
  const maxBytes = (kind === 'animation' || kind === 'video' || kind === 'videoMp4') ? 25 * 1024 * 1024 : MAX_DECOR_BYTES;
  if (file.size > maxBytes) throw new Error(`حجم الملف أكبر من ${mbLabel(maxBytes)}`);

  if (kind === 'video') {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    if (!ALLOWED_VIDEO.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|m4v)$/i)) {
      throw new Error('الصيغ المدعومة للفيديو: MP4, MOV, WebM');
    }
    const contentType =
      file.type ||
      (ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4');
    return uploadToStorage(`config/store/${itemId}/video.${ext}`, file, contentType);
  }

  if (kind === 'videoMp4') {
    if (!ALLOWED_VIDEO.includes(file.type) && !file.name.match(/\.(mp4|mov|m4v)$/i)) {
      throw new Error('الصيغ المدعومة للاحتياطي: MP4, MOV');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const contentType = file.type || (ext === 'mov' ? 'video/quicktime' : 'video/mp4');
    return uploadToStorage(`config/store/${itemId}/video_ios.${ext}`, file, contentType);
  }

  const contentType = resolveImageType(file);
  if (kind === 'animation' && contentType !== 'image/gif' && !file.name.toLowerCase().endsWith('.gif')) {
    throw new Error('الأنيميشن يتطلب ملف GIF');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  return uploadToStorage(`config/store/${itemId}/${kind}.${ext}`, file, contentType);
}

export async function uploadDecorAsset(
  file: File,
  kind: 'frames' | 'backgrounds',
  id: string,
): Promise<string> {
  if (!id.trim()) throw new Error('معرّف العنصر غير صالح');
  if (file.size > MAX_DECOR_BYTES) {
    throw new Error(`حجم الملف أكبر من ${mbLabel(MAX_DECOR_BYTES)}`);
  }
  const contentType = resolveImageType(file);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  return uploadToStorage(`config/${kind}/${id}/image.${ext}`, file, contentType);
}

/** رفع أيقونة تصنيف رموز الروم — config/room-reactions/{packId}/icon/ */
export async function uploadRoomReactionPackIcon(
  file: File,
  packId: string,
): Promise<string> {
  return uploadRoomReactionAsset(file, packId, 'icon');
}

/** رفع صورة/GIF لرموز الروم — config/room-reactions/{packId}/{itemId}/ */
export async function uploadRoomReactionAsset(
  file: File,
  packId: string,
  itemId: string,
): Promise<string> {
  if (!packId.trim() || !itemId.trim()) {
    throw new Error('احفظ معرّف التصنيف والصورة أولاً');
  }
  if (file.size > MAX_DECOR_BYTES) {
    throw new Error(`حجم الملف أكبر من ${mbLabel(MAX_DECOR_BYTES)}`);
  }
  const contentType = resolveImageType(file);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  return uploadToStorage(
    `config/room-reactions/${packId}/${itemId}/image.${ext}`,
    file,
    contentType,
  );
}

/** رفع أيقونة حزمة ملصقات — config/stickers/{packId}/icon/ */
export async function uploadStickerPackIcon(
  file: File,
  packId: string,
): Promise<string> {
  return uploadStickerAsset(file, packId, 'icon');
}

/** رفع ملصق (صورة/GIF/WebP متحرك) — config/stickers/{packId}/{itemId}/ */
export async function uploadStickerAsset(
  file: File,
  packId: string,
  itemId: string,
): Promise<string> {
  if (!packId.trim() || !itemId.trim()) {
    throw new Error('احفظ معرّف الحزمة والملصق أولاً');
  }
  if (file.size > MAX_DECOR_BYTES) {
    throw new Error(`حجم الملف أكبر من ${mbLabel(MAX_DECOR_BYTES)}`);
  }
  const contentType = resolveImageType(file);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  return uploadToStorage(
    `config/stickers/${packId}/${itemId}/image.${ext}`,
    file,
    contentType,
  );
}

/** رفع أصول موظفي التطبيق — صورة / إطار GIF / شعار */
export async function uploadStaffAsset(
  file: File,
  uid: string,
  kind: 'avatar' | 'frame' | 'badge',
): Promise<string> {
  if (!uid.trim()) throw new Error('معرّف الموظف غير صالح');
  if (file.size > MAX_DECOR_BYTES) {
    throw new Error(`حجم الملف أكبر من ${mbLabel(MAX_DECOR_BYTES)}`);
  }
  const contentType =
    kind === 'frame' && (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif'))
      ? 'image/gif'
      : resolveImageType(file);
  const ext = file.name.split('.').pop()?.toLowerCase() || (contentType === 'image/gif' ? 'gif' : 'png');
  return uploadToStorage(`config/staff/${uid}/${kind}.${ext}`, file, contentType);
}

/** رفع دخولية فيديو للموظف — WebM/MP4 + احتياطي iOS */
export async function uploadStaffEntryVideo(
  file: File,
  uid: string,
  kind: 'video' | 'videoMp4',
): Promise<string> {
  if (!uid.trim()) throw new Error('معرّف الموظف غير صالح');
  if (file.size > 50 * 1024 * 1024) {
    throw new Error(`حجم الملف أكبر من ${mbLabel(50 * 1024 * 1024)}`);
  }
  if (kind === 'video') {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    if (!ALLOWED_VIDEO.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|m4v)$/i)) {
      throw new Error('الصيغ المدعومة للفيديو: MP4, MOV, WebM');
    }
    const contentType =
      file.type ||
      (ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4');
    return uploadToStorage(`config/staff/${uid}/entry-video.${ext}`, file, contentType);
  }
  if (!ALLOWED_VIDEO.includes(file.type) && !file.name.match(/\.(mp4|mov|m4v)$/i)) {
    throw new Error('الصيغ المدعومة للاحتياطي: MP4, MOV');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const contentType = file.type || (ext === 'mov' ? 'video/quicktime' : 'video/mp4');
  return uploadToStorage(`config/staff/${uid}/entry-video_ios.${ext}`, file, contentType);
}

/** شعار/بانر وكالة سوبر أدمن */
export async function uploadStaffAgencyAsset(
  file: File,
  uid: string,
  kind: 'logo' | 'banner',
): Promise<string> {
  if (!uid.trim()) throw new Error('معرّف الموظف غير صالح');
  if (file.size > MAX_DECOR_BYTES) {
    throw new Error(`حجم الملف أكبر من ${mbLabel(MAX_DECOR_BYTES)}`);
  }
  const contentType =
    file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')
      ? 'image/gif'
      : resolveImageType(file);
  const ext = file.name.split('.').pop()?.toLowerCase() || (contentType === 'image/gif' ? 'gif' : 'png');
  return uploadToStorage(`config/staff/${uid}/agency-${kind}.${ext}`, file, contentType);
}

const MAX_APK_BYTES = 150 * 1024 * 1024;

/** رفع APK تجريبي — config/releases/{version}/linkup.apk */
export async function uploadApkRelease(file: File, versionName: string): Promise<string> {
  const version = versionName.trim();
  if (!version) throw new Error('أدخل رقم الإصدار أولاً (مثل 1.2.0)');
  const name = file.name.toLowerCase();
  if (!name.endsWith('.apk')) throw new Error('الملف يجب أن يكون بصيغة APK');
  if (file.size > MAX_APK_BYTES) {
    throw new Error(`حجم APK أكبر من ${mbLabel(MAX_APK_BYTES)}`);
  }
  const safeVersion = version.replace(/[^a-zA-Z0-9._-]/g, '_');
  return uploadToStorage(
    `config/releases/${safeVersion}/linkup.apk`,
    file,
    'application/vnd.android.package-archive',
  );
}
