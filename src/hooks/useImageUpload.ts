/**
 * useImageUpload — Hook لاختيار ورفع الصور
 * يدمج expo-image-picker مع Firebase Storage
 */

import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  uploadImage,
  uploadAvatar,
  uploadPostImage,
  uploadRoomBanner,
  uploadAlbumImage,
} from '@/services/firebase/storage';
import { requestMediaLibraryAccess, requestCameraAccess } from '@/services/permissions';
// حارس منتقي الوسائط — يمنع إفراغ المقعد أثناء ذهاب التطبيق للخلفية لفتح
// المعرض/الكاميرا داخل الروم (no-op خارج الغرف فالتغليف آمن دائماً)
import { withRoomMediaPickerGuard } from '@/utils/roomMediaPickerGuard';

interface UseImageUploadResult {
  pickAndUpload: (options?: PickOptions) => Promise<string | null>;
  takePhotoAndUpload: (options?: PickOptions) => Promise<string | null>;
  uploading: boolean;
  progress: number;
  error: string | null;
}

interface PickOptions {
  folder?: 'avatars' | 'posts' | 'banners' | 'albums' | 'rooms' | 'gifts' | 'agencies';
  aspect?: [number, number];
  quality?: number;
  allowsEditing?: boolean;
}

export const useImageUpload = (): UseImageUploadResult => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * فتح المعرض، اختر صورة، ارفعها لـ Firebase Storage
   */
  const pickAndUpload = async (options: PickOptions = {}): Promise<string | null> => {
    setError(null);
    try {
      const permOk = await requestMediaLibraryAccess();
      if (!permOk) {
        Alert.alert(
          'الإذن مطلوب',
          'نحتاج إذن للوصول لمعرض الصور. يمكنك تفعيله من إعدادات الجهاز.',
          [{ text: 'حسناً' }],
        );
        return null;
      }

      const result = await withRoomMediaPickerGuard(() =>
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: options.allowsEditing ?? false,
          aspect: options.aspect ?? [1, 1],
          quality: options.quality ?? 0.7,
        }),
      );

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const uri = result.assets[0]!.uri;
      return await uploadFromUri(uri, options.folder ?? 'avatars');
    } catch (e: any) {
      setError(e.message);
      Alert.alert('خطأ', e.message ?? 'فشل اختيار الصورة');
      return null;
    }
  };

  /**
   * فتح الكاميرا، التقط صورة، ارفعها
   */
  const takePhotoAndUpload = async (options: PickOptions = {}): Promise<string | null> => {
    setError(null);
    try {
      const camOk = await requestCameraAccess();
      if (!camOk) {
        Alert.alert('الإذن مطلوب', 'نحتاج إذن لاستخدام الكاميرا');
        return null;
      }

      const result = await withRoomMediaPickerGuard(() =>
        ImagePicker.launchCameraAsync({
          allowsEditing: options.allowsEditing ?? true,
          aspect: options.aspect ?? [1, 1],
          quality: options.quality ?? 0.7,
        }),
      );

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const uri = result.assets[0]!.uri;
      return await uploadFromUri(uri, options.folder ?? 'avatars');
    } catch (e: any) {
      setError(e.message);
      Alert.alert('خطأ', e.message ?? 'فشل التقاط الصورة');
      return null;
    }
  };

  /**
   * رفع URI لـ Firebase
   */
  const uploadFromUri = async (
    uri: string,
    folder: PickOptions['folder'] = 'avatars',
  ): Promise<string | null> => {
    setUploading(true);
    setProgress(0);
    try {
      let downloadURL: string;
      switch (folder) {
        case 'avatars':
          downloadURL = await uploadAvatar(uri, setProgress);
          break;
        case 'posts':
          downloadURL = await uploadPostImage(uri, setProgress);
          break;
        case 'banners':
          downloadURL = await uploadRoomBanner(uri, setProgress);
          break;
        case 'albums':
          downloadURL = await uploadAlbumImage(uri, setProgress);
          break;
        default:
          downloadURL = await uploadImage(uri, folder ?? 'avatars', setProgress);
      }
      return downloadURL;
    } catch (e: any) {
      setError(e.message);
      Alert.alert('فشل الرفع', e.message ?? 'حدث خطأ أثناء رفع الصورة');
      return null;
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return {
    pickAndUpload,
    takePhotoAndUpload,
    uploading,
    progress,
    error,
  };
};
