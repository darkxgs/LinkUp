/**
 * مشغّل فيديو الهدايا — expo-video مع fallback لـ expo-av
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av';

type Props = {
  uri: string;
  onDuration?: (durationSec: number) => void;
  onEnd: () => void;
  onError?: (message: string) => void;
  style?: ViewStyle;
  playbackRate?: number;
  contentFit?: 'contain' | 'cover';
};

export function GiftVideoPlayer({
  uri,
  onDuration,
  onEnd,
  onError,
  style,
  playbackRate = 1,
  contentFit = 'contain',
}: Props) {
  const [useAvFallback, setUseAvFallback] = useState(false);

  useEffect(() => {
    setUseAvFallback(false);
  }, [uri]);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
    p.volume = 1;
    p.playbackRate = playbackRate;
  });

  useEffect(() => {
    if (useAvFallback || !uri) return;
    // استدعاء replace/play على مشغّل حُرِّر أصلاً (إغلاق سريع للأنيميشن) يرمي
    // «player has been released» ويُسقط التطبيق كاملاً — نلتقطه ونكمل بالـ fallback
    try {
      player.replace(uri);
      player.playbackRate = playbackRate;
      player.play();
    } catch (e) {
      console.warn('GiftVideoPlayer play failed', e);
      setUseAvFallback(true);
    }
  }, [uri, player, useAvFallback, playbackRate]);

  useEffect(() => {
    if (useAvFallback) return;
    try {
      const endSub = player.addListener('playToEnd', () => onEnd());
      const statusSub = player.addListener('statusChange', ({ status, error }) => {
        if (status === 'readyToPlay') {
          try {
            if (player.duration > 0) onDuration?.(player.duration);
          } catch {
            // المشغّل قد يكون حُرِّر بين الحدث والقراءة
          }
        }
        if (status === 'error') {
          setUseAvFallback(true);
          onError?.(error?.message ?? 'expo-video');
        }
      });
      return () => {
        endSub.remove();
        statusSub.remove();
      };
    } catch (e) {
      console.warn('GiftVideoPlayer listeners failed', e);
      return undefined;
    }
  }, [player, onEnd, onDuration, onError, useAvFallback]);

  const handleAvStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      // حالة عدم التحميل قد تحمل خطأ تشغيل — نُبلّغ عنه (كان يُفقَد سابقاً)
      if (status.error) onError?.(status.error);
      return;
    }
    if (status.durationMillis && status.durationMillis > 0) {
      onDuration?.(status.durationMillis / 1000);
    }
    if (status.didJustFinish) onEnd();
  };

  const videoStyle = style ? [styles.video, style] : styles.video;

  const avResizeMode = contentFit === 'cover' ? ResizeMode.COVER : ResizeMode.CONTAIN;

  if (useAvFallback) {
    return (
      <Video
        source={{ uri }}
        style={videoStyle}
        resizeMode={avResizeMode}
        shouldPlay
        isLooping={false}
        isMuted={false}
        volume={1}
        rate={playbackRate}
        onPlaybackStatusUpdate={handleAvStatus}
      />
    );
  }

  return (
    <VideoView
      player={player}
      style={videoStyle}
      contentFit={contentFit}
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
});
