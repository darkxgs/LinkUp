/**
 * LinkUp App — Video Call Screen
 * مكالمة فيديو كاملة عبر Agora (callSession + CallVideoView)
 */

import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Dimensions, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCall } from '@/hooks/useCall';
import { useLightStatusBarOnFocus } from '@/hooks/useLightStatusBarOnFocus';
import { CallVideoView } from '@/components/call/CallVideoView';
import { auth } from '@/services/firebase';
import { getUser, type UserDoc } from '@/services/firebase/users';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Mic,
  MicOff,
  PhoneOff,
  Video as VideoIcon,
  VideoOff,
  Camera,
  CameraOff,
  RefreshCw,
  Gift,
  MessageCircle,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
} from 'lucide-react-native';

import { Text, RealCountryFlag, CoinIcon } from '@/components/ui';
import { colors, radius, spacing, shadows } from '@/theme';
import { useCallSessionStore } from '@/stores/callSessionStore';
import { CallRtcEnvironmentNotice } from '@/components/call/CallRtcEnvironmentNotice';
import { isRtcEnvironmentError } from '@/utils/rtcEnvironmentMessage';
import { useConfig } from '@/contexts/ConfigContext';
import { exitCallScreen, exitCallScreenToBrowse } from '@/utils/callScreenNavigation';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function VideoCallScreen() {
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

  const channelName = (typeof channel === 'string' ? decodeURIComponent(channel) : '') || `call_${id}`;
  const billingSessionId = typeof session === 'string' ? session : undefined;
  const {
    callState,
    remoteJoined,
    isMuted,
    isRemoteMuted,
    isVideoEnabled,
    localVideoTrack,
    remoteVideoTrack,
    error,
    leave,
    toggleMute,
    toggleVideo,
    switchCamera,
    isSpeakerOn,
    toggleSpeaker,
  } = useCall({
    channelName,
    isVideo: true,
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
  const [showControls, setShowControls] = useState(true);
  const [selfViewExpanded, setSelfViewExpanded] = useState(false);
  const [peer, setPeer] = useState<UserDoc | null>(null);

  const isCameraOn = isVideoEnabled;
  const pricingRates = source === 'match' ? callPricing.match : callPricing.chat;
  const videoPricePerMinute = pricingRates.videoAfterMinute;

  useEffect(() => {
    const myUid = auth.currentUser?.uid;
    if (myUid && id && myUid === id) {
      Alert.alert(t('common.error'), t('profile.cannotCallSelf'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    }
  }, [id, router, t]);

  useEffect(() => {
    if (id && id !== auth.currentUser?.uid) getUser(id).then(setPeer).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (callState !== 'connected' || !remoteJoined) {
      setDuration(0);
      return;
    }
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [callState, remoteJoined]);

  // Auto-hide controls after 4s
  useEffect(() => {
    if (showControls) {
      const hideTimer = setTimeout(() => setShowControls(false), 4000);
      return () => clearTimeout(hideTimer);
    }
    return undefined;
  }, [showControls]);

  const formatDuration = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

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

  const handleEnd = async () => {
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
        isVideo: true,
        billingSessionId,
        source: source === 'match' ? 'match' : 'chat',
      });
      exitCallScreenToBrowse(router);
      return;
    }

    useCallSessionStore.getState().clear();
    exitCallScreen(router);
  };

  const isEnvError = callState === 'error' && isRtcEnvironmentError(error);

  return (
    <Pressable style={styles.container} onPress={() => setShowControls(!showControls)}>
      {/* Remote video (full screen) */}
      <View style={styles.remoteVideo}>
        {remoteVideoTrack ? (
          <CallVideoView track={remoteVideoTrack} objectFit="cover" />
        ) : (
          <Image
            source={{ uri: peer?.avatar || 'https://picsum.photos/seed/remote-video/600/1200' }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={20}
          />
        )}
        {/* Dark overlay for better UI visibility */}
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.5)']}
          locations={[0, 0.3, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* حالة الاتصال إن لم يصل الطرف الآخر */}
        {callState !== 'connected' || !remoteJoined ? (
          <View style={styles.waitingOverlay}>
            {isEnvError ? (
              <CallRtcEnvironmentNotice error={error} />
            ) : (
              <Text variant="body" color="rgba(255,255,255,0.9)">
                {callState === 'connecting'
                  ? t('call.connecting')
                  : callState === 'error'
                    ? (error ?? t('call.connectFailed'))
                    : t('call.waitingPartnerJoin')}
              </Text>
            )}
          </View>
        ) : null}
      </View>

      {/* Self view (picture-in-picture) */}
      <View
        style={[
          styles.selfView,
          selfViewExpanded ? styles.selfViewExpanded : styles.selfViewSmall,
          { top: insets.top + spacing.base },
        ]}
      >
        {isCameraOn && localVideoTrack ? (
          <CallVideoView track={localVideoTrack} objectFit="cover" mirror />
        ) : (
          <View style={styles.selfViewOff}>
            <CameraOff size={28} color={colors.white} strokeWidth={2} />
          </View>
        )}
        <Pressable
          style={styles.expandButton}
          onPress={(e) => {
            e.stopPropagation();
            setSelfViewExpanded(!selfViewExpanded);
          }}
        >
          {selfViewExpanded ? (
            <Minimize2 size={14} color={colors.white} strokeWidth={2.5} />
          ) : (
            <Maximize2 size={14} color={colors.white} strokeWidth={2.5} />
          )}
        </Pressable>
      </View>

      {/* Top info bar */}
      {showControls && (
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.base }]}>
          <View style={styles.userInfoBar}>
            <View style={styles.userInfoLeft}>
              <Image
                source={{ uri: peer?.avatar || 'https://i.pravatar.cc/150?img=47' }}
                style={styles.smallAvatar}
                contentFit="cover"
              />
              <View>
                <View style={styles.nameRow}>
                  <Text variant="body" weight="semibold" color={colors.white}>
                    {((peer as any)?.profile?.displayName || peer?.displayName) ?? t('rooms.userFallback')}
                  </Text>
                  <RealCountryFlag countryCode={peer?.country ?? 'PS'} size={16} />
                  {isRemoteMuted && (
                    <View style={styles.remoteMutedPill}>
                      <MicOff size={11} color={colors.white} strokeWidth={2.5} />
                    </View>
                  )}
                </View>
                <Text variant="caption" color="rgba(255,255,255,0.85)">
                  {callState === 'connected' && remoteJoined
                    ? formatDuration(duration)
                    : callState === 'connected'
                      ? t('call.waitingPeer')
                      : t('call.connecting')}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.qualityBadge}>
                <View style={styles.qualityDot} />
                <Text variant="caption" color={colors.white} weight="medium" style={{ fontSize: 10 }}>
                  HD
                </Text>
              </View>

              <Pressable
                onPress={handleMinimize}
                style={styles.minimizeBtn}
                accessibilityLabel={t('call.minimize')}
              >
                <Minimize2 size={20} color={colors.white} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>

          {/* Coins cost display */}
          <View style={styles.costBanner}>
            <Text variant="caption" color={colors.white} weight="semibold">
              {videoPricePerMinute.toLocaleString('en-US')}
            </Text>
            <CoinIcon size={14} />
            <Text variant="caption" color={colors.white}>
              {t('call.pricePerMinuteSuffix')}
            </Text>
          </View>
        </View>
      )}

      {/* Bottom controls */}
      {showControls && (
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + spacing.lg }]}>
          {/* Secondary actions */}
          <View style={styles.secondaryActions}>
            <ControlButton
              icon={isSpeakerOn ? Volume2 : VolumeX}
              onPress={handleToggleSpeaker}
              active={isSpeakerOn}
              label={isSpeakerOn ? t('call.speaker') : t('call.earpiece')}
            />
            <ControlButton icon={RefreshCw} onPress={switchCamera} />
            <ControlButton icon={Gift} gradient onPress={() => router.push(`/gifts/${id}` as any)} />
            <ControlButton icon={MessageCircle} onPress={() => router.push(`/chat/${id}` as any)} />
          </View>

          {/* Primary actions */}
          <View style={styles.primaryActions}>
            <Pressable
              onPress={handleToggleMute}
              style={[styles.actionBtn, isMuted && styles.actionBtnMuted]}
            >
              {isMuted ? (
                <MicOff size={26} color={colors.white} strokeWidth={2} />
              ) : (
                <Mic size={26} color={colors.white} strokeWidth={2} />
              )}
            </Pressable>

            <Pressable
              onPress={toggleVideo}
              style={[styles.actionBtn, !isCameraOn && styles.actionBtnMuted]}
            >
              {isCameraOn ? (
                <VideoIcon size={26} color={colors.white} strokeWidth={2} />
              ) : (
                <VideoOff size={26} color={colors.white} strokeWidth={2} />
              )}
            </Pressable>

            <Pressable onPress={handleEnd} style={styles.endCallBtn}>
              <LinearGradient
                colors={['#FF6B6B', '#EF4444']}
                style={StyleSheet.absoluteFill}
              />
              <PhoneOff size={32} color={colors.white} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const ControlButton: React.FC<{
  icon: any;
  onPress?: () => void;
  gradient?: boolean;
  active?: boolean;
  label?: string;
}> = ({ icon: Icon, onPress, gradient, active, label }) => (
  <Pressable style={styles.smallControlBtn} onPress={onPress} accessibilityLabel={label}>
    {gradient ? (
      <LinearGradient
        colors={['#FCD34D', '#F59E0B']}
        style={StyleSheet.absoluteFill}
      />
    ) : (
      <View style={[StyleSheet.absoluteFill, active ? styles.controlBgActive : styles.controlBg]} />
    )}
    <Icon size={20} color={colors.white} strokeWidth={2} />
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1A0A0C',
  },
  waitingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Self view (PiP)
  selfView: {
    position: 'absolute',
    right: spacing.base,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: colors.white,
    ...shadows.lg,
  },
  selfViewSmall: {
    width: 100,
    height: 140,
  },
  selfViewExpanded: {
    width: 160,
    height: 220,
  },
  selfViewOff: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A1A1C',
  },
  expandButton: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  userInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  userInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qualityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
    borderRadius: radius.full,
  },
  qualityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  minimizeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: spacing.sm,
  },
  costBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.full,
  },

  // Bottom controls
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.base,
    gap: spacing.lg,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.base,
  },
  smallControlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  controlBg: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  controlBgActive: {
    backgroundColor: 'rgba(225, 20, 20, 0.85)',
  },

  primaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnMuted: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  endCallBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.lg,
  },
  remoteMutedPill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(239,68,68,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
