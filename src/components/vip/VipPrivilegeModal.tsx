/**
 * مودال تفاصيل امتياز VIP — مطابق لتطبيق المنافس
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { VIP_ASSETS, VIP_DESIGN } from '@/components/vip/vipDesign';
import { PrivilegeVectorIcon } from '@/components/icons/PrivilegeVectorIcon';
import type { VipPrivilegeDef } from '@/services/firebase/vipSystem';
import { WlLockWhiteIcon } from '@/components/wealthLevel/WealthLevelDesignIcons';

type Props = {
  visible: boolean;
  privilege: VipPrivilegeDef | null;
  userLevel: number;
  onClose: () => void;
};

export function VipPrivilegeModal({ visible, privilege, userLevel, onClose }: Props) {
  const { t } = useTranslation();
  const { width: W } = useWindowDimensions();

  if (!privilege) return null;

  const unlocked = userLevel >= privilege.unlockLevel;
  const unlockLabel = `SVIP${privilege.unlockLevel}`;

  const showSeatDemo = privilege.id === 'vip-seat';
  const showBadgeGrid = privilege.id === 'vip-badge';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.card, { width: Math.min(W - 32, 360) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.cardBg} />

          <Text weight="bold" style={styles.title}>
            {privilege.title || t(privilege.titleKey)}
          </Text>

          <ScrollView
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {showSeatDemo ? (
              <View style={styles.seatBox}>
                {DEMO_SEAT_USERS.map((u) => (
                  <View key={u.name} style={[styles.seatRow, { backgroundColor: u.tint }]}>
                    <View style={styles.seatAvatarWrap}>
                      <Image source={VIP_ASSETS.vipBadge} style={styles.seatAvatar} contentFit="contain" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text weight="bold" style={styles.seatName}>{u.name}</Text>
                      <Image source={VIP_ASSETS.vipBadge} style={{ width: 56, height: 22, marginTop: 4 }} contentFit="contain" />
                    </View>
                  </View>
                ))}
              </View>
            ) : showBadgeGrid ? (
              <View style={styles.badgeGrid}>
                {BADGE_LEVELS.map((lv) => (
                  <View key={lv} style={styles.badgeCell}>
                    <Image source={VIP_ASSETS.vipBadge} style={styles.badgeImg} contentFit="contain" />
                    <Text style={styles.badgeLv}>{lv}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.heroBox}>
                {(() => {
                  const img = privilege.imageUrl
                    ? { uri: privilege.imageUrl }
                    : VIP_ASSETS[privilege.assetKey];
                  return img ? (
                    <Image source={img} style={styles.heroImg} contentFit="contain" />
                  ) : (
                    <PrivilegeVectorIcon name={privilege.assetKey} size={72} />
                  );
                })()}
              </View>
            )}

            <Text style={styles.desc}>{privilege.desc || t(privilege.descKey)}</Text>
          </ScrollView>

          <View style={styles.footer}>
            {!unlocked ? (
              <View style={styles.lockRow}>
                <WlLockWhiteIcon size={12} />
                <Text weight="bold" style={styles.footerText}>
                  {t('vipHub.privilegeUnlock', { level: unlockLabel })}
                </Text>
              </View>
            ) : (
              <Text weight="bold" style={[styles.footerText, { color: VIP_DESIGN.purple }]}>
                {t('vipHub.privilegeActive')}
              </Text>
            )}
          </View>

          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text weight="bold" style={{ color: VIP_DESIGN.ink2, fontSize: 14 }}>
              {t('common.close')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const DEMO_SEAT_USERS = [
  { name: 'Adelaide', tint: '#FEE2E2' },
  { name: 'Aurora', tint: '#FFF0E8' },
  { name: 'Anonymous', tint: '#FDEAEA' },
];

const BADGE_LEVELS = ['VIP1', 'VIP2', 'VIP3', 'VIP4', 'VIP5', 'VIP6', 'VIP7', 'VIP8'];

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: VIP_DESIGN.cardBorder,
    padding: 18,
    backgroundColor: '#FFFFFF',
    ...lu.shadows.card,
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  title: {
    textAlign: 'center',
    fontSize: 18,
    color: VIP_DESIGN.ink,
    marginBottom: 14,
  },
  seatBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
  },
  seatAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatAvatar: { width: 44, height: 44 },
  seatName: { fontSize: 13, color: '#1B1B22' },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: VIP_DESIGN.purpleSoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  badgeCell: { width: '28%', alignItems: 'center' },
  badgeImg: { width: 52, height: 52 },
  badgeLv: { fontSize: 10, color: VIP_DESIGN.ink2, marginTop: 4 },
  heroBox: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: VIP_DESIGN.purpleSoft,
    borderRadius: 14,
    marginBottom: 12,
  },
  heroImg: { width: 120, height: 120 },
  desc: {
    fontSize: 13,
    lineHeight: 21,
    color: VIP_DESIGN.ink2,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  footer: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: VIP_DESIGN.purpleSoft,
    alignItems: 'center',
  },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { fontSize: 12, color: VIP_DESIGN.ink2, textAlign: 'center' },
  closeBtn: {
    marginTop: 12,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
});
