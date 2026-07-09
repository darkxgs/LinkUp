/**
 * GiftAnimation — overlay غير حاجب (non-blocking)
 * يسمح للمستخدمين بالتفاعل مع الروم أثناء عرض الهدية
 */

import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Heart, Star, Crown } from 'lucide-react-native';
import { Text } from './Text';
import { GiftVisual } from './GiftVisual';
import {
  inferGiftMediaType,
  giftHasSound,
  giftHasGifAnimation,
  giftHasVideo,
  resolveGiftDisplayDurationMs,
  shouldRoomLiteGiftPlayback,
  GIFT_VIDEO_SAFETY_MAX_MS,
} from './giftUtils';
import { configureSoundEffectsAudio, playGiftSound } from '@/utils/playRoomSound';
import { GiftVideoPlayer } from './GiftVideoPlayer';
import { resolveGiftVideoUri } from '@/utils/videoCacheManager';
import { getGiftVideoPlaybackCandidates, giftVideoUnsupportedReason } from '@/utils/giftVideoPlayback';
import { radius, spacing } from '@/theme';
import { TAB_DESIGN } from '@/components/navigation/TabBarNavigationSvg';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const GIFT_SIZE_FULL = Math.min(SCREEN_W * 0.82, SCREEN_H * 0.48);
const GIFT_SIZE_COMPACT = Math.min(SCREEN_W * 0.5, 220);
const CONFETTI_COUNT_FULL = 14;
const CONFETTI_COUNT_COMPACT = 0;

const VIDEO_COMPACT_W = Math.min(SCREEN_W * 0.65, 280);
const VIDEO_COMPACT_H = VIDEO_COMPACT_W * 0.65;

interface GiftAnimationProps {
  iconName: string;
  iconColor: string;
  imageUrl?: string;
  animationUrl?: string;
  giftName: string;
  senderName: string;
  recipientName?: string;
  recipientUid?: string;
  recipientAvatar?: string;
  isGroupGift?: boolean;
  recipientCount?: number;
  quantity?: number;
  price?: number;
  soundUrl?: string;
  videoUrl?: string;
  videoUrlMp4?: string;
  showGiftName?: boolean;
  giftOnly?: boolean;
  onComplete: () => void;
}

export const GiftAnimation: React.FC<GiftAnimationProps> = ({
  iconName,
  iconColor,
  imageUrl,
  animationUrl,
  giftName,
  senderName,
  recipientName,
  recipientUid,
  recipientAvatar,
  isGroupGift = false,
  recipientCount,
  quantity = 1,
  price = 0,
  soundUrl,
  videoUrl,
  videoUrlMp4,
  showGiftName = true,
  giftOnly = false,
  onComplete,
}) => {
  const GIFT_SIZE = giftOnly ? GIFT_SIZE_COMPACT : GIFT_SIZE_FULL;
  const CONFETTI_COUNT = giftOnly ? CONFETTI_COUNT_COMPACT : CONFETTI_COUNT_FULL;

  const [videoPlayUri, setVideoPlayUri] = useState<string | null>(null);
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null);
  const [playbackCandidateIdx, setPlaybackCandidateIdx] = useState(0);
  const popScale = useRef(new Animated.Value(0.06)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const nameScale = useRef(new Animated.Value(0.5)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.3)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const videoFinishedRef = useRef(false);
  const qtyBump = useRef(new Animated.Value(1)).current;
  const prevQtyRef = useRef(quantity);

  const particles = useRef(
    CONFETTI_COUNT > 0
      ? Array.from({ length: CONFETTI_COUNT }, () => ({
          translateX: new Animated.Value(0),
          translateY: new Animated.Value(0),
          opacity: new Animated.Value(0),
          scale: new Animated.Value(0.4),
        }))
      : [],
  ).current;

  const onCompleteRef = useRef(onComplete);
  const soundStartedRef = useRef(false);

  onCompleteRef.current = onComplete;

  const giftLike = useMemo(
    () => ({
      iconName,
      iconColor,
      imageUrl,
      animationUrl,
      soundUrl,
      videoUrl,
      giftMediaType: inferGiftMediaType({ iconName, iconColor, imageUrl, animationUrl, soundUrl, videoUrl }),
    }),
    [iconName, iconColor, imageUrl, animationUrl, soundUrl, videoUrl],
  );

  const staticImage = imageUrl?.trim();
  const animUrl = animationUrl?.trim();
  const videoSrc = videoUrl?.trim();
  const playbackCandidates = useMemo(
    () => getGiftVideoPlaybackCandidates(videoSrc, videoUrlMp4),
    [videoSrc, videoUrlMp4],
  );
  const playbackSrc = playbackCandidates[playbackCandidateIdx] ?? '';
  const videoUnsupportedReason = useMemo(
    () => giftVideoUnsupportedReason(videoSrc, videoUrlMp4),
    [videoSrc, videoUrlMp4],
  );
  const canPlayVideo = playbackCandidates.length > 0;
  const hasVideo = giftHasVideo(giftLike);
  const hasGif = giftHasGifAnimation(giftLike);
  /** في الروم (giftOnly) لا نشغّل فيديو MP4 كامل — صورة+صوت فقط */
  const roomLitePlayback = giftOnly && shouldRoomLiteGiftPlayback(giftLike, price, quantity);
  const useVideoPlayback = hasVideo && !roomLitePlayback;
  const allowAnimatedGif = hasGif && !roomLitePlayback;
  const showNameOverlay = showGiftName && !useVideoPlayback && !giftOnly;
  const showSenderChip = !giftOnly;
  const showGifOverlay = Boolean(allowAnimatedGif && staticImage && animUrl !== staticImage);
  const showGifOnly = Boolean(allowAnimatedGif && (!staticImage || animUrl === staticImage));

  const displayMs = resolveGiftDisplayDurationMs(price, quantity);
  const cappedDisplayMs = giftOnly ? Math.min(displayMs, 4000) : displayMs;

  const videoSafetyMs = useMemo(() => {
    if (!useVideoPlayback) return GIFT_VIDEO_SAFETY_MAX_MS;
    const maxSafe = giftOnly ? 15_000 : GIFT_VIDEO_SAFETY_MAX_MS;
    if (videoDurationMs && videoDurationMs > 0) {
      return Math.min(maxSafe, Math.ceil(videoDurationMs) + 2000);
    }
    return maxSafe;
  }, [useVideoPlayback, videoDurationMs, giftOnly]);

  const finishVideoGift = useCallback(() => {
    if (videoFinishedRef.current) return;
    videoFinishedRef.current = true;
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(nameOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      onCompleteRef.current();
    });
  }, [backdropOpacity, contentOpacity, nameOpacity]);

  useEffect(() => {
    let aborted = false;
    soundStartedRef.current = false;
    videoFinishedRef.current = false;
    let exitTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (aborted) return;
      onCompleteRef.current();
    };

    const runExitAnimation = () => {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(contentOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(nameOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(popScale, {
          toValue: 1.28,
          duration: 300,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(finish);
    };

    if (useVideoPlayback) {
      void configureSoundEffectsAudio().catch(() => {});
    } else if (giftHasSound(giftLike) && !soundStartedRef.current) {
      soundStartedRef.current = true;
      void configureSoundEffectsAudio()
        .then(() => {
          if (aborted) return;
          return playGiftSound(soundUrl!);
        })
        .catch(() => {});
    }

    popScale.setValue(useVideoPlayback ? 1 : 0.06);
    nameScale.setValue(0.55);
    nameOpacity.setValue(useVideoPlayback ? 1 : 0);

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: giftOnly ? 0 : 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: useVideoPlayback ? 180 : 200,
        useNativeDriver: true,
      }),
      ...(useVideoPlayback || giftOnly
        ? []
        : [
            Animated.sequence([
              Animated.spring(popScale, {
                toValue: 1.12,
                tension: 155,
                friction: 6,
                useNativeDriver: true,
              }),
              Animated.spring(popScale, {
                toValue: 1,
                tension: 88,
                friction: 10,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(glowOpacity, { toValue: 0.6, duration: 150, useNativeDriver: true }),
              Animated.timing(glowScale, {
                toValue: 2.2,
                duration: 600,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(glowOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
            ]),
          ]),
      ...(giftOnly && !useVideoPlayback
        ? [
            Animated.spring(popScale, {
              toValue: 1,
              tension: 120,
              friction: 9,
              useNativeDriver: true,
            }),
            Animated.timing(nameOpacity, {
              toValue: 1,
              duration: 300,
              delay: 150,
              useNativeDriver: true,
            }),
          ]
        : []),
    ]).start();

    const nameTimer =
      useVideoPlayback || giftOnly || !showSenderChip
        ? null
        : setTimeout(() => {
          Animated.parallel([
            Animated.spring(nameScale, {
              toValue: 1,
              tension: 120,
              friction: 8,
              useNativeDriver: true,
            }),
            Animated.timing(nameOpacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }, 200);

    const fxTimer = useVideoPlayback || giftOnly || particles.length === 0
      ? null
      : setTimeout(() => {
          particles.forEach((p, i) => {
            const angle = (i / particles.length) * Math.PI * 2 + Math.random() * 0.4;
            const distance = SCREEN_W * 0.18 + Math.random() * SCREEN_W * 0.22;
            Animated.parallel([
              Animated.timing(p.translateX, {
                toValue: Math.cos(angle) * distance,
                duration: 800 + Math.random() * 300,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(p.translateY, {
                toValue: Math.sin(angle) * distance * 0.85,
                duration: 800 + Math.random() * 300,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(p.scale, {
                toValue: 0.9 + Math.random() * 0.5,
                duration: 450,
                useNativeDriver: true,
              }),
              Animated.sequence([
                Animated.timing(p.opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
                Animated.delay(300),
                Animated.timing(p.opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
              ]),
            ]).start();
          });
        }, 150);

    exitTimer = useVideoPlayback
      ? null
      : setTimeout(() => {
          runExitAnimation();
        }, cappedDisplayMs);

    return () => {
      aborted = true;
      if (nameTimer) clearTimeout(nameTimer);
      if (fxTimer) clearTimeout(fxTimer);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [soundUrl, videoUrl, videoUrlMp4, giftLike.giftMediaType, cappedDisplayMs, quantity, price, useVideoPlayback, giftOnly, roomLitePlayback]);

  const handleWebVideoDuration = useCallback((durationSec: number) => {
    if (durationSec > 0) {
      setVideoDurationMs((prev) => prev ?? Math.round(durationSec * 1000));
    }
  }, []);

  const handleVideoPlaybackError = useCallback(() => {
    if (playbackCandidateIdx + 1 < playbackCandidates.length) {
      setPlaybackCandidateIdx((idx) => idx + 1);
      return;
    }
    console.warn('[GiftVideo] all playback candidates failed', playbackCandidates);
    finishVideoGift();
  }, [playbackCandidateIdx, playbackCandidates, finishVideoGift]);

  useEffect(() => {
    setPlaybackCandidateIdx(0);
  }, [videoUrl, videoUrlMp4]);

  useEffect(() => {
    if (!playbackSrc || !useVideoPlayback || !canPlayVideo) {
      setVideoPlayUri(null);
      return;
    }
    let cancelled = false;
    setVideoPlayUri(null);
    void resolveGiftVideoUri(playbackSrc).then((uri) => {
      if (!cancelled && uri) setVideoPlayUri(uri);
    });
    return () => {
      cancelled = true;
    };
  }, [playbackSrc, useVideoPlayback, canPlayVideo]);

  useEffect(() => {
    if (!useVideoPlayback || canPlayVideo) return;
    const timer = setTimeout(() => finishVideoGift(), 3500);
    return () => clearTimeout(timer);
  }, [useVideoPlayback, canPlayVideo, finishVideoGift]);

  useEffect(() => {
    setVideoDurationMs(null);
    videoFinishedRef.current = false;
  }, [videoUrl, videoUrlMp4]);

  useEffect(() => {
    if (!useVideoPlayback) return;
    const safetyTimer = setTimeout(() => {
      finishVideoGift();
    }, videoSafetyMs);
    return () => clearTimeout(safetyTimer);
  }, [useVideoPlayback, playbackSrc, finishVideoGift, videoSafetyMs]);

  const ParticleIcons = [Star, Heart, Sparkles, Crown];

  const compactFloat = useRef(new Animated.Value(0)).current;
  const compactRotate = useRef(new Animated.Value(0)).current;
  const compactShimmer = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!giftOnly || useVideoPlayback) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(compactFloat, { toValue: -10, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(compactFloat, { toValue: 4, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(compactFloat, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(compactRotate, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(compactRotate, { toValue: -1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(compactRotate, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(compactShimmer, { toValue: 1.12, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(compactShimmer, { toValue: 0.95, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [giftOnly, useVideoPlayback, compactFloat, compactRotate, compactShimmer]);

  useEffect(() => {
    if (!giftOnly || quantity <= 1 || quantity === prevQtyRef.current) return;
    prevQtyRef.current = quantity;
    qtyBump.setValue(0.82);
    Animated.spring(qtyBump, {
      toValue: 1,
      friction: 4,
      tension: 240,
      useNativeDriver: true,
    }).start();
  }, [quantity, giftOnly, qtyBump]);

  const compactRotateInterp = compactRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-4deg', '0deg', '4deg'],
  });

  if (giftOnly) {
    return (
      <View style={styles.overlayRoot} pointerEvents="box-none">
        <Animated.View style={[styles.compactLayer, { opacity: contentOpacity }]} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.compactGiftWrap,
              {
                transform: [
                  {
                    scale: Animated.multiply(
                      popScale,
                      compactShimmer.interpolate({ inputRange: [0.95, 1.12], outputRange: [0.95, 1.12] }),
                    ),
                  },
                  { translateY: compactFloat },
                  { rotate: compactRotateInterp },
                ],
              },
            ]}
            pointerEvents="none"
            collapsable={false}
          >
            {showGifOnly ? (
              <GiftVisual gift={giftLike} size={GIFT_SIZE} mediaOrder="animation-first" animateGif={allowAnimatedGif} />
            ) : (
              <>
                <GiftVisual gift={giftLike} size={GIFT_SIZE} mediaOrder="image-first" />
                {showGifOverlay && (
                  <View style={styles.gifOverlay} pointerEvents="none">
                    <GiftVisual gift={giftLike} size={GIFT_SIZE} mediaOrder="animation-first" animateGif={allowAnimatedGif} />
                  </View>
                )}
              </>
            )}
            {quantity > 1 ? (
              <Animated.View
                style={[styles.compactQtyBadge, { transform: [{ scale: qtyBump }] }]}
                pointerEvents="none"
              >
                <Text variant="bodySmall" weight="bold" color="#fff">
                  ×{quantity}
                </Text>
              </Animated.View>
            ) : null}
          </Animated.View>

          <Animated.View style={[styles.compactSenderChip, { opacity: nameOpacity }]}>
            <Sparkles size={10} color="#FCD34D" strokeWidth={2.4} />
            <Text variant="caption" weight="bold" color="#fff" numberOfLines={1}>
              {senderName}
              {recipientName ? ` → ${recipientName}` : ''}
            </Text>
          </Animated.View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.overlayRoot} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: backdropOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [0, hasVideo ? 0.85 : 0.35],
            }),
          },
        ]}
        pointerEvents="none"
      />

      <Animated.View style={[styles.contentLayer, { opacity: contentOpacity }]} pointerEvents="box-none">
        {!hasVideo && particles.length > 0 ? (
          <View style={styles.confettiLayer} pointerEvents="none">
            {particles.map((p, i) => {
              const ParticleIcon = ParticleIcons[i % ParticleIcons.length]!;
              const colors = ['#FCD34D', '#E11414', TAB_DESIGN.purple, '#C61414', '#F97316'];
              const c = colors[i % colors.length]!;
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.particle,
                    {
                      opacity: p.opacity,
                      transform: [
                        { translateX: p.translateX },
                        { translateY: p.translateY },
                        { scale: p.scale },
                      ],
                    },
                  ]}
                >
                  <ParticleIcon size={14} color={c} fill={c} strokeWidth={0} />
                </Animated.View>
              );
            })}
          </View>
        ) : null}

        {showSenderChip ? (
        <Animated.View style={[hasVideo ? styles.senderChipVideo : styles.senderChip, { opacity: nameOpacity }]}>
          <LinearGradient
            colors={['#FECACA', TAB_DESIGN.purple]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Sparkles size={13} color="#fff" strokeWidth={2.4} />
          <Text variant="caption" weight="bold" color="#fff" numberOfLines={1} style={{ flex: 1 }}>
            {senderName}
            {recipientName ? ` → ${recipientName}` : ''}
          </Text>
        </Animated.View>
        ) : null}

        {useVideoPlayback && videoSrc ? (
          <View style={styles.videoLayer} pointerEvents="none">
            {!canPlayVideo ? (
              <View style={styles.videoUnsupported}>
                <GiftVisual gift={giftLike} size={GIFT_SIZE} mediaOrder="image-first" />
                {videoUnsupportedReason ? (
                  <Text variant="caption" color="#fff" align="center" style={styles.unsupportedText}>
                    {videoUnsupportedReason}
                  </Text>
                ) : null}
              </View>
            ) : videoPlayUri ? (
              <GiftVideoPlayer
                key={videoPlayUri}
                uri={videoPlayUri}
                onDuration={handleWebVideoDuration}
                onEnd={finishVideoGift}
                onError={handleVideoPlaybackError}
              />
            ) : (
              <View style={styles.videoLoading}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.giftStage, { height: GIFT_SIZE + 30 }]} pointerEvents="none">
            <Animated.View
              style={[
                styles.glowBurst,
                {
                  width: GIFT_SIZE * 0.9,
                  height: GIFT_SIZE * 0.9,
                  borderRadius: GIFT_SIZE * 0.45,
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }],
                  backgroundColor: `${iconColor}55`,
                },
              ]}
            />

            <Animated.View
              style={[styles.giftPopWrap, { width: GIFT_SIZE, height: GIFT_SIZE, transform: [{ scale: popScale }] }]}
              collapsable={false}
            >
              {showGifOnly ? (
                <GiftVisual gift={giftLike} size={GIFT_SIZE} mediaOrder="animation-first" animateGif />
              ) : (
                <>
                  <GiftVisual gift={giftLike} size={GIFT_SIZE} mediaOrder="image-first" />
                  {showGifOverlay && (
                    <View style={styles.gifOverlay} pointerEvents="none">
                      <GiftVisual gift={giftLike} size={GIFT_SIZE} mediaOrder="animation-first" animateGif />
                    </View>
                  )}
                </>
              )}
            </Animated.View>
          </View>
        )}

        {showNameOverlay ? (
          <Animated.View
            style={{
              opacity: nameOpacity,
              transform: [{ scale: nameScale }],
              alignItems: 'center',
            }}
            pointerEvents="none"
          >
            <LinearGradient
              colors={['#FECACA', '#FFFFFF', '#FCD34D']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.nameGradient}
            >
              <Text variant="h2" weight="bold" align="center" style={styles.giftNameText}>
                {giftName}
              </Text>
            </LinearGradient>

            {quantity > 1 && (
              <View style={styles.qtyBadge}>
                <Text variant="bodySmall" weight="bold" color="#fff">
                  ×{quantity}
                </Text>
              </View>
            )}
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#180606',
  },
  contentLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
  },
  compactLayer: {
    position: 'absolute',
    top: SCREEN_H * 0.18,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactGiftWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactQtyBadge: {
    position: 'absolute',
    right: -6,
    bottom: 4,
    minWidth: 34,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactSenderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    maxWidth: GIFT_SIZE_COMPACT + 40,
  },
  compactVideoWrap: {
    width: VIDEO_COMPACT_W,
    height: VIDEO_COMPACT_H,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactVideo: {
    width: VIDEO_COMPACT_W,
    height: VIDEO_COMPACT_H,
    backgroundColor: 'transparent',
  },
  videoLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  videoLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  videoUnsupported: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  unsupportedText: {
    opacity: 0.85,
    lineHeight: 20,
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    width: 16,
    height: 16,
  },
  senderChip: {
    position: 'absolute',
    top: SCREEN_H * 0.1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
    maxWidth: SCREEN_W - 48,
  },
  senderChipVideo: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? SCREEN_H * 0.08 : SCREEN_H * 0.06,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    overflow: 'hidden',
    maxWidth: SCREEN_W - 40,
    zIndex: 20,
  },
  giftStage: {
    width: SCREEN_W,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  glowBurst: {
    position: 'absolute',
  },
  giftPopWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gifOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameGradient: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: radius.lg,
  },
  giftNameText: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(225, 20, 20, 0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    lineHeight: 36,
  },
  qtyBadge: {
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: TAB_DESIGN.purple,
  },
});
