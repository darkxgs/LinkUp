/**
 * RoomVideoApprovalModal — معاينة طلب فيديو للموافقة/الرفض (داخل الروم)
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, X, Film, Youtube, User } from 'lucide-react-native';

import { Text } from '@/components/ui';
import {
  approveRoomVideoRequest,
  rejectRoomVideoRequest,
  type RoomVideoRequest,
} from '@/services/roomVideoRequests';
import { lu } from '@/theme/lu-brand';

interface Props {
  visible: boolean;
  request: RoomVideoRequest | null;
  onClose: () => void;
  roomId: string;
}

export function RoomVideoApprovalModal({ visible, request, onClose, roomId }: Props) {
  const { width: screenW } = useWindowDimensions();
  const previewW = Math.min(screenW - 48, 360);
  const previewH = Math.round(previewW / (16 / 9));

  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  if (!request) return null;

  const thumbUri =
    request.sourceType === 'youtube' && request.youtubeId
      ? `https://img.youtube.com/vi/${request.youtubeId}/hqdefault.jpg`
      : null;

  const handleApprove = async () => {
    setBusy('approve');
    try {
      await approveRoomVideoRequest(roomId, request.id);
      onClose();
    } catch {
      // parent may show alert
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    setBusy('reject');
    try {
      await rejectRoomVideoRequest(roomId, request.id);
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
          <Text variant="h3" weight="bold" color={lu.colors.ink} align="center">
            طلب مشاركة فيديو
          </Text>
          <Text variant="caption" color={lu.colors.ink2} align="center" style={styles.subtitle}>
            معاينة قبل الموافقة — لن يُبث الفيديو والصوت إلا بعد القبول
          </Text>

          {/* المرسل */}
          <View style={styles.requesterRow}>
            {request.requestedByAvatar ? (
              <Image source={{ uri: request.requestedByAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <User size={18} color={lu.colors.muted} strokeWidth={2} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text variant="button" weight="bold" color={lu.colors.ink} numberOfLines={1}>
                {request.requestedByName}
              </Text>
              <Text variant="caption" color={lu.colors.muted}>
                على المايك — يطلب مشاركة فيديو
              </Text>
            </View>
            {request.sourceType === 'youtube' ? (
              <Youtube size={22} color="#FF0000" strokeWidth={2} />
            ) : (
              <Film size={22} color={lu.colors.pink} strokeWidth={2} />
            )}
          </View>

          {/* معاينة */}
          <View style={[styles.previewWrap, { width: previewW, height: previewH }]}>
            {thumbUri ? (
              <Image source={{ uri: thumbUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <View style={styles.previewFallback}>
                <Film size={40} color={lu.colors.muted} strokeWidth={1.8} />
                <Text variant="caption" color={lu.colors.muted} align="center" style={{ marginTop: 8 }}>
                  {request.title ?? 'فيديو مرفوع'}
                </Text>
              </View>
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.55)']}
              style={styles.previewGradient}
            />
            {request.title ? (
              <Text variant="caption" weight="bold" color="#fff" style={styles.previewTitle} numberOfLines={2}>
                {request.title}
              </Text>
            ) : null}
          </View>

          {/* أزرار */}
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
              onPress={handleApprove}
              disabled={!!busy}
              style={[styles.btn, styles.approveBtn, !!busy && { opacity: 0.6 }]}
            >
              <LinearGradient
                colors={lu.gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {busy === 'approve' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Check size={18} color="#fff" strokeWidth={2.4} />
                  <Text variant="button" weight="bold" color="#fff">
                    موافقة
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
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    gap: 14,
  },
  subtitle: { marginTop: -6 },
  requesterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: lu.colors.bg2,
    borderRadius: lu.radius.base,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    backgroundColor: lu.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewWrap: {
    alignSelf: 'center',
    borderRadius: lu.radius.base,
    overflow: 'hidden',
    backgroundColor: lu.colors.ink,
  },
  previewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lu.colors.bg,
  },
  previewGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
  },
  previewTitle: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
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
  approveBtn: {},
});
