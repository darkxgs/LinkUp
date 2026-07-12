/**
 * شريط نقاط PK + المؤقت أثناء التحدي النشط
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Crown } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { colors, radius } from '@/theme';
import type { RoomPkState } from '@/services/firebase/roomPk';
import { isPkActive } from '@/services/firebase/roomPk';

type Props = {
  pk: RoomPkState;
  onTimerEnd?: () => void;
};

function formatCountdown(endsAt: number): string {
  const left = Math.max(0, endsAt - Date.now());
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RoomPkBattleOverlay({ pk, onTimerEnd }: Props) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState('0:00');
  // يمنع استدعاء onTimerEnd أكثر من مرّة عند انتهاء الوقت (كان يُستدعى كل ثانية)
  const endFiredRef = useRef(false);

  useEffect(() => {
    if (!pk.endsAt || !isPkActive(pk)) return;
    endFiredRef.current = false; // جلسة تحدٍ جديدة
    const tick = () => {
      setCountdown(formatCountdown(pk.endsAt!));
      if (Date.now() >= pk.endsAt! && !endFiredRef.current) {
        endFiredRef.current = true;
        onTimerEnd?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pk.endsAt, pk.status, onTimerEnd]);

  if (!isPkActive(pk)) return null;

  const total = pk.blueScore + pk.redScore;
  const bluePct = total > 0 ? (pk.blueScore / total) * 100 : 50;

  return (
    <View style={styles.wrap}>
      <View style={styles.scoreBar}>
        <LinearGradient
          // أزرق حقيقي لجانب الفريق الأزرق — كان أحمر فبدا الشريط كله لوناً واحداً (b16)
          colors={['#60A5FA', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.blueSide, { width: `${bluePct}%` }]}
        />
        <LinearGradient
          colors={['#EF4444', '#DC2626']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.redSide, { width: `${100 - bluePct}%` }]}
        />
        <View style={styles.scoreLabels}>
          <Text variant="caption" weight="bold" color="#fff" style={styles.scoreNum}>
            {pk.blueScore.toLocaleString()}
          </Text>
          <View style={styles.timerBadge}>
            <Text variant="caption" weight="bold" color="#FCD34D" style={{ fontSize: 11 }}>
              PK
            </Text>
            <Text variant="caption" weight="bold" color="#fff" style={{ fontSize: 12 }}>
              {countdown}
            </Text>
          </View>
          <Text variant="caption" weight="bold" color="#fff" style={styles.scoreNum}>
            {pk.redScore.toLocaleString()}
          </Text>
        </View>
      </View>

      {pk.mode === 'cross_room' && pk.crossRoom ? (
        <Text variant="caption" color="rgba(255,255,255,0.75)" align="center" style={{ marginTop: 4 }}>
          {t('roomPk.vsRoom', { name: pk.crossRoom.opponentRoomName })}
        </Text>
      ) : null}

      <View style={styles.topGiftersRow}>
        <View style={styles.teamTop}>
          {(pk.blueTopGifters ?? []).slice(0, 3).map((g, i) => (
            <View key={g.uid} style={[styles.gifterAvatar, { marginStart: i * -8 }]}>
              {g.avatar ? (
                <Image source={{ uri: g.avatar }} style={styles.gifterImg} contentFit="cover" cachePolicy="memory-disk" recyclingKey={g.avatar} />
              ) : (
                <View style={[styles.gifterImg, { backgroundColor: '#3B82F6' }]} />
              )}
              <Crown
                size={10}
                color={i === 0 ? '#FCD34D' : 'rgba(255,255,255,0.5)'}
                fill={i === 0 ? '#FCD34D' : 'transparent'}
                style={styles.crown}
              />
            </View>
          ))}
        </View>
        <View style={styles.teamTop}>
          {(pk.redTopGifters ?? []).slice(0, 3).map((g, i) => (
            <View key={g.uid} style={[styles.gifterAvatar, { marginEnd: i * -8 }]}>
              {g.avatar ? (
                <Image source={{ uri: g.avatar }} style={styles.gifterImg} contentFit="cover" cachePolicy="memory-disk" recyclingKey={g.avatar} />
              ) : (
                <View style={[styles.gifterImg, { backgroundColor: '#EF4444' }]} />
              )}
              <Crown
                size={10}
                color={i === 0 ? '#FCD34D' : 'rgba(255,255,255,0.5)'}
                fill={i === 0 ? '#FCD34D' : 'transparent'}
                style={styles.crown}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  scoreBar: {
    height: 32,
    borderRadius: radius.full,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.35)',
    position: 'relative',
  },
  blueSide: {
    height: '100%',
  },
  redSide: {
    height: '100%',
  },
  scoreLabels: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  scoreNum: {
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  timerBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.4)',
  },
  topGiftersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 8,
  },
  teamTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gifterAvatar: {
    position: 'relative',
  },
  gifterImg: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  crown: {
    position: 'absolute',
    top: -6,
    alignSelf: 'center',
  },
});
