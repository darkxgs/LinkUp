/**
 * LinkUp App — Firebase Storage Service
 * رفع الصور (الأفاتارات، الألبومات، البانرات، صور المنشورات) إلى Firebase Storage
 * كل الصور تخزّن في cloud وليس على الجهاز
 */

import {
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';
import { storage, auth } from './index';
import { waitForFirestoreAuth, SESSION_EXPIRED_MSG } from './authReady';
import { compressImageForUpload, COMPRESS_PRESETS } from '@/utils/imageCompress';
import {
  uriToUploadBlob,
  assertUploadSize,
  translateStorageUploadError,
  guessImageContentType,
} from '@/utils/mediaUpload';

export type UploadProgress = (percent: number) => void;

// ضغط قبل الرفع حسب المجلد. المجلدات غير المذكورة (rooms/gifts) تُرفع كما هي
// (قد تحتاج شفافية PNG أو تُدار من الأدمن) — حفاظاً على الوظيفة.
const COMPRESS_BY_FOLDER: Partial<Record<string, CompressPreset>> = {
  avatars: COMPRESS_PRESETS.avatar,
  posts: COMPRESS_PRESETS.post,
  albums: COMPRESS_PRESETS.album,
  banners: COMPRESS_PRESETS.banner,
};
type CompressPreset = (typeof COMPRESS_PRESETS)[keyof typeof COMPRESS_PRESETS];

// ==================== HELPERS ====================

/**
 * تحويل URI محلي لـ blob للرفع — متوافق مع content:// على Android
 */
const uriToBlob = uriToUploadBlob;

/**
 * توليد اسم ملف فريد
 */
const generateFileName = (uid: string, ext: string = 'jpg'): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${uid}_${timestamp}_${random}.${ext}`;
};

/**
 * استخراج امتداد من URI
 */
const getExtension = (uri: string): string => {
  const match = uri.match(/\.(\w+)(\?|$)/);
  return match?.[1]?.toLowerCase() ?? 'jpg';
};

/** يضمن جلسة صالحة قبل الرفع — مع إعادة محاولة لتحديث التوكن */
async function ensureUploadAuth() {
  const user = await waitForFirestoreAuth(15_000);
  if (!user) throw new Error(SESSION_EXPIRED_MSG);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await user.getIdToken(attempt > 0);
      return user;
    } catch {
      if (attempt === 1) throw new Error(SESSION_EXPIRED_MSG);
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(SESSION_EXPIRED_MSG);
}

// ==================== UPLOAD IMAGE ====================

/**
 * رفع صورة عامة لـ Firebase Storage
 * @param uri - مسار محلي من image picker
 * @param folder - المجلد (avatars/posts/banners/albums)
 * @param onProgress - callback لتتبع نسبة الرفع
 * @returns download URL من Firebase
 */
export const uploadImage = async (
  uri: string,
  folder: 'avatars' | 'posts' | 'banners' | 'albums' | 'rooms' | 'gifts' | 'agencies',
  onProgress?: UploadProgress,
  /** رفع الملف كما هو دون ضغط/تحويل JPEG — يحفظ شفافية PNG */
  skipCompress = false,
): Promise<string> => {
  const user = await ensureUploadAuth();
  const rawExt = getExtension(uri);
  const isGif = rawExt === 'gif';
  // skipCompress: keep PNG transparency; GIF: keep animation (SVIP animated avatar)
  const preset = skipCompress || isGif ? undefined : COMPRESS_BY_FOLDER[folder];
  let uploadUri = uri;
  try {
    uploadUri = preset ? await compressImageForUpload(uri, preset) : uri;
  } catch {
    uploadUri = uri;
  }

  const ext = isGif ? 'gif' : (preset ? 'jpg' : getExtension(uploadUri));
  const contentType = guessImageContentType(uploadUri, ext);
  const fileName = generateFileName(user.uid, ext);
  const path = `${folder}/${user.uid}/${fileName}`;
  const fileRef = storageRef(storage, path);

  let blob: Blob;
  try {
    blob = await uriToBlob(uploadUri, contentType);
    assertUploadSize(blob);
  } catch (e) {
    throw new Error(translateStorageUploadError(e));
  }

  const metadata = { contentType: blob.type || contentType };

  if (onProgress) {
    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(fileRef, blob, metadata);
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(percent);
        },
        (error) => reject(new Error(translateStorageUploadError(error))),
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (e) {
            reject(new Error(translateStorageUploadError(e)));
          }
        },
      );
    });
  }

  try {
    const snapshot = await uploadBytes(fileRef, blob, metadata);
    return await getDownloadURL(snapshot.ref);
  } catch (e) {
    throw new Error(translateStorageUploadError(e));
  }
};

// ==================== UPLOAD AVATAR ====================

/**
 * رفع صورة الملف الشخصي
 * يستبدل القديمة ويرجع الـ URL الجديد
 */
export const uploadAvatar = async (
  uri: string,
  onProgress?: UploadProgress,
): Promise<string> => {
  return uploadImage(uri, 'avatars', onProgress);
};

// ==================== UPLOAD POST IMAGE ====================

export const uploadPostImage = async (
  uri: string,
  onProgress?: UploadProgress,
): Promise<string> => {
  return uploadImage(uri, 'posts', onProgress);
};

export const uploadCommentImage = async (
  uri: string,
  onProgress?: UploadProgress,
): Promise<string> => {
  return uploadImage(uri, 'posts', onProgress);
};

// ==================== UPLOAD ROOM BANNER ====================

export const uploadRoomBanner = async (
  uri: string,
  onProgress?: UploadProgress,
): Promise<string> => {
  return uploadImage(uri, 'banners', onProgress);
};

// ==================== UPLOAD ALBUM IMAGE ====================

export const uploadAlbumImage = async (
  uri: string,
  onProgress?: UploadProgress,
): Promise<string> => {
  return uploadImage(uri, 'albums', onProgress);
};

// ==================== UPLOAD VOICE BIO ====================

/**
 * رفع التسجيل الصوتي للبروفايل
 */
export const uploadVoiceBio = async (
  uri: string,
  onProgress?: UploadProgress,
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const ext = uri.includes('.m4a') ? 'm4a' : uri.includes('.mp3') ? 'mp3' : 'm4a';
  const fileName = generateFileName(user.uid, ext);
  // المسار المطابق لقاعدة Storage المنشورة: voice_bios/{uid}/{file} (المالك فقط، حتى 5MB)
  const path = `voice_bios/${user.uid}/${fileName}`;
  const fileRef = storageRef(storage, path);
  const blob = await uriToBlob(uri);
  const contentType = ext === 'mp3' ? 'audio/mpeg' : 'audio/m4a';

  if (onProgress) {
    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(fileRef, blob, { contentType });
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(percent);
        },
        reject,
        async () => resolve(await getDownloadURL(uploadTask.snapshot.ref)),
      );
    });
  }

  const snapshot = await uploadBytes(fileRef, blob, { contentType });
  return getDownloadURL(snapshot.ref);
};

// ==================== UPLOAD MULTIPLE IMAGES ====================

export const uploadMultipleImages = async (
  uris: string[],
  folder: 'albums' | 'posts',
  onProgress?: (uri: string, percent: number) => void,
): Promise<string[]> => {
  const urls: string[] = [];
  for (const uri of uris) {
    const url = await uploadImage(uri, folder, (percent) =>
      onProgress?.(uri, percent),
    );
    urls.push(url);
  }
  return urls;
};

// ==================== DELETE IMAGE ====================

/**
 * حذف صورة من Storage
 * يحتاج Storage URL كامل
 */
export const deleteImage = async (downloadURL: string): Promise<void> => {
  try {
    // استخراج المسار من الـ URL
    const decodedUrl = decodeURIComponent(downloadURL);
    const matches = decodedUrl.match(/\/o\/(.+?)\?/);
    if (!matches?.[1]) {
      console.warn('Invalid storage URL:', downloadURL);
      return;
    }
    const path = matches[1];
    const fileRef = storageRef(storage, path);
    await deleteObject(fileRef);
  } catch (e) {
    console.error('deleteImage error:', e);
  }
};

// ==================== LIST USER IMAGES ====================

/**
 * جلب كل صور المستخدم من مجلد معين
 */
export const listUserImages = async (
  folder: 'avatars' | 'albums' | 'posts',
): Promise<string[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const folderRef = storageRef(storage, `${folder}/${user.uid}`);
    const result = await listAll(folderRef);
    const urls = await Promise.all(
      result.items.map((item) => getDownloadURL(item)),
    );
    return urls;
  } catch (e) {
    console.error('listUserImages error:', e);
    return [];
  }
};

// ==================== UTILITY: CHECK IS STORAGE URL ====================

/**
 * تحقق إذا كان URL من Firebase Storage
 */
export const isStorageURL = (url: string): boolean => {
  return url.includes('firebasestorage.googleapis.com') ||
         url.includes('firebasestorage.app');
};
