/**
 * إعداد التحدي: المدة + قواعد + بدء
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { colors, spacing, radius } from '@/theme';
import { lu } from '@/theme/lu-brand';
import type { PkDuration } from '@/services/firebase/roomPk';

const DURATIONS: PkDuration[] = [5, 15, 30];

type Props = {
  visible: boolean;
  mode: 'in_room' | 'cross_room';
  modeLabel: string;
  startLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onStart: (duration: PkDuration, mode: 'in_room' | 'cross_room') => void;
};

export function RoomPkSetupSheet({
  visible,
  mode,
  modeLabel,
  startLabel,
  loading = false,
  onClose,
  onStart,
}: Props) {
  const { t } = useTranslation();
  const [duration, setDuration] = useState<PkDuration>(15);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['rgba(71, 17, 17, 0.98)', 'rgba(48, 10, 10, 0.98)']}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.header}>
            <LinearGradient
              colors={['#FCD34D', '#F59E0B', '#D97706']}
              style={styles.pkTitleBadge}
            >
              <Text style={styles.pkTitleText}>PK</Text>
            </LinearGradient>
            <Pressable onPress={onClose} style={styles.closeBtn} disabled={loading}>
              <X size={22} color={colors.white} strokeWidth={2.5} />
            </Pressable>
          </View>

          <Text variant="caption" color="rgba(255,255,255,0.7)" align="center" style={{ marginBottom: 8 }}>
            {modeLabel}
          </Text>

          <Text variant="h4" weight="bold" color={colors.white} style={styles.sectionLabel}>
            {t('roomPk.timeLabel')}
          </Text>
          <View style={styles.durationRow}>
            {DURATIONS.map((d) => {
              const active = duration === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => setDuration(d)}
                  style={[styles.durationBtn, active && styles.durationBtnActive]}
                >
                  <Text
                    variant="body"
                    weight="bold"
                    color={active ? lu.colors.gold : 'rgba(255,255,255,0.8)'}
                  >
                    {t('roomPk.minutes', { n: d })}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => onStart(duration, mode)}
            disabled={loading}
            style={({ pressed }) => [styles.startWrap, pressed && { opacity: 0.92 }]}
          >
            <LinearGradient
              colors={['#F43F5E', '#E11414', '#B00E0E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startBtn}
              pointerEvents="none"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text variant="button" weight="bold" color="#fff">
                  {startLabel ?? t('roomPk.start')}
                </Text>
              )}
            </LinearGradient>
          </Pressable>

          <ScrollView style={styles.rulesScroll} showsVerticalScrollIndicator={false}>
            <Text variant="caption" color="rgba(255,255,255,0.75)" style={styles.ruleLine}>
              {t('roomPk.rule1')}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.75)" style={styles.ruleLine}>
              {t('roomPk.rule2')}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.75)" style={styles.ruleLine}>
              {t('roomPk.rule3')}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.75)" style={styles.ruleLine}>
              {t('roomPk.rule4')}
            </Text>
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
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + 12,
    maxHeight: '78%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pkTitleBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
  },
  pkTitleText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    fontStyle: 'italic',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    textAlign: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  durationBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  durationBtnActive: {
    borderColor: lu.colors.gold,
    backgroundColor: 'rgba(252,211,77,0.15)',
  },
  startWrap: {
    marginBottom: spacing.md,
  },
  startBtn: {
    paddingVertical: 14,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  rulesScroll: {
    maxHeight: 140,
  },
  ruleLine: {
    lineHeight: 18,
    marginBottom: 8,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
});
