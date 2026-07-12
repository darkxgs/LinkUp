/**
 * LinkUp App — Voice Call Screen
 */

import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCall } from '@/hooks/useCall';
import { useLightStatusBarOnFocus } from '@/hooks/useLightStatusBarOnFocus';
import { auth } from '@/services/firebase';
import { getUser, type UserDoc } from '@/services/firebase/users';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Video,
  Gift,
  ChevronDown,
} from 'lucide-react-native';

import { Text, CoinIcon } from '@/components/ui';
import { colors, radius, spacing, shadows } from '@/theme';
import { lu } from '@/theme/lu-brand';
import { useCallSessionStore } from '@/stores/callSessionStore';
import { CallRtcEnvironmentNotice } from '@/components/call/CallRtcEnvironmentNotice';
import { isRtcEnvironmentError } from '@/utils/rtcEnvironmentMessage';
import { useConfig } from '@/contexts/ConfigContext';
import { exitCallScreen, exitCallScreenToBrowse } from '@/utils/callScreenNavigation';

export default function VoiceCallScreen() {
  // شاشة داكنة — أيقونات فاتحة أثناء التركيز فقط
  useLightStatusBarOnFocus();
  const { t } = useTranslation();
  const { id, channel, session, source } = useLocalSearchParams<{
    id: string;
    channel?: string;
    session?: string;
    source?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { callPricing } = useConfig();

  // اسم القناة: من المطابقة (channel) أو من معرّف المكالمة المباشرة
  const channelName = (typeof channel === 'string' ? decodeURIComponent(channel) : '') || `call_${id}`;
  const billingSessionId = typeof session === 'string' ? session : undefined;

  const {
    callState,
    remoteJoined,
    isMuted,
    isRemoteMuted,
    isSpeakerOn,
    error,
    leave,
    toggleMute,
    toggleSpeaker,
  } = useCall({
    channelName,
    isVideo: false,
    peerUid: id,
    billingSessionId,
    callSource: source === 'match' ? 'match' : 'chat',
    onInsufficientBalance: () => {
      Alert.alert(t('match.insufficientBalance'), 'انتهى رصيدك — تم إنهاء المكالمة', [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    },
  });

  const [duration, setDuration] = useState(0);
  const [peer, setPeer] = useState<UserDoc | null>(null);

  useEffect(() => {
    const myUid = auth.currentUser?.uid;
    if (myUid && id && myUid === id) {
      Alert.alert(t('common.error'), t('profile.cannotCallSelf'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    }
  }, [id, router, t]);

  // جلب بيانات الطرف الآخر
  useEffect(() => {
    if (id && id !== auth.currentUser?.uid) getUser(id).then(setPeer).catch(() => {});
  }, [id]);

  // عداد المدة يبدأ فقط بعد رد الطرف الآخر (انضمامه للقناة)
  useEffect(() => {
    if (callState !== 'connected' || !remoteJoined) {
      setDuration(0);
      return;
    }
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [callState, remoteJoined]);

  const handleToggleMute = () => {
    void toggleMute().then((ok) => {
      if (!ok) Alert.alert(t('common.error'), t('call.muteFailed'));
    });
  };

  const handleToggleSpeaker = () => {
    void toggleSpeaker().then((ok) => {
      if (!ok) Alert.alert(t('common.error'), t('call.speakerFailed'));
    });
  };

  const formatDuration = (sec: number): string => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleEndCall = async () => {
    await leave();
    router.back();
  };

  const handleMinimize = () => {
    if (!id) {
      exitCallScreen(router);
      return;
    }

    const canPin = callState === 'connecting' || callState === 'connected';
    if (canPin) {
      useCallSessionStore.getState().minimize({
        peerUid: id,
        peerName: ((peer as any)?.profile?.displayName || peer?.displayName) ?? t('rooms.userFallback'),
        peerAvatar: peer?.avatar,
        channelName,
        isVideo: false,
        billingSessionId,
        source: source === 'match' ? 'match' : 'chat',
      });
      exitCallScreenToBrowse(router);
      return;
    }

    useCallSessionStore.getState().clear();
    exitCallScreen(router);
  };

  // نص الحالة
  const isEnvError = callState === 'error' && isRtcEnvironmentError(error);

  const statusText =
    callState === 'connecting' ? t('call.connecting') :
    callState === 'connected' && remoteJoined ? t('call.voiceCallActive') :
    callState === 'connected' ? t('call.waitingPeer') :
    callState === 'error'
      ? isEnvError
        ? t('call.unavailableOnDevice')
        : (error ?? t('call.connectFailed'))
      :
    callState === 'ended' ? t('call.ended') : t('call.preparing');
  const pricingRates = source === 'match' ? callPricing.match : callPricing.chat;
  const voicePricePerMinute = pricingRates.voicePerMinute;

  return (
    <View style={styles.container}>
      {/* خلفية غامرة بهوية LinkUp */}
      <LinearGradient
        colors={['#3A1316', '#26090C', '#1A0A0C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(225, 20, 20,0.20)', 'rgba(236, 62, 62, 0.10)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.brandGlow}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.base }]}>
        <Pressable
          onPress={handleMinimize}
          style={styles.headerButton}
          accessibilityLabel={t('call.minimize')}
        >
          <ChevronDown size={24} color={colors.white} strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* User info */}
      <View style={styles.userSection}>
        <LinearGradient
          colors={lu.gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarRing}
        >
          <View style={styles.avatarRingInner}>
            <Image
              source={{ uri: peer?.avatar || 'https://i.pravatar.cc/300?img=47' }}
              style={styles.avatar}
              contentFit="cover"
            />
          </View>
          {isRemoteMuted && (
            <View style={styles.remoteMutedBadge}>
              <MicOff size={16} color={colors.white} strokeWidth={2.5} />
            </View>
          )}
        </LinearGradient>

        <View style={styles.nameRow}>
          <Text variant="h1" weight="bold" color={colors.white} style={{ marginTop: spacing.xl }}>
            {((peer as any)?.profile?.displayName || peer?.displayName) ?? t('rooms.userFallback')}
          </Text>
          {isRemoteMuted && (
            <MicOff size={18} color="rgba(255,100,100,0.9)" strokeWidth={2} style={{ marginTop: spacing.xl, marginStart: 6 }} />
          )}
        </View>

        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, isEnvError && styles.statusDotMuted]} />
          <Text variant="body" color="rgba(255,255,255,0.9)">
            {statusText}
          </Text>
        </View>
        <View style={styles.priceBadge}>
          <Text variant="caption" color="rgba(255,255,255,0.9)" weight="semibold">
            {voicePricePerMinute.toLocaleString('en-US')}
          </Text>
          <CoinIcon size={14} />
          <Text variant="caption" color="rgba(255,255,255,0.9)">
            {t('call.pricePerMinuteSuffix')}
          </Text>
        </View>

        {isEnvError ? <CallRtcEnvironmentNotice error={error} /> : null}

        <Text variant="display2" weight="bold" color={colors.white} style={{ marginTop: spacing.lg }}>
          {callState === 'connected' && remoteJoined ? formatDuration(duration) : '--:--'}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={[styles.actionsContainer, { paddingBottom: insets.bottom + spacing.lg }]}>
        {/* Secondary actions */}
        <View style={styles.secondaryActions}>
          <ActionButton
            icon={isSpeakerOn ? Volume2 : VolumeX}
            label={isSpeakerOn ? t('call.speaker') : t('call.earpiece')}
            onPress={handleToggleSpeaker}
            active={isSpeakerOn}
          />
          <ActionButton
            icon={Video}
            label={t('call.video')}
            onPress={() => {
              const sess = typeof session === 'string' && session ? `&session=${encodeURIComponent(session)}` : '';
              const src = source === 'match' ? '&source=match' : '';
              // ثبّت الجلسة حتى لا تُقطع جلسة الصوت عند الانتقال لشاشة الفيديو
              useCallSessionStore.setState({
                sessionPinned: true,
                channelName,
                peerUid: id,
                isVideo: true,
                billingSessionId,
                isMinimized: false,
              });
              router.replace(
                `/call/video/${id}?channel=${encodeURIComponent(channelName)}${src}${sess}` as any,
              );
            }}
          />
          <ActionButton
            icon={Gift}
            label={t('call.gift')}
            onPress={() => router.push(`/gifts/${id}` as any)}
            gradient
          />
        </View>

        {/* Primary actions */}
        <View style={styles.primaryActions}>
          <Pressable
            onPress={handleToggleMute}
            style={[styles.muteButton, isMuted && styles.muteButtonActive]}
          >
            {isMuted ? (
              <MicOff size={28} color={colors.white} />
            ) : (
              <Mic size={28} color={colors.white} />
            )}
          </Pressable>

          <Pressable onPress={handleEndCall} style={styles.endCallButton}>
            <LinearGradient
              colors={['#FF5C5C', '#FF2E3E']}
              style={StyleSheet.absoluteFill}
            />
            <PhoneOff size={32} color={colors.white} />
          </Pressable>

          <View style={styles.muteButton} />
        </View>
      </View>
    </View>
  );
}

const ActionButton: React.FC<{
  icon: any;
  label: string;
  onPress?: () => void;
  active?: boolean;
  gradient?: boolean;
}> = ({ icon: Icon, label, onPress, active, gradient }) => (
  <Pressable style={styles.actionButton} onPress={onPress}>
    {gradient ? (
      <View style={styles.actionIconWrapper}>
        <LinearGradient
          colors={lu.gradients.pink}
          style={StyleSheet.absoluteFill}
        />
        <Icon size={22} color={colors.white} />
      </View>
    ) : (
      <View style={[styles.actionIconWrapper, active && styles.actionIconActive]}>
        <Icon size={22} color={colors.white} />
      </View>
    )}
    <Text variant="caption" color={colors.white}>
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0A0C' },
  brandGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.base,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  avatarRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    ...lu.shadows.grad,
  },
  avatarRingInner: {
    width: 184,
    height: 184,
    borderRadius: 92,
    borderWidth: 4,
    borderColor: '#1A0A0C',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginTop: spacing.base,
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: lu.colors.mint,
  },
  statusDotMuted: {
    backgroundColor: 'rgba(255,180,100,0.95)',
  },
  actionsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actionIconActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  primaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  muteButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteButtonActive: {
    backgroundColor: colors.white,
  },
  endCallButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  remoteMutedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(239,68,68,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
});
