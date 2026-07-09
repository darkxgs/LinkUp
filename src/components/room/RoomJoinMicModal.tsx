/**
 * RoomJoinMicModal — مودال شراء/انضمام لأخذ المايك (عضوية الغرفة)
 */
import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { X, Mic, User, Heart, Coins } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { spacing, radius } from '@/theme';

interface Props {
  visible: boolean;
  fee: number;
  loading?: boolean;
  onClose: () => void;
  onJoin: () => void;
}

function PrivilegeRow({
  icon,
  iconBg,
  label,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
}) {
  return (
    <View style={styles.privilegeRow}>
      <Text variant="bodySmall" color={lu.colors.ink} style={styles.privilegeText}>
        {label}
      </Text>
      <View style={[styles.privilegeIcon, { backgroundColor: iconBg }]}>{icon}</View>
    </View>
  );
}

export function RoomJoinMicModal({
  visible,
  fee,
  loading = false,
  onClose,
  onJoin,
}: Props) {
  const { t } = useTranslation();
  const isFree = fee <= 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <X size={20} color={lu.colors.muted} />
          </Pressable>

          <Text variant="body" weight="bold" color={lu.colors.ink} align="center" style={styles.title}>
            {isFree ? t('roomJoinMic.titleFree') : t('roomJoinMic.titlePaid')}
          </Text>

          <Text variant="bodySmall" weight="bold" color={lu.colors.ink2} style={styles.sectionTitle}>
            {t('roomJoinMic.privilegesTitle')}
          </Text>

          <View style={styles.privileges}>
            <PrivilegeRow
              label={t('roomJoinMic.privilegeMic')}
              iconBg="#FFF4CC"
              icon={<Mic size={18} color="#EAB308" strokeWidth={2.2} />}
            />
            <PrivilegeRow
              label={t('roomJoinMic.privilegeBadge')}
              iconBg="#FDEAEA"
              icon={<User size={18} color="#ED4444" strokeWidth={2.2} />}
            />
            <PrivilegeRow
              label={t('roomJoinMic.privilegeFans')}
              iconBg="#FFE6E6"
              icon={<Heart size={18} color="#E11414" strokeWidth={2.2} fill="#E11414" />}
            />
          </View>

          <Pressable
            onPress={onJoin}
            disabled={loading}
            style={({ pressed }) => [
              styles.joinBtn,
              pressed && !loading && { opacity: 0.9 },
              loading && { opacity: 0.7 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.joinBtnInner}>
                {isFree ? (
                  <Text variant="button" weight="bold" color="#fff">
                    {t('roomJoinMic.joinFree')}
                  </Text>
                ) : (
                  <>
                    <Text variant="button" weight="bold" color="#fff">
                      {t('roomJoinMic.join')}
                    </Text>
                    <View style={styles.feeChip}>
                      <Text variant="caption" weight="bold" color="#fff" style={styles.feeText}>
                        {fee.toLocaleString()}
                      </Text>
                      <Coins size={14} color={lu.colors.gold} fill={lu.colors.gold} />
                    </View>
                  </>
                )}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + 4,
    paddingBottom: spacing.lg,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 2,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    lineHeight: 24,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  privileges: {
    gap: 10,
    marginBottom: spacing.lg,
  },
  privilegeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  privilegeText: {
    flex: 1,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    marginLeft: spacing.sm,
  },
  privilegeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtn: {
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: lu.colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  feeText: {
    fontSize: 13,
  },
});
