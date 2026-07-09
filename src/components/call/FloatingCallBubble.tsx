/**
 * فقاعة مكالمة عائمة — تصفّح التطبيق دون إنهاء المكالمة
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  Dimensions,
  Alert,
  I18nManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { X, Phone, Video, MicOff } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { useCallSessionStore } from '@/stores/callSessionStore';
import { callSession } from '@/services/callSession';
import { lu } from '@/theme/lu-brand';

const BUBBLE_W = 188;
const BUBBLE_H = 64;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const IS_RTL = I18nManager.isRTL;

const INITIAL = {
  x: IS_RTL ? 14 : SCREEN_W - BUBBLE_W - 14,
  y: SCREEN_H * 0.38,
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function FloatingCallBubble() {
  const { t } = useTranslation();
  const router = useRouter();
  const isMinimized = useCallSessionStore((s) => s.isMinimized);
  const peerUid = useCallSessionStore((s) => s.peerUid);
  const peerName = useCallSessionStore((s) => s.peerName);
  const peerAvatar = useCallSessionStore((s) => s.peerAvatar);
  const channelName = useCallSessionStore((s) => s.channelName);
  const isVideo = useCallSessionStore((s) => s.isVideo);
  const billingSessionId = useCallSessionStore((s) => s.billingSessionId);
  const source = useCallSessionStore((s) => s.source);
  const clear = useCallSessionStore((s) => s.clear);

  const [duration, setDuration] = React.useState(0);
  const [isRemoteMuted, setIsRemoteMuted] = React.useState(false);

  const pulse = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY(INITIAL)).current;

  useEffect(() => {
    const sync = () => {
      const snap = callSession.getSnapshot();
      setDuration(snap.duration);
      setIsRemoteMuted(snap.isRemoteMuted);
      if (snap.callState === 'ended' || snap.callState === 'error') {
        clear();
      }
    };
    sync();
    return callSession.subscribe(sync);
  }, [clear]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 1200, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        pan.extractOffset();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    }),
  ).current;

  if (!isMinimized || !peerUid || !channelName) return null;

  const openCall = () => {
    const sessionQs = billingSessionId ? `&session=${billingSessionId}` : '';
    const sourceQs = source === 'match' ? '&source=match' : '';
    const ch = encodeURIComponent(channelName);
    const path = isVideo
      ? `/call/video/${peerUid}?channel=${ch}${sourceQs}${sessionQs}`
      : `/call/${peerUid}?channel=${ch}${sourceQs}${sessionQs}`;
    router.push(path as any);
  };

  const endCall = () => {
    Alert.alert(t('call.endCall'), t('call.endCallConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('call.endCall'),
        style: 'destructive',
        onPress: async () => {
          clear();
          await callSession.leave();
        },
      },
    ]);
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none" collapsable={false}>
      <Animated.View
        style={[
          styles.bubbleHost,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: pulse },
            ],
          },
        ]}
        {...panResponder.panHandlers}
        pointerEvents="auto"
      >
        <Pressable
          onPress={openCall}
          onLongPress={endCall}
          accessibilityLabel={t('call.floatingTapReturn')}
          style={styles.bubble}
        >
          <LinearGradient colors={['#25D366', '#128C7E']} style={styles.gradient}>
            <View style={styles.avatarWrap}>
              {peerAvatar ? (
                <Image source={{ uri: peerAvatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Phone size={18} color="#fff" strokeWidth={2.2} />
                </View>
              )}
              {isRemoteMuted && (
                <View style={styles.mutedBadge}>
                  <MicOff size={9} color="#fff" strokeWidth={2.5} />
                </View>
              )}
            </View>
            <View style={styles.info}>
              <Text variant="caption" weight="bold" color="#fff" numberOfLines={1} style={styles.nameText}>
                {peerName || t('rooms.userFallback')}
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.9)" style={styles.durationText}>
                {duration > 0 ? formatDuration(duration) : t('call.connecting')}
              </Text>
            </View>
            <View style={styles.typePill}>
              {isVideo ? (
                <Video size={11} color="#fff" strokeWidth={2.5} />
              ) : (
                <Phone size={11} color="#fff" strokeWidth={2.5} />
              )}
            </View>
          </LinearGradient>
          <Pressable onPress={endCall} style={styles.closeBtn} hitSlop={10}>
            <X size={11} color="#fff" strokeWidth={3} />
          </Pressable>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99998,
    elevation: 99998,
  },
  bubbleHost: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BUBBLE_W,
    height: BUBBLE_H,
  },
  bubble: {
    width: BUBBLE_W,
    height: BUBBLE_H,
  },
  gradient: {
    flex: 1,
    flexDirection: IS_RTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 16,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  avatarFallback: {
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedBadge: {
    position: 'absolute',
    bottom: -2,
    end: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  info: {
    flex: 1,
    minWidth: 0,
    alignItems: IS_RTL ? 'flex-end' : 'flex-start',
  },
  nameText: {
    maxWidth: 86,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '700',
  },
  typePill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: -4,
    end: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
