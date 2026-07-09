/**
 * إنشاء منشور / لحظة جديدة
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Camera, X, Send } from 'lucide-react-native';

import { Text, BackButton } from '@/components/ui';
import { createPost } from '@/services/firebase/posts';
import { requestMediaLibraryAccess } from '@/services/permissions';
import { lu } from '@/theme/lu-brand';

const MAX_IMAGES = 4;
const HEADER_SIDE_W = 92;

export default function CreatePostScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const pickImages = async () => {
    const ok = await requestMediaLibraryAccess();
    if (!ok) {
      Alert.alert(t('post.mediaPermissionTitle'), t('post.mediaPermissionBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.85,
    });
    if (!result.canceled) {
      setImages((prev) => [
        ...prev,
        ...result.assets.map((a) => a.uri).slice(0, MAX_IMAGES - prev.length),
      ]);
    }
  };

  const handlePublish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createPost(text, images);
      router.replace('/(tabs)/feed' as any);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? t('post.publishFailed'));
    } finally {
      setBusy(false);
    }
  };

  const canPublish = !busy && (text.trim().length > 0 || images.length > 0);

  return (
    <LinearGradient colors={lu.gradients.pageHome} locations={[0, 0.25]} style={styles.flex}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <View style={styles.headerSide}>
              <BackButton />
            </View>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {t('post.createTitle')}
              </Text>
            </View>

            <View style={[styles.headerSide, styles.headerSideEnd]}>
              <Pressable
                onPress={handlePublish}
                disabled={!canPublish}
                style={({ pressed }) => [
                  styles.publishBtn,
                  pressed && canPublish && { opacity: 0.85 },
                  !canPublish && styles.publishBtnDisabled,
                ]}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Send size={16} color="#fff" strokeWidth={2.5} />
                    <Text style={styles.publishText}>{t('post.publish')}</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextInput
              style={styles.input}
              placeholder={t('post.createPlaceholder')}
              placeholderTextColor={lu.colors.muted}
              multiline
              maxLength={2000}
              value={text}
              onChangeText={setText}
              textAlignVertical="top"
              textAlign={I18nManager.isRTL ? 'right' : 'left'}
            />

            {images.length > 0 && (
              <View style={styles.imagesGrid}>
                {images.map((uri, i) => (
                  <View key={uri} style={styles.imageWrap}>
                    <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
                    <Pressable
                      style={styles.removeImg}
                      onPress={() => setImages((arr) => arr.filter((_, j) => j !== i))}
                    >
                      <X size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {images.length < MAX_IMAGES && (
              <Pressable onPress={pickImages} style={styles.addPhoto}>
                <Camera size={22} color={lu.colors.purple} strokeWidth={2} />
                <Text style={styles.addPhotoText}>
                  {t('post.addPhotos', { count: images.length, max: MAX_IMAGES })}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lu.colors.line,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  headerSide: {
    width: HEADER_SIDE_W,
    justifyContent: 'center',
  },
  headerSideEnd: {
    alignItems: 'flex-end',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
    textAlign: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 76,
    borderRadius: 20,
    backgroundColor: lu.colors.purple,
  },
  publishBtnDisabled: {
    opacity: 0.45,
  },
  publishText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    fontFamily: lu.fonts.bodyHeavy,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  input: {
    minHeight: 140,
    fontSize: 16,
    lineHeight: 24,
    color: lu.colors.ink,
    fontFamily: lu.fonts.body,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  imageWrap: { width: '48%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  removeImg: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: lu.colors.line,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  addPhotoText: {
    fontSize: 14,
    fontWeight: '700',
    color: lu.colors.purple,
    fontFamily: lu.fonts.bodyBold,
  },
});
