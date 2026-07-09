/**
 * ضغط الصور قبل الرفع لتسريع الرفع وتقليل الاستهلاك.
 *
 * مبادئ السلامة (حتى لا نؤثر على أي وظيفة):
 *  - تصغير بالعرض فقط (width) → النسبة (aspect ratio) محفوظة تلقائياً ولا تشوّه الصورة.
 *  - تصغير فقط لا تكبير: لو عرض الصورة الأصلي ≤ الحد الأقصى نتركها كما هي (لا نكبّرها).
 *  - أي فشل في المعالجة → نُعيد الـ URI الأصلي كما هو (الرفع لا ينكسر أبداً).
 *  - تُستعمل فقط لصور المستخدم (بروفايل/ألبوم/منشورات/بانر/شات). لا تُستعمل للفيديو أو الصوت
 *    ولا للهدايا (التي قد تحتاج شفافية PNG).
 */
import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

export interface CompressOptions {
  /** أقصى عرض بالبكسل — لو الأصل أكبر منه نصغّره لهذا العرض (بلا تكبير) */
  maxWidth: number;
  /** جودة JPEG بين 0 و 1 */
  quality: number;
}

/** إعدادات جاهزة حسب نوع الصورة */
export const COMPRESS_PRESETS = {
  avatar: { maxWidth: 720, quality: 0.72 },
  post: { maxWidth: 1280, quality: 0.75 },
  album: { maxWidth: 1280, quality: 0.75 },
  banner: { maxWidth: 1280, quality: 0.78 },
  chat: { maxWidth: 1280, quality: 0.72 },
} as const;

/** قياس أبعاد صورة محلية (لا يفشل الرفع لو تعذّر القياس) */
const getImageWidth = (uri: string): Promise<number> =>
  new Promise((resolve) => {
    try {
      Image.getSize(
        uri,
        (width) => resolve(width || 0),
        () => resolve(0),
      );
    } catch {
      resolve(0);
    }
  });

/**
 * يضغط الصورة ويعيد URI محلي جديد (JPEG). عند أي خطأ يعيد الأصل بلا تعديل.
 */
export const compressImageForUpload = async (
  uri: string,
  opts: CompressOptions,
): Promise<string> => {
  try {
    const width = await getImageWidth(uri);
    const actions: ImageManipulator.Action[] = [];
    if (width && width > opts.maxWidth) {
      actions.push({ resize: { width: opts.maxWidth } });
    }
    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: opts.quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    if (result?.uri) return result.uri;
  } catch {
    /* محاولة ثانية عبر نسخ الملف */
  }

  try {
    const FileSystem = await import('expo-file-system');
    const dest = `${FileSystem.cacheDirectory}img_${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists && (info.size ?? 0) > 0) return dest;
  } catch {
    /* ignore */
  }

  return uri;
};
