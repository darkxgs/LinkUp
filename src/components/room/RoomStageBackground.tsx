/**
 * خلفية مسرح الروم — إضاءة + منصة (مطابق لتصميم Figma Live room)
 */
import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { ROOM_DESIGN } from '@/theme/room-design';

const { width: SW, height: SH } = Dimensions.get('window');

type Props = {
  customUri?: string | null;
};

export function RoomStageBackground({ customUri }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Vibrant Premium Gradient (Clean, no blobs) */}
      <LinearGradient
        colors={[...ROOM_DESIGN.stageGradient]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle floating particles instead of harsh stars */}
      <View style={[styles.particle, { top: '15%', left: '20%', width: 3, height: 3, opacity: 0.7 }]} />
      <View style={[styles.particle, { top: '35%', right: '15%', width: 4, height: 4, opacity: 0.5 }]} />
      <View style={[styles.particle, { top: '65%', left: '10%', width: 2, height: 2, opacity: 0.6 }]} />
      <View style={[styles.particle, { top: '50%', right: '25%', width: 3, height: 3, opacity: 0.8 }]} />

      {customUri ? (
        <>
          <Image source={{ uri: customUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={customUri} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: ROOM_DESIGN.scrim }]} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 50,
  },
  podiumWrap: {
    position: 'absolute',
    top: SH * 0.12,
    left: SW * 0.05,
    right: SW * 0.05,
    height: SH * 0.25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumGlowOuter: {
    position: 'absolute',
    width: SW * 0.85,
    height: SW * 0.85,
    borderRadius: SW * 0.425,
    backgroundColor: 'rgba(225, 20, 20,0.08)',
    transform: [{ scaleY: 0.35 }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumGlowInner: {
    width: SW * 0.65,
    height: SW * 0.65,
    borderRadius: SW * 0.325,
    backgroundColor: 'rgba(232, 23, 23, 0.06)',
  },
  podiumRing: {
    position: 'absolute',
    width: SW * 0.8,
    height: 3,
    borderRadius: 2,
    transform: [{ scaleY: 0.35 }, { translateY: 20 }],
  },
  podiumRingInner: {
    position: 'absolute',
    width: SW * 0.6,
    height: 2,
    borderRadius: 1,
    transform: [{ scaleY: 0.35 }, { translateY: 40 }],
  },
});
