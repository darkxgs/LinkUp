/**
 * تسجيل فيديو قصير للتحقق — وجه واضح أمام الكاميرا
 */
import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { Camera, RotateCcw, CheckCircle2 } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export type KycVideoCaptureResult = {
  videoUri: string;
  frameUri: string;
};

type Props = {
  value: KycVideoCaptureResult | null;
  onChange: (value: KycVideoCaptureResult | null) => void;
};

export function KycVideoCapture({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const recordVideo = async () => {
    setBusy(true);
    try {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) {
        throw new Error(t('kyc.cameraPermission'));
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: 12,
        quality: 0.6,
        cameraType: ImagePicker.CameraType.front,
      });

      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }

      const videoUri = result.assets[0].uri;
      const thumb = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 800,
        quality: 0.85,
      });

      onChange({ videoUri, frameUri: thumb.uri });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('common.errorOccurred');
      throw new Error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text variant="h3" weight="bold" style={{ marginBottom: spacing.sm }}>
        {t('kyc.videoTitle')}
      </Text>
      <Text variant="bodySmall" color={colors.text.secondary} style={{ marginBottom: spacing.lg }}>
        {t('kyc.videoHint')}
      </Text>

      {value ? (
        <View style={styles.previewBox}>
          <Video
            source={{ uri: value.videoUri }}
            style={styles.video}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            isLooping
          />
          <View style={styles.frameRow}>
            <Image source={{ uri: value.frameUri }} style={styles.frameThumb} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <View style={styles.okRow}>
                <CheckCircle2 size={18} color="#10B981" />
                <Text variant="bodySmall" weight="semibold" style={{ color: '#10B981' }}>
                  {t('kyc.videoRecorded')}
                </Text>
              </View>
              <Text variant="caption" color={colors.text.secondary}>
                {t('kyc.videoRecordedSub')}
              </Text>
            </View>
          </View>
          <Pressable style={styles.retakeBtn} onPress={() => onChange(null)} disabled={busy}>
            <RotateCcw size={16} color="#E11414" />
            <Text variant="caption" weight="semibold" style={{ color: '#E11414' }}>
              {t('kyc.retakeVideo')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.recordBtn} onPress={() => void recordVideo()} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Camera size={28} color="#fff" strokeWidth={2.2} />
              <Text variant="button" color="#fff" weight="bold">
                {t('kyc.startVideo')}
              </Text>
            </>
          )}
        </Pressable>
      )}

      <View style={styles.tips}>
        <Text variant="caption" color={colors.text.secondary} style={{ lineHeight: 18 }}>
          {t('kyc.videoTips')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  recordBtn: {
    height: 160,
    borderRadius: radius.lg,
    backgroundColor: '#E11414',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  previewBox: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#FBEAEA',
    borderWidth: 1,
    borderColor: '#EFEFF2',
  },
  video: { width: '100%', height: 220, backgroundColor: '#000' },
  frameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  frameThumb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ddd',
  },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EFEFF2',
  },
  tips: {
    marginTop: spacing.base,
    padding: spacing.base,
    backgroundColor: '#FEE2E2',
    borderRadius: radius.md,
  },
});
