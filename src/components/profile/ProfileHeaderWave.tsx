/**
 * موجة رأس شاشة البروفايل — من Profile Backgroumd.svg + تدرج Header Background
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { lu } from '@/theme/lu-brand';

type Props = {
  width: number;
  height?: number;
};

export function ProfileHeaderWave({ width, height = 200 }: Props) {
  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height} viewBox="0 0 393 195" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="profileHdr" x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor="#FECACA" />
            <Stop offset="0.45" stopColor="#FCA5A5" />
            <Stop offset="0.75" stopColor="#B00E0E" />
            <Stop offset="1" stopColor="#E11414" stopOpacity={0.35} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="393" height="155" fill="url(#profileHdr)" />
        <Path
          d="M393 161C393 179.778 377.778 195 359 195H34C15.2223 195 0 179.778 0 161V0H14.093C59.0317 0 98.8995 28.0759 139.242 47.8745C156.369 56.2801 175.633 61 196 61C216.367 61 235.631 56.2801 252.758 47.8745C293.101 28.0759 332.968 0 377.907 0H393V161Z"
          fill={lu.colors.bg}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
});
