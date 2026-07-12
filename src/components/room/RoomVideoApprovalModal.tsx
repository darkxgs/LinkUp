/**
 * RoomVideoApprovalModal — معاينة طلب فيديو للموافقة/الرفض (داخل الروم)
 */

import React, { useEffect, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { Check, X, Film, Youtube, User, Play } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { LocalVideoPreview } from '@/components/room/LocalVideoPreview';
import {
  approveRoomVideoRequest,
  rejectRoomVideoRequest,
  type RoomVideoRequest,
} from '@/services/roomVideoRequests';
import { isUserOnRoomSeat } from '@/services/firebase/rooms';
import { lu } from '@/theme/lu-brand';

interface Props {
  visible: boolean;
  request: RoomVideoRequest | null;
  onClose: () => void;
  roomId: string;
}

export function RoomVideoApprovalModal({ visible, request, onClose, roomId }: Props) {
  const { t } = useTranslation();
  const { width: screenW } = useWindowDimensions();
  const previewW = Math.min(screenW - 48, 360);
  const previewH = Math.round(previewW / (16 / 9));

  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  // معاينة الفيديو داخل النافذة — lazy: لا يُحمَّل المشغّل قبل ضغط زر المعاينة
  const [previewing, setPreviewing] = useState(false);
  // هل الطالب ما زال على المايك؟ null = جارٍ التحقق (نعرض النص الافتراضي)
  const [requesterOnMic, setRequesterOnMic] = useState<boolean | null>(null);

  // أي إغلاق/تبديل طلب يوقف المعاينة فوراً (unmount للمشغّل = unload حتمي)
  useEffect(() => {
    setPreviewing(false);
  }, [visible, request?.id]);

  // «على المايك» كانت عبارة ثابتة غير متحققة — نقرأ مقاعد RTDB لحظة العرض
  useEffect(() => {
    if (!visible || !request) {
      setRequesterOnMic(null);
      return;
    }
    let cancelled = false;
    setRequesterOnMic(null);
    isUserOnRoomSeat(roomId, request.requestedBy)
      .then((onMic) => {
        if (!cancelled) setRequesterOnMic(onMic);
      })
      .catch(() => {
        // فشل القراءة — لا نعرض «نزل عن المايك» بلا دليل
        if (!cancelled) setRequesterOnMic(true);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, request?.id, request?.requestedBy, roomId]);

  if (!request) return null;

  // معاينة الطلب — الصورة المولَّدة من الفيديو المرفوع أو صورة يوتيوب
  const thumbUri =
    request.thumbnailUrl?.trim() ||
    (request.sourceType === 'youtube' && request.youtubeId
      ? `https://img.youtube.com/vi/${request.youtubeId}/hqdefault.jpg`
      : null);

  const handleApprove = async () => {
    setPreviewing(false); // القرار يوقف المعاينة فوراً
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
    setPreviewing(false); // القرار يوقف المعاينة فوراً
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
              <Text
                variant="caption"
                color={requesterOnMic === false ? lu.colors.live : lu.colors.muted}
              >
                {requesterOnMic === false
                  ? t('room.videoRequesterOffMic')
                  : t('room.videoRequesterOnMic')}
              </Text>
            </View>
            {request.sourceType === 'youtube' ? (
              <Youtube size={22} color="#FF0000" strokeWidth={2} />
            ) : (
              <Film size={22} color={lu.colors.pink} strokeWidth={2} />
            )}
          </View>

          {/* معاينة — غلاف ثابت يتحول لمشغّل محلي بحت عند ضغط زر المعاينة */}
          <View style={[styles.previewWrap, { width: previewW, height: previewH }]}>
            {previewing ? (
              <LocalVideoPreview
                url={request.url}
                sourceType={
                  request.sourceType === 'youtube'
                    ? 'youtube'
                    : request.sourceType === 'hls'
                      ? 'hls'
                      : 'mp4'
                }
                youtubeId={request.youtubeId}
                posterUri={thumbUri ?? undefined}
              />
            ) : (
              <>
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
                {/* زر تشغيل المعاينة — lazy: لا يُحمَّل الفيديو قبل الضغط */}
                <View style={styles.previewBtnOverlay} pointerEvents="box-none">
                  <Pressable
                    onPress={() => setPreviewing(true)}
                    style={styles.previewPlayBtn}
                    accessibilityLabel={t('room.videoPreviewBtn')}
                  >
                    <Play size={16} color="#fff" fill="#fff" />
                    <Text variant="caption" weight="bold" color="#fff">
                      {t('room.videoPreviewBtn')}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
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
  previewBtnOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
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
