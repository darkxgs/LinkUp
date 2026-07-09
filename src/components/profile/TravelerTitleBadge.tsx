/**
 * وسم اللقب — تصميم نظيف بإطار ذهبي وأيقونة تاج متجهية (vector)
 * موحّد مع بقية أوسمة البروفايل، احترافي ومتوافق مع الهوية البصرية
 */
import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';

type Props = {
  title: string;
  size?: 'sm' | 'md';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function TravelerTitleBadge({ title, size = 'sm', onPress, style }: Props) {
  const isMd = size === 'md';
  const h = isMd ? 32 : 26;
  const fontSize = isMd ? 12.5 : 11;
  const iconSize = isMd ? 13 : 11;

  const inner = (
    <View style={[styles.frame, { height: h }, style]}>
      <LinearGradient
        colors={['#FFE9A8', '#F5BE37', '#E0930B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fill}
      >
        <View style={styles.iconDisc}>
          <Crown size={iconSize} color="#B8740A" fill="#B8740A" strokeWidth={1.4} />
        </View>
        <Text
          weight="bold"
          numberOfLines={1}
          style={[styles.title, { fontSize }]}
        >
          {title}
        </Text>
      </LinearGradient>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 99,
    overflow: 'hidden',
    maxWidth: 190,
    ...lu.shadows.card,
  },
  fill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingStart: 3,
    paddingEnd: 10,
  },
  iconDisc: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#6B3F02',
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
    flexShrink: 1,
    textAlign: 'center',
  },
});
