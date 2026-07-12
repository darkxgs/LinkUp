/**
 * RoomDjControlPanel — لوحة DJ مع التحكم بالصوت والتشغيل
 *
 * الصوت عبر خلط Agora على جهاز الـDJ: قناتان مستقلتان («صوت الجمهور» =
 * adjustAudioMixingPublishVolume، «سماعي أنا» = playout المحلي) — معاً
 * افتراضياً مع إمكانية الفصل؛ وعند المستمع خافض «صوت الـDJ» المحلي
 * (يخفض كلامه وموسيقاه معاً — ستريم واحد).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Play,
  Pause,
  X,
  Music2,
  Radio,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Link2,
  Link2Off,
  MicOff,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import type { RoomMusic } from '@/services/roomMusic';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';
import { roomAudioSession } from '@/services/roomAudioSession';
import { MusicVolumeSlider } from './MusicVolumeSlider';
import { lu } from '@/theme/lu-brand';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

type PlaybackApi = {
  isController: boolean;
  localPlaying: boolean;
  position: number;
  duration: number;
  ready: boolean;
  togglePlay: () => void | Promise<void>;
  broadcastVolume: number;
  effectiveVolume: number;
  setBroadcastVolume: (v: number) => void;
  stopBroadcast: () => void | Promise<void>;
};

type Props = {
  roomId: string;
  music: RoomMusic;
  playback: PlaybackApi;
};

export function RoomDjControlPanel({ music, playback }: Props) {
  const { t } = useTranslation();
  const expanded = useRoomMusicUiStore((s) => s.djPanelExpanded);
  const toggleDjPanel = useRoomMusicUiStore((s) => s.toggleDjPanel);
  const localListenerVolume = useRoomMusicUiStore((s) => s.localListenerVolume);
  const setLocalListenerVolume = useRoomMusicUiStore((s) => s.setLocalListenerVolume);
  const djPlayoutVolume = useRoomMusicUiStore((s) => s.djPlayoutVolume);
  const setDjPlayoutVolume = useRoomMusicUiStore((s) => s.setDjPlayoutVolume);
  const volumesLinked = useRoomMusicUiStore((s) => s.djVolumesLinked);
  const setVolumesLinked = useRoomMusicUiStore((s) => s.setDjVolumesLinked);

  // مايك جلسة الصوت — لمؤشر «مايكك مكتوم والموسيقى مستمرة»
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

  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!playback.localPlaying) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [playback.localPlaying, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progress =
    playback.duration > 0 ? Math.min(playback.position / playback.duration, 1) : 0;

  const handleToggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggleDjPanel();
  }, [toggleDjPanel]);

  // القناتان معاً (افتراضي): شريط واحد يضبط صوت الجمهور وسماعي أنا معاً
  const handleLinkedVolumeChange = useCallback(
    (v: number) => {
      playback.setBroadcastVolume(v);
      setDjPlayoutVolume(v);
    },
    [playback, setDjPlayoutVolume],
  );

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(225, 20, 20, 0.42)', 'rgba(46, 11, 11, 0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Pressable onPress={handleToggleExpand} style={styles.headerRow}>
        <View style={styles.discWrap}>
          <Animated.View style={[styles.vinyl, { transform: [{ rotate }] }]}>
            <LinearGradient
              colors={['#1a1a1a', '#2d2d2d', '#111']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.vinylGroove} />
            <View style={styles.vinylGrooveInner} />
            {music.addedByAvatar ? (
              <Image
                source={{ uri: music.addedByAvatar }}
                style={styles.vinylLabel}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.vinylLabel, styles.vinylLabelFallback]}>
                <Music2 size={14} color="#fff" />
              </View>
            )}
          </Animated.View>
          <View style={styles.liveBadge}>
            <Radio size={9} color="#fff" strokeWidth={3} />
          </View>
        </View>

        <View style={styles.meta}>
          <View style={styles.djPill}>
            <Text variant="caption" color="#fff" weight="bold" style={styles.djPillText}>
              DJ
            </Text>
          </View>
          <Text variant="body" weight="bold" color="#fff" numberOfLines={1}>
            {music.title}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.55)" numberOfLines={1}>
            {music.addedByName}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {playback.isController ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                void playback.togglePlay();
              }}
              style={styles.miniCtrl}
            >
              {playback.localPlaying ? (
                <Pause size={18} color="#fff" fill="#fff" />
              ) : (
                <Play size={18} color="#fff" fill="#fff" />
              )}
            </Pressable>
          ) : null}
          {expanded ? (
            <ChevronUp size={18} color="rgba(255,255,255,0.7)" />
          ) : (
            <ChevronDown size={18} color="rgba(255,255,255,0.7)" />
          )}
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text variant="caption" color="rgba(255,255,255,0.45)" style={styles.time}>
            {formatTime(playback.position)}
            {playback.duration > 0 ? ` / ${formatTime(playback.duration)}` : ''}
          </Text>

          {playback.isController && micMuted && playback.localPlaying ? (
            <View style={styles.micMutedPill}>
              <MicOff size={12} color="#FFD54F" />
              <Text variant="caption" color="#FFD54F" style={styles.micMutedText}>
                {t('room.musicMicMutedMusicOn')}
              </Text>
            </View>
          ) : null}

          {playback.isController ? (
            <View style={styles.volumeArea}>
              <Pressable
                onPress={() => setVolumesLinked(!volumesLinked)}
                style={styles.linkToggle}
                hitSlop={8}
              >
                {volumesLinked ? (
                  <Link2 size={14} color="rgba(255,255,255,0.75)" />
                ) : (
                  <Link2Off size={14} color="rgba(255,255,255,0.75)" />
                )}
                <Text variant="caption" color="rgba(255,255,255,0.6)" style={styles.linkLabel}>
                  {volumesLinked ? t('room.musicUnlinkVolumes') : t('room.musicLinkVolumes')}
                </Text>
              </Pressable>
              {volumesLinked ? (
                <MusicVolumeSlider
                  value={playback.broadcastVolume}
                  onChange={handleLinkedVolumeChange}
                  label={t('room.musicDjVolume')}
                  fillColor={lu.colors.pink}
                />
              ) : (
                <>
                  <MusicVolumeSlider
                    value={playback.broadcastVolume}
                    onChange={playback.setBroadcastVolume}
                    label={t('room.musicAudienceVolume')}
                    fillColor={lu.colors.pink}
                  />
                  <MusicVolumeSlider
                    value={djPlayoutVolume}
                    onChange={setDjPlayoutVolume}
                    label={t('room.musicMyMonitorVolume')}
                    fillColor={lu.colors.pink}
                  />
                </>
              )}
            </View>
          ) : (
            <View style={styles.volumeArea}>
              <MusicVolumeSlider
                value={localListenerVolume}
                onChange={setLocalListenerVolume}
                label={t('room.musicDjPlaybackVolume')}
                hint={t('room.musicDjVolumeHint')}
                fillColor={lu.colors.pink}
              />
            </View>
          )}

          <View style={styles.footerRow}>
            {playback.isController ? (
              <>
                <Pressable onPress={() => void playback.togglePlay()} style={styles.mainCtrl}>
                  {playback.localPlaying ? (
                    <Pause size={24} color="#fff" fill="#fff" />
                  ) : (
                    <Play size={24} color="#fff" fill="#fff" />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => void playback.stopBroadcast()}
                  style={[styles.mainCtrl, styles.stopCtrl]}
                >
                  <X size={20} color="#fff" strokeWidth={2.5} />
                  <Text variant="caption" color="#fff" weight="semibold">
                    {t('room.musicStopBroadcast')}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => void playback.stopBroadcast()}
                style={[styles.mainCtrl, styles.stopCtrl]}
              >
                <VolumeX size={18} color="#fff" />
                <Text variant="caption" color="#fff" weight="semibold">
                  {t('room.musicStopListening')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 6,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.4)',
    zIndex: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  discWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinyl: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  vinylGroove: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  vinylGrooveInner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  vinylLabel: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  vinylLabelFallback: {
    backgroundColor: lu.colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: lu.colors.live,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1A0A0C',
  },
  meta: { flex: 1, minWidth: 0, gap: 2 },
  djPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(225, 20, 20, 0.55)',
    marginBottom: 2,
  },
  djPillText: {
    fontSize: 10,
    letterSpacing: 1.2,
  },
  headerActions: {
    alignItems: 'center',
    gap: 8,
  },
  miniCtrl: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 0,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: lu.colors.pink,
    borderRadius: 2,
  },
  time: { marginTop: 6, fontSize: 10 },
  micMutedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
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
  linkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginBottom: 2,
  },
  linkLabel: { fontSize: 10 },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  mainCtrl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  stopCtrl: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 46, 98, 0.45)',
  },
});
