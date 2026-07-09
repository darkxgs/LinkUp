/**
 * كارد بروفايل — خلفية PNG من التصميم + محتوى فوقها
 */
import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

import { lu } from '@/theme/lu-brand';
import { PROFILE_THEME } from './profileTheme';
import {
  PROFILE_CARD_IMAGES,
  type ProfileCardImageVariant,
} from './profileCardAssets';

type Props = {
  width: number;
  height: number;
  variant: ProfileCardImageVariant;
  onPress?: () => void;
  style?: ViewStyle;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
};

export function ProfileImageCard({
  width,
  height,
  variant,
  onPress,
  style,
  children,
  contentStyle,
}: Props) {
  const body = (
    <View style={[{ width, height }, style]}>
      <Image
        source={PROFILE_CARD_IMAGES[variant]}
        style={{ width, height }}
        contentFit="fill"
        cachePolicy="memory-disk"
      />
      <View style={[StyleSheet.absoluteFill, styles.content, contentStyle]}>
        {children}
      </View>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      {body}
    </Pressable>
  );
}

/** دائرة زجاجية لأيقونة المحفظة */
export function ProfileWalletIconGlass({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.glass}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  glass: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: PROFILE_THEME.glassBg,
    borderWidth: 1,
    borderColor: PROFILE_THEME.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
