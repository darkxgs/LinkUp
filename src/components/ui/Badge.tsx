/**
 * Sada App — Badge Components
 * Level, VIP, Verified, Country, Gender badges
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { CheckCircle2, Crown, Heart } from 'lucide-react-native';

import { Text } from './Text';
import { colors, radius, spacing } from '@/theme';

// ============ Verified Badge ============
interface VerifiedBadgeProps {
  size?: number;
  color?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  size = 14,
  color = colors.verified,
}) => <CheckCircle2 size={size} color={color} fill={color} />;

// ============ Level Badge ============
interface LevelBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
}

export const LevelBadge: React.FC<LevelBadgeProps> = ({ level, size = 'md' }) => {
  const sizeMap = {
    sm: { paddingH: 6, paddingV: 2, fontSize: 10 },
    md: { paddingH: 8, paddingV: 3, fontSize: 11 },
    lg: { paddingH: 10, paddingV: 4, fontSize: 13 },
  };
  const s = sizeMap[size];
  
  return (
    <View
      style={[
        styles.levelBadge,
        { paddingHorizontal: s.paddingH, paddingVertical: s.paddingV },
      ]}
    >
      <Text
        variant="caption"
        weight="bold"
        color={colors.white}
        style={{ fontSize: s.fontSize }}
      >
        LV{level}
      </Text>
    </View>
  );
};

// ============ VIP Badge ============
interface VIPBadgeProps {
  tier?: 'silver' | 'gold' | 'platinum' | 'diamond';
  size?: 'sm' | 'md';
}

export const VIPBadge: React.FC<VIPBadgeProps> = ({ tier = 'gold', size = 'md' }) => {
  const tierColors: Record<string, string> = {
    silver: '#94A3B8',
    gold: '#F59E0B',
    platinum: '#C61414',
    diamond: '#FCA5A5',
  };
  const color = tierColors[tier] ?? colors.vip;
  const iconSize = size === 'sm' ? 14 : 18;
  
  return (
    <View style={[styles.vipBadge, { backgroundColor: color }]}>
      <Crown size={iconSize} color={colors.white} fill={colors.white} />
    </View>
  );
};

// ============ Gender Badge ============
interface GenderBadgeProps {
  gender: 'male' | 'female';
  age?: number;
}

export const GenderBadge: React.FC<GenderBadgeProps> = ({ gender, age }) => {
  const bgColor = gender === 'male' ? colors.gender.maleBg : colors.gender.femaleBg;
  const textColor = gender === 'male' ? colors.gender.male : colors.gender.female;
  const icon = gender === 'male' ? '♂' : '♀';
  
  return (
    <View style={[styles.genderBadge, { backgroundColor: bgColor }]}>
      <Text variant="caption" weight="semibold" color={textColor}>
        {icon}
        {age !== undefined && ` ${age}`}
      </Text>
    </View>
  );
};

// ============ Country Flag (Emoji-based) ============
interface CountryFlagProps {
  countryCode: string;
  size?: number;
}

export const CountryFlag: React.FC<CountryFlagProps> = ({ countryCode, size = 16 }) => {
  const flag = countryCodeToFlag(countryCode);
  return (
    <Text style={{ fontSize: size }}>{flag}</Text>
  );
};

const countryCodeToFlag = (code: string): string => {
  if (!code || code.length !== 2) return '🌐';
  const codePoints = code
    .toUpperCase()
    .split('')
    .map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// ============ Heart Badge (for likes/discover) ============
interface HeartBadgeProps {
  isLiked?: boolean;
  size?: number;
  onPress?: () => void;
}

export const HeartBadge: React.FC<HeartBadgeProps> = ({
  isLiked = false,
  size = 22,
}) => {
  return (
    <View style={styles.heartBadge}>
      <Heart
        size={size}
        color={isLiked ? colors.actions.like : colors.text.tertiary}
        fill={isLiked ? colors.actions.like : 'transparent'}
      />
    </View>
  );
};

// ============ Count Badge (for views, listeners) ============
interface CountBadgeProps {
  count: number;
  icon?: React.ReactNode;
  bgColor?: string;
  textColor?: string;
}

export const CountBadge: React.FC<CountBadgeProps> = ({
  count,
  icon,
  bgColor = colors.brand.secondary,
  textColor = colors.white,
}) => {
  return (
    <View style={[styles.countBadge, { backgroundColor: bgColor }]}>
      {icon}
      <Text variant="caption" weight="medium" color={textColor}>
        {count}
      </Text>
    </View>
  );
};

// ============ New Badge ============
export const NewBadge: React.FC = () => (
  <View style={styles.newBadge}>
    <Text variant="caption" weight="bold" color={colors.white}>
      جديد
    </Text>
  </View>
);

const styles = StyleSheet.create({
  levelBadge: {
    backgroundColor: colors.level,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  heartBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.actions.likeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  newBadge: {
    backgroundColor: colors.semantic.error,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.xs,
  },
});
