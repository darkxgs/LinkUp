/**
 * RoomContributionsModal — قائمة المساهمين (يوم / أسبوع) حسب قيمة الهدايا.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Trophy, Crown, Coins } from 'lucide-react-native';

import { Text } from '@/components/ui';
import {
  subscribeToRoomContributions,
  type ContributionPeriod,
  type RoomContributionEntry,
} from '@/services/roomContributions';
import { lu } from '@/theme/lu-brand';
import { colors, radius, spacing } from '@/theme';

const SCREEN_H = Dimensions.get('window').height;

type Props = {
  visible: boolean;
  roomId: string;
  onClose: () => void;
};

export function RoomContributionsModal({ visible, roomId, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<ContributionPeriod>('daily');
  const [entries, setEntries] = useState<RoomContributionEntry[]>([]);

  useEffect(() => {
    if (!visible || !roomId) return;
    return subscribeToRoomContributions(roomId, period, setEntries);
  }, [visible, roomId, period]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.base }]}
          onPress={(e) => e.stopPropagation()}
        >
          <LinearGradient colors={['#3A0A0A', '#1A0A0C']} style={StyleSheet.absoluteFill} />
          <View style={styles.handle} />

          <View style={styles.header}>
            <Trophy size={20} color={lu.colors.gold} strokeWidth={2.5} />
            <Text variant="h3" weight="bold" color={colors.white}>
              {t('room.contributorsList')}
            </Text>
          </View>

          <View style={styles.tabs}>
            {(['daily', 'weekly'] as const).map((id) => {
              const active = period === id;
              return (
                <Pressable key={id} onPress={() => setPeriod(id)} style={styles.tabWrap}>
                  {active ? (
                    <LinearGradient
                      colors={['#FF3340', '#B00E0E']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.tabActive}
                    >
                      <Text variant="bodySmall" weight="bold" color="#fff">
                        {id === 'daily' ? t('room.contribToday') : t('room.contribWeek')}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.tabInactive}>
                      <Text variant="bodySmall" weight="semibold" color="rgba(255,255,255,0.65)">
                        {id === 'daily' ? t('room.contribToday') : t('room.contribWeek')}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <ScrollView style={{ maxHeight: SCREEN_H * 0.55 }} showsVerticalScrollIndicator={false}>
            {entries.length === 0 ? (
              <View style={styles.empty}>
                <Text variant="bodySmall" color="rgba(255,255,255,0.55)" align="center">
                  {t('roomRocket.noContributorsYet')}
                </Text>
              </View>
            ) : (
              entries.map((entry, idx) => {
                const rank = idx + 1;
                return (
                  <View key={entry.uid} style={styles.row}>
                    <View style={[styles.rankBadge, rank <= 3 && styles.rankBadgeTop]}>
                      {rank === 1 ? (
                        <Crown size={16} color={lu.colors.gold} fill={lu.colors.gold} strokeWidth={0} />
                      ) : (
                        <Text
                          variant="bodySmall"
                          weight="bold"
                          color={rank <= 3 ? lu.colors.gold : colors.white}
                        >
                          {rank}
                        </Text>
                      )}
                    </View>
                    <Image
                      source={{ uri: entry.avatar }}
                      style={styles.avatar}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={150}
                    />
                    <View style={styles.info}>
                      <Text variant="bodySmall" color={colors.white} weight="bold" numberOfLines={1}>
                        {entry.name}
                      </Text>
                      {entry.level ? (
                        <Text variant="caption" color="rgba(255,255,255,0.5)">
                          Lv{entry.level}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.coinsChip}>
                      <Coins size={13} color={lu.colors.gold} strokeWidth={2.2} />
                      <Text variant="caption" weight="bold" color={lu.colors.gold}>
                        {entry.coins.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    borderTopStartRadius: radius['2xl'],
    borderTopEndRadius: radius['2xl'],
    maxHeight: SCREEN_H * 0.8,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  tabWrap: {
    flex: 1,
  },
  tabActive: {
    paddingVertical: 10,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  tabInactive: {
    paddingVertical: 10,
    borderRadius: radius.full,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  empty: {
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: radius.md,
    marginBottom: 6,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeTop: {
    backgroundColor: 'rgba(252, 211, 77, 0.3)',
    borderWidth: 1.5,
    borderColor: lu.colors.gold,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  coinsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(252, 211, 77, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(252, 211, 77, 0.35)',
  },
});
