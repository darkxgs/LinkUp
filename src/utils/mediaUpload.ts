/**
 * قراءة ملفات محلية (file:// / content:// / ph://) وتحويلها لـ Blob — متوافق مع iOS و Android
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

import { auth } from '@/services/firebase/index';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function guessImageContentType(uri: string, extHint?: string): string {
  const ext = (extHint ?? uri.match(/\.(\w+)(\?|$)/)?.[1] ?? 'jpg').toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'heic' || ext === 'heif') return 'image/jpeg';
  return 'image/jpeg';
}

/** نسخ URI إلى ملف مؤقت file:// — يعمل مع content:// على Android */
export async function ensureLocalFileUri(uri: string, ext = 'jpg'): Promise<string> {
  const normalized = uri.trim();
  if (!normalized) throw new Error('مسار الملف غير صالح');
  if (normalized.startsWith('file://')) return normalized;

  const dest = `${FileSystem.cacheDirectory}upload_${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: normalized, to: dest });
  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists || (info.size ?? 0) <= 0) {
    throw new Error('تعذّر تجهيز الصورة للرفع');
  }
  return dest;
}

async function blobFromBase64(base64: string, contentType: string): Promise<Blob> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

/** قراءة URI محلي كـ Blob — fetch أولاً ثم FileSystem */
export async function uriToUploadBlob(
  uri: string,
  contentTypeHint = 'image/jpeg',
): Promise<Blob> {
  const normalized = uri.trim();
  if (!normalized) throw new Error('مسار الملف غير صالح');

  const contentType = contentTypeHint || guessImageContentType(normalized);

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    const res = await fetch(normalized);
    if (!res.ok) throw new Error('تعذّر قراءة الملف من الشبكة');
    const blob = await res.blob();
    if (blob.size > 0) return blob;
    throw new Error('الملف فارغ');
  }

  try {
    const res = await fetch(normalized);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) return blob;
    }
  } catch {
    /* content:// قد يفشل fetch على Android */
  }

  let fileUri = normalized;
  if (!normalized.startsWith('file://')) {
    fileUri = await ensureLocalFileUri(normalized, contentType.includes('jpeg') ? 'jpg' : 'jpg');
  }

  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) {
    throw new Error('الصورة غير موجودة — اخترها مرة أخرى');
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64) throw new Error('تعذّر قراءة الصورة من الجهاز');

  const blob = await blobFromBase64(base64, contentType);
  if (blob.size <= 0) throw new Error('الصورة فارغة');
  return blob;
}

export function assertUploadSize(blob: Blob, maxBytes = MAX_IMAGE_BYTES): void {
  if (blob.size > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(0);
    throw new Error(`حجم الملف كبير جداً (الحد ${mb}MB)`);
  }
}

export function translateStorageUploadError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  const code = String(e?.code ?? '');
  const msg = String(e?.message ?? '');

  if (
    code.includes('unauthenticated')
    || msg.includes('unauthenticated')
    || (code.includes('unauthorized') && !auth.currentUser)
  ) {
    return 'انتهت جلسة الدخول — سجّل دخولاً مرة أخرى ثم أعد الرفع';
  }
  if (code.includes('unauthorized') || msg.includes('Permission denied')) {
    return 'تعذّر رفع الملف — تحقق من صلاحياتك أو أعد تسجيل الدخول';
  }
  if (code.includes('quota') || msg.includes('quota')) {
    return 'مساحة التخزين ممتلئة — تواصل مع الدعم';
  }
  if (code.includes('retry') || msg.includes('network')) {
    return 'تحقق من اتصال الإنترنت وحاول مرة أخرى';
  }
  if (msg.includes('CORS') || msg.includes('Failed to fetch')) {
    return Platform.OS === 'web'
      ? 'تعذّر قراءة الصورة — جرّب صورة أخرى'
      : 'تعذّر قراءة الصورة من الجهاز — اختر صورة من المعرض مرة أخرى';
  }
  return msg || 'فشل رفع الصورة';
}
