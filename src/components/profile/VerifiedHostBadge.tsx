/**
 * وسم «فتاة موثّقة» — يظهر للحسابات الأنثوية الموثّقة
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';

export function VerifiedHostBadge() {
  const { t } = useTranslation();
  return (
    <View style={styles.badge}>
      <LinearGradient
        colors={lu.gradients.mint}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <BadgeCheck size={12} color="#fff" strokeWidth={2.4} />
      <Text weight="bold" style={styles.text} numberOfLines={1}>
        {t('profile.verifiedGirl')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 99,
    overflow: 'hidden',
    ...lu.shadows.card,
  },
  text: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
});
