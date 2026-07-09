/**
 * طبقة خلفية المحادثة — تدرّج أو صورة من لوحة التحكم
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

import type { ChatBackground } from '@/constants/chatBackgrounds';

type Props = {
  background: ChatBackground;
};

export function ChatBackgroundLayer({ background }: Props) {
  const imageUrl = background.imageUrl?.trim();

  if (imageUrl) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={imageUrl} transition={150} />
      </View>
    );
  }

  const colors = background.colors.length >= 2
    ? background.colors
    : ['#FEE2E2', '#FECACA'];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={colors as [string, string, ...string[]]}
        start={background.start ?? { x: 0, y: 0 }}
        end={background.end ?? { x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {background.blobs?.map((blob, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            width: blob.size,
            height: blob.size,
            borderRadius: blob.size / 2,
            backgroundColor: blob.color,
            opacity: blob.opacity ?? 0.12,
            top: blob.top,
            left: blob.left,
          }}
        />
      ))}
    </View>
  );
}

export function ChatBackgroundPreview({
  background,
  size = 88,
}: {
  background: ChatBackground;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size * 0.72,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <ChatBackgroundLayer background={background} />
    </View>
  );
}
