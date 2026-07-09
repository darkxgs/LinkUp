/**
 * RoomMusicPlayer — مشغّل موسيقى متزامن لكل من في الروم
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Play,
  Pause,
  X,
  Music2,
  Radio,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import {
  type RoomMusic,
  updateMusicPlayback,
  removeMusicFromRoom,
  calculateMusicTime,
  canControlMusic,
} from '@/services/roomMusic';
import { lu } from '@/theme/lu-brand';

type AVModule = typeof import('expo-av');

interface Props {
  roomId: string;
  music: RoomMusic;
  userUid?: string | null;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function RoomMusicPlayer({ roomId, music, userUid }: Props) {
  const { t } = useTranslation();
  const isController = canControlMusic(music, userUid);
  const soundRef = useRef<import('expo-av').Audio.Sound | null>(null);
  const avRef = useRef<AVModule | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncWriteRef = useRef(0);
  const pulse = useRef(new Animated.Value(0)).current;

  const [localPlaying, setLocalPlaying] = useState(music.isPlaying);
  const [position, setPosition] = useState(music.currentTime);
  const [duration, setDuration] = useState(music.duration ?? 0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const unload = useCallback(async () => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    try {
      await soundRef.current?.unloadAsync();
    } catch {
      // ignore
    }
    soundRef.current = null;
    setReady(false);
  }, []);

  const loadTrack = useCallback(async () => {
    await unload();
    try {
      const AV = avRef.current ?? (await import('expo-av'));
      avRef.current = AV;
      await AV.Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await AV.Audio.Sound.createAsync(
        { uri: music.url },
        { shouldPlay: false, progressUpdateIntervalMillis: 500 },
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.durationMillis) {
          setDuration(status.durationMillis / 1000);
        }
        if (isController && status.positionMillis != null) {
          setPosition(status.positionMillis / 1000);
        }
        if (status.didJustFinish && isController) {
          updateMusicPlayback(roomId, { isPlaying: false, currentTime: 0 }).catch(() => {});
        }
      });

      const startAt = calculateMusicTime(music);
      if (startAt > 0) {
        await sound.setPositionAsync(startAt * 1000);
      }
      setPosition(startAt);
      if (music.isPlaying) {
        await sound.playAsync();
      }
      setLocalPlaying(music.isPlaying);
      setReady(true);
    } catch (e) {
      console.warn('RoomMusicPlayer load:', e);
    }
  }, [music.url, music.addedAt, unload, isController, roomId]);

  useEffect(() => {
    loadTrack();
    return () => {
      unload();
    };
  }, [music.url, music.addedAt]);

  // تزامن المشاهدين مع RTDB
  useEffect(() => {
    if (isController) return;
    const tick = () => {
      const t = calculateMusicTime(music);
      setPosition(t);
      setLocalPlaying(music.isPlaying);
      soundRef.current
        ?.getStatusAsync()
        .then(async (st) => {
          if (!st.isLoaded || !soundRef.current) return;
          const drift = Math.abs(st.positionMillis / 1000 - t);
          if (drift > 1.5) {
            await soundRef.current.setPositionAsync(t * 1000);
          }
          if (music.isPlaying && !st.isPlaying) {
            await soundRef.current.playAsync();
          }
          if (!music.isPlaying && st.isPlaying) {
            await soundRef.current.pauseAsync();
          }
        })
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [music.isPlaying, music.lastUpdatedAt, music.currentTime, isController, music]);

  // المتحكّم يكتب التقدّم كل ~4 ثوان
  useEffect(() => {
    if (!isController || !ready) return;
    syncTimerRef.current = setInterval(async () => {
      const st = await soundRef.current?.getStatusAsync();
      if (!st?.isLoaded) return;
      const now = Date.now();
      if (now - lastSyncWriteRef.current < 3500) return;
      lastSyncWriteRef.current = now;
      const pos = st.positionMillis / 1000;
      const playing = st.isPlaying;
      setPosition(pos);
      setLocalPlaying(playing);
      try {
        await updateMusicPlayback(roomId, {
          currentTime: pos,
          isPlaying: playing,
          duration: st.durationMillis ? st.durationMillis / 1000 : undefined,
        });
      } catch {
        // ignore
      }
    }, 4000);
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [isController, ready, roomId]);

  const togglePlay = async () => {
    if (!isController || !soundRef.current) return;
    const st = await soundRef.current.getStatusAsync();
    if (!st.isLoaded) return;
    const next = !st.isPlaying;
    if (next) await soundRef.current.playAsync();
    else await soundRef.current.pauseAsync();
    const pos = st.positionMillis / 1000;
    setLocalPlaying(next);
    await updateMusicPlayback(roomId, { isPlaying: next, currentTime: pos });
  };

  const handleStop = async () => {
    if (!isController) return;
    try {
      await removeMusicFromRoom(roomId);
    } catch (e) {
      console.warn(e);
    }
  };

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(225, 20, 20,0.35)', 'rgba(225, 20, 20,0.25)', 'rgba(46, 11, 11, 0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.glowOrb, { transform: [{ scale }] }]} />

      <View style={styles.row}>
        <View style={styles.art}>
          {music.addedByAvatar ? (
            <Image source={{ uri: music.addedByAvatar }} style={styles.artImg} contentFit="cover" cachePolicy="memory-disk" recyclingKey={music.addedByAvatar} />
          ) : (
            <LinearGradient colors={lu.gradients.pink} style={styles.artImg}>
              <Music2 size={22} color="#fff" />
            </LinearGradient>
          )}
          <View style={styles.liveDot}>
            <Radio size={10} color="#fff" strokeWidth={3} />
          </View>
        </View>

        <View style={styles.meta}>
          <Text variant="caption" color={lu.colors.pink} weight="bold" style={styles.liveLabel}>
            {t('room.musicNowPlaying')}
          </Text>
          <Text variant="body" weight="bold" color="#fff" numberOfLines={1}>
            {music.title}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.55)" numberOfLines={1}>
            DJ · {music.addedByName}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text variant="caption" color="rgba(255,255,255,0.45)" style={styles.time}>
            {formatTime(position)}
            {duration > 0 ? ` / ${formatTime(duration)}` : ''}
          </Text>
        </View>

        <View style={styles.controls}>
          {isController ? (
            <>
              <Pressable onPress={togglePlay} style={styles.ctrlBtn}>
                {localPlaying ? (
                  <Pause size={22} color="#fff" fill="#fff" />
                ) : (
                  <Play size={22} color="#fff" fill="#fff" />
                )}
              </Pressable>
              <Pressable onPress={handleStop} style={[styles.ctrlBtn, styles.ctrlStop]}>
                <X size={20} color="#fff" strokeWidth={2.5} />
              </Pressable>
            </>
          ) : (
            <View style={styles.listeningPill}>
              <Text variant="caption" color="#fff" weight="semibold">
                {localPlaying ? t('room.musicListening') : t('room.musicPaused')}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20,0.35)',
    minHeight: 88,
    justifyContent: 'center',
  },
  glowOrb: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(225, 20, 20,0.2)',
    top: -20,
    right: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  art: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: 'visible',
  },
  artImg: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: lu.colors.live,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1A0A0C',
  },
  meta: { flex: 1, minWidth: 0 },
  liveLabel: { fontSize: 10, letterSpacing: 0.6, marginBottom: 2 },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: lu.colors.pink,
    borderRadius: 2,
  },
  time: { marginTop: 4, fontSize: 10 },
  controls: { alignItems: 'center', gap: 8 },
  ctrlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlStop: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,46,98,0.5)',
  },
  listeningPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
