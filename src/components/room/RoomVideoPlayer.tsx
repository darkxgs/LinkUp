/**
 * RoomVideoPlayer
 *
 * مشغّل فيديو مدمج في الروم يدعم:
 *  - mp4 / HLS / mov / webm (عبر expo-video)
 *  - YouTube (عبر react-native-youtube-iframe)
 *
 * التزامن:
 *  - subscribe لـ rooms/{id}/video من RTDB
 *  - المتحكّم (canControl) يحدّث الـ playback كل 5 ثوان
 *  - المشاهدون يتزامنون عند تغيّر state من RTDB
 *
 * المايكات لا تتأثر: الفيديو مستقل عن جلسة الصوت.
 * نعطّل صوت الفيديو افتراضياً (muted=true) لتجنّب التداخل مع المايكات،
 * مع زر "تفعيل صوت الفيديو" للجميع كخيار شخصي محلي فقط.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Play,
  Pause,
  X,
  Volume2,
  VolumeX,
  Youtube,
  Film,
  Maximize2,
  Minimize2,
  Move,
} from 'lucide-react-native';

import { Text } from '@/components/ui';
import {
  type RoomVideo,
  updateVideoPlayback,
  removeVideoFromRoom,
  calculateActualTime,
} from '@/services/roomVideo';
import { lu } from '@/theme/lu-brand';
import { radius, shadows } from '@/theme';

interface Props {
  roomId: string;
  video: RoomVideo;
  userUid: string | null | undefined;
  /** المضيف / مشرف الإشراف / وكيل الوكالة — يتحكمون بالإيقاف والتشغيل */
  canControl?: boolean;
  roomHostUid: string;
  coHosts?: string[];
  /** ارتفاع تقريبي — يُحسب تلقائياً من العرض (16:9) إن لم يُمرَّر */
  height?: number;
  /** عرض الحاوية — الافتراضي عرض الشاشة ناقص الهوامش */
  width?: number;
  /** حالة كتم الصوت الابتدائية — false عند «احتفظ» لسماع الفيديو */
  defaultMuted?: boolean;
}

const SYNC_INTERVAL_MS = 5000; // كل 5 ثوان يحدّث المتحكّم
const DRIFT_THRESHOLD = 2.5; // ثانية — لو فرق المشاهد > 2.5s يقفز للمكان الصحيح
const VIDEO_DUCKED_VOLUME = 0.2; // صوت الفيديو منخفض حتى تبقى أولوية المايكات

const ASPECT = 16 / 9;
const HORIZONTAL_MARGIN = 32;
/** نسبة عرض المشغّل من الشاشة — أصغر قليلاً لعدم تغطية الروم */
const PLAYER_WIDTH_RATIO = 0.86;

const SIZE_SCALES = [0.5, 0.65, 0.86, 1.0] as const;

export function RoomVideoPlayer({
  roomId,
  video,
  userUid,
  canControl = false,
  roomHostUid,
  coHosts = [],
  height,
  width,
  defaultMuted = true,
}: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const canManageVideo = canControl || Boolean(userUid && video.addedBy === userUid);

  const [localMuted, setLocalMuted] = useState(defaultMuted);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setLocalMuted(defaultMuted);
  }, [defaultMuted, video.url]);

  const [sizeIndex, setSizeIndex] = useState(2);

  const scale = SIZE_SCALES[sizeIndex] ?? 0.86;
  const playerWidth = width ?? Math.round((screenW - HORIZONTAL_MARGIN) * scale);
  const playerHeight = height ?? Math.round(playerWidth / ASPECT);

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const draggingRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        draggingRef.current = false;
        pan.extractOffset();
      },
      onPanResponderMove: (_, g) => {
        draggingRef.current = true;
        pan.setValue({ x: g.dx, y: g.dy });
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        requestAnimationFrame(() => { draggingRef.current = false; });
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
        draggingRef.current = false;
      },
    }),
  ).current;

  const cycleSize = useCallback(() => {
    setSizeIndex((i) => (i + 1) % SIZE_SCALES.length);
  }, []);

  const expoPlayerRef = useRef<any>(null);
  const ytPlayerRef = useRef<any>(null);
  const lastSyncRef = useRef(0);

  // YouTube: حتى عند فتح صوت الفيديو، نبقيه منخفضاً
  useEffect(() => {
    if (video.sourceType !== 'youtube' || !ytPlayerRef.current || localMuted) return;
    ytPlayerRef.current.setVolume?.(Math.round(VIDEO_DUCKED_VOLUME * 100));
  }, [video.sourceType, localMuted]);

  // ========== Sync logic ==========
  // كل 5 ثوان: المتحكّم يكتب currentTime لإبقاء المشاهدين متزامنين
  useEffect(() => {
    if (!canControl) return;
    const interval = setInterval(async () => {
      try {
        if (video.sourceType === 'youtube' && ytPlayerRef.current) {
          const t = await ytPlayerRef.current.getCurrentTime();
          if (typeof t === 'number') {
            await updateVideoPlayback(roomId, { currentTime: t });
          }
        } else if (expoPlayerRef.current?.getStatusAsync) {
          const status = await expoPlayerRef.current.getStatusAsync();
          if (status?.isLoaded) {
            const t = (status.positionMillis ?? 0) / 1000;
            await updateVideoPlayback(roomId, { currentTime: t });
          }
        }
      } catch {
        // ignore
      }
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [canControl, roomId, video.sourceType]);

  // المشاهد: يتزامن مع currentTime + isPlaying عند التغيير
  useEffect(() => {
    if (canControl) return; // المتحكّم لا يحتاج
    const expected = calculateActualTime(video);

    // YouTube — مكتبة youtube-iframe ترمي استثناءً متزامناً إذا حُرِّر الـ WebView
    // الداخلي لحظة الاستدعاء (إغلاق الفيديو/الخروج) → كان يُسقط التطبيق كاملاً
    try {
      if (video.sourceType === 'youtube' && ytPlayerRef.current) {
        ytPlayerRef.current.getCurrentTime().then((current: number) => {
          const yt = ytPlayerRef.current;
          if (yt && Math.abs(current - expected) > DRIFT_THRESHOLD) {
            yt.seekTo(expected, true);
          }
        }).catch(() => {});
      }
      // Expo Video
      else if (expoPlayerRef.current?.getStatusAsync) {
        expoPlayerRef.current.getStatusAsync().then((status: any) => {
          if (!status?.isLoaded) return;
          const current = (status.positionMillis ?? 0) / 1000;
          if (Math.abs(current - expected) > DRIFT_THRESHOLD) {
            expoPlayerRef.current?.setPositionAsync?.(expected * 1000)?.catch?.(() => {});
          }
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('room video sync failed', e);
    }
  }, [video.currentTime, video.isPlaying, video.lastUpdatedAt, canControl]);

  // ========== Handlers ==========
  const handleTogglePlay = useCallback(async () => {
    if (!canManageVideo) return;
    try {
      await updateVideoPlayback(roomId, { isPlaying: !video.isPlaying });
    } catch (e: any) {
      console.warn('toggle play failed', e);
    }
  }, [canManageVideo, roomId, video.isPlaying]);

  const handleClose = useCallback(async () => {
    if (!canManageVideo) return;
    try {
      await removeVideoFromRoom(roomId);
    } catch (e: any) {
      console.warn('close video failed', e);
    }
  }, [canManageVideo, roomId]);

  // ========== Render ==========
  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: playerWidth,
          height: playerHeight,
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.playerWrap}>
        {video.sourceType === 'youtube' ? (
          <YouTubePlayer
            video={video}
            playerRef={ytPlayerRef}
            muted={localMuted}
            canControl={canControl}
            onReady={() => setIsLoading(false)}
            roomId={roomId}
            width={playerWidth}
            height={playerHeight}
          />
        ) : (
          <ExpoVideoPlayer
            video={video}
            playerRef={expoPlayerRef}
            muted={localMuted}
            canControl={canControl}
            onReady={() => setIsLoading(false)}
            roomId={roomId}
          />
        )}

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
      </View>

      {/* Top bar — info + close */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={styles.topBar}
      >
        <View style={styles.topLeft}>
          {video.sourceType === 'youtube' ? (
            <Youtube size={14} color="#FF0000" fill="#FF0000" />
          ) : (
            <Film size={14} color="#fff" />
          )}
          <Text variant="caption" color="#fff" weight="bold" numberOfLines={1} style={{ flex: 1 }}>
            {video.title ?? (video.sourceType === 'youtube' ? 'YouTube' : 'فيديو')}
          </Text>
        </View>

        <View style={styles.topRight}>
          <Pressable
            onPress={() => setLocalMuted((m) => !m)}
            style={styles.iconBtn}
            hitSlop={6}
          >
            {localMuted ? (
              <VolumeX size={14} color="#fff" />
            ) : (
              <Volume2 size={14} color="#fff" />
            )}
          </Pressable>

          <Pressable
            onPress={cycleSize}
            style={styles.iconBtn}
            hitSlop={6}
          >
            {sizeIndex >= SIZE_SCALES.length - 1 ? (
              <Minimize2 size={14} color="#fff" />
            ) : (
              <Maximize2 size={14} color="#fff" />
            )}
          </Pressable>

          {canManageVideo && (
            <Pressable
              onPress={handleClose}
              style={[styles.iconBtn, styles.closeBtn]}
              hitSlop={8}
              accessibilityLabel="إغلاق الفيديو"
            >
              <X size={14} color="#fff" />
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {/* Bottom bar — added by + play/pause + drag handle */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.bottomBar}
      >
        <View style={styles.addedBy}>
          {video.addedByAvatar ? (
            <Image source={{ uri: video.addedByAvatar }} style={styles.addedByAvatar} cachePolicy="memory-disk" recyclingKey={video.addedByAvatar} />
          ) : (
            <View style={[styles.addedByAvatar, { backgroundColor: lu.colors.pink }]} />
          )}
          <Text variant="caption" color="#fff" numberOfLines={1} style={{ flex: 1 }}>
            أضافه: {video.addedByName}
          </Text>
        </View>

        <View style={styles.bottomRight}>
          <View style={styles.dragHandle}>
            <Move size={14} color="rgba(255,255,255,0.6)" />
          </View>

          {canManageVideo ? (
            <Pressable onPress={handleTogglePlay} style={styles.playBtn}>
              {video.isPlaying ? (
                <Pause size={18} color="#fff" fill="#fff" />
              ) : (
                <Play size={18} color="#fff" fill="#fff" />
              )}
            </Pressable>
          ) : (
            <View style={styles.viewerBadge}>
              <Text variant="caption" color="rgba(255,255,255,0.85)" weight="semibold">
                {video.isPlaying ? '▶ يشاهد' : '⏸ متوقف'}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ============================================================
// Expo Video Player (mp4 / HLS)
// ============================================================
function ExpoVideoPlayer({
  video,
  playerRef,
  muted,
  canControl,
  onReady,
  roomId,
}: {
  video: RoomVideo;
  playerRef: React.MutableRefObject<any>;
  muted: boolean;
  canControl: boolean;
  onReady: () => void;
  roomId: string;
}) {
  // dynamic import للحفاظ على عمل المشروع لو ما تثبّت expo-av بعد
  const AVRef = useRef<any>(null);
  const [AV, setAV] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const av = await import('expo-av');
        AVRef.current = av;
        setAV(av);
      } catch (e) {
        console.warn('expo-av not installed', e);
      }
    })();
  }, []);

  if (!AV) {
    return (
      <View style={styles.fallback}>
        <Text variant="caption" color="#9CA3AF">
          مكتبة الفيديو غير مُثبّتة. يُرجى تثبيت expo-av
        </Text>
      </View>
    );
  }

  // حارس مصدر فارغ — source بلا رابط كان يرمي خطأ native على أندرويد
  const sourceUri = (video.url ?? '').trim();
  if (!sourceUri) {
    return (
      <View style={styles.fallback}>
        <Text variant="caption" color="#9CA3AF">
          رابط الفيديو غير صالح
        </Text>
      </View>
    );
  }

  const Video = AV.Video;
  const ResizeMode = AV.ResizeMode;

  return (
    <Video
      ref={(r: any) => {
        playerRef.current = r;
      }}
      source={{ uri: sourceUri }}
      style={StyleSheet.absoluteFill}
      shouldPlay={video.isPlaying}
      isMuted={muted}
      volume={muted ? 0 : VIDEO_DUCKED_VOLUME}
      resizeMode={ResizeMode.CONTAIN}
      useNativeControls={false}
      // قراءة الموضع تتم بـgetStatusAsync كل 5ث لا بالأحداث — الافتراضي 500ms
      // كان يبثّ أحداثاً لا أحد يستهلكها أثناء تشغيل فيديو المشاهدة المشتركة
      progressUpdateIntervalMillis={10000}
      onLoad={(status: any) => {
        onReady();
        // إذا متحكّم وما عنده duration → احفظها
        if (canControl && status?.durationMillis) {
          updateVideoPlayback(roomId, {
            duration: status.durationMillis / 1000,
          }).catch(() => {});
        }
        // اضبط الموقع حسب آخر تزامن
        const expected = calculateActualTime(video);
        if (expected > 0 && playerRef.current?.setPositionAsync) {
          playerRef.current.setPositionAsync(expected * 1000).catch(() => {});
        }
      }}
      onError={(err: any) => {
        console.warn('Video error', err);
      }}
    />
  );
}

// ============================================================
// YouTube Player
// ============================================================
function YouTubePlayer({
  video,
  playerRef,
  muted,
  canControl,
  onReady,
  roomId,
  width,
  height,
}: {
  video: RoomVideo;
  playerRef: React.MutableRefObject<any>;
  muted: boolean;
  canControl: boolean;
  onReady: () => void;
  roomId: string;
  width: number;
  height: number;
}) {
  const [YT, setYT] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const yt = await import('react-native-youtube-iframe');
        setYT(yt);
      } catch (e) {
        console.warn('react-native-youtube-iframe not installed', e);
      }
    })();
  }, []);

  if (!YT || !video.youtubeId) {
    return (
      <View style={styles.fallback}>
        <Text variant="caption" color="#9CA3AF">
          {!YT ? 'مكتبة YouTube غير مُثبّتة' : 'معرّف YouTube غير صالح'}
        </Text>
      </View>
    );
  }

  const YouTubeIframe = YT.default ?? YT;

  return (
    <View style={{ width, height, backgroundColor: '#000', overflow: 'hidden' }}>
      <YouTubeIframe
        ref={playerRef}
        videoId={video.youtubeId}
        play={video.isPlaying}
        mute={muted}
        height={height}
        width={width}
        webViewStyle={{ backgroundColor: '#000' }}
        webViewProps={{
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
          scrollEnabled: false,
        }}
        initialPlayerParams={{
          controls: 0,
          modestbranding: true,
          rel: false,
          loop: false,
          preventFullScreen: true,
          iv_load_policy: 3,
        }}
      onReady={() => {
        onReady();
        // seekTo/getDuration يرميان استثناءً متزامناً لو حُرِّر الـ WebView — لا نُسقط التطبيق
        try {
          // اضبط الموقع
          const expected = calculateActualTime(video);
          if (expected > 0 && playerRef.current?.seekTo) {
            playerRef.current.seekTo(expected, true);
          }
          // اقرأ duration
          if (canControl && playerRef.current?.getDuration) {
            playerRef.current.getDuration().then((d: number) => {
              if (d && d > 0) {
                updateVideoPlayback(roomId, { duration: d }).catch(() => {});
              }
            }).catch(() => {});
          }
        } catch (e) {
          console.warn('YT onReady sync failed', e);
        }
      }}
      onChangeState={(state: string) => {
        // YouTube states: 'unstarted' | 'ended' | 'playing' | 'paused' | 'buffering' | 'video cued'
        if (state === 'ended' && canControl) {
          updateVideoPlayback(roomId, { isPlaying: false, currentTime: 0 }).catch(() => {});
        }
      }}
      onError={(e: any) => console.warn('YT error', e)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    backgroundColor: '#000',
    borderRadius: radius.lg,
    overflow: 'hidden',
    zIndex: 50,
    ...shadows.lg,
    elevation: 50,
  },
  playerWrap: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#1F2937',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topRight: {
    flexDirection: 'row',
    gap: 6,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  addedBy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addedByAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  closeBtn: {
    backgroundColor: 'rgba(239,68,68,0.85)',
  },
  viewerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: lu.colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dragHandle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
