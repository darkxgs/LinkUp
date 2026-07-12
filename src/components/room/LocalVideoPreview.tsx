/**
 * LocalVideoPreview — مشغّل معاينة محلي بحت داخل نافذة موافقة الفيديو
 *
 * مستخلص من مشغّلي RoomVideoPlayer (ExpoVideoPlayer / YouTubePlayer) بوضع
 * معاينة صارم: بلا canControl، بلا أي قراءة/كتابة RTDB، بلا updateVideoPlayback
 * أو calculateActualTime — التشغيل/الإيقاف/التقديم كله محلي على جهاز المراجع فقط
 * ولا يصل شيء منه لبقية الغرفة.
 *
 * الصوت مسموع افتراضياً (جوهر المعاينة تقييم المحتوى قبل الموافقة) مع زر كتم،
 * ويُهيّأ عبر configureSoundEffectsAudio (MixWithOthers) قبل التحميل — نفس نمط
 * playRoomSound — حتى لا يُقتل مايك LiveKit للمراجع أثناء سماع المعاينة.
 * التفريغ حتمي عند unmount — صفر تسريب صوت بعد إغلاق النافذة أو اتخاذ القرار.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Volume2, VolumeX, ShieldAlert } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { configureSoundEffectsAudio } from '@/utils/playRoomSound';
import { lu } from '@/theme/lu-brand';

interface Props {
  url: string;
  sourceType: 'youtube' | 'mp4' | 'hls';
  youtubeId?: string;
  /** صورة الغلاف — تُعرض أثناء التحميل وخلف رسالة الفشل */
  posterUri?: string;
}

/** تنسيق مدة مقروء mm:ss */
function formatTime(sec: number): string {
  const safe = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function LocalVideoPreview({ url, sourceType, youtubeId, posterUri }: Props) {
  const { t } = useTranslation();

  // مدخلات غير قابلة للتشغيل أصلاً — فشل فوري بلا محاولة تحميل
  const [failed, setFailed] = useState(
    () => !url.trim() || (sourceType === 'youtube' && !youtubeId),
  );
  const [audioReady, setAudioReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(true);
  // الصوت مسموع افتراضياً — المعاينة لتقييم المحتوى لا للصورة فقط
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const expoRef = useRef<any>(null);
  const ytRef = useRef<any>(null);
  const durationRef = useRef(0);
  durationRef.current = duration;
  const seekBarWidthRef = useRef(1);

  // تهيئة وضع الصوت (MixWithOthers) قبل تحميل المشغّل — نفس نمط playRoomSound
  useEffect(() => {
    let cancelled = false;
    configureSoundEffectsAudio(true)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAudioReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // unload حتمي عند unmount — لا يبقى صوت معاينة بعد إغلاق النافذة
  useEffect(() => {
    return () => {
      const player = expoRef.current;
      expoRef.current = null;
      if (player) {
        try {
          player.stopAsync?.()?.catch?.(() => {});
        } catch {
          // ignore
        }
        try {
          player.unloadAsync?.()?.catch?.(() => {});
        } catch {
          // ignore
        }
      }
      // WebView يوتيوب يموت مع unmount المكوّن نفسه — نكتفي بإسقاط المرجع
      ytRef.current = null;
    };
  }, []);

  // مزامنة شريط التقدم من يوتيوب — قراءة محلية بحتة (لا RTDB)
  useEffect(() => {
    if (sourceType !== 'youtube' || failed) return;
    const interval = setInterval(() => {
      const yt = ytRef.current;
      if (!yt) return;
      // youtube-iframe يرمي استثناءً متزامناً لو حُرِّر الـ WebView لحظة الاستدعاء
      try {
        yt.getCurrentTime?.()
          .then((current: number) => {
            if (typeof current === 'number' && ytRef.current) setPosition(current);
          })
          .catch(() => {});
      } catch {
        // ignore
      }
    }, 500);
    return () => clearInterval(interval);
  }, [sourceType, failed]);

  // ========== Seek محلي ==========
  const seekToRatio = useCallback(
    (ratio: number) => {
      const d = durationRef.current;
      if (!d || d <= 0) return;
      const target = Math.min(Math.max(ratio, 0), 1) * d;
      setPosition(target);
      if (sourceType === 'youtube') {
        try {
          ytRef.current?.seekTo?.(target, true);
        } catch {
          // ignore
        }
      } else {
        expoRef.current?.setPositionAsync?.(target * 1000)?.catch?.(() => {});
      }
    },
    [sourceType],
  );
  const seekToRatioRef = useRef(seekToRatio);
  seekToRatioRef.current = seekToRatio;

  const seekResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) =>
        seekToRatioRef.current(e.nativeEvent.locationX / seekBarWidthRef.current),
      onPanResponderMove: (e) =>
        seekToRatioRef.current(e.nativeEvent.locationX / seekBarWidthRef.current),
    }),
  ).current;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: Math.round(width), h: Math.round(height) });
  }, []);

  const handleError = useCallback(() => {
    setLoading(false);
    setFailed(true);
  }, []);

  const handleExpoStatus = useCallback((status: any) => {
    if (!status?.isLoaded) return;
    setPosition((status.positionMillis ?? 0) / 1000);
    if (status.durationMillis) setDuration(status.durationMillis / 1000);
    if (status.didJustFinish) setPlaying(false);
  }, []);

  // ========== فشل التحميل ==========
  if (failed) {
    const insecureHttp = url.trim().toLowerCase().startsWith('http://');
    return (
      <View style={styles.root}>
        {posterUri ? (
          <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : null}
        <View style={styles.failOverlay}>
          <ShieldAlert size={28} color="#fff" strokeWidth={1.8} />
          <Text variant="caption" color="#fff" align="center" style={styles.failText}>
            {insecureHttp
              ? t('room.videoPreviewFailedInsecure')
              : t('room.videoPreviewFailed')}
          </Text>
        </View>
      </View>
    );
  }

  const progressPct = duration > 0 ? Math.min((position / duration) * 100, 100) : 0;

  return (
    <View style={styles.root} onLayout={handleLayout}>
      {/* لا تحميل قبل تهيئة وضع الصوت ومعرفة أبعاد الحاوية */}
      {audioReady && box.w > 0 ? (
        sourceType === 'youtube' ? (
          <YouTubePreviewPlayer
            youtubeId={youtubeId!}
            playing={playing}
            muted={muted}
            playerRef={ytRef}
            width={box.w}
            height={box.h}
            onReady={(d) => {
              setLoading(false);
              if (d > 0) setDuration(d);
            }}
            onEnded={() => setPlaying(false)}
            onError={handleError}
          />
        ) : (
          <ExpoPreviewPlayer
            url={url}
            playing={playing}
            muted={muted}
            playerRef={expoRef}
            onLoad={() => setLoading(false)}
            onStatus={handleExpoStatus}
            onError={handleError}
          />
        )
      ) : null}

      {loading && (
        <View style={styles.loadingOverlay}>
          {posterUri ? (
            <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : null}
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {/* ضوابط مصغّرة — play/pause + شريط seek + مدة + كتم، كلها محلية */}
      <View style={styles.controls}>
        <Pressable onPress={() => setPlaying((p) => !p)} style={styles.ctrlBtn} hitSlop={6}>
          {playing ? (
            <Pause size={14} color="#fff" fill="#fff" />
          ) : (
            <Play size={14} color="#fff" fill="#fff" />
          )}
        </Pressable>

        <Text variant="caption" color="#fff" style={styles.timeText}>
          {formatTime(position)}
        </Text>

        <View
          style={styles.seekBar}
          onLayout={(e) => {
            seekBarWidthRef.current = Math.max(e.nativeEvent.layout.width, 1);
          }}
          {...seekResponder.panHandlers}
        >
          <View style={styles.seekTrack} />
          <View style={[styles.seekFill, { width: `${progressPct}%` }]} />
        </View>

        <Text variant="caption" color="#fff" style={styles.timeText}>
          {formatTime(duration)}
        </Text>

        <Pressable onPress={() => setMuted((m) => !m)} style={styles.ctrlBtn} hitSlop={6}>
          {muted ? <VolumeX size={14} color="#fff" /> : <Volume2 size={14} color="#fff" />}
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================
// Expo Video (mp4 / HLS) — نسخة معاينة بلا أي تزامن
// ============================================================
function ExpoPreviewPlayer({
  url,
  playing,
  muted,
  playerRef,
  onLoad,
  onStatus,
  onError,
}: {
  url: string;
  playing: boolean;
  muted: boolean;
  playerRef: React.MutableRefObject<any>;
  onLoad: () => void;
  onStatus: (status: any) => void;
  onError: () => void;
}) {
  // dynamic import للحفاظ على عمل المشروع لو ما تثبّت expo-av بعد
  const [AV, setAV] = useState<any>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const av = await import('expo-av');
        if (alive) setAV(av);
      } catch (e) {
        console.warn('expo-av not installed', e);
        if (alive) onErrorRef.current();
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!AV) return null; // مؤشر التحميل العام يغطي هذه الفترة

  const Video = AV.Video;
  const ResizeMode = AV.ResizeMode;

  return (
    <Video
      ref={(r: any) => {
        playerRef.current = r;
      }}
      source={{ uri: url.trim() }}
      style={StyleSheet.absoluteFill}
      shouldPlay={playing}
      isMuted={muted}
      volume={muted ? 0 : 1}
      resizeMode={ResizeMode.CONTAIN}
      useNativeControls={false}
      progressUpdateIntervalMillis={500}
      onLoad={() => onLoad()}
      onPlaybackStatusUpdate={(status: any) => onStatus(status)}
      onError={() => onError()}
    />
  );
}

// ============================================================
// YouTube — نسخة معاينة بلا أي تزامن
// ============================================================
function YouTubePreviewPlayer({
  youtubeId,
  playing,
  muted,
  playerRef,
  width,
  height,
  onReady,
  onEnded,
  onError,
}: {
  youtubeId: string;
  playing: boolean;
  muted: boolean;
  playerRef: React.MutableRefObject<any>;
  width: number;
  height: number;
  onReady: (duration: number) => void;
  onEnded: () => void;
  onError: () => void;
}) {
  const [YT, setYT] = useState<any>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const yt = await import('react-native-youtube-iframe');
        if (alive) setYT(yt);
      } catch (e) {
        console.warn('react-native-youtube-iframe not installed', e);
        if (alive) onErrorRef.current();
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!YT) return null;

  const YouTubeIframe = YT.default ?? YT;

  return (
    <View style={{ width, height, backgroundColor: '#000', overflow: 'hidden' }}>
      <YouTubeIframe
        ref={playerRef}
        videoId={youtubeId}
        play={playing}
        mute={muted}
        volume={100}
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
          // getDuration يرمي استثناءً متزامناً لو حُرِّر الـ WebView — لا نُسقط التطبيق
          try {
            const p = playerRef.current;
            if (p?.getDuration) {
              p.getDuration()
                .then((d: number) => onReady(typeof d === 'number' ? d : 0))
                .catch(() => onReady(0));
              return;
            }
          } catch {
            // ignore
          }
          onReady(0);
        }}
        onChangeState={(state: string) => {
          if (state === 'ended') onEnded();
        }}
        onError={() => onError()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  failOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    padding: 16,
    gap: 8,
  },
  failText: {
    lineHeight: 18,
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  ctrlBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 10,
    minWidth: 32,
    textAlign: 'center',
  },
  seekBar: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  seekTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  seekFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: lu.colors.pink,
  },
});
