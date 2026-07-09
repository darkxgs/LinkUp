/**
 * فقاعة الروم العائمة — داخل التطبيق فقط (بدون Modal)
 * لا تحجب التنقل — pointerEvents="box-none" يمرر اللمسات للعناصر تحتها
 * تظهر بعد «احتفظ في الروم» — الضغط على الدائرة يعيدك للروم
 * إن كان هناك موسيقى تشتغل بالروم يظهر توهج موسيقي حول الفقاعة
 */
import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  useWindowDimensions,
  Alert,
  Platform,
  I18nManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { X, Radio } from 'lucide-react-native';

import { useRoomSessionStore } from '@/stores/roomSessionStore';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';
import { completeRoomLeave } from '@/services/roomLeave';
import { auth } from '@/services/firebase';
import { lu } from '@/theme/lu-brand';

const BUBBLE_SIZE = 64;
const GLOW_SIZE = BUBBLE_SIZE + 22;
const DRAG_THRESHOLD = 6;

export function FloatingRoomBubble() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isMinimized = useRoomSessionStore((s) => s.isMinimized);
  const audioPinned = useRoomSessionStore((s) => s.audioPinned);
  const roomId = useRoomSessionStore((s) => s.roomId);
  const roomBanner = useRoomSessionStore((s) => s.roomBanner);

  const musicActiveRoomId = useRoomMusicUiStore((s) => s.activeRoomId);
  const musicDismissed = useRoomMusicUiStore((s) => s.localDismissed);
  const hasMusicPlaying = !!roomId && musicActiveRoomId === roomId && !musicDismissed;

  const pulse = useRef(new Animated.Value(1)).current;
  const musicGlow = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const positionedRef = useRef(false);
  const draggingRef = useRef(false);

  const showBubble = isMinimized && audioPinned && !!roomId;

  useEffect(() => {
    if (showBubble && winW > 0 && !positionedRef.current) {
      pan.setValue({
        x: winW - BUBBLE_SIZE - 16,
        y: Math.max(insets.top + 12, winH * 0.55),
      });
      positionedRef.current = true;
    } else if (!showBubble) {
      positionedRef.current = false;
    }
  }, [showBubble, winW, winH, insets.top, pan]);

  useEffect(() => {
    if (!showBubble) return;
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [showBubble, pulse]);

  useEffect(() => {
    if (!hasMusicPlaying) {
      Animated.timing(musicGlow, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      return;
    }
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(musicGlow, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(musicGlow, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ]),
    );
    glowLoop.start();
    return () => glowLoop.stop();
  }, [hasMusicPlaying, musicGlow]);

  const openRoom = useCallback(() => {
    if (!roomId || draggingRef.current) return;
    // expand() تُستدعى من شاشة الروم عند resumingPinnedSession — لا نُلغي التثبيت هنا
    router.navigate(`/room/${roomId}` as any);
  }, [roomId, router]);

  const exitRoom = useCallback(() => {
    if (!roomId) return;
    Alert.alert(t('room.leaveRoom'), t('room.leaveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('room.leaveRoom'),
        style: 'destructive',
        onPress: async () => {
          const uid = auth.currentUser?.uid;
          await completeRoomLeave(roomId, uid);
        },
      },
    ]);
  }, [roomId, t]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > DRAG_THRESHOLD || Math.abs(g.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => {
        draggingRef.current = false;
        pan.extractOffset();
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > DRAG_THRESHOLD || Math.abs(g.dy) > DRAG_THRESHOLD) {
          draggingRef.current = true;
        }
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(
          _,
          g,
        );
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        requestAnimationFrame(() => {
          draggingRef.current = false;
        });
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
        draggingRef.current = false;
      },
    }),
  ).current;

  if (!showBubble) return null;

  const glowScale = musicGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });

  return (
    <View
      style={styles.overlayRoot}
      pointerEvents="box-none"
      collapsable={false}
      renderToHardwareTextureAndroid
      needsOffscreenAlphaCompositing
    >
      <Animated.View
        style={[
          styles.bubbleHost,
          // نُثبّت المرساة عند الحافة اليسرى فيزيائياً في اللغتين: في RTL يُبدّل النظام
          // left↔right فنستخدم right:0 (يُقلَب إلى left:0)، فتبقى رياضة translateX صحيحة
          // ولا تخرج الفقاعة خارج الشاشة في العربية.
          I18nManager.isRTL ? { right: 0 } : { left: 0 },
          { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
        ]}
        {...panResponder.panHandlers}
        pointerEvents="box-none"
        collapsable={false}
        renderToHardwareTextureAndroid
      >
        <Pressable
          onPress={openRoom}
          onLongPress={exitRoom}
          accessibilityLabel={t('room.floatingTapReturn')}
          style={styles.bubblePressable}
        >
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            {hasMusicPlaying ? (
              <Animated.View
                style={[
                  styles.musicGlowRing,
                  { opacity: musicGlow, transform: [{ scale: glowScale }] },
                ]}
              />
            ) : null}
            <LinearGradient colors={lu.gradients.brand} style={styles.ring}>
              <View style={styles.inner}>
                {roomBanner ? (
                  <Image
                    source={{ uri: roomBanner }}
                    style={styles.avatar}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Radio size={20} color={lu.colors.pink} strokeWidth={2.2} />
                  </View>
                )}
              </View>
            </LinearGradient>
            <View style={styles.liveDot} />
          </Animated.View>
        </Pressable>

        <Pressable
          onPress={exitRoom}
          style={styles.closeBtn}
          hitSlop={8}
          accessibilityLabel={t('room.leaveRoom')}
        >
          <LinearGradient colors={['#FF5C7A', '#FF2E62']} style={styles.closeBtnGrad}>
            <X size={12} color="#fff" strokeWidth={3} />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    ...(Platform.OS === 'android' ? { elevation: 30 } : {}),
  },
  bubbleHost: {
    position: 'absolute',
    top: 0,
    width: BUBBLE_SIZE + 12,
    height: BUBBLE_SIZE + 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    ...(Platform.OS === 'android' ? { elevation: 30 } : {}),
  },
  bubblePressable: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 16,
    ...(Platform.OS === 'android' ? { elevation: 16 } : null),
  },
  musicGlowRing: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: 'rgba(225, 20, 20, 0.35)',
    top: (BUBBLE_SIZE - GLOW_SIZE) / 2,
    left: (BUBBLE_SIZE - GLOW_SIZE) / 2,
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 4,
  },
  ring: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 12,
  },
  inner: {
    width: BUBBLE_SIZE - 6,
    height: BUBBLE_SIZE - 6,
    borderRadius: (BUBBLE_SIZE - 6) / 2,
    overflow: 'hidden',
    backgroundColor: '#1A0A0C',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    position: 'absolute',
    bottom: 2,
    end: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#fff',
  },
  closeBtn: {
    position: 'absolute',
    top: -2,
    end: -2,
    zIndex: 30,
    borderRadius: 11,
    ...lu.shadows.pop,
    ...(Platform.OS === 'android' ? { elevation: 20 } : null),
  },
  closeBtnGrad: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
