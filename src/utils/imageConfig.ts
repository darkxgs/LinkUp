/**
 * إعدادات موحّدة لتحميل الصور عبر expo-image.
 *
 * الهدف: تحميل سريع وسلس حتى على الإنترنت الضعيف:
 *  - cachePolicy = 'memory-disk' → الصورة تُحفظ على القرص فلا تُحمَّل مرتين أبداً.
 *  - placeholder (blurhash) → يظهر تدرّج لوني ناعم فوراً بدل المربّع الفارغ ريثما تصل الصورة.
 *  - transition قصير → ظهور انسيابي بلا وميض.
 *
 * الاستخدام:
 *   import { IMG } from '@/utils/imageConfig';
 *   <Image source={{ uri }} recyclingKey={uri} {...IMG} />
 */

import { PixelRatio, type ImageStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

/** blurhash رمادي/بنفسجي ناعم محايد — placeholder عام يناسب الأفاتار والصور. */
export const BLUR_PLACEHOLDER = 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4';

/** خصائص expo-image الموحّدة للصور الشبكية. */
export const IMG = {
  cachePolicy: 'memory-disk',
  placeholder: { blurhash: BLUR_PLACEHOLDER },
  placeholderContentFit: 'cover',
  transition: 150,
} as const;

/** نفس الإعدادات لكن بلا placeholder — للأيقونات الصغيرة الشفّافة (هدايا/إطارات). */
export const IMG_ICON = {
  cachePolicy: 'memory-disk',
  transition: 120,
} as const;

/** أوسمة SVIP والإطارات الثابتة — أولوية عالية وبدون تصغير يُفقد التفاصيل (فكّ ترميز مرّة واحدة) */
export const IMG_DECOR = {
  cachePolicy: 'memory-disk',
  priority: 'high' as const,
  allowDownscaling: false,
  transition: 120,
} as const;

/**
 * إطارات متحرّكة (GIF) — نسمح بالتصغير لأنها تُفكّ ترميزها لكل إطار باستمرار؛
 * فكّها بالحجم الكامل × كثافة البكسل لكل مقعد يسخّن الجهاز بشدّة (يزداد كلما امتلأت
 * الغرفة). التصغير لحجم العرض يقلّل تكلفة الترميز المستمرّة كثيراً بفرق شبه غير مرئي.
 */
export const IMG_DECOR_ANIMATED = {
  cachePolicy: 'memory-disk',
  priority: 'high' as const,
  transition: 120,
} as const;

/** عرض بكسل كامل على شاشات Retina مع الحفاظ على نفس الحجم المنطقي */
export function sharpImageStyle(width: number, height: number): ImageStyle {
  const ratio = PixelRatio.get();
  return {
    width: width * ratio,
    height: height * ratio,
    transform: [{ scale: 1 / ratio }],
  };
}

/** إعدادات أفاتار الغرفة — placeholder فوري + أولوية عالية. */
export const IMG_AVATAR = {
  ...IMG,
  transition: 100,
  priority: 'high' as const,
} as const;

const prefetchedAvatarUris = new Set<string>();

/** تحميل مسبق سريع لصور الأفاتار — يُخزَّن على القرص لظهور فوري على المقاعد. */
export function prefetchAvatarUris(uris: (string | undefined | null)[]): void {
  for (const raw of uris) {
    const uri = raw?.trim();
    if (!uri || !uri.startsWith('http') || prefetchedAvatarUris.has(uri)) continue;
    prefetchedAvatarUris.add(uri);
    void ExpoImage.prefetch(uri, { cachePolicy: 'memory-disk' });
  }
}
