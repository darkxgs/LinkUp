/**
 * شريط تحكم الموسيقى السفلي — داخل شاشة الموسيقى الكاملة
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Repeat,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import type { RoomMusicPlaybackApi } from '@/contexts/RoomMusicPlaybackContext';
import { advanceRoomMusicQueue } from '@/services/roomMusicQueue';
import { removeMusicFromRoom, updateMusicPlayback } from '@/services/roomMusic';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

type VolumeDragSliderProps = {
  value: number;
  onChange: (v: number) => void;
};

function VolumeDragSlider({ value, onChange }: VolumeDragSliderProps) {
  const trackWidth = useRef(0);

  const setFromX = useCallback(
    (x: number) => {
      if (trackWidth.current <= 0) return;
      const next = Math.max(0, Math.min(1, x / trackWidth.current));
      onChange(Math.round(next * 20) / 20);
    },
    [onChange],
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => setFromX(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => setFromX(evt.nativeEvent.locationX),
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  const progress = Math.round(value * 100);

  return (
    <View style={volStyles.wrap}>
      {value < 0.05 ? (
        <VolumeX size={18} color="rgba(255,255,255,0.65)" />
      ) : (
        <Volume2 size={18} color="rgba(255,255,255,0.85)" />
      )}
      <View
        style={volStyles.track}
        onLayout={onLayout}
        {...pan.panHandlers}
      >
        <View style={[volStyles.fill, { width: `${progress}%` }]} />
        <View style={[volStyles.thumb, { left: `${progress}%` }]} />
      </View>
      <Text variant="caption" color="rgba(255,255,255,0.55)" style={volStyles.pct}>
        {progress}%
      </Text>
    </View>
  );
}

const volStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  track: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF6B35',
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    backgroundColor: '#fff',
    top: 7,
  },
  pct: {
    width: 36,
    textAlign: 'right',
    fontSize: 11,
  },
});

type Props = {
  roomId: string;
  playback: RoomMusicPlaybackApi;
};

export function RoomMusicPlaybackBar({ roomId, playback }: Props) {
  const { t } = useTranslation();
  const localListenerVolume = useRoomMusicUiStore((s) => s.localListenerVolume);
  const setLocalListenerVolume = useRoomMusicUiStore((s) => s.setLocalListenerVolume);
  const [loopOn, setLoopOn] = useState(false);

  const progress =
    playback.duration > 0 ? Math.min(playback.position / playback.duration, 1) : 0;

  const volumeValue = playback.isController
    ? playback.broadcastVolume
    : localListenerVolume;

  const handleVolumeChange = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(1, next));
      if (playback.isController) {
        playback.setBroadcastVolume(clamped);
        return;
      }
      setLocalListenerVolume(clamped);
    },
    [playback, setLocalListenerVolume],
  );

  const handleSkipBack = useCallback(async () => {
    if (!playback.isController) return;
    await updateMusicPlayback(roomId, { currentTime: 0, isPlaying: true });
  }, [playback.isController, roomId]);

  const handleSkipNext = useCallback(async () => {
    if (!playback.isController) return;
    const advanced = await advanceRoomMusicQueue(roomId);
    if (!advanced) await removeMusicFromRoom(roomId);
  }, [playback.isController, roomId]);

  return (
    <View style={styles.wrap}>
      <View style={styles.progressRow}>
        <Text variant="caption" color="rgba(255,255,255,0.55)" style={styles.time}>
          {formatTime(playback.duration)}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.progressThumb, { left: `${progress * 100}%` }]} />
        </View>
        <Text variant="caption" color="rgba(255,255,255,0.55)" style={styles.time}>
          {formatTime(playback.position)}
        </Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.sideBtn} />

        <Pressable
          onPress={() => void handleSkipBack()}
          disabled={!playback.isController}
          style={styles.sideBtn}
        >
          <SkipBack size={24} color={playback.isController ? '#fff' : 'rgba(255,255,255,0.25)'} />
        </Pressable>

        <Pressable
          onPress={() => void playback.togglePlay()}
          disabled={!playback.isController}
          style={styles.playBtn}
        >
          {playback.localPlaying ? (
            <Pause size={28} color="#1A0A0C" fill="#1A0A0C" />
          ) : (
            <Play size={28} color="#1A0A0C" fill="#1A0A0C" style={{ marginLeft: 3 }} />
          )}
        </Pressable>

        <Pressable
          onPress={() => void handleSkipNext()}
          disabled={!playback.isController}
          style={styles.sideBtn}
        >
          <SkipForward size={24} color={playback.isController ? '#fff' : 'rgba(255,255,255,0.25)'} />
        </Pressable>

        <Pressable onPress={() => setLoopOn((v) => !v)} style={styles.sideBtn}>
          <Repeat size={22} color={loopOn ? '#FF6B35' : 'rgba(255,255,255,0.65)'} />
        </Pressable>
      </View>

      <VolumeDragSlider value={volumeValue} onChange={handleVolumeChange} />
      <Text variant="caption" color="rgba(255,255,255,0.4)" align="center" style={styles.volHint}>
        {playback.isController ? t('room.musicDjVolume') : t('room.musicListenerVolume')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: '#160808',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  time: {
    width: 44,
    fontSize: 11,
    textAlign: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    position: 'relative',
    justifyContent: 'center',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  progressThumb: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    backgroundColor: '#fff',
    top: -3.5,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sideBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volHint: {
    marginTop: 4,
    fontSize: 10,
  },
});
