/**
 * صورة غلاف الوكالة/الروم مع إطار شفاف (PNG) فوقها داخل نفس حدود الكارد.
 */
import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

/** @deprecated الحاوية لم تعد تتوسع — نفس أبعاد المحتوى */
export const FRAMED_COVER_INNER_RATIO = 1;
export const FRAMED_COVER_FRAME_RATIO = 1;

export function getFramedCoverContainerSize(innerWidth: number, aspect = 1.05): {
  width: number;
  height: number;
  innerW: number;
  innerH: number;
} {
  const innerW = innerWidth;
  const innerH = Math.round(innerWidth / aspect);
  return { width: innerW, height: innerH, innerW, innerH };
}

type FramedAgencyCoverProps = {
  imageUri?: string | null;
  frameUri?: string | null;
  width: number;
  aspect?: number;
  fallbackGrad?: readonly [string, string];
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function FramedAgencyCover({
  imageUri,
  frameUri,
  width,
  aspect = 1.05,
  fallbackGrad = ['#EA6666', '#8A0E0E'],
  borderRadius = 14,
  style,
  children,
}: FramedAgencyCoverProps) {
  const height = Math.round(width / aspect);
  const hasFrame = Boolean(frameUri?.startsWith('http'));

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          overflow: 'hidden',
          backgroundColor: 'rgba(0,0,0,0.15)',
        },
        style,
      ]}
    >
      {imageUri?.startsWith('http') ? (
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={imageUri}
        />
      ) : (
        <LinearGradient colors={fallbackGrad} style={StyleSheet.absoluteFill} />
      )}

      {hasFrame ? (
        <Image
          source={{ uri: frameUri! }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={frameUri}
          transition={120}
          pointerEvents="none"
        />
      ) : null}

      {children}
    </View>
  );
}
