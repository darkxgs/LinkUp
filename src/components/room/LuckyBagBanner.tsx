/**
 * LuckyBagBanner — بانر حقيبة الحظ فوق الدردشة (يظهر للجميع بما فيهم صاحب الوكالة)
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gift, Users, Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import {
  type LuckyBag,
  getBagOpenCountdownSecondsLeft,
  getBagSecondsLeft,
  isBagOpenUnlocked,
} from '@/services/luckyBag';
import { lu } from '@/theme/lu-brand';

interface Props {
  bags: LuckyBag[];
  myUid: string;
  canManageRoom?: boolean;
  onOpenBag: (bagId: string) => void;
}

function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function LuckyBagBanner({ bags, myUid, canManageRoom, onOpenBag }: Props) {
  const { t } = useTranslation();
  const [, setTick] = useState(0);

  const activeBag = bags.find(
    (b) => b.status === 'active' && b.remainingSlots > 0 && getBagSecondsLeft(b) > 0,
  );

  useEffect(() => {
    if (!activeBag) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [activeBag?.id]);

  if (!activeBag) return null;

  const isSender = activeBag.senderUid === myUid;
  const canOpen = !isSender || canManageRoom;
  const unlocked = isBagOpenUnlocked(activeBag);
  const timerStr = formatTimer(
    unlocked ? getBagSecondsLeft(activeBag) : getBagOpenCountdownSecondsLeft(activeBag),
  );

  return (
    <Pressable onPress={() => onOpenBag(activeBag.id)} style={styles.banner}>
      <LinearGradient
        colors={[lu.colors.gold, lu.colors.pink]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.bagIcon}>
        <Gift size={22} color="#fff" />
      </View>

      <View style={{ flex: 1 }}>
        <Text variant="caption" color="#fff" weight="bold" numberOfLines={1}>
          {isSender && !canManageRoom
            ? t('luckyBag.bannerSentByYou', { amount: activeBag.totalAmount.toLocaleString() })
            : isSender && canManageRoom
              ? t('luckyBag.bannerManagerOwn', { amount: activeBag.totalAmount.toLocaleString() })
              : t('luckyBag.bannerFrom', { name: activeBag.senderName })}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Users size={11} color="rgba(255,255,255,0.9)" />
            <Text variant="caption" color="rgba(255,255,255,0.9)" style={{ fontSize: 10 }}>
              {activeBag.remainingSlots}/{activeBag.maxOpeners}
            </Text>
          </View>
          <View style={styles.metaChip}>
            <Clock size={11} color="rgba(255,255,255,0.9)" />
            <Text variant="caption" color="rgba(255,255,255,0.9)" style={{ fontSize: 10 }}>
              {timerStr}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.openBtn}>
        <Text variant="caption" color={lu.colors.gold2} weight="bold">
          {canOpen ? t('luckyBag.open') : t('luckyBag.view')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 12,
    borderRadius: lu.radius.lg,
    overflow: 'hidden',
    shadowColor: lu.colors.gold2,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  bagIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  openBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: '#fff',
  },
});
