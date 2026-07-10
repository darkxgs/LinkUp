/**
 * صف مستوى الوكالة — شريط تقدم مضغوط كما في معلومات الغرفة (LV.20 → LV.21)
 */
import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, Alert, I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react-native';

import { Text } from '@/components/ui';
import {
  getAgencyLevelProgress,
  getSupportTargetForLevel,
  type AgencyLevelsRuntimeConfig,
} from '@/services/agencyLevels';
import { radius, spacing } from '@/theme';

function formatLevelCoins(n: number): string {
  const v = Math.max(0, Number(n) || 0);
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}b`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}m`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}k`;
  return v.toLocaleString('en-US');
}

type Props = {
  supportCoins: number;
  manualLevel?: number;
  manual?: boolean;
  levelsConfig: AgencyLevelsRuntimeConfig;
  variant?: 'dark' | 'light';
};

export function AgencyLevelProgressRow({
  supportCoins,
  manualLevel,
  manual,
  levelsConfig,
  variant = 'dark',
}: Props) {
  const { t } = useTranslation();
  const isDark = variant === 'dark';

  const progress = useMemo(() => {
    const base = getAgencyLevelProgress(supportCoins, levelsConfig);
    if (manual && manualLevel && manualLevel >= 1) {
      return { ...base, level: manualLevel };
    }
    if (base.level < 1) {
      // الوكالة تبدأ دائماً من LV.1 — لا يوجد «مستوى صفر» في الواجهة
      // (نفس الحد الأدنى المعروض في بطاقة «مستوى الوكالة»)
      const nextTarget = getSupportTargetForLevel(2, levelsConfig) || base.nextTarget || 1;
      return {
        ...base,
        level: 1,
        nextLevel: 2,
        nextTarget,
        progressRatio: Math.min(1, Math.max(0, base.supportCoins / nextTarget)),
        remainingCoins: Math.max(0, nextTarget - base.supportCoins),
      };
    }
    return base;
  }, [supportCoins, manualLevel, manual, levelsConfig]);

  const pct = Math.round(progress.progressRatio * 100);
  const currentLevel = progress.level || 0;
  const nextLevel = progress.nextLevel;
  const accent = isDark ? '#EA2626' : '#DA2626';
  const muted = isDark ? '#FCA5A5' : '#9CA3AF';
  const labelColor = isDark ? '#FECACA' : '#6B7280';
  const trackBg = isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB';
  // المحصَّل أولاً ثم الهدف (كانت معكوسة فتظهر «1.00m/0» بدل «0/1.00m»)
  const valuesText = progress.nextTarget != null
    ? `${formatLevelCoins(progress.supportCoins)}/${formatLevelCoins(progress.nextTarget)}`
    : formatLevelCoins(progress.supportCoins);

  const showHelp = () => {
    Alert.alert(
      t('roomSettings.agencyLevelTitle'),
      t('roomSettings.agencyLevelSubtitle'),
    );
  };

  return (
    <View style={[styles.wrap, isDark && styles.wrapDark]}>
      <View style={styles.labelRow}>
        <Text variant="bodySmall" color={labelColor} style={styles.label}>
          {t('roomInfo.level')}:
        </Text>
        <View style={styles.barSection}>
          <View style={styles.levelRow}>
            <Text variant="bodySmall" weight="bold" color={accent} style={styles.lvText}>
              LV.{currentLevel}
            </Text>
            <View style={[styles.track, { backgroundColor: trackBg }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${pct}%`,
                    backgroundColor: accent,
                    ...(I18nManager.isRTL ? { alignSelf: 'flex-end' } : {}),
                  },
                ]}
              />
            </View>
            {nextLevel != null ? (
              <Text variant="caption" color={muted} style={styles.lvText}>
                LV.{nextLevel}
              </Text>
            ) : (
              <View style={styles.lvText} />
            )}
            <Pressable onPress={showHelp} hitSlop={8} style={styles.helpBtn}>
              <HelpCircle size={16} color={muted} />
            </Pressable>
          </View>
          <Text variant="caption" color={muted} align="center" style={styles.values}>
            {valuesText}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  wrapDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  label: {
    minWidth: 56,
    paddingTop: 2,
    textAlign: 'right',
  },
  barSection: {
    flex: 1,
    gap: 4,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lvText: {
    minWidth: 44,
    textAlign: 'center',
    fontSize: 12,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
  helpBtn: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  values: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
