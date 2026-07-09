/**
 * بوب أب دعوة PK بين الوكالات — للمشرفين ومدير الوكالة
 */

import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, Check, X } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import {
  acceptPkAgencyInvite,
  rejectPkAgencyInvite,
  type PkAgencyInvite,
} from '@/services/firebase/roomPkMatching';

type Props = {
  visible: boolean;
  invite: PkAgencyInvite | null;
  roomId: string;
  onClose: () => void;
  onAccepted?: () => void;
};

export function RoomPkChallengePopup({ visible, invite, roomId, onClose, onAccepted }: Props) {
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);

  if (!invite) return null;

  const handleAccept = async () => {
    setBusy('accept');
    try {
      await acceptPkAgencyInvite(roomId, invite.id);
      onAccepted?.();
      onClose();
    } catch {
      // parent may alert
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    setBusy('reject');
    try {
      await rejectPkAgencyInvite(roomId, invite.id);
      onClose();
    } catch {
      // ignore
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Shield size={32} color={lu.colors.gold} strokeWidth={2} />
          </View>

          <Text variant="h3" weight="bold" color={lu.colors.ink} align="center">
            دعوة تحدي PK
          </Text>
          <Text variant="caption" color={lu.colors.ink2} align="center" style={styles.subtitle}>
            بين الوكالات — للإشراف ومدير الوكالة فقط
          </Text>

          <View style={styles.infoBox}>
            <Text variant="body" weight="bold" color={lu.colors.ink} align="center">
              {invite.fromAgencyName ?? invite.fromRoomName}
            </Text>
            <Text variant="caption" color={lu.colors.muted} align="center" style={{ marginTop: 4 }}>
              {invite.durationMinutes} د · {invite.fromRoomName}
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={handleReject}
              disabled={!!busy}
              style={[styles.btn, styles.rejectBtn, !!busy && { opacity: 0.6 }]}
            >
              {busy === 'reject' ? (
                <ActivityIndicator color={lu.colors.live} />
              ) : (
                <>
                  <X size={18} color={lu.colors.live} strokeWidth={2.4} />
                  <Text variant="button" weight="bold" color={lu.colors.live}>
                    رفض
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={handleAccept}
              disabled={!!busy}
              style={[styles.btn, styles.acceptBtn, !!busy && { opacity: 0.6 }]}
            >
              <LinearGradient
                colors={lu.gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {busy === 'accept' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Check size={18} color="#fff" strokeWidth={2.4} />
                  <Text variant="button" weight="bold" color="#fff">
                    قبول التحدي
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 10, 12,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    gap: 12,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(251,191,36,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: { marginTop: -4 },
  infoBox: {
    width: '100%',
    padding: 14,
    borderRadius: lu.radius.base,
    backgroundColor: lu.colors.bg2,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  btn: {
    flex: 1,
    height: 50,
    borderRadius: lu.radius.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  rejectBtn: {
    backgroundColor: lu.colors.redSoft,
    borderWidth: 1.5,
    borderColor: lu.colors.live,
  },
  acceptBtn: {},
});
