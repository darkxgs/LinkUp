import React from 'react';
import { View, StyleSheet, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Text } from '@/components/ui';
import { TITLE_RARITY_COLORS } from './titlesDesign';
import type { TitleDef } from '@/services/firebase/titleSystem';
import { lu } from '@/theme/lu-brand';

type Props = {
  title: TitleDef;
  label: string;
  width?: number;
  height?: number;
  dimmed?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

// الحصول على أيقونة الإنجاز حسب ندرة اللقب
function getRarityBadge(rarity: string): string {
  switch (rarity) {
    case 'legendary':
      return '👑'; // تاج ذهبي للأساطير
    case 'epic':
      return '✦'; // نجمة رباعية متوهجة للملحمي
    case 'rare':
      return '⭐'; // نجمة للفريد
    default:
      return '•'; // نقطة بسيطة للعادي
  }
}

// الحصول على لون إطار اللقب حسب الندرة
function getRarityBorderColor(rarity: string): string {
  switch (rarity) {
    case 'legendary':
      return '#FFD700'; // ذهبي لامع
    case 'epic':
      return '#E11414'; // وردي متوهج
    case 'rare':
      return '#EC3E3E'; // أزرق سماوي
    default:
      return 'rgba(255,255,255,0.18)'; // فضي خفيف
  }
}

export function TitleBanner({
  title,
  label,
  width = 100,
  height = 36,
  dimmed,
  onPress,
  style,
}: Props) {
  const colors = (title.gradientColors?.length === 2
    ? title.gradientColors
    : TITLE_RARITY_COLORS[title.rarity] ?? TITLE_RARITY_COLORS.common) as readonly [string, string, ...string[]];

  const borderColor = getRarityBorderColor(title.rarity);
  const badge = getRarityBadge(title.rarity);

  const inner = (
    <View style={[{ width, height, opacity: dimmed ? 0.45 : 1 }, style]}>
      {title.imageUrl ? (
        <Image
          source={{ uri: title.imageUrl }}
          style={[styles.img, { width, height }]}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.banner, { width, height, borderColor }]}
        >
          {/* لمحة لمعان زجاجي قطري واقعي */}
          <View style={styles.diagonalShine} />
          
          <View style={styles.contentRow}>
            {badge !== '•' && (
              <Text style={styles.badgeText}>{badge}</Text>
            )}
            <Text
              weight="bold"
              numberOfLines={1}
              style={[
                styles.text,
                { fontSize: height * 0.32, fontFamily: lu.fonts.bodyBold }
              ]}
            >
              {label}
            </Text>
          </View>
        </LinearGradient>
      )}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{inner}</Pressable>;
  }
  return inner;
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    overflow: 'hidden',
    position: 'relative',
    // تأثير ظل خفيف يعطي بعداً ثلاثي الأبعاد
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  diagonalShine: {
    position: 'absolute',
    top: -40,
    left: '-30%',
    width: '25%',
    height: 150,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ rotate: '-35deg' }],
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  badgeText: {
    fontSize: 11,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  text: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 2.5,
    textAlign: 'center',
  },
  img: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
});

