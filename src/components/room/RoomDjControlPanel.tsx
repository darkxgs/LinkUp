/**
 * RoomDjControlPanel — لوحة DJ مع التحكم بالصوت والتشغيل
 */
import React, { useCallback, useEffect, useRef } from 'react';
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
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import type { RoomMusic } from '@/services/roomMusic';
import { useRoomMusicUiStore } from '@/stores/roomMusicUiStore';
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

type VolumeSliderProps = {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
};

function VolumeSlider({ value, onChange, disabled }: VolumeSliderProps) {
  const step = 0.05;
  const progress = Math.round(value * 100);

  const dec = () => onChange(Math.max(0, Math.round((value - step) * 20) / 20));
  const inc = () => onChange(Math.min(1, Math.round((value + step) * 20) / 20));

  return (
    <View style={volStyles.wrap}>
      <Pressable onPress={dec} disabled={disabled} style={volStyles.btn}>
        <Minus size={14} color="#fff" strokeWidth={2.5} />
      </Pressable>
      <View style={volStyles.track}>
        <View style={[volStyles.fill, { width: `${progress}%` }]} />
        <View style={[volStyles.thumb, { left: `${progress}%` }]} />
      </View>
      <Pressable onPress={inc} disabled={disabled} style={volStyles.btn}>
        <Plus size={14} color="#fff" strokeWidth={2.5} />
      </Pressable>
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
    gap: 8,
    marginTop: 10,
  },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'visible',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
    backgroundColor: lu.colors.pink,
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: lu.colors.pink,
    top: -4,
  },
  pct: {
    width: 36,
    textAlign: 'center',
    fontSize: 11,
  },
});

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

  const volumeValue = playback.isController
    ? playback.broadcastVolume
    : localListenerVolume;

  const handleVolumeChange = useCallback(
    (v: number) => {
      if (playback.isController) {
        playback.setBroadcastVolume(v);
        return;
      }
      setLocalListenerVolume(v);
    },
    [playback, setLocalListenerVolume],
  );

  const volumeLabel = playback.isController
    ? t('room.musicDjVolume')
    : t('room.musicListenerVolume');

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

          <View style={styles.volumeRow}>
            {volumeValue < 0.05 ? (
              <VolumeX size={16} color="rgba(255,255,255,0.6)" />
            ) : (
              <Volume2 size={16} color="rgba(255,255,255,0.85)" />
            )}
            <Text variant="caption" color="rgba(255,255,255,0.65)" style={styles.volumeLabel}>
              {volumeLabel}
            </Text>
          </View>
          <VolumeSlider value={volumeValue} onChange={handleVolumeChange} />

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
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  volumeLabel: { fontSize: 11 },
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
