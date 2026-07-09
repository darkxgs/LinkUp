/**
 * Sada App — Match Card Component (Video Match / Voice Match)
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, Mic, Flame } from 'lucide-react-native';
import { ArrowUpRight } from '@/components/ui/RtlIcons';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { colors, radius, spacing, shadows } from '@/theme';

interface MatchCardProps {
  type: 'video' | 'voice';
  peopleCount: number;
  onPress?: () => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  type,
  peopleCount,
  onPress,
}) => {
  const { t } = useTranslation();
  
  const isVideo = type === 'video';
  const gradient = isVideo
    ? colors.gradients.videoMatch
    : colors.gradients.voiceMatch;
  const title = isVideo ? t('discover.videoMatch') : t('discover.voiceMatch');
  const Icon = isVideo ? Video : Mic;
  
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Icon size={24} color={colors.white} strokeWidth={2.5} />
        
        <View style={styles.content}>
          <Text variant="h4" color={colors.white} weight="semibold">
            {title}
          </Text>
          <View style={styles.badge}>
            <Flame size={11} color="#FFB800" fill="#FFB800" strokeWidth={0} />
            <Text variant="caption" color={colors.white}>
              {t('discover.peopleOnline', { count: peopleCount })}
            </Text>
          </View>
        </View>
        
        <View style={styles.arrowContainer}>
          <ArrowUpRight size={16} color={colors.white} strokeWidth={2.5} />
        </View>
      </LinearGradient>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
  gradient: {
    padding: spacing.base,
    minHeight: 100,
    justifyContent: 'space-between',
  },
  content: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  arrowContainer: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
