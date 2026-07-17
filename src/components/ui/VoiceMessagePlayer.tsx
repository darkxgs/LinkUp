/**
 * VoiceMessagePlayer — مشغّل رسالة صوتية في فقاعة الشات
 *  - زر play/pause
 *  - شريط تقدّم + مدّة
 *  - موجة صوتية مزخرفة
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Play, Pause } from 'lucide-react-native';

import { Text } from './Text';
import { lu } from '@/theme/lu-brand';

// يضمن تشغيل رسالة صوتية واحدة فقط (يمنع التداخل/«التكرار»)
let stopActiveVoice: (() => void) | null = null;
let unloadActiveVoice: (() => void) | null = null;

/** إيقاف أي صوت يعمل (مثلاً عند مغادرة شاشة التعديل) */
export function stopVoicePlayback() {
  unloadActiveVoice?.();
  unloadActiveVoice = null;
  stopActiveVoice = null;
}

export type VoicePlayerVariant = 'chat' | 'profile';

interface Props {
  voiceUrl: string;
  duration: number; // بالثواني
  /** لون الفقاعة (مرسلة = وردي / مستلمة = رمادي) — للشات فقط */
  isMine?: boolean;
  /** profile = خلفية فاتحة (أيقونات وردية)، chat = فقاعات الشات */
  variant?: VoicePlayerVariant;
  /** نسخة مضغوطة لشريط الغلاف في البروفايل */
  compact?: boolean;
}

// أعمدة الموجة الصوتية المزخرفة (نمط ثابت جميل)
const WAVE_BARS = [
  0.3, 0.6, 0.4, 0.8, 0.5, 1.0, 0.7, 0.4, 0.9, 0.5,
  0.6, 0.3, 0.7, 0.5, 0.8, 0.4, 0.6, 0.9, 0.5, 0.3,
];

const COMPACT_WAVE = WAVE_BARS.slice(0, 10);

export function VoiceMessagePlayer({
  voiceUrl,
  duration,
  isMine,
  variant = 'chat',
  compact,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0); // 0..1
  const soundRef = useRef<any>(null);
  const AVRef = useRef<any>(null);

  const unloadSelf = useCallback(() => {
    const sound = soundRef.current;
    soundRef.current = null;
    if (sound) {
      sound.stopAsync?.().catch(() => {});
      sound.unloadAsync?.().catch(() => {});
    }
    setIsPlaying(false);
    setPosition(0);
  }, []);

  // إيقاف مؤقت — يُستدعى عند تشغيل صوت آخر
  const pauseSelf = useCallback(() => {
    soundRef.current?.pauseAsync?.().catch(() => {});
    setIsPlaying(false);
  }, []);

  const registerActive = useCallback(() => {
    stopActiveVoice = pauseSelf;
    unloadActiveVoice = unloadSelf;
  }, [pauseSelf, unloadSelf]);

  const clearActive = useCallback(() => {
    if (stopActiveVoice === pauseSelf) stopActiveVoice = null;
    if (unloadActiveVoice === unloadSelf) unloadActiveVoice = null;
  }, [pauseSelf, unloadSelf]);

  useEffect(() => {
    (async () => {
      try {
        AVRef.current = await import('expo-av');
      } catch {}
    })();
    return () => {
      clearActive();
      unloadSelf();
    };
  }, [clearActive, unloadSelf]);

  const togglePlay = async () => {
    const AV = AVRef.current;
    if (!AV) return;

    try {
      // لو مُحمّل بالفعل
      if (soundRef.current) {
        if (isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
          clearActive();
        } else {
          if (unloadActiveVoice && unloadActiveVoice !== unloadSelf) unloadActiveVoice();
          registerActive();
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
        return;
      }

      // تحميل الصوت — أوقف أي صوت آخر يعمل أولاً
      setLoading(true);
      await AV.Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      if (unloadActiveVoice && unloadActiveVoice !== unloadSelf) unloadActiveVoice();
      const { sound } = await AV.Audio.Sound.createAsync(
        { uri: voiceUrl },
        { shouldPlay: true, isLooping: false, progressUpdateIntervalMillis: 120 },
      );
      soundRef.current = sound;
      registerActive();
      setLoading(false);
      setIsPlaying(true);

      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (!status.isLoaded) return;
        if (status.durationMillis) {
          setPosition(status.positionMillis / status.durationMillis);
        }
        if (status.didJustFinish) {
          setIsPlaying(false);
          setPosition(0);
          // فرّغ المشغّل بدل إبقائه محمّلاً — إعادة التشغيل تُنشئه من جديد،
          // فلا يبقى MediaPlayer مقيم لكل آخر رسالة صوتية شغّلها المستخدم
          sound.unloadAsync().catch(() => {});
          if (soundRef.current === sound) soundRef.current = null;
          clearActive();
        }
      });
    } catch (e) {
      console.warn('voice play failed', e);
      setLoading(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const onLightBg = variant === 'profile' || !isMine;
  const tint = onLightBg ? lu.colors.pink : '#fff';
  const waveInactive = onLightBg ? 'rgba(225,20,20,0.2)' : 'rgba(255,255,255,0.35)';
  const playBtnBg = onLightBg ? '#FFE6E9' : 'rgba(255,255,255,0.25)';
  const timeColor = onLightBg ? '#6B7280' : 'rgba(255,255,255,0.9)';

  const bars = compact ? COMPACT_WAVE : WAVE_BARS;
  const iconSize = compact ? 14 : 18;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Pressable
        onPress={togglePlay}
        style={[
          styles.playBtn,
          compact && styles.playBtnCompact,
          { backgroundColor: playBtnBg },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={tint} />
        ) : isPlaying ? (
          <Pause size={iconSize} color={tint} fill={tint} />
        ) : (
          <Play size={iconSize} color={tint} fill={tint} />
        )}
      </Pressable>

      <View style={[styles.wave, compact && styles.waveCompact]}>
        {bars.map((h, i) => {
          const active = i / bars.length <= position;
          return (
            <View
              key={i}
              style={[
                styles.waveBar,
                compact && styles.waveBarCompact,
                {
                  height: compact ? 3 + h * 12 : 4 + h * 18,
                  backgroundColor: active ? tint : waveInactive,
                },
              ]}
            />
          );
        })}
      </View>

      <Text
        variant="caption"
        color={timeColor}
        weight="bold"
        style={compact ? styles.timeCompact : undefined}
      >
        {formatTime(duration)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 180,
    paddingVertical: 2,
  },
  containerCompact: {
    minWidth: 0,
    flexShrink: 1,
    flex: 1,
    gap: 6,
    maxWidth: 140,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  wave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 24,
  },
  waveCompact: {
    height: 18,
    gap: 1,
  },
  waveBar: {
    flex: 1,
    borderRadius: 2,
    maxWidth: 3,
  },
  waveBarCompact: {
    maxWidth: 2,
  },
  timeCompact: {
    fontSize: 10,
    minWidth: 28,
  },
});
