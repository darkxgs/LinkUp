/**
 * أفاتار رسمي لفريق دعم LinkUp — بدون صور عشوائية
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Headphones } from 'lucide-react-native';
import { lu } from '@/theme/lu-brand';

type Props = {
  size?: number;
};

export function LinkUpSupportAvatar({ size = 48 }: Props) {
  const r = size / 2;
  const dot = Math.round(size * 0.28);
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.wrap, { width: size, height: size, borderRadius: r }]}>
        <LinearGradient
          colors={['#8A1E1E', '#8A0E0E', '#E11414']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: r }]}
        />
        <Headphones size={size * 0.44} color="#fff" strokeWidth={2.2} />
      </View>
      {/* النقطة خارج الدائرة المقصوصة حتى لا تُقتطع */}
      <View style={[styles.badge, { width: dot, height: dot, borderRadius: dot / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    backgroundColor: lu.colors.mint,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
