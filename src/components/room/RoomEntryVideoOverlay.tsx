/**
 * دخولية SVIP — overlay بكامل الشاشة.
 * room: مختصر وسريع للغرف | profile: كامل الشاشة + المدة الكاملة + صوت
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Pressable,
  ActivityIndicator,
  Modal,
  Platform,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { GiftVideoPlayer } from '@/components/ui/GiftVideoPlayer';
import {
  preloadVideoBackground,
  resolveEntryVideoUriFast,
  resolveGiftVideoUri,
} from '@/utils/videoCacheManager';
import {
  getGiftVideoPlaybackCandidates,
  giftVideoUnsupportedReason,
} from '@/utils/giftVideoPlayback';
import {
  ENTRY_VIDEO_LOAD_TIMEOUT_MS,
  ENTRY_VIDEO_MAX_DISPLAY_MS,
  ENTRY_VIDEO_SAFETY_MAX_MS,
  PROFILE_ENTRY_VIDEO_LOAD_TIMEOUT_MS,
  PROFILE_ENTRY_VIDEO_SAFETY_MAX_MS,
} from '@/components/ui/giftUtils';
import { configureVideoPlaybackAudio } from '@/utils/playRoomSound';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Props = {
  userName: string;
  videoUrl: string;
  videoUrlMp4?: string;
  onComplete: () => void;
  /** profile = ملء الشاشة + مدة الفيديو كاملة + صوت */
  mode?: 'room' | 'profile';
};

export function RoomEntryVideoOverlay({
  userName,
  videoUrl,
  videoUrlMp4,
  onComplete,
  mode = 'room',
}: Props) {
  const isProfile = mode === 'profile';
  const [playUri, setPlayUri] = useState<string | null>(null);
  const [playbackCandidateIdx, setPlaybackCandidateIdx] = useState(0);
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null);
  const finishedRef = useRef(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const playbackCandidates = useMemo(
    () => getGiftVideoPlaybackCandidates(videoUrl, videoUrlMp4),
    [videoUrl, videoUrlMp4],
  );
  const playbackSrc = playbackCandidates[playbackCandidateIdx] ?? '';
  const canPlayVideo = playbackCandidates.length > 0;
  const unsupportedReason = useMemo(
    () => giftVideoUnsupportedReason(videoUrl, videoUrlMp4),
    [videoUrl, videoUrlMp4],
  );

  const safetyMaxMs = useMemo(() => {
    if (!isProfile) return ENTRY_VIDEO_SAFETY_MAX_MS;
    if (videoDurationMs && videoDurationMs > 0) {
      return Math.min(PROFILE_ENTRY_VIDEO_SAFETY_MAX_MS, Math.ceil(videoDurationMs) + 2500);
    }
    return PROFILE_ENTRY_VIDEO_SAFETY_MAX_MS;
  }, [isProfile, videoDurationMs]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: isProfile ? 320 : 250,
      useNativeDriver: true,
    }).start(onComplete);
  }, [overlayOpacity, onComplete, isProfile]);

  useEffect(() => {
    finishedRef.current = false;
    setVideoDurationMs(null);
    overlayOpacity.setValue(0);
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: isProfile ? 280 : 200,
      useNativeDriver: true,
    }).start();
  }, [videoUrl, videoUrlMp4, overlayOpacity, isProfile]);

  useEffect(() => {
    setPlaybackCandidateIdx(0);
    setPlayUri(null);
  }, [videoUrl, videoUrlMp4]);

  useEffect(() => {
    const safety = setTimeout(finish, safetyMaxMs);
    return () => clearTimeout(safety);
  }, [playbackSrc, finish, safetyMaxMs]);

  useEffect(() => {
    if (isProfile) return;
    const maxDisplay = setTimeout(finish, ENTRY_VIDEO_MAX_DISPLAY_MS);
    return () => clearTimeout(maxDisplay);
  }, [isProfile, playbackSrc, finish]);

  useEffect(() => {
    if (canPlayVideo) return;
    const timer = setTimeout(finish, isProfile ? 1500 : 900);
    return () => clearTimeout(timer);
  }, [canPlayVideo, finish, isProfile]);

  useEffect(() => {
    if (!playbackSrc) {
      setPlayUri(null);
      return;
    }

    let cancelled = false;
    const loadTimeoutMs = isProfile
      ? PROFILE_ENTRY_VIDEO_LOAD_TIMEOUT_MS
      : ENTRY_VIDEO_LOAD_TIMEOUT_MS;

    if (isProfile) {
      void configureVideoPlaybackAudio().catch(() => {});
      setPlayUri(null);
      void resolveGiftVideoUri(playbackSrc).then((uri) => {
        if (!cancelled && uri) setPlayUri(uri);
      });
      preloadVideoBackground(playbackSrc);
    } else {
      const fastUri = resolveEntryVideoUriFast(playbackSrc);
      if (fastUri) setPlayUri(fastUri);
      preloadVideoBackground(playbackSrc);
    }

    const loadTimeout = setTimeout(() => {
      if (cancelled) return;
      setPlayUri((prev) => prev ?? resolveEntryVideoUriFast(playbackSrc) ?? playbackSrc);
      if (!isProfile && !resolveEntryVideoUriFast(playbackSrc)) finish();
    }, loadTimeoutMs);

    return () => {
      cancelled = true;
      clearTimeout(loadTimeout);
    };
  }, [playbackSrc, finish, isProfile]);

  const handleVideoError = useCallback(() => {
    if (playbackCandidateIdx + 1 < playbackCandidates.length) {
      setPlaybackCandidateIdx((idx) => idx + 1);
      return;
    }
    finish();
  }, [playbackCandidateIdx, playbackCandidates.length, finish]);

  const handleVideoDuration = useCallback((durationSec: number) => {
    if (durationSec > 0) {
      setVideoDurationMs((prev) => prev ?? Math.round(durationSec * 1000));
    }
  }, []);

  const content = (
    <Animated.View
      style={[
        isProfile ? styles.profileRoot : styles.overlayRoot,
        { opacity: overlayOpacity },
      ]}
    >
      <Pressable style={styles.touchArea} onPress={isProfile ? undefined : finish}>
        <View style={[styles.backdrop, isProfile && styles.profileBackdrop]} />

        <View style={[styles.videoBox, isProfile && styles.profileVideoBox]}>
          {!canPlayVideo ? (
            unsupportedReason ? (
              <Text
                variant="caption"
                color="rgba(255,255,255,0.7)"
                align="center"
                style={styles.hint}
              >
                {unsupportedReason}
              </Text>
            ) : null
          ) : playUri ? (
            <GiftVideoPlayer
              key={`${playUri}-${playbackCandidateIdx}`}
              uri={playUri}
              style={isProfile ? styles.profileVideo : styles.fullVideo}
              contentFit={isProfile ? 'cover' : 'contain'}
              playbackRate={1}
              onDuration={handleVideoDuration}
              onEnd={finish}
              onError={handleVideoError}
            />
          ) : (
            <ActivityIndicator color="rgba(255,255,255,0.85)" size={isProfile ? 'large' : 'small'} />
          )}
        </View>

        <View style={[styles.nameChip, isProfile && styles.profileNameChip]}>
          <LinearGradient
            colors={['#FECACA', '#E11414']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Sparkles size={14} color="#fff" strokeWidth={2.4} />
          <Text variant="caption" weight="bold" color="#fff" numberOfLines={1} style={styles.nameText}>
            {userName}
          </Text>
        </View>

        {isProfile ? (
          <Pressable style={styles.profileSkipBtn} onPress={finish} hitSlop={12}>
            <Text variant="caption" color="rgba(255,255,255,0.85)">
              تخطي
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );

  if (isProfile) {
    return (
      <Modal
        visible
        animationType="fade"
        transparent={false}
        statusBarTranslucent={Platform.OS === 'android'}
        presentationStyle="overFullScreen"
        onRequestClose={finish}
      >
        {content}
      </Modal>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 55,
  },
  profileRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  touchArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  profileBackdrop: {
    backgroundColor: '#000',
  },
  nameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
    maxWidth: SCREEN_W - 48,
    position: 'absolute',
    bottom: SCREEN_H * 0.12,
    zIndex: 2,
  },
  profileNameChip: {
    bottom: SCREEN_H * 0.08,
  },
  profileSkipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 36,
    right: 20,
    zIndex: 3,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  nameText: {
    flexShrink: 1,
  },
  videoBox: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileVideoBox: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  fullVideo: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: 'transparent',
  } as ViewStyle,
  profileVideo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  } as ViewStyle,
  hint: {
    paddingHorizontal: 12,
    lineHeight: 18,
  },
});
