/**
 * عرض رمز الروم — صورة (GIF/PNG/WebP) أو إيموجي نصي.
 * الصور تُدار من لوحة التحكم عبر config/roomReactions.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Text } from 'react-native';
import { Image } from 'expo-image';
import { parseRoomReactionDisplay } from '@/utils/roomReactionValue';

type Props = {
  value: string;
  size?: number;
  /** chat = GIF/صورة بحجم كامل بدون تصغير */
  variant?: 'default' | 'chat';
};

export function RoomReactionDisplay({ value, size = 64, variant = 'default' }: Props) {
  const bounce = useRef(new Animated.Value(1)).current;
  const { imageUrl, emoji } = parseRoomReactionDisplay(value);

  useEffect(() => {
    if (imageUrl) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1.14,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0.94,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [imageUrl, bounce]);

  if (imageUrl) {
    const imageScale = variant === 'chat' ? 1 : 0.9;
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size * imageScale, height: size * imageScale }}
          contentFit="contain"
          transition={120}
        />
      </View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale: bounce }] }}>
      <Text style={[styles.fallbackEmoji, { fontSize: size * 0.82, lineHeight: size }]}>
        {emoji}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fallbackEmoji: {
    textAlign: 'center',
  },
});
