/**
 * شريط تحكم الموسيقى السفلي — داخل شاشة الموسيقى الكاملة
 *
 * الصوت عبر خلط Agora: للـDJ قناتان («صوت الجمهور» تُنشر للجميع و«سماعي
 * أنا» محلي) معاً افتراضياً مع إمكانية الفصل؛ وللمستمع خافض «صوت الـDJ»
 * المحلي — يخفض كلامه وموسيقاه معاً (ستريم واحد).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Link2,
  Link2Off,
  MicOff,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import type { RoomMusicPlaybackApi } from '@/contexts/RoomMusicPlaybackContext';
import { advanceRoomMusicQueue } from '@/services/roomMusicQueue';
import { removeMusicFromRoom } from '@/services/roomMusic';
import { roomAudioSession } from '@/services/roomAudioSession';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';
import { MusicVolumeSlider } from './MusicVolumeSlider';

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

type Props = {
  roomId: string;
  playback: RoomMusicPlaybackApi;
};

export function RoomMusicPlaybackBar({ roomId, playback }: Props) {
  const { t } = useTranslation();
  const localListenerVolume = useRoomMusicUiStore((s) => s.localListenerVolume);
  const setLocalListenerVolume = useRoomMusicUiStore((s) => s.setLocalListenerVolume);
  const djPlayoutVolume = useRoomMusicUiStore((s) => s.djPlayoutVolume);
  const setDjPlayoutVolume = useRoomMusicUiStore((s) => s.setDjPlayoutVolume);
  const volumesLinked = useRoomMusicUiStore((s) => s.djVolumesLinked);
  const setVolumesLinked = useRoomMusicUiStore((s) => s.setDjVolumesLinked);

  // مايك جلسة الصوت — مؤشر «مايكك مكتوم والموسيقى مستمرة» للـDJ
  const [micMuted, setMicMuted] = useState(
    () => roomAudioSession.getSnapshot().isMuted,
  );
  useEffect(
    () =>
      roomAudioSession.subscribe(() =>
        setMicMuted(roomAudioSession.getSnapshot().isMuted),
      ),
    [],
  );

  const progress =
    playback.duration > 0 ? Math.min(playback.position / playback.duration, 1) : 0;

  // القناتان معاً (افتراضي) — شريط واحد يضبط النشر والسماع المحلي معاً
  const handleLinkedVolumeChange = useCallback(
    (v: number) => {
      playback.setBroadcastVolume(v);
      setDjPlayoutVolume(v);
    },
    [playback, setDjPlayoutVolume],
  );

  const handleSkipBack = useCallback(async () => {
    if (!playback.isController) return;
    await playback.seekTo(0);
  }, [playback]);

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

        {playback.isController ? (
          <Pressable onPress={() => setVolumesLinked(!volumesLinked)} style={styles.sideBtn}>
            {volumesLinked ? (
              <Link2 size={20} color="#FF6B35" />
            ) : (
              <Link2Off size={20} color="rgba(255,255,255,0.65)" />
            )}
          </Pressable>
        ) : (
          <View style={styles.sideBtn} />
        )}
      </View>

      {playback.isController && micMuted && playback.localPlaying ? (
        <View style={styles.micMutedPill}>
          <MicOff size={12} color="#FFD54F" />
          <Text variant="caption" color="#FFD54F" style={styles.micMutedText}>
            {t('room.musicMicMutedMusicOn')}
          </Text>
        </View>
      ) : null}

      <View style={styles.volumeArea}>
        {playback.isController ? (
          volumesLinked ? (
            <MusicVolumeSlider
              value={playback.broadcastVolume}
              onChange={handleLinkedVolumeChange}
              label={t('room.musicDjVolume')}
            />
          ) : (
            <>
              <MusicVolumeSlider
                value={playback.broadcastVolume}
                onChange={playback.setBroadcastVolume}
                label={t('room.musicAudienceVolume')}
              />
              <MusicVolumeSlider
                value={djPlayoutVolume}
                onChange={setDjPlayoutVolume}
                label={t('room.musicMyMonitorVolume')}
              />
            </>
          )
        ) : (
          <MusicVolumeSlider
            value={localListenerVolume}
            onChange={setLocalListenerVolume}
            label={t('room.musicDjPlaybackVolume')}
            hint={t('room.musicDjVolumeHint')}
          />
        )}
      </View>
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
  micMutedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 213, 79, 0.14)',
  },
  micMutedText: { fontSize: 10 },
  volumeArea: {
    marginTop: 10,
    gap: 4,
  },
});
