/**
 * إطار صورة الشريك — Level Man / Woman image Shape.svg
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Text } from '@/components/ui';
import { REL_DESIGN } from './relationshipDesign';

const FRAME_PATH =
  'M1 20.0018C1.00008 8.76108 10.7056 -0.0219407 21.8906 1.09656L81.8906 7.09656C91.6034 8.06787 98.9999 16.2406 99 26.0018V99.8026C98.9999 109.564 91.6034 117.737 81.8906 118.708L21.8906 124.708C10.7056 125.826 1.00008 117.043 1 105.803V20.0018Z';

type Props = {
  uri?: string;
  name: string;
  width?: number;
  tilt?: 'left' | 'right' | 'none';
};

export function RelationshipAvatarFrame({ uri, name, width = 92, tilt = 'none' }: Props) {
  const height = width * 1.26;
  const rotate = tilt === 'left' ? '-7deg' : tilt === 'right' ? '7deg' : '0deg';
  const initial = (name ?? '?').trim().charAt(0) || '★';

  return (
    <View style={[styles.wrap, { width, height, transform: [{ rotate }] }]}>
      <Svg width={width} height={height} viewBox="0 0 100 126" style={StyleSheet.absoluteFill}>
        <Path d={FRAME_PATH} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={2} />
      </Svg>
      <View style={[styles.photoClip, { width: width - 8, height: height - 14, borderRadius: 14 }]}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient
            colors={[REL_DESIGN.pinkSoft, REL_DESIGN.purple]}
            style={[StyleSheet.absoluteFill, styles.center]}
          >
            <Text weight="bold" style={{ color: '#fff', fontSize: width * 0.3 }}>{initial}</Text>
          </LinearGradient>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  photoClip: {
    overflow: 'hidden',
    marginTop: 4,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
