/**
 * صورة مستخدم داخل إطار شفاف — نفس نسب معاينة المتجر.
 * الإطار فوق الصورة ومتمركز؛ الصورة تملأ الفتحة الدائرية.
 */
import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './Text';
import { lu } from '@/theme/lu-brand';
import { isGifImageUrl } from '@/utils/mediaUrl';
import { IMG_AVATAR, IMG_DECOR, IMG_DECOR_ANIMATED, sharpImageStyle } from '@/utils/imageConfig';

/** نسبة قطر الصورة من حاوية الإطار */
export const FRAMED_AVATAR_INNER_RATIO = 0.58;
/** نسبة حجم صورة الإطار من الحاوية */
export const FRAMED_AVATAR_FRAME_RATIO = 0.92;

export function getFramedAvatarContainerSize(avatarDiameter: number): number {
  return Math.round(avatarDiameter / FRAMED_AVATAR_INNER_RATIO);
}

type FramedAvatarProps = {
  avatarUri?: string;
  frameUri: string;
  avatarSize: number;
  /** تجاوز اختياري لحجم الحاوية — المقاعد تُكبّر الوجه مع إبقاء مربّع الشبكة ثابتاً */
  containerSize?: number;
  fallbackLetter?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function FramedAvatar({
  avatarUri,
  frameUri,
  avatarSize,
  containerSize: containerSizeProp,
  fallbackLetter = '?',
  style,
  children,
}: FramedAvatarProps) {
  const containerSize = containerSizeProp ?? getFramedAvatarContainerSize(avatarSize);
  const frameSize = Math.round(containerSize * FRAMED_AVATAR_FRAME_RATIO);
  const frameAnimated = isGifImageUrl(frameUri);

  return (
    <View
      style={[
        {
          width: containerSize,
          height: containerSize,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <View
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
          overflow: 'hidden',
          backgroundColor: lu.colors.purple,
        }}
      >
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri.trim() }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            recyclingKey={avatarUri.trim()}
            {...IMG_AVATAR}
          />
        ) : (
          <View style={styles.fallback}>
            <Text weight="bold" style={{ fontSize: avatarSize * 0.38, color: '#fff' }}>
              {fallbackLetter.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <View style={[StyleSheet.absoluteFillObject, styles.frameLayer]} pointerEvents="none">
        <Image
          source={{ uri: frameUri }}
          // الإطار الثابت: دقّة كاملة (sharp) لأنه يُفكّ مرّة واحدة. المتحرّك (GIF):
          // حجم العرض فقط + سماح بالتصغير — يقلّل تكلفة الترميز المستمرّة لكل مقعد.
          style={frameAnimated ? { width: frameSize, height: frameSize } : sharpImageStyle(frameSize, frameSize)}
          contentFit="contain"
          recyclingKey={frameUri}
          autoplay={frameAnimated}
          {...(frameAnimated ? IMG_DECOR_ANIMATED : IMG_DECOR)}
        />
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frameLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lu.colors.purple,
  },
});
