/**
 * التحقق السريع بالوجه — كاميرا فقط
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
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
};

type PickedPhoto = {
  uri: string;
  base64: string;
};

export function KycFaceVerify({ fullName, displayName, disabled, onResult }: Props) {
  const { t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedPhoto | null>(null);
  const [useCamera, setUseCamera] = useState(true);

  useEffect(() => {
    if (!useCamera || picked) return;
    if (!permission?.granted && permission?.canAskAgain !== false) {
      void requestPermission();
    }
  }, [permission, requestPermission, useCamera, picked]);

  const submitBase64 = useCallback(
    async (base64: string) => {
      const name = fullName.trim();
      if (name.length < 2) return;

      setBusy(true);
      setError(null);
      try {
        const result = await submitKycFaceVerification(
          base64,
          name,
          displayName?.trim() || name,
        );
        onResult(result);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : t('kyc.faceVerifyFailed');
        setError(msg);
      } finally {
        setBusy(false);
      }
    },
    [displayName, fullName, onResult, t],
  );

  const captureAndVerify = useCallback(async () => {
    if (busy || disabled) return;

    if (picked?.base64) {
      await submitBase64(picked.base64);
      return;
    }

    if (!cameraRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.75,
        skipProcessing: false,
      });
      if (!photo?.base64) {
        throw new Error(t('kyc.faceCaptureFailed'));
      }
      await submitBase64(photo.base64);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('kyc.faceVerifyFailed');
      setError(msg);
      setBusy(false);
    }
  }, [busy, disabled, picked, submitBase64, t]);

  const resetPhoto = useCallback(() => {
    setPicked(null);
    setUseCamera(true);
    setError(null);
  }, []);

  const showCamera = useCamera && !picked;

  if (showCamera && !permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={lu.colors.pink} />
      </View>
    );
  }

  if (showCamera && !permission?.granted) {
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
        {picked ? (
          <Image source={{ uri: picked.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : showCamera ? (
          <>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
            <View style={styles.faceOval} pointerEvents="none" />
          </>
        ) : null}
      </View>

      <Text variant="caption" color="rgba(255,255,255,0.65)" align="center" style={styles.hint}>
        {picked ? t('kyc.faceGalleryPreviewHint') : t('kyc.faceHint')}
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

      {picked ? (
        <Pressable onPress={resetPhoto} disabled={busy} style={styles.retryLink}>
          <RotateCcw size={14} color="#FCA5A5" />
          <Text variant="caption" weight="semibold" color="#FCA5A5">
            {t('kyc.faceRetakePhoto')}
          </Text>
        </Pressable>
      ) : null}

      {error && !picked ? (
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
