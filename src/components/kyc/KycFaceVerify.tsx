/**
 * التحقق السريع بالوجه — كاميرا فقط.
 * تحقق حيوية بسيط: عند الضغط تُلتقط 3 صور تلقائياً خلال ~3 ثوانٍ مع إيماءة
 * عشوائية سهلة (ابتسامة/التفاتة خفيفة) — بلا أي خطوات إضافية على المستخدمة.
 * السيرفر يقارن الإطارات: اتفاقها يرفع الدقة، وصورة ثابتة مُعادة تُرفض تلقائياً.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ShieldCheck, RotateCcw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { lu } from '@/theme/lu-brand';
import { submitKycFaceVerification, type KycSubmitResult } from '@/services/firebase/kyc';

type Props = {
  fullName: string;
  displayName?: string;
  disabled?: boolean;
  onResult: (result: KycSubmitResult) => void;
  /** يُعلم الشاشة الأم بحالة الإرسال — يمنع تبديل الواجهة أثناء التحقق */
  onBusyChange?: (busy: boolean) => void;
};

type CaptureStage = 'idle' | 'hold' | 'gesture' | 'final' | 'uploading';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function KycFaceVerify({ fullName, displayName, disabled, onResult, onBusyChange }: Props) {
  const { t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<CaptureStage>('idle');
  const [gestureText, setGestureText] = useState('');

  // إيماءات بسيطة جداً — واحدة عشوائياً لكل محاولة
  const gestures = [
    { id: 'smile', label: t('kyc.gestureSmile', 'ابتسمي ابتسامة خفيفة 🙂') },
    { id: 'turn_right', label: t('kyc.gestureTurnRight', 'حرّكي رأسك يميناً قليلاً') },
    { id: 'turn_left', label: t('kyc.gestureTurnLeft', 'حرّكي رأسك يساراً قليلاً') },
    { id: 'closer', label: t('kyc.gestureCloser', 'اقتربي قليلاً من الكاميرا') },
  ];

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain !== false) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  // إبلاغ الأم بحالة الانشغال — يشمل كل مسارات النجاح/الفشل
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const submitFrames = useCallback(
    async (frames: string[], gestureId?: string) => {
      const name = fullName.trim();
      if (name.length < 2) return;

      setStage('uploading');
      setError(null);
      try {
        const result = await submitKycFaceVerification(
          frames[0]!,
          name,
          displayName?.trim() || name,
          frames.length > 1 ? frames : undefined,
          gestureId,
        );
        onResult(result);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : t('kyc.faceVerifyFailed');
        setError(msg);
      } finally {
        setBusy(false);
        setStage('idle');
        setGestureText('');
      }
    },
    [displayName, fullName, onResult, t],
  );

  const snapFrame = useCallback(async (): Promise<string | null> => {
    if (!cameraRef.current) return null;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.6,
        skipProcessing: true,
      });
      return photo?.base64 ?? null;
    } catch {
      return null;
    }
  }, []);

  // كاميرا حية فقط — لا رفع من الاستوديو ولا أي ملفات (أمر المالك: تصوير مباشر حصراً)
  const captureAndVerify = useCallback(async () => {
    if (busy || disabled) return;
    if (!cameraRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const gesture = gestures[Math.floor(Math.random() * gestures.length)]!;
      const frames: string[] = [];

      // 1) لقطة البداية — ثبات
      setStage('hold');
      setGestureText(t('kyc.gestureHold', 'ثبّتي وجهك داخل الإطار'));
      await wait(700);
      const f1 = await snapFrame();
      if (f1) frames.push(f1);

      // 2) الإيماءة البسيطة — لقطة أثناءها
      setStage('gesture');
      setGestureText(gesture.label);
      await wait(1400);
      const f2 = await snapFrame();
      if (f2) frames.push(f2);

      // 3) لقطة الختام
      setStage('final');
      setGestureText(t('kyc.gestureFinal', 'ممتاز! ثبات للحظة…'));
      await wait(800);
      const f3 = await snapFrame();
      if (f3) frames.push(f3);

      if (!frames.length) {
        throw new Error(t('kyc.faceCaptureFailed'));
      }
      await submitFrames(frames, gesture.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('kyc.faceVerifyFailed');
      setError(msg);
      setBusy(false);
      setStage('idle');
      setGestureText('');
    }
  }, [busy, disabled, submitFrames, snapFrame, gestures, t]);

  const capturing = stage === 'hold' || stage === 'gesture' || stage === 'final';

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={lu.colors.pink} />
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.wrap}>
        <View style={styles.permissionBox}>
          <Text variant="bodySmall" color="rgba(255,255,255,0.85)" align="center">
            {t('kyc.cameraPermission')}
          </Text>
          <Pressable onPress={() => void requestPermission()} style={styles.permBtn}>
            <Text variant="bodySmall" weight="bold" color="#fff">
              {t('kyc.faceAllowCamera')}
            </Text>
          </Pressable>
        </View>

      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.cameraFrame}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
        <View style={styles.faceOval} pointerEvents="none" />
        {capturing ? (
          <View style={styles.gestureOverlay} pointerEvents="none">
            <View style={styles.gestureBanner}>
              <Text variant="body" weight="bold" color="#fff" align="center">
                {gestureText}
              </Text>
              <View style={styles.dotsRow}>
                {(['hold', 'gesture', 'final'] as const).map((s, i) => {
                  const activeIdx = stage === 'hold' ? 0 : stage === 'gesture' ? 1 : 2;
                  return (
                    <View
                      key={s}
                      style={[styles.dot, i <= activeIdx && styles.dotActive]}
                    />
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}
      </View>

      <Text variant="caption" color="rgba(255,255,255,0.65)" align="center" style={styles.hint}>
        {capturing
          ? t('kyc.faceLivenessHint', 'التقاط تلقائي — اتبعي التعليمة فقط')
          : t('kyc.faceHint')}
      </Text>

      {error ? (
        <Text variant="caption" color="#FCA5A5" align="center" style={{ marginBottom: 8 }}>
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={() => void captureAndVerify()}
        disabled={busy || disabled}
        style={({ pressed }) => [{ opacity: pressed || busy ? 0.88 : 1 }]}
      >
        <LinearGradient
          colors={['#FF3340', '#B00E0E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.verifyBtn}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <ShieldCheck size={20} color="#fff" strokeWidth={2.4} />
              <Text variant="body" weight="bold" color="#fff">
                {t('kyc.faceVerifyNow')}
              </Text>
            </>
          )}
        </LinearGradient>
      </Pressable>

      {error ? (
        <Pressable onPress={() => setError(null)} style={styles.retryLink}>
          <RotateCcw size={14} color="#FCA5A5" />
          <Text variant="caption" weight="semibold" color="#FCA5A5">
            {t('kyc.faceRetry')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  center: { paddingVertical: 32, alignItems: 'center' },
  permissionBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 12,
    alignItems: 'center',
  },
  permBtn: {
    backgroundColor: lu.colors.purple,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  cameraFrame: {
    height: 280,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  faceOval: {
    position: 'absolute',
    alignSelf: 'center',
    top: '12%',
    width: '58%',
    height: '72%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  gestureOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 12,
  },
  gestureBanner: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#FF3340',
  },
  hint: { lineHeight: 18, paddingHorizontal: 8 },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 26,
  },
  retryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
});
