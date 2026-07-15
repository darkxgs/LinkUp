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
import { Crown } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';

type Props = {
  title: string;
  size?: 'sm' | 'md';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** سمة داكنة — قرص زجاجي نبيذي موحّد بدل التدرج الذهبي */
  night?: boolean;
};

export function TravelerTitleBadge({ title, size = 'sm', onPress, style, night }: Props) {
  const isMd = size === 'md';
  const h = isMd ? 32 : 26;
  const fontSize = isMd ? 12.5 : 11;
  const iconSize = isMd ? 13 : 11;

  const content = (
    <>
      <View style={[styles.iconDisc, night && styles.iconDiscNight]}>
        <Crown size={iconSize} color="#F5BE37" fill="#F5BE37" strokeWidth={1.4} />
      </View>
      <Text
        weight="bold"
        numberOfLines={1}
        style={[styles.title, night && styles.titleNight, { fontSize }]}
      >
        {title}
      </Text>
    </>
  );

  const inner = (
    <View style={[styles.frame, { height: h }, night ? styles.frameNight : styles.frameLight, style]}>
      {night ? (
        <View style={[styles.fill, styles.fillNight]}>{content}</View>
      ) : (
        <View style={[styles.fill, styles.fillLight]}>
          <View style={styles.iconDisc}>
            <Crown size={iconSize} color="#B8740A" fill="#B8740A" strokeWidth={1.4} />
          </View>
          <Text
            weight="bold"
            numberOfLines={1}
            style={[styles.title, styles.titleLight, { fontSize }]}
          >
            {title}
          </Text>
        </View>
      )}
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
  frameNight: {
    borderWidth: 1,
    borderColor: 'rgba(255,90,105,0.28)',
    shadowOpacity: 0,
    elevation: 0,
  },
  frameLight: {
    borderWidth: 1,
    borderColor: '#F0BABA',
    shadowOpacity: 0,
    elevation: 0,
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
  fillNight: {
    backgroundColor: 'rgba(255,60,75,0.16)',
  },
  fillLight: {
    backgroundColor: 'rgba(225,20,20,0.07)',
  },
  titleLight: {
    color: '#B00E0E',
  },
  iconDisc: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDiscNight: {
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  title: {
    color: '#6B3F02',
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
    flexShrink: 1,
    textAlign: 'center',
  },
  titleNight: {
    color: '#FFFFFF',
  },
});
