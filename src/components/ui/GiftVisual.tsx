/**
 * عرض هدية — أيقونة Lucide أو صورة من لوحة التحكم
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import * as LucideIcons from 'lucide-react-native';
import { Gift } from 'lucide-react-native';
import {
  giftMediaCandidates,
  resolveGiftMediaUrl,
  type GiftLike,
  type GiftMediaUrlOrder,
} from './giftUtils';

export type { GiftLike } from './giftUtils';
export { usesGiftImage, resolveGiftMediaUrl } from './giftUtils';
/** @deprecated استخدم resolveGiftMediaUrl */
export const giftDisplayUrl = resolveGiftMediaUrl;

interface GiftVisualProps {
  gift: GiftLike;
  size: number;
  style?: any;
  /** @deprecated استخدم mediaOrder */
  preferAnimation?: boolean;
  /** image-first = القائمة/الأنيميشن overlay، animation-first = GIF أولاً */
  mediaOrder?: GiftMediaUrlOrder;
  /** قص دائري — للأنيميشن بدون إطار مربع */
  clipCircle?: boolean;
  /** تشغيل GIF متحرك (إعادة تحميل عند التفعيل) */
  animateGif?: boolean;
  /**
   * تجاوز سياسة الكاش. الافتراضي: 'none' عند تشغيل GIF (لإعادة التشغيل من البداية)
   * و'memory-disk' لغير ذلك. مرّر 'memory-disk' في الشبكات/القوائم لتفادي إعادة
   * تنزيل الصور عند كل رسم (مهم للإنترنت الضعيف).
   */
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
}

const GiftVisualComponent: React.FC<GiftVisualProps> = ({
  gift,
  size,
  style,
  preferAnimation = false,
  mediaOrder,
  clipCircle = false,
  animateGif = false,
  cachePolicy,
}) => {
  const resolvedOrder: GiftMediaUrlOrder =
    mediaOrder ?? (preferAnimation ? 'animation-first' : 'image-first');

  const candidates = useMemo(
    () => giftMediaCandidates(gift, resolvedOrder),
    [gift.imageUrl, gift.animationUrl, resolvedOrder],
  );

  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  useEffect(() => {
    setFailedUrls([]);
  }, [candidates.join('|')]);

  const url = candidates.find((u) => !failedUrls.includes(u)) ?? null;

  if (url) {
    const image = (
      <Image
        key={animateGif ? `gif-${url}` : `img-${url}`}
        source={{ uri: url }}
        style={[{ width: size, height: size, backgroundColor: 'transparent' }, style]}
        contentFit="contain"
        cachePolicy={cachePolicy ?? (animateGif ? 'none' : 'memory-disk')}
        recyclingKey={url}
        onError={() => setFailedUrls((prev) => (prev.includes(url) ? prev : [...prev, url]))}
      />
    );

    if (clipCircle) {
      return (
        <View
          style={[
            styles.circleClip,
            { width: size, height: size, borderRadius: size / 2 },
            style,
          ]}
        >
          {image}
        </View>
      );
    }

    return image;
  }

  const IconComp = (LucideIcons as any)[gift.iconName] ?? Gift;
  return (
    <View style={[styles.iconWrap, style]}>
      <IconComp size={size} color={gift.iconColor} fill={gift.iconColor} strokeWidth={0} />
    </View>
  );
};

export const GiftVisual = React.memo(GiftVisualComponent);
GiftVisual.displayName = 'GiftVisual';

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleClip: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
