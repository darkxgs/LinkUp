/**
 * شريط المستوى — Level Tag.svg من حزمة التصميم
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Text } from '@/components/ui';

type Props = {
  label: string;
  width?: number;
};

export function RelationshipLevelRibbon({ label, width = 132 }: Props) {
  const h = (width / 122) * 41;
  return (
    <View style={[styles.wrap, { width, height: h }]}>
      <Svg width={width} height={h} viewBox="0 0 122 41" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="ribbonPurple" x1="96" y1="-78" x2="223" y2="66" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FECACA" />
            <Stop offset="1" stopColor="#E11414" />
          </LinearGradient>
        </Defs>
        <Path
          d="M20.1241 6.89984C15.456 6.89984 13.0335 7.70304 11.9464 8.95749C8.90601 12.4655 5.19176 28.4329 4.45996 35.5791H66.6578C107.448 35.5791 108.521 32.7856 110.387 30.8076C111.556 29.5984 119.472 9.34192 120.012 2.39453C118.402 4.96173 115.182 6.89984 83.0519 6.89984H20.1241Z"
          fill="url(#ribbonPurple)"
        />
      </Svg>
      <Text weight="bold" style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 0.3,
    marginTop: 4,
    textShadowColor: 'rgba(138, 14, 14,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
