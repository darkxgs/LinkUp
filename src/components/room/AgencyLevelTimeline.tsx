/**
 * شريط تقدم مستوى الوكالة — يظهر لمدير الوكالة في إعدادات الغرفة
 */
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TrendingUp } from 'lucide-react-native';

import { Text, CoinIcon } from '@/components/ui';
import {
  getAgencyLevelProgress,
  isAgencyThroneUnlockedByLevel,
  type AgencyLevelsRuntimeConfig,
} from '@/services/agencyLevels';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';

function formatCoins(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-US');
}

type Props = {
  supportCoins: number;
  manualLevel?: number;
  manual?: boolean;
  levelsConfig: AgencyLevelsRuntimeConfig;
};

export function AgencyLevelTimeline({
  supportCoins,
  manualLevel,
  manual,
  levelsConfig,
}: Props) {
  const { t } = useTranslation();

  const progress = useMemo(() => {
    if (manual && manualLevel && manualLevel >= 1) {
      const base = getAgencyLevelProgress(supportCoins, levelsConfig);
      return { ...base, level: manualLevel };
    }
    return getAgencyLevelProgress(supportCoins, levelsConfig);
  }, [supportCoins, manualLevel, manual, levelsConfig]);

  const throneUnlocked = isAgencyThroneUnlockedByLevel(progress.level, levelsConfig);
  const pct = Math.round(progress.progressRatio * 100);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <TrendingUp size={18} color={lu.colors.purple} strokeWidth={2.5} />
          <Text style={styles.title}>{t('roomSettings.agencyLevelTitle')}</Text>
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeText}>L{progress.level || 0}</Text>
        </View>
      </View>

      <Text variant="caption" color="#6B7280" style={styles.subtitle}>
        {t('roomSettings.agencyLevelSubtitle')}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text variant="caption" color="#9CA3AF">
            {t('roomSettings.agencyLevelSupport')}
          </Text>
          <View style={styles.coinRow}>
            <CoinIcon size={14} />
            <Text variant="bodySmall" weight="bold" color="#D97706">
              {formatCoins(progress.supportCoins)}
            </Text>
          </View>
        </View>
        {progress.nextTarget != null ? (
          <View style={[styles.statItem, styles.statItemEnd]}>
            <Text variant="caption" color="#9CA3AF">
              {t('roomSettings.agencyLevelNext', { level: progress.nextLevel ?? progress.level + 1 })}
            </Text>
            <View style={styles.coinRow}>
              <CoinIcon size={14} />
              <Text variant="bodySmall" weight="bold" color="#059669">
                {formatCoins(progress.remainingCoins)}
              </Text>
            </View>
            <Text variant="caption" color="#E11414" weight="semibold">
              {t('roomSettings.agencyLevelRemaining')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.trackLabels}>
        <Text variant="caption" color="#9CA3AF">
          L{progress.level || 0}
        </Text>
        <Text variant="caption" color="#9CA3AF">
          {pct}%
        </Text>
        {progress.nextLevel != null ? (
          <Text variant="caption" color="#9CA3AF">
            L{progress.nextLevel}
          </Text>
        ) : null}
      </View>

      {throneUnlocked ? (
        <Text variant="caption" color="#059669" weight="semibold" style={styles.throneHint}>
          {t('roomSettings.agencyLevelThroneUnlocked')}
        </Text>
      ) : (
        <Text variant="caption" color="#9CA3AF" style={styles.throneHint}>
          {t('roomSettings.agencyLevelThroneLocked', {
            level: levelsConfig.throneUnlockLevel,
          })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.base,
    marginBottom: spacing.base,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#301010',
  },
  levelBadge: {
    backgroundColor: lu.colors.purple,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  levelBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  subtitle: {
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    gap: 4,
  },
  statItemEnd: {
    alignItems: 'flex-end',
  },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  track: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: '#FEE2E2',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: lu.colors.purple,
  },
  trackLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  throneHint: {
    marginTop: 2,
  },
});
