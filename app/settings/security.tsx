/**
 * أمن الحساب — مطابق لتجربة Saada مع هوية LinkUp
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui';
import { BackChevron, ForwardChevron } from '@/components/ui/RtlChevron';
import { useAuth } from '@/hooks/useAuth';
import { lu } from '@/theme/lu-brand';
import {
  ensurePublicAccountId,
  getSecurityProfile,
  registerCurrentDevice,
  getRegisteredDevices,
  getAuthProviderStatus,
  type SecurityProfile,
} from '@/services/accountSecurity';
type RowProps = {
  label: string;
  value?: string;
  valueColor?: string;
  showArrow?: boolean;
  danger?: boolean;
  onPress?: () => void;
  loading?: boolean;
};

function SecurityRow({
  label,
  value,
  valueColor,
  showArrow = true,
  danger,
  onPress,
  loading,
}: RowProps) {
  const content = (
    <View style={styles.row}>
      <Text
        variant="body"
        color={danger ? lu.colors.live : lu.colors.ink}
        style={styles.rowLabel}
      >
        {label}
      </Text>
      <View style={styles.rowEnd}>
        {loading ? (
          <ActivityIndicator size="small" color={lu.colors.pink} />
        ) : value ? (
          <Text
            variant="body"
            color={valueColor ?? lu.colors.muted}
            style={styles.rowValue}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
        {showArrow && onPress ? (
          <ForwardChevron size={20} color={lu.colors.muted} />
        ) : null}
      </View>
    </View>
  );

  if (!onPress) {
    return <View style={styles.rowWrap}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.rowWrap, pressed && styles.rowPressed]}
    >
      {content}
    </Pressable>
  );
}

export default function AccountSecurityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, cancelAccountDeletionRequest } = useAuth();

  const [profile, setProfile] = useState<SecurityProfile | null>(null);
  const [providers, setProviders] = useState(getAuthProviderStatus());
  const [deviceCount, setDeviceCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const load = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await registerCurrentDevice(user.uid);
      const publicAccountId = await ensurePublicAccountId(user.uid);
      const sec = await getSecurityProfile(user.uid);
      const devices = await getRegisteredDevices(user.uid);
      setProfile({ ...sec, publicAccountId });
      setDeviceCount(devices.length);
      setProviders(getAuthProviderStatus());
    } catch (e) {
      console.warn('security load:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleCancelDeletion = async () => {
    try {
      await cancelAccountDeletionRequest();
      Alert.alert(t('common.success'), t('accountSecurity.deletionCancelled'));
      load();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    }
  };

  const isPendingDeletion = profile?.accountStatus === 'pending_deletion';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <BackChevron size={26} color={lu.colors.ink} />
        </Pressable>
        <Text variant="h3" weight="bold" style={styles.headerTitle}>
          {t('accountSecurity.title')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={lu.colors.pink} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {isPendingDeletion && (
            <View style={styles.pendingBanner}>
              <Text variant="body" weight="semibold" color={lu.colors.live}>
                {t('accountSecurity.pendingDeletion')}
              </Text>
              <Text variant="caption" color={lu.colors.ink2} style={{ marginTop: 6 }}>
                {t('accountSecurity.pendingDeletionHint')}
              </Text>
              <Pressable onPress={handleCancelDeletion} style={styles.cancelDeletionBtn}>
                <Text variant="label" color={lu.colors.purple} weight="bold">
                  {t('accountSecurity.cancelDeletion')}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.section}>
            <SecurityRow
              label={t('accountSecurity.uniqueAccount')}
              value={profile?.publicAccountId ?? '—'}
              showArrow={false}
            />
            <View style={styles.divider} />
            <SecurityRow
              label={t('accountSecurity.password')}
              value={t('accountSecurity.passwordSet')}
              onPress={() => router.push('/settings/password?intent=change' as any)}
            />
            <View style={styles.divider} />
            <SecurityRow
              label={t('accountSecurity.phoneLink')}
              value={
                profile?.phoneNumber
                  ? t('accountSecurity.phoneLinked')
                  : t('accountSecurity.phoneNotLinked')
              }
              onPress={() => router.push('/settings/phone' as any)}
            />
          </View>

          <View style={styles.section}>
            <SecurityRow
              label={t('accountSecurity.facebook')}
              value={
                providers.facebook
                  ? t('accountSecurity.linked')
                  : t('accountSecurity.comingSoonShort')
              }
              valueColor={lu.colors.muted}
              onPress={undefined}
              showArrow={false}
            />
            <View style={styles.divider} />
            <SecurityRow
              label={t('accountSecurity.google')}
              value={
                providers.google
                  ? t('accountSecurity.linked')
                  : t('accountSecurity.comingSoonShort')
              }
              valueColor={lu.colors.muted}
              onPress={undefined}
              showArrow={false}
            />
            <View style={styles.divider} />
            <SecurityRow
              label={t('accountSecurity.apple')}
              value={
                providers.apple
                  ? t('accountSecurity.linked')
                  : t('accountSecurity.comingSoonShort')
              }
              valueColor={lu.colors.muted}
              onPress={undefined}
              showArrow={false}
            />
            <View style={styles.divider} />
            <SecurityRow
              label={t('accountSecurity.tiktok')}
              value={
                profile?.linkedTiktok
                  ? t('accountSecurity.linked')
                  : t('accountSecurity.comingSoonShort')
              }
              valueColor={lu.colors.muted}
              onPress={undefined}
              showArrow={false}
            />
          </View>

          <View style={styles.section}>
            <SecurityRow
              label={t('accountSecurity.devices')}
              value={t('accountSecurity.devicesCount', { count: deviceCount })}
              onPress={() => router.push('/settings/devices' as any)}
            />
          </View>

          <View style={[styles.section, styles.sectionLast]}>
            <SecurityRow
              label={t('accountSecurity.deleteAccount')}
              danger
              showArrow
              onPress={() => setShowDeleteModal(true)}
            />
          </View>
        </ScrollView>
      )}

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDeleteModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text variant="body" style={styles.modalParagraph}>
              {t('accountSecurity.deleteParagraph1')}
            </Text>
            <Text variant="body" style={styles.modalParagraph}>
              {t('accountSecurity.deleteParagraph2')}
            </Text>
            <Text variant="body" style={styles.modalParagraph}>
              {t('accountSecurity.deleteParagraph3')}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text variant="body" weight="semibold" color={lu.colors.live}>
                  {t('accountSecurity.cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowDeleteModal(false);
                  router.push('/settings/password?intent=delete' as any);
                }}
                style={styles.modalDeleteWrap}
              >
                <LinearGradient
                  colors={lu.gradients.orange}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text variant="body" weight="bold" color={lu.colors.onGrad}>
                  {t('accountSecurity.deleteAccount')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: lu.colors.card },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lu.colors.line,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: lu.colors.ink },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: {
    marginTop: 8,
    backgroundColor: lu.colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: lu.colors.line,
  },
  sectionLast: { marginTop: 16 },
  rowWrap: { backgroundColor: lu.colors.card },
  rowPressed: { backgroundColor: lu.colors.bg2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    minHeight: 54,
  },
  rowLabel: { flex: 1, fontSize: 16 },
  rowEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '55%',
  },
  rowValue: { fontSize: 15, textAlign: 'left' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: lu.colors.line,
    marginStart: 20,
  },
  pendingBanner: {
    margin: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: lu.colors.redSoft,
    borderWidth: 1,
    borderColor: '#FFD6D6',
  },
  cancelDeletionBtn: { marginTop: 12, alignSelf: 'flex-start' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 10, 12, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: lu.colors.card,
    borderRadius: 20,
    padding: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#1A0A0C',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
    }),
  },
  modalParagraph: {
    color: lu.colors.ink2,
    lineHeight: 22,
    marginBottom: 14,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: '#F5F0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeleteWrap: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
