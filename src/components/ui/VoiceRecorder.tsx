/**
 * VoiceRecorder — تسجيل صوتي بضغط مطوّل
 *
 * - fab: زر دائري — اضغط واستمر للتسجيل
 * - bar: شريط كامل (يُفعَّل تلقائياً أثناء التسجيل)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trash2 } from 'lucide-react-native';

import { Text } from './Text';
import { useAlert } from './CustomAlert';
import { configureSoundEffectsAudio, isRoomVoiceSessionActive } from '@/utils/playRoomSound';
import { lu } from '@/theme/lu-brand';
import { LuMicIcon, LuSendIcon } from '@/components/icons/LuDesignIcons';
import { TAB_DESIGN } from '@/components/navigation/TabBarNavigationSvg';

interface Props {
  onRecorded: (uri: string, durationSec: number) => void;
  onRecordingChange?: (recording: boolean) => void;
  color?: string;
  variant?: 'fab' | 'bar';
}

async function loadAudioModule() {
  return import('expo-av');
}

export function VoiceRecorder({
  onRecorded,
  onRecordingChange,
  color = lu.colors.pink,
  variant = 'fab',
}: Props) {
  const { showAlert } = useAlert();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  const recordingRef = useRef<any>(null);
  const AVRef = useRef<Awaited<ReturnType<typeof loadAudioModule>> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const isRecordingRef = useRef(false);
  const startingRef = useRef(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const setRecordingState = useCallback(
    (active: boolean) => {
      isRecordingRef.current = active;
      setIsRecording(active);
      onRecordingChange?.(active);
    },
    [onRecordingChange],
  );

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  useEffect(() => {
    loadAudioModule()
      .then((AV) => {
        AVRef.current = AV;
      })
      .catch((e) => {
        console.warn('expo-av not available', e);
      });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const recording = recordingRef.current;
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      if (AVRef.current) {
        // أثناء جلسة صوت الغرفة لا نطفئ التسجيل — allowsRecordingIOS: false
        // يقلب فئة AVAudioSession فيقتل مايك LiveKit لمن هو على المقعد
        // (المسجّل يظهر داخل شات الروم المدمج)
        if (isRoomVoiceSessionActive()) {
          configureSoundEffectsAudio(true).catch(() => {});
        } else {
          AVRef.current.Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
        }
      }
    };
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    if (isRecordingRef.current || startingRef.current) return;
    startingRef.current = true;

    setRecordingState(true);
    setCancelling(false);
    setDuration(0);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setDuration(elapsed);
      if (elapsed >= 120) {
        void stopRecording(false);
      }
    }, 200);

    try {
      const AV = AVRef.current ?? (await loadAudioModule());
      AVRef.current = AV;

      const perm = await AV.Audio.requestPermissionsAsync();
      if (!perm.granted) {
        showAlert({
          type: 'warning',
          title: 'الإذن مطلوب',
          message: 'يجب السماح باستخدام المايكروفون',
        });
        throw new Error('PERMISSION_DENIED');
      }

      await AV.Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await AV.Audio.Recording.createAsync(
        AV.Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
    } catch (e: any) {
      console.warn('startRecording failed', e);
      clearTimer();
      setRecordingState(false);
      recordingRef.current = null;
      if (e?.message !== 'PERMISSION_DENIED') {
        showAlert({ type: 'error', title: 'فشل', message: 'فشل بدء التسجيل' });
      }
    } finally {
      startingRef.current = false;
    }
  };

  const stopRecording = async (cancel: boolean) => {
    clearTimer();

    const recording = recordingRef.current;
    const wasStarting = startingRef.current;

    if (!recording && !wasStarting && !isRecordingRef.current) {
      setRecordingState(false);
      return;
    }

    const finalDuration = Math.max(
      0,
      Math.floor((Date.now() - startTimeRef.current) / 1000),
    );

    setRecordingState(false);
    setCancelling(false);
    recordingRef.current = null;

    if (!recording) {
      return;
    }

    try {
      await recording.stopAndUnloadAsync();
      const AV = AVRef.current;
      if (AV) {
        // نفس حماية جلسة الغرفة أعلاه — لا نقلب فئة الصوت والمايك على المقعد
        if (isRoomVoiceSessionActive()) {
          await configureSoundEffectsAudio(true).catch(() => {});
        } else {
          await AV.Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        }
      }
      const uri = recording.getURI();

      if (cancel || finalDuration < 1) {
        if (!cancel && finalDuration < 1) {
          showAlert({
            type: 'warning',
            title: 'تسجيل قصير',
            message: 'سجّل ثانية واحدة على الأقل ثم اضغط إرسال',
          });
        }
        return;
      }

      if (uri) {
        onRecorded(uri, finalDuration);
      }
    } catch (e) {
      console.warn('stopRecording failed', e);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (variant === 'bar' && !isRecording) {
    return (
      <Pressable
        onPress={() => void startRecording()}
        style={({ pressed }) => [styles.idleBar, pressed && { opacity: 0.9 }]}
      >
        <LinearGradient
          colors={[...TAB_DESIGN.activeGrad]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LuMicIcon size={18} color="#fff" />
        <Text variant="button" weight="bold" color="#fff">
          اضغط للتسجيل
        </Text>
      </Pressable>
    );
  }

  if (isRecording) {
    return (
      <View style={styles.recordingBar}>
        <Pressable
          onPress={() => stopRecording(true)}
          style={[styles.cancelBtn, cancelling && { backgroundColor: '#FF2E62' }]}
        >
          <Trash2 size={18} color={cancelling ? '#fff' : '#FF2E62'} />
        </Pressable>

        <View style={styles.recordingInfo}>
          <Animated.View
            style={[styles.recDot, { transform: [{ scale: pulseAnim }] }]}
          />
          <Text variant="button" weight="bold" color={lu.colors.purpleDark}>
            {formatTime(duration)}
          </Text>
          <Text variant="caption" color="#9CA3AF">
            جاري التسجيل...
          </Text>
        </View>

        <Pressable
          onPress={() => stopRecording(false)}
          style={[styles.sendBtn, { backgroundColor: color }]}
        >
          <LuSendIcon size={18} color="#fff" filled />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPressIn={() => {
        void startRecording();
      }}
      onPressOut={() => {
        if (isRecordingRef.current || startingRef.current) {
          void stopRecording(false);
        }
      }}
      style={({ pressed }) => [styles.fabBtn, pressed && { opacity: 0.9 }]}
      hitSlop={8}
    >
      <LinearGradient
        colors={[...TAB_DESIGN.activeGrad]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LuMicIcon size={21} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fabBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF5F5',
    borderRadius: 99,
    minHeight: 46,
  },
  cancelBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF2E62',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 99,
    overflow: 'hidden',
    paddingHorizontal: 20,
  },
});
