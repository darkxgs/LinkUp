/**
 * hook تشغيل موسيقى الروم — واجهة رفيعة فوق مدير خلط Agora
 *
 * جهاز الـDJ فقط يبثّ (startAudioMixing عبر roomMusicPlaybackManager) —
 * المستمعون صفر كود تشغيل: يسمعون الموسيقى من ستريم الـDJ تلقائياً، وهذا
 * الـhook يمدّهم بواجهة العرض فقط (موضع/مدة من RTDB + calculateMusicTime
 * للتنعيم) وبخافض «صوت الـDJ» المحلي (adjustUserPlaybackSignalVolume).
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type RoomMusic,
  removeMusicFromRoom,
  calculateMusicTime,
  isRoomMusicDj,
  canStopRoomMusic,
} from '@/services/roomMusic';
import {
  roomMusicPlaybackManager,
  stopRoomMusicPlayback,
  type RoomMusicNotice,
} from '@/services/roomMusicPlaybackManager';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';
import { useAlert } from '@/components/ui';

export { stopRoomMusicPlayback };

export function useRoomMusicPlayback(
  roomId: string | null,
  music: RoomMusic | null,
  userUid: string | null | undefined,
  enabled: boolean,
  canManageMusic = false,
) {
  const { t } = useTranslation();
  const { showToast } = useAlert();
  const isController = isRoomMusicDj(music, userUid);
  const canStopMusic = canStopRoomMusic(music, userUid, canManageMusic);
  const localListenerVolume = useRoomMusicUiStore((s) => s.localListenerVolume);
  const setLocalListenerVolume = useRoomMusicUiStore((s) => s.setLocalListenerVolume);
  const djPlayoutVolume = useRoomMusicUiStore((s) => s.djPlayoutVolume);

  const [mixSnap, setMixSnap] = useState(() => roomMusicPlaybackManager.getSnapshot());
  const [listenerPosition, setListenerPosition] = useState(
    music ? calculateMusicTime(music) : 0,
  );

  // ==================== جهاز الـDJ: بدء/مصالحة البث ====================

  useEffect(() => {
    if (!enabled || !roomId || !music || !isController) return;
    // idempotent — المدير يتجاهل نفس المقطع ويصالح حالة التشغيل/الصوت فقط.
    // ملاحظة: لا إيقاف عند التنظيف — المدير يراقب عقدة RTDB بنفسه ويتوقف
    // عند حذفها، فيستمر البث أثناء تصغير الروم وإعادة تركيب الشاشات.
    roomMusicPlaybackManager.syncDjBroadcast(roomId, music);
  }, [
    enabled,
    roomId,
    isController,
    music,
    music?.url,
    music?.addedAt,
    music?.isPlaying,
    music?.volume,
  ]);

  // «سماعي أنا» — playout الـDJ المحلي من قيمة المتجر
  useEffect(() => {
    if (!enabled || !isController) return;
    roomMusicPlaybackManager.setPlayoutVolume(djPlayoutVolume);
  }, [enabled, isController, djPlayoutVolume]);

  // لقطة المدير (موضع/مدة/تشغيل) — لجهاز الـDJ
  useEffect(() => {
    if (!enabled || !isController) return;
    setMixSnap(roomMusicPlaybackManager.getSnapshot());
    return roomMusicPlaybackManager.subscribe(() => {
      setMixSnap(roomMusicPlaybackManager.getSnapshot());
    });
  }, [enabled, isController]);

  // إشعارات المدير (تخطّي صيغة غير مدعومة / إيقاف إداري) — toast مترجم
  useEffect(() => {
    if (!enabled || !isController) return;
    return roomMusicPlaybackManager.subscribeNotices((notice: RoomMusicNotice) => {
      showToast(
        notice === 'admin-stopped'
          ? t('room.musicAdminStopped')
          : notice === 'playback-interrupted'
            ? // انقطاع تدفق/تكرار سريع (702/703) — ليست مشكلة صيغة
              t('room.musicPlaybackInterrupted')
            : t('room.musicUnsupportedSkipped'),
      );
    });
  }, [enabled, isController, showToast, t]);

  // ==================== المستمع: عرض فقط + خافض «صوت الـDJ» ====================

  // موضع التقدم للعرض — من RTDB منعَّماً بساعة السيرفر (لا صوت محلياً إطلاقاً)
  useEffect(() => {
    if (!enabled || !music || isController) return;
    const tick = () => setListenerPosition(calculateMusicTime(music));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [enabled, isController, music, music?.lastUpdatedAt, music?.isPlaying]);

  // الخافض المحلي «صوت الـDJ» — يخفض كلامه وموسيقاه معاً (ستريم واحد)؛
  // roomId يمكّن المدير من مراقبة العقدة واستعادة الصوت عند نهاية الجلسة
  useEffect(() => {
    if (!enabled || !roomId || !music || isController) return;
    roomMusicPlaybackManager.setListenerDjVolume(
      roomId,
      music.addedBy,
      localListenerVolume,
    );
  }, [enabled, roomId, isController, music, music?.addedBy, localListenerVolume]);

  // ==================== واجهة موحّدة ====================

  const localPlaying = isController ? mixSnap.playing : (music?.isPlaying ?? false);
  const position = isController ? mixSnap.positionSec : listenerPosition;
  const duration = isController
    ? mixSnap.durationSec || (music?.duration ?? 0)
    : (music?.duration ?? 0);
  const ready = isController ? mixSnap.active : !!music;

  const togglePlay = useCallback(async () => {
    if (!isController || !roomId) return;
    await roomMusicPlaybackManager.togglePlay(roomId);
  }, [isController, roomId]);

  const seekTo = useCallback(
    async (seconds: number) => {
      if (!isController || !roomId) return;
      await roomMusicPlaybackManager.seekTo(roomId, seconds);
    },
    [isController, roomId],
  );

  /**
   * «إيقاف الاستماع» للمستمع — لا يمكن إيقاف ستريم مشترك محلياً؛
   * الصادق المتاح: تصفير خافض «صوت الـDJ» (يكتم كلامه وموسيقاه معاً).
   */
  const pauseLocal = useCallback(async () => {
    if (isController) {
      if (roomId) await roomMusicPlaybackManager.togglePlay(roomId);
      return;
    }
    setLocalListenerVolume(0);
    if (music?.addedBy && roomId) {
      roomMusicPlaybackManager.setListenerDjVolume(roomId, music.addedBy, 0);
    }
  }, [isController, roomId, music?.addedBy, setLocalListenerVolume]);

  const broadcastVolume = music?.volume ?? 1;
  const effectiveVolume = isController ? broadcastVolume : localListenerVolume;

  /** «صوت الجمهور» (النشر) للـDJ — محرك فوراً + RTDB بـdebounce داخل المدير */
  const setBroadcastVolume = useCallback(
    (volume: number) => {
      if (!isController || !roomId) return;
      roomMusicPlaybackManager.setPublishVolume(roomId, volume);
    },
    [isController, roomId],
  );

  const stopBroadcast = useCallback(async () => {
    if (!roomId) return;
    if (canStopMusic) {
      // حذف العقدة يوقف خلط جهاز الـDJ عبر مراقب المدير
      await removeMusicFromRoom(roomId).catch(() => {});
      return;
    }
    // مستمع بلا صلاحية إيقاف — كتم «صوت الـDJ» محلياً وإخفاء الواجهة
    await pauseLocal();
    useRoomMusicUiStore.getState().dismissLocally();
  }, [canStopMusic, roomId, pauseLocal]);

  return {
    isController,
    canStopMusic,
    localPlaying,
    position,
    duration,
    ready,
    togglePlay,
    seekTo,
    pauseLocal,
    broadcastVolume,
    effectiveVolume,
    setBroadcastVolume,
    stopBroadcast,
  };
}
