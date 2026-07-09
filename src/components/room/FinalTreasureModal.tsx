/**
 * مودال الكنز النهائي — تصميم متوافق مع هوية LinkUp (بدون زخارف مقصوصة)
 */
import React from 'react';
import {
  Modal,
  Pressable,
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, X } from 'lucide-react-native';

import { Text, CurrencyIcon } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { spacing, radius } from '@/theme';

interface Props {
  visible: boolean;
  amount: number;
  onClose: () => void;
}

export function FinalTreasureModal({ visible, amount, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const formatted = amount.toLocaleString(i18n.language === 'ar' ? 'ar' : undefined);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={12}
            accessibilityLabel={t('common.close')}
          >
            <X size={20} color="rgba(255,255,255,0.85)" strokeWidth={2.5} />
          </Pressable>

          <View style={styles.iconWrap}>
            <LinearGradient
              colors={['#FFD86F', '#FF9A2E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Trophy size={28} color="#fff" strokeWidth={2.2} />
          </View>

          <View style={styles.badge}>
            <Text variant="caption" weight="semibold" color={lu.colors.gold}>
              {t('room.eventReview')}
            </Text>
          </View>

          <Text variant="h3" weight="bold" color="#fff" align="center" style={styles.title}>
            {t('room.finalTreasure')}
          </Text>

          <View style={styles.amountBox}>
            <CurrencyIcon type="coin" size={24} />
            <View style={styles.amountTexts}>
              <Text
                variant="h2"
                weight="bold"
                color={lu.colors.gold}
                style={styles.amountValue}
              >
                {formatted}
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.72)" style={styles.amountLabel}>
                {t('room.coinUnit')}
              </Text>
            </View>
          </View>

          <Text
            variant="bodySmall"
            color="rgba(255,255,255,0.78)"
            align="center"
            style={styles.hint}
          >
            {t('room.treasureHint')}
          </Text>

          <Pressable onPress={onClose} style={styles.okBtn}>
            <LinearGradient
              colors={[...lu.gradients.brand]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <Text variant="button" weight="bold" color="#fff">
              {t('common.ok')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 6, 6, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: lu.colors.room1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 197, 61, 0.28)',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.md,
    end: spacing.md,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 197, 61, 0.15)',
    marginBottom: spacing.sm,
  },
  title: {
    marginBottom: spacing.lg,
    lineHeight: 28,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 197, 61, 0.2)',
  },
  amountTexts: {
    flex: 1,
    minWidth: 0,
  },
  amountValue: {
    fontSize: 26,
    lineHeight: Platform.OS === 'android' ? 34 : 32,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  amountLabel: {
    marginTop: 2,
    lineHeight: 16,
  },
  hint: {
    lineHeight: 20,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  okBtn: {
    width: '100%',
    height: 48,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
