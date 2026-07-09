/**
 * شاشة المطابقة — PK بين الوكالات
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Radio, Check, Ban } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { colors, spacing, radius } from '@/theme';
import { lu } from '@/theme/lu-brand';
import type { PkAgencyInvite, PkMatchRequest } from '@/services/firebase/roomPkMatching';

type Props = {
  visible: boolean;
  matchRequest: PkMatchRequest | null;
  sentInvites: PkAgencyInvite[];
  loading?: boolean;
  onClose: () => void;
  onCancel: () => void;
};

function statusLabel(status: PkAgencyInvite['status'], t: (k: string) => string): string {
  switch (status) {
    case 'pending':
      return t('roomPk.invitePending');
    case 'accepted':
      return t('roomPk.inviteAccepted');
    case 'rejected':
      return t('roomPk.inviteRejected');
    case 'cancelled':
      return t('roomPk.inviteCancelled');
    default:
      return status;
  }
}

function StatusIcon({ status }: { status: PkAgencyInvite['status'] }) {
  if (status === 'accepted') return <Check size={14} color={lu.colors.mint} strokeWidth={2.5} />;
  if (status === 'rejected' || status === 'cancelled') {
    return <Ban size={14} color={lu.colors.live} strokeWidth={2.5} />;
  }
  return <Radio size={14} color={lu.colors.gold} strokeWidth={2.5} />;
}

export function RoomPkMatchingSheet({
  visible,
  matchRequest,
  sentInvites,
  loading,
  onClose,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const searching = matchRequest?.status === 'searching';
  const matched = matchRequest?.status === 'matched';

  const pending = sentInvites.filter((i) => i.status === 'pending');
  const responded = sentInvites.filter((i) => i.status !== 'pending');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['rgba(71, 17, 17, 0.98)', 'rgba(48, 10, 10, 0.98)']}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.header}>
            <Text variant="h4" weight="bold" color={colors.white}>
              {matched ? t('roomPk.matchFound') : t('roomPk.matchingTitle')}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={colors.white} strokeWidth={2.5} />
            </Pressable>
          </View>

          {searching && (
            <View style={styles.searchRow}>
              <ActivityIndicator color={lu.colors.gold} />
              <Text variant="body" color="rgba(255,255,255,0.85)" style={{ flex: 1 }}>
                {t('roomPk.matchingHint')}
              </Text>
            </View>
          )}

          {matched && matchRequest?.matchedRoomName ? (
            <View style={styles.matchedBanner}>
              <Text variant="body" weight="bold" color={lu.colors.gold} align="center">
                {t('roomPk.vsRoom', { name: matchRequest.matchedRoomName })}
              </Text>
            </View>
          ) : null}

          {/* قسم: بانتظار القبول */}
          {pending.length > 0 ? (
            <>
              <Text variant="caption" weight="bold" color="rgba(255,255,255,0.55)" style={styles.sectionTitle}>
                {t('roomPk.sectionWaiting')} ({pending.length})
              </Text>
              <FlatList
                data={pending}
                keyExtractor={(i) => i.id}
                style={{ maxHeight: 140 }}
                renderItem={({ item }) => (
                  <View style={styles.inviteRow}>
                    <StatusIcon status={item.status} />
                    <View style={styles.inviteInfo}>
                      <Text variant="body" weight="semibold" color={colors.white} numberOfLines={1}>
                        {item.toAgencyName ?? item.toRoomName ?? item.fromAgencyName}
                      </Text>
                      <Text variant="caption" color="rgba(255,255,255,0.5)">
                        {statusLabel(item.status, t)}
                      </Text>
                    </View>
                  </View>
                )}
              />
            </>
          ) : searching ? (
            <Text variant="caption" color="rgba(255,255,255,0.45)" align="center" style={{ marginVertical: 12 }}>
              {t('roomPk.noInvitesYet')}
            </Text>
          ) : null}

          {/* قسم: ردود الوكالات */}
          {responded.length > 0 ? (
            <>
              <Text variant="caption" weight="bold" color="rgba(255,255,255,0.55)" style={styles.sectionTitle}>
                {t('roomPk.sectionResponses')} ({responded.length})
              </Text>
              <FlatList
                data={responded.slice(0, 8)}
                keyExtractor={(i) => i.id}
                style={{ maxHeight: 160 }}
                renderItem={({ item }) => (
                  <View style={styles.inviteRow}>
                    <StatusIcon status={item.status} />
                    <View style={styles.inviteInfo}>
                      <Text variant="body" weight="semibold" color={colors.white} numberOfLines={1}>
                        {item.toAgencyName ?? item.toRoomName ?? item.fromAgencyName}
                      </Text>
                      <Text variant="caption" color="rgba(255,255,255,0.5)">
                        {statusLabel(item.status, t)}
                      </Text>
                    </View>
                  </View>
                )}
              />
            </>
          ) : null}

          {searching && (
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={[styles.cancelBtn, loading && { opacity: 0.6 }]}
            >
              {loading ? (
                <ActivityIndicator color={lu.colors.live} />
              ) : (
                <Text variant="button" weight="bold" color={lu.colors.live}>
                  {t('roomPk.cancelMatch')}
                </Text>
              )}
            </Pressable>
          )}
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
    padding: spacing.lg,
    maxHeight: '62%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.base,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: spacing.md,
  },
  matchedBanner: {
    padding: 14,
    borderRadius: radius.base,
    backgroundColor: 'rgba(252,211,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.35)',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    marginBottom: 8,
    marginTop: 4,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  inviteInfo: {
    flex: 1,
    alignItems: I18nManager.isRTL ? 'flex-end' : 'flex-start',
  },
  cancelBtn: {
    marginTop: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.5)',
    alignItems: 'center',
  },
});
