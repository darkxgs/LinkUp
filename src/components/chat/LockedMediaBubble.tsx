/**
 * LockedMediaBubble
 *
 * يعرض رسالة وسائط مقفلة/مؤقتة في فقاعة الشات:
 *  - مقفلة + لم تُفتح: غلاف ضبابي + سعر + زر "افتح بـ X كوين"
 *  - مفتوحة/عادية: عرض المحتوى (صورة/صوت/فيديو)
 *  - once + مُشاهَدة: "انتهت الرسالة"
 *  - timed: عند الفتح، عدّاد تنازلي ثم إخفاء
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Lock,
  Eye,
  EyeOff,
  Coins,
  Play,
  Timer,
  Zap,
  Image as ImageIcon,
  Video as VideoIcon,
} from 'lucide-react-native';

import { Text, useAlert, VoiceMessagePlayer } from '@/components/ui';
import {
  unlockMessage,
  markMessageViewed,
  canViewMedia,
} from '@/services/lockedMedia';
import type { ChatMessage } from '@/services/firebase/chat';
import { lu } from '@/theme/lu-brand';
import { radius } from '@/theme';

interface Props {
  msg: ChatMessage;
  myUid: string;
  isMine: boolean;
  onOpenFullImage?: (url: string) => void;
  onOpenVideo?: (url: string) => void;
}

export function LockedMediaBubble({
  msg,
  myUid,
  isMine,
  onOpenFullImage,
  onOpenVideo,
}: Props) {
  const { showAlert } = useAlert();
  const [unlocking, setUnlocking] = useState(false);
  const [unlockedLocally, setUnlockedLocally] = useState(false);
  const [locallyViewed, setLocallyViewed] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const status = canViewMedia(msg, myUid);
  const effectiveUnlocked =
    unlockedLocally || !(msg.isLocked && !(msg.unlockedBy ?? []).includes(myUid));
  const effectiveStatus = effectiveUnlocked
    ? { ...status, canView: true, needsUnlock: false }
    : status;
  const viewDuration = msg.viewDuration ?? 0;
  const onceDisplaySeconds = viewDuration > 0 ? viewDuration : 8;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // فتح بالدفع
  const handleUnlock = () => {
    showAlert({
      type: 'warning',
      title: 'فتح الرسالة',
      message: `سيتم خصم ${msg.unlockPrice?.toLocaleString('en-US')} كوين لرؤية هذا المحتوى`,
      buttons: [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'فتح',
          onPress: async () => {
            setUnlocking(true);
            try {
              await unlockMessage(msg.id);
              setUnlockedLocally(true);
              if (msg.expireMode === 'once') {
                startRevealCountdown(onceDisplaySeconds);
              } else if (msg.expireMode === 'timed' && viewDuration > 0) {
                startRevealCountdown(viewDuration);
              }
            } catch (e: any) {
              showAlert({ type: 'error', title: 'فشل', message: e?.message ?? 'خطأ' });
            } finally {
              setUnlocking(false);
            }
          },
        },
      ],
    });
  };

  // فتح رسالة once/timed (بدون دفع — مجرّد عرض مؤقت)
  const handleReveal = () => {
    if (msg.expireMode === 'once') {
      startRevealCountdown(onceDisplaySeconds);
      return;
    }
    if (msg.expireMode === 'timed' && viewDuration > 0) {
      startRevealCountdown(viewDuration);
    }
  };

  const startRevealCountdown = (seconds: number) => {
    setRevealing(true);
    setCountdown(seconds);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setRevealing(false);
          setLocallyViewed(true);
          markMessageViewed(msg.id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  // ============ حالات العرض ============

  // 1. انتهت (once + مُشاهَدة)
  if ((effectiveStatus.expired || locallyViewed) && !isMine) {
    return (
      <View style={styles.expiredBox}>
        <EyeOff size={20} color="#9A9AA5" />
        <Text variant="caption" color="#9A9AA5">انتهت الرسالة</Text>
      </View>
    );
  }

  // 2. مقفلة وتحتاج دفع (لست المرسل)
  if (effectiveStatus.needsUnlock && !isMine) {
    return (
      <Pressable onPress={handleUnlock} disabled={unlocking} style={styles.lockedBox}>
        <LinearGradient
          colors={[lu.colors.purple, lu.colors.purpleDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* أيقونة نوع الوسائط */}
        <View style={styles.lockedIcon}>
          {msg.type === 'image' ? (
            <ImageIcon size={28} color="rgba(255,255,255,0.9)" />
          ) : msg.type === 'video' ? (
            <VideoIcon size={28} color="rgba(255,255,255,0.9)" />
          ) : (
            <Play size={28} color="rgba(255,255,255,0.9)" />
          )}
          <View style={styles.lockBadge}>
            <Lock size={12} color="#fff" />
          </View>
        </View>

        <Text variant="caption" color="#fff" weight="bold" style={{ marginTop: 8 }}>
          {msg.type === 'image' ? 'صورة مقفلة' : msg.type === 'video' ? 'فيديو مقفل' : 'صوت مقفل'}
        </Text>

        {unlocking ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 8 }} />
        ) : (
          <View style={styles.unlockBtn}>
            <Coins size={14} color="#FFC53D" />
            <Text variant="caption" color="#fff" weight="bold">
              افتح بـ {msg.unlockPrice?.toLocaleString('en-US')} كوين
            </Text>
          </View>
        )}
      </Pressable>
    );
  }

  // 3. رسالة once/timed لم تُفتح بعد (مجانية، لكن مؤقتة) — لست المرسل
  if (
    !isMine &&
    !effectiveStatus.needsUnlock &&
    (msg.expireMode === 'once' || (msg.expireMode === 'timed' && viewDuration > 0)) &&
    !revealing &&
    !locallyViewed
  ) {
    return (
      <Pressable onPress={handleReveal} style={styles.tapToView}>
        <LinearGradient
          colors={['#FFE6E9', '#FDECEC']}
          style={StyleSheet.absoluteFill}
        />
        {msg.expireMode === 'once' ? (
          <Zap size={24} color={lu.colors.pink} />
        ) : (
          <Timer size={24} color={lu.colors.pink} />
        )}
        <Text variant="caption" weight="bold" color={lu.colors.purpleDark} style={{ marginTop: 6 }}>
          {msg.expireMode === 'once'
            ? `اضغط للعرض (${onceDisplaySeconds}ث)`
            : `اضغط للعرض (${viewDuration}ث)`}
        </Text>
        <Text variant="caption" color="#9A9AA5" style={{ fontSize: 10 }}>
          {msg.type === 'image' ? 'صورة' : msg.type === 'video' ? 'فيديو' : 'رسالة صوتية'}
        </Text>
      </Pressable>
    );
  }

  // 4. عرض المحتوى الفعلي
  return (
    <View>
      {/* عدّاد تنازلي أثناء العرض المؤقت */}
      {revealing && countdown > 0 && (
        <View style={styles.countdownBadge}>
          <Timer size={11} color="#fff" />
          <Text variant="caption" color="#fff" weight="bold" style={{ fontSize: 10 }}>
            {countdown}
          </Text>
        </View>
      )}

      {msg.type === 'image' && msg.imageUrl && (
        <Pressable onPress={() => onOpenFullImage?.(msg.imageUrl!)}>
          <Image source={{ uri: msg.imageUrl }} style={styles.media} contentFit="cover" cachePolicy="memory-disk" recyclingKey={msg.id} transition={150} />
        </Pressable>
      )}

      {msg.type === 'video' && msg.videoUrl && (
        <Pressable onPress={() => onOpenVideo?.(msg.videoUrl!)} style={styles.videoBox}>
          {msg.videoThumbnail ? (
            <Image source={{ uri: msg.videoThumbnail }} style={styles.media} contentFit="cover" cachePolicy="memory-disk" recyclingKey={msg.id} transition={150} />
          ) : (
            <View style={[styles.media, styles.videoPlaceholder]}>
              <VideoIcon size={32} color="#fff" />
            </View>
          )}
          <View style={styles.playOverlay}>
            <Play size={28} color="#fff" fill="#fff" />
          </View>
        </Pressable>
      )}

      {msg.type === 'voice' && msg.voiceUrl && (
        <VoiceMessagePlayer
          voiceUrl={msg.voiceUrl}
          duration={msg.voiceDuration ?? 0}
          isMine={isMine}
        />
      )}

      {/* مؤشر للمرسل أنها مقفلة/مؤقتة */}
      {isMine && (msg.isLocked || msg.expireMode === 'once' || (msg.viewDuration ?? 0) > 0) && (
        <View style={styles.senderHint}>
          {msg.isLocked && <Lock size={10} color="rgba(255,255,255,0.7)" />}
          {msg.expireMode === 'once' && <Zap size={10} color="rgba(255,255,255,0.7)" />}
          {msg.expireMode === 'timed' && (msg.viewDuration ?? 0) > 0 && (
            <Timer size={10} color="rgba(255,255,255,0.7)" />
          )}
          <Text variant="caption" color="rgba(255,255,255,0.7)" style={{ fontSize: 9 }}>
            {msg.isLocked ? `مقفلة ${msg.unlockPrice}ك` : msg.expireMode === 'once' ? 'مرة واحدة' : `${msg.viewDuration}ث`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  expiredBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    minWidth: 160,
    justifyContent: 'center',
  },
  lockedBox: {
    width: 180,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  lockedIcon: {
    position: 'relative',
  },
  lockBadge: {
    position: 'absolute',
    bottom: -4,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: lu.colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  tapToView: {
    width: 180,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  videoBox: {
    position: 'relative',
  },
  videoPlaceholder: {
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  countdownBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  senderHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
});
