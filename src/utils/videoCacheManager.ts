import * as FileSystem from 'expo-file-system';

const VIDEO_DIR = FileSystem.cacheDirectory + 'video_gifts/';
const videoCache = new Map<string, string>();
let isDirEnsured = false;

// التأكد من وجود مجلد الكاش محلياً على الجهاز
async function ensureDir(): Promise<void> {
  if (isDirEnsured) return;
  const dirInfo = await FileSystem.getInfoAsync(VIDEO_DIR);
  if (!dirInfo.exists) {
    try {
      await FileSystem.makeDirectoryAsync(VIDEO_DIR, { intermediates: true });
      isDirEnsured = true;
    } catch (e) {
      console.warn('[VideoCache] Failed to create cache directory:', e);
    }
  } else {
    isDirEnsured = true;
  }
}

// تحويل رابط الويب لاسم ملف محلي آمن ومميز
function getLocalFilename(url: string): string {
  const sanitized = encodeURIComponent(url.trim()).replace(/%/g, '_');
  // استخراج الامتداد الافتراضي (.mp4 أو .webm)
  const parts = url.split('.');
  const lastPart = parts[parts.length - 1] || 'mp4';
  const extension = lastPart.split('?')[0] || 'mp4';
  return `${sanitized.slice(-100)}.${extension}`;
}

/**
 * تنزيل الفيديو مسبقاً وتخزينه في الكاش
 * @param url رابط الفيديو على Firebase Storage أو الويب
 * @returns المسار المحلي للفيديو على الجهاز بعد تحميله
 */
export async function preloadVideo(url: string): Promise<string | null> {
  const key = url?.trim();
  if (!key) return null;

  if (videoCache.has(key)) {
    return videoCache.get(key)!;
  }

  try {
    await ensureDir();
    const filename = getLocalFilename(key);
    const localUri = VIDEO_DIR + filename;

    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      videoCache.set(key, localUri);
      return localUri;
    }

    // تنزيل ملف الفيديو من الإنترنت وحفظه محلياً
    const downloadResult = await FileSystem.downloadAsync(key, localUri);
    if (downloadResult.status === 200) {
      videoCache.set(key, downloadResult.uri);
      return downloadResult.uri;
    }
  } catch (e) {
    console.warn('[VideoCache] Failed to preload video:', key, e);
  }
  return null;
}

/**
 * الحصول على مسار الفيديو المحلي المخزن بالكاش
 * @param url رابط الفيديو على الويب
 * @returns رابط المسار المحلي أو الرابط الأصلي في حال لم يكتمل تنزيله بعد
 */
export function getCachedVideoUri(url: string): string {
  const key = url?.trim();
  if (!key) return '';
  return videoCache.get(key) || key;
}

/** ينتظر التحميل المحلي — ضروري لإزالة الخلفية (WebGL + CORS) */
export async function resolveGiftVideoUri(url: string): Promise<string> {
  const key = url?.trim();
  if (!key) return '';
  const local = await preloadVideo(key);
  return local || key;
}

/** تشغيل فوري من الكاش أو الرابط — بدون انتظار تنزيل كامل (لدخوليات الغرف) */
export function resolveEntryVideoUriFast(url: string): string {
  const key = url?.trim();
  if (!key) return '';
  return getCachedVideoUri(key);
}

/** تنزيل بالخلفية لتحسين التشغيل لاحقاً — لا يحجب الواجهة */
export function preloadVideoBackground(url: string): void {
  void preloadVideo(url?.trim() || '');
}

export function isLocalVideoUri(uri: string): boolean {
  const u = uri.trim().toLowerCase();
  return u.startsWith('file://') || u.startsWith('content://');
}
