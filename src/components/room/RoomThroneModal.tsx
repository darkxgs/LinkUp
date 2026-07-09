/**
 * RoomThroneModal — موديل العرش (العرش ينتظر)
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { X, HelpCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text, useAlert } from '@/components/ui';
import { RoomThroneIcon } from './RoomThroneIcon';
import {
  type RoomThroneState,
  claimRoomThrone,
  vacateRoomThrone,
} from '@/services/roomThrone';
import { type RoomThroneConfig } from '@/services/firebase/roomThroneConfig';
import { lu } from '@/theme/lu-brand';

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  throne: RoomThroneState;
  config: RoomThroneConfig;
  myUid: string;
  myContribution: number;
  canManageRoom?: boolean;
  onSendGift: () => void;
}

export function RoomThroneModal({
  visible,
  onClose,
  roomId,
  throne,
  config,
  myUid,
  myContribution,
  canManageRoom,
  onSendGift,
}: Props) {
  const { t, i18n } = useTranslation();
  const { showAlert } = useAlert();
  const [busy, setBusy] = useState(false);
  const isAr = i18n.language?.startsWith('ar');

  const minCoins = config.minGiftCoins;
  const title = isAr ? config.titleAr : config.titleEn;
  const hintTemplate = isAr ? config.hintAr : config.hintEn;
  const hint = hintTemplate.replace('{{coins}}', minCoins.toLocaleString());

  const qualified = myContribution >= minCoins;
  const isOccupant = throne.occupantUid === myUid;

  const handleClaim = useCallback(async () => {
    setBusy(true);
    try {
      await claimRoomThrone(roomId, myUid, minCoins);
      showAlert({
        type: 'crown',
        title: t('roomThrone.claimed'),
        message: t('roomThrone.claimedMsg'),
      });
      onClose();
    } catch (e: any) {
      showAlert({
        type: 'warning',
        title: t('common.error'),
        message: e?.message ?? t('roomThrone.claimFailed'),
      });
    } finally {
      setBusy(false);
    }
  }, [minCoins, myUid, onClose, roomId, showAlert, t]);

  const handleVacate = useCallback(async () => {
    setBusy(true);
    try {
      await vacateRoomThrone(roomId);
      showAlert({ type: 'info', title: t('roomThrone.vacated'), message: t('roomThrone.vacatedMsg') });
      onClose();
    } catch (e: any) {
      showAlert({ type: 'error', title: t('common.error'), message: e?.message ?? t('roomThrone.vacateFailed') });
    } finally {
      setBusy(false);
    }
  }, [onClose, roomId, showAlert, t]);

  const handleSendGift = () => {
    onClose();
    onSendGift();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Pressable style={styles.helpBtn} hitSlop={12}>
            <HelpCircle size={18} color="#9CA3AF" />
          </Pressable>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <X size={20} color="#6B7280" />
          </Pressable>

          <Text variant="h4" weight="bold" color="#111827" style={styles.title}>
            {title}
          </Text>

          <View style={styles.iconWrap}>
            <RoomThroneIcon size={96} />
          </View>

          <Text variant="body" color="#4B5563" style={styles.hint}>
            {hint}
          </Text>

          <View style={styles.progressRow}>
            <Text variant="caption" color="#6B7280">
              {t('roomThrone.yourGifts')}
            </Text>
            <Text variant="body" color={qualified ? lu.colors.gold : '#EF4444'} weight="bold">
              {myContribution.toLocaleString()} / {minCoins.toLocaleString()}
            </Text>
          </View>

          {isOccupant ? (
            <View style={styles.occupantBadge}>
              <Text variant="caption" color={lu.colors.purple} weight="bold">
                {t('roomThrone.youOnThrone')}
              </Text>
            </View>
          ) : null}

          {qualified && !isOccupant ? (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: lu.colors.purple }, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={handleClaim}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text variant="body" color="#fff" weight="bold">
                  {t('roomThrone.takeThrone')}
                </Text>
              )}
            </Pressable>
          ) : (
            <Pressable style={styles.primaryBtn} onPress={handleSendGift}>
              <Text variant="body" color="#fff" weight="bold">
                {t('roomThrone.sendGiftNow')}
              </Text>
            </Pressable>
          )}

          {canManageRoom && throne.occupantUid ? (
            <Pressable style={styles.secondaryBtn} disabled={busy} onPress={handleVacate}>
              <Text variant="caption" color="#9CA3AF" weight="semibold">
                {t('roomThrone.closeThrone')}
              </Text>
            </Pressable>
          ) : (
            <Pressable style={styles.secondaryBtn} onPress={onClose}>
              <Text variant="caption" color="#9CA3AF" weight="semibold">
                {t('roomThrone.dismiss')}
              </Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  helpBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  iconWrap: {
    marginVertical: 8,
  },
  hint: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  progressRow: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
  },
  occupantBadge: {
    backgroundColor: 'rgba(240, 43, 43, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  secondaryBtn: {
    paddingVertical: 8,
  },
});
