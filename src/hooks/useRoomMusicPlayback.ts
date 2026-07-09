import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type RoomMusic,
  updateMusicPlayback,
  removeMusicFromRoom,
  calculateMusicTime,
  isRoomMusicDj,
  canStopRoomMusic,
  setMusicVolume,
} from '@/services/roomMusic';
import { advanceRoomMusicQueue } from '@/services/roomMusicQueue';
import {
  roomMusicPlaybackManager,
  stopRoomMusicPlayback,
} from '@/services/roomMusicPlaybackManager';
import { useRoomSessionStore } from '@/stores/roomSessionStore';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';
import { configureSoundEffectsAudio, isRoomVoiceSessionActive } from '@/utils/playRoomSound';

export { stopRoomMusicPlayback };

type AVModule = typeof import('expo-av');

export function useRoomMusicPlayback(
  roomId: string | null,
  music: RoomMusic | null,
  userUid: string | null | undefined,
  enabled: boolean,
  canManageMusic = false,
) {
  const isController = isRoomMusicDj(music, userUid);
  const canStopMusic = canStopRoomMusic(music, userUid, canManageMusic);
  const soundRef = useRef<import('expo-av').Audio.Sound | null>(null);
  const avRef = useRef<AVModule | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncWriteRef = useRef(0);
  const loadGenRef = useRef(0);
  // آخر نسخة من بيانات الموسيقى — تُقرأ داخل الدوال بدل الاعتماد على هوية الكائن،
  // وإلا أعاد كل تحديث مزامنة (كل ~4ث) تحميل الملف من الصفر → تقطيع
  const latestMusicRef = useRef(music);
  latestMusicRef.current = music;
  const lastDriftSeekRef = useRef(0);
  const lastLoadedSessionRef = useRef<number | null>(null);
  const volumeWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // مرجع ثابت لأحدث نسخة من loadTrack + عدّاد إعادة محاولة عند بقاء pending://
  const loadTrackRef = useRef<() => Promise<void>>();
  const pendingRetryRef = useRef(0);
  const pendingRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localListenerVolume = useRoomMusicUiStore((s) => s.localListenerVolume);

  const broadcastVolume = music?.volume ?? 1;
  const effectiveVolume = isController
    ? broadcastVolume
    : broadcastVolume * localListenerVolume;
  // نقرأ الصوت من ref داخل loadTrack بدل التبعية المباشرة — وإلا كان كل تغيير
  // مستوى صوت يُعيد إنشاء loadTrack ويُعيد تحميل الملف والقفز للموضع (الأغنية ترجع).
  const effectiveVolumeRef = useRef(effectiveVolume);
  effectiveVolumeRef.current = effectiveVolume;

  const applySoundVolume = useCallback(async (vol: number) => {
    try {
      await soundRef.current?.setVolumeAsync(Math.max(0, Math.min(1, vol)));
    } catch {
      // ignore
    }
  }, []);

  const [localPlaying, setLocalPlaying] = useState(music?.isPlaying ?? false);
  const [position, setPosition] = useState(music?.currentTime ?? 0);
  const [duration, setDuration] = useState(music?.duration ?? 0);
  const [ready, setReady] = useState(false);

  const clearSound = useCallback(async () => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    const sound = soundRef.current;
    soundRef.current = null;
    roomMusicPlaybackManager.detach(sound);
    try {
      await sound?.stopAsync();
    } catch {
      // ignore
    }
    try {
      await sound?.unloadAsync();
    } catch {
      // ignore
    }
    setReady(false);
    setLocalPlaying(false);
  }, []);

  const unload = useCallback(async () => {
    loadGenRef.current += 1;
    lastLoadedSessionRef.current = null;
    await clearSound();
  }, [clearSound]);

  const loadTrack = useCallback(async () => {
    const music = latestMusicRef.current;
    if (!enabled || !music?.url) return;
    const myGen = ++loadGenRef.current;

    // حلّ المسار المحلي مع مهلة — إن تعذّر (getInfoAsync معلّق) نبثّ الرابط السحابي
    // بدل البقاء في التحميل إلى ما لا نهاية.
    const playableUri = await Promise.race([
      import('@/services/roomMusicLocal')
        .then((m) => m.resolveLocalPlayableUri(music.url))
        .catch(() => music.url),
      new Promise<string>((resolve) => setTimeout(() => resolve(music.url), 4000)),
    ]);
    // النسخة المحلية لم تُكتب بعد (سباق كتابة) — أعد المحاولة بضع مرّات بدل التعليق في Loading
    if (playableUri.startsWith('pending://')) {
      if (pendingRetryRef.current < 12) {
        pendingRetryRef.current += 1;
        if (pendingRetryTimerRef.current) clearTimeout(pendingRetryTimerRef.current);
        pendingRetryTimerRef.current = setTimeout(() => {
          void loadTrackRef.current?.();
        }, 400);
      }
      return;
    }
    pendingRetryRef.current = 0;

    if (
      lastLoadedSessionRef.current === music.addedAt &&
      soundRef.current
    ) {
      try {
        const st = await soundRef.current.getStatusAsync();
        if (st.isLoaded && myGen === loadGenRef.current) {
          setReady(true);
          setLocalPlaying(music.isPlaying);
          return;
        }
      } catch {
        // fall through — إعادة تحميل كاملة
      }
    }

    const existing = roomMusicPlaybackManager.getActiveSound();
    if (existing) {
      try {
        const st = await existing.getStatusAsync();
        if (st.isLoaded && myGen === loadGenRef.current) {
          soundRef.current = existing;
          roomMusicPlaybackManager.attach(existing);
          if (music.isPlaying && !st.isPlaying) {
            await existing.playAsync();
          }
          setLocalPlaying(music.isPlaying);
          setReady(true);
          const startAt = calculateMusicTime(music);
          setPosition(startAt);
          return;
        }
      } catch {
        // fall through to full load
      }
    }

    await clearSound();
    if (myGen !== loadGenRef.current) return;
    try {
      const AV = avRef.current ?? (await import('expo-av'));
      avRef.current = AV;
      if (!isRoomVoiceSessionActive()) {
        await configureSoundEffectsAudio();
      }
      const { sound } = await AV.Audio.Sound.createAsync(
        { uri: playableUri },
        {
          shouldPlay: false,
          progressUpdateIntervalMillis: 400,
          volume: effectiveVolumeRef.current,
          isMuted: false,
        },
      );
      if (myGen !== loadGenRef.current) {
        await sound.unloadAsync().catch(() => {});
        return;
      }
      soundRef.current = sound;
      roomMusicPlaybackManager.attach(sound);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded || !roomId) return;
        if (status.durationMillis) {
          setDuration(status.durationMillis / 1000);
        }
        if (isController && status.positionMillis != null) {
          setPosition(status.positionMillis / 1000);
        }
        if (status.didJustFinish && isController && roomId) {
          advanceRoomMusicQueue(roomId)
            .then((advanced) => {
              if (!advanced) void removeMusicFromRoom(roomId);
            })
            .catch(() => {
              updateMusicPlayback(roomId, { isPlaying: false, currentTime: 0 }).catch(() => {});
            });
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
      lastLoadedSessionRef.current = music.addedAt;
    } catch (e) {
      console.warn('useRoomMusicPlayback load:', e);
    }
    // ملاحظة: لا نعتمد على كائن music هنا (نقرأه من latestMusicRef)
    // ولا على effectiveVolume (نقرأه من effectiveVolumeRef) — حتى تبقى الدالة ثابتة
    // عبر كتابات المزامنة وتغيّر الصوت، فلا يُعاد تحميل الملف ولا يقفز الموضع.
  }, [clearSound, isController, roomId, enabled]);
  loadTrackRef.current = loadTrack;

  useEffect(() => {
    void applySoundVolume(effectiveVolume);
  }, [effectiveVolume, applySoundVolume, ready]);

  useEffect(() => {
    // مقطع جديد — صفّر عدّاد إعادة محاولة pending:// وألغِ أي مؤقّت سابق
    pendingRetryRef.current = 0;
    if (pendingRetryTimerRef.current) {
      clearTimeout(pendingRetryTimerRef.current);
      pendingRetryTimerRef.current = null;
    }
    if (!enabled || !music) {
      void unload();
      return;
    }
    void loadTrack();
    return () => {
      const session = useRoomSessionStore.getState();
      if (
        session.audioPinned &&
        session.isMinimized &&
        session.roomId &&
        session.roomId === roomId
      ) {
        return;
      }
      void unload();
    };
  }, [music?.url, music?.addedAt, enabled, roomId, loadTrack, unload]);

  useEffect(() => {
    if (!enabled || !music || isController) return;
    const tick = () => {
      const m = latestMusicRef.current;
      if (!m) return;
      const t = calculateMusicTime(m);
      setPosition(t);
      setLocalPlaying(m.isPlaying);
      soundRef.current
        ?.getStatusAsync()
        .then(async (st) => {
          if (!st.isLoaded || !soundRef.current) return;
          if (m.isPlaying && !st.isPlaying) {
            await soundRef.current.playAsync();
            return;
          }
          if (!m.isPlaying && st.isPlaying) {
            await soundRef.current.pauseAsync();
            return;
          }
          // أثناء التحميل المؤقت لا نقفز — القفز لمنطقة غير محمّلة يزيد التقطيع
          if (st.isBuffering) return;
          const drift = Math.abs(st.positionMillis / 1000 - t);
          const now = Date.now();
          // قفزة تصحيح فقط عند انحراف كبير، وبفاصل ≥ 10ث بين القفزات —
          // العتبة القديمة (1.5ث) مع انحراف الساعات كانت تسبّب قفزات متواصلة
          if (drift > 4 && now - lastDriftSeekRef.current > 10_000) {
            lastDriftSeekRef.current = now;
            await soundRef.current.setPositionAsync(t * 1000);
          }
        })
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [music?.url, music?.addedAt, isController, enabled]);

  useEffect(() => {
    if (!enabled || !isController || !ready || !roomId) return;
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
  }, [isController, ready, roomId, enabled]);

  const pauseLocal = useCallback(async () => {
    try {
      await soundRef.current?.pauseAsync();
      setLocalPlaying(false);
    } catch {
      // ignore
    }
  }, []);

  const togglePlay = useCallback(async () => {
    if (!isController || !soundRef.current || !roomId) return;
    const st = await soundRef.current.getStatusAsync();
    if (!st.isLoaded) return;
    const next = !st.isPlaying;
    if (next) await soundRef.current.playAsync();
    else await soundRef.current.pauseAsync();
    const pos = st.positionMillis / 1000;
    setLocalPlaying(next);
    await updateMusicPlayback(roomId, { isPlaying: next, currentTime: pos });
  }, [isController, roomId]);

  const setBroadcastVolume = useCallback(
    (volume: number) => {
      const clamped = Math.max(0, Math.min(1, volume));
      void applySoundVolume(clamped);
      if (!isController || !roomId) return;
      if (volumeWriteTimerRef.current) clearTimeout(volumeWriteTimerRef.current);
      volumeWriteTimerRef.current = setTimeout(() => {
        void setMusicVolume(roomId, clamped).catch(() => {});
      }, 280);
    },
    [applySoundVolume, isController, roomId],
  );

  const stopBroadcast = useCallback(async () => {
    if (!roomId) return;
    if (canStopMusic) {
      await removeMusicFromRoom(roomId).catch(() => {});
      return;
    }
    await stopRoomMusicPlayback().catch(() => {});
    useRoomMusicUiStore.getState().dismissLocally();
  }, [canStopMusic, roomId]);

  useEffect(
    () => () => {
      if (volumeWriteTimerRef.current) clearTimeout(volumeWriteTimerRef.current);
      if (pendingRetryTimerRef.current) clearTimeout(pendingRetryTimerRef.current);
    },
    [],
  );

  return {
    isController,
    canStopMusic,
    localPlaying,
    position,
    duration,
    ready,
    togglePlay,
    pauseLocal,
    soundRef,
    broadcastVolume,
    effectiveVolume,
    setBroadcastVolume,
    stopBroadcast,
  };
}
