/**
 * VideoAddModal — مودال إضافة فيديو للروم
 *
 * تصميم bottom sheet عصري:
 *  - رأس بأيقونة بارزة + عنوان واضح
 *  - تبويبان: إضافة رابط / رفع من الجهاز
 *  - حقول input في كروت منفصلة
 *  - زر CTA كبير بالـ gradient
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  I18nManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Youtube,
  Film,
  Link2,
  UploadCloud,
  Send,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Info,
  Volume,
  Trash2,
} from 'lucide-react-native';

import { Text, useAlert } from '@/components/ui';
import { submitRoomVideoRequest, publishRoomVideoDirect } from '@/services/roomVideoRequests';
import { parseVideoUrl } from '@/utils/videoUrlParser';
import { storage, auth } from '@/services/firebase/index';
import { lu } from '@/theme/lu-brand';
import { withRoomMediaPickerGuard } from '@/utils/roomMediaPickerGuard';

type Tab = 'url' | 'upload';

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  /** مدير الوكالة/الإشراف — يُبث الفيديو مباشرة بدون مراجعة */
  canPublishDirectly?: boolean;
}

export function VideoAddModal({ visible, onClose, roomId, canPublishDirectly = false }: Props) {
  const { showAlert } = useAlert();
  const [tab, setTab] = useState<Tab>('url');

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [pickedVideo, setPickedVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const parsed = url ? parseVideoUrl(url) : null;
  const busy = submitting || uploading;

  const reset = () => {
    setUrl('');
    setTitle('');
    setPickedVideo(null);
    setUploading(false);
    setUploadProgress(0);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleSubmitUrl = async () => {
    if (!parsed?.isValid) {
      showAlert({ type: 'error', title: 'رابط غير صالح', message: parsed?.error ?? 'تأكد من الرابط' });
      return;
    }
    setSubmitting(true);
    try {
      if (canPublishDirectly) {
        await publishRoomVideoDirect(roomId, url, title);
        showAlert({
          type: 'success',
          title: 'تم العرض',
          message: 'تم عرض الفيديو في الروم الآن',
        });
      } else {
        await submitRoomVideoRequest(roomId, url, title);
        showAlert({
          type: 'success',
          title: 'تم الإرسال',
          message: 'وصل طلبك للإشراف — سيُعرض الفيديو بعد الموافقة',
        });
      }
      reset();
      onClose();
    } catch (e: any) {
      showAlert({ type: 'error', title: 'فشل', message: e?.message ?? 'فشل الإضافة' });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickVideo = async () => {
    try {
      await withRoomMediaPickerGuard(async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          showAlert({ type: 'warning', title: 'الإذن مطلوب', message: 'يجب السماح بالوصول للمكتبة' });
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          videoMaxDuration: 600,
          quality: 0.7,
        });
        if (result.canceled || !result.assets?.[0]) return;
        setPickedVideo(result.assets[0]);
      });
    } catch (e: any) {
      showAlert({ type: 'error', title: 'فشل', message: e?.message ?? 'خطأ' });
    }
  };

  const handleUpload = async () => {
    if (!pickedVideo) return;
    const user = auth.currentUser;
    if (!user) {
      showAlert({ type: 'error', title: 'غير مسجّل', message: 'يجب تسجيل الدخول' });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      await withRoomMediaPickerGuard(async () => {
      const response = await fetch(pickedVideo.uri);
      const blob = await response.blob();

      const MAX_SIZE = 50 * 1024 * 1024;
      if (blob.size > MAX_SIZE) {
        throw new Error('الحجم تجاوز الحد الأقصى (50MB)');
      }

      const ext = pickedVideo.uri.split('.').pop()?.toLowerCase() ?? 'mp4';
      const path = `room_videos/${roomId}/${user.uid}_${Date.now()}.${ext}`;
      const fileRef = storageRef(storage, path);

      setUploadProgress(30);
      await uploadBytes(fileRef, blob, { contentType: blob.type || `video/${ext}` });

      setUploadProgress(80);
      const downloadUrl = await getDownloadURL(fileRef);

      // صورة معاينة للمشرف — يشاهد محتوى الفيديو قبل الموافقة
      let thumbnailUrl: string | undefined;
      try {
        const VideoThumbnails = await import('expo-video-thumbnails');
        const thumb = await VideoThumbnails.getThumbnailAsync(pickedVideo.uri, {
          time: 1000,
          quality: 0.6,
        });
        const thumbBlob = await (await fetch(thumb.uri)).blob();
        const thumbRef = storageRef(storage, `room_videos/${roomId}/${user.uid}_${Date.now()}_thumb.jpg`);
        await uploadBytes(thumbRef, thumbBlob, { contentType: 'image/jpeg' });
        thumbnailUrl = await getDownloadURL(thumbRef);
      } catch {
        // المعاينة اختيارية — فشلها لا يمنع الطلب
      }
      setUploadProgress(100);

      if (canPublishDirectly) {
        await publishRoomVideoDirect(roomId, downloadUrl, title || 'فيديو من الجهاز');
        showAlert({
          type: 'success',
          title: 'تم العرض',
          message: 'تم عرض الفيديو في الروم الآن',
        });
      } else {
        await submitRoomVideoRequest(roomId, downloadUrl, title || 'فيديو من الجهاز', thumbnailUrl);
        showAlert({
          type: 'success',
          title: 'تم الإرسال',
          message: 'وصل طلبك للإشراف — سيُعرض الفيديو بعد الموافقة',
        });
      }
      });
      reset();
      onClose();
    } catch (e: any) {
      showAlert({ type: 'error', title: 'فشل الرفع', message: e?.message ?? 'خطأ' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={!busy ? handleClose : undefined} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* أيقونة رئيسية */}
          <View style={styles.iconWrap}>
            <View style={styles.iconRingOuter}>
              <View style={styles.iconRingInner}>
                <PlayCircle size={28} color={lu.colors.pink} strokeWidth={2.2} />
              </View>
            </View>
          </View>

          <Text variant="h3" weight="bold" color={lu.colors.ink} align="center">
            مشاركة فيديو
          </Text>
          <Text variant="body" color={lu.colors.ink2} align="center" style={styles.subtitle}>
            {canPublishDirectly
              ? 'سيُعرض الفيديو في الروم مباشرة بدون مراجعة'
              : 'يُرسل الطلب للإشراف — لا يُبث الفيديو إلا بعد الموافقة'}
          </Text>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            <Pressable
              onPress={() => setTab('url')}
              style={[styles.tab, tab === 'url' && styles.tabActive]}
            >
              <Link2 size={16} color={tab === 'url' ? '#fff' : lu.colors.ink2} strokeWidth={2.4} />
              <Text
                variant="caption"
                weight="bold"
                color={tab === 'url' ? '#fff' : lu.colors.ink2}
                style={styles.tabText}
              >
                إضافة رابط
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('upload')}
              style={[styles.tab, tab === 'upload' && styles.tabActive]}
            >
              <UploadCloud size={16} color={tab === 'upload' ? '#fff' : lu.colors.ink2} strokeWidth={2.4} />
              <Text
                variant="caption"
                weight="bold"
                color={tab === 'upload' ? '#fff' : lu.colors.ink2}
                style={styles.tabText}
              >
                رفع من الجهاز
              </Text>
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {tab === 'url' && (
              <>
                {/* حقل الرابط */}
                <View style={styles.inputCard}>
                  <Text variant="caption" weight="bold" color={lu.colors.ink2} style={styles.fieldLabel}>
                    رابط الفيديو
                  </Text>
                  <TextInput
                    value={url}
                    onChangeText={setUrl}
                    placeholder="https://youtu.be/..."
                    placeholderTextColor={lu.colors.muted}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </View>

                {/* نتيجة التحقق */}
                {parsed && (
                  <View
                    style={[
                      styles.parseResult,
                      { backgroundColor: parsed.isValid ? '#E8FDF6' : lu.colors.redSoft },
                    ]}
                  >
                    {parsed.isValid ? (
                      <CheckCircle2 size={16} color={lu.colors.mint} strokeWidth={2.4} />
                    ) : (
                      <AlertCircle size={16} color={lu.colors.live} strokeWidth={2.4} />
                    )}
                    <Text
                      variant="caption"
                      weight="bold"
                      color={parsed.isValid ? lu.colors.mint : lu.colors.live}
                      style={{ flex: 1 }}
                    >
                      {parsed.isValid
                        ? parsed.type === 'youtube'
                          ? 'رابط YouTube صالح'
                          : parsed.type === 'mp4'
                          ? 'فيديو مباشر (MP4)'
                          : 'بث مباشر (HLS)'
                        : parsed.error}
                    </Text>
                  </View>
                )}

                {/* عنوان اختياري */}
                <View style={styles.inputCard}>
                  <Text variant="caption" weight="bold" color={lu.colors.ink2} style={styles.fieldLabel}>
                    عنوان اختياري
                  </Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="اسم الفيديو..."
                    placeholderTextColor={lu.colors.muted}
                    style={styles.input}
                    maxLength={50}
                  />
                </View>

                {/* الصيغ المدعومة */}
                <View style={styles.formatsCard}>
                  <View style={styles.formatRow}>
                    <View style={[styles.formatIcon, { backgroundColor: '#FFE5E5' }]}>
                      <Youtube size={14} color="#FF0000" strokeWidth={2.4} />
                    </View>
                    <Text variant="caption" color={lu.colors.ink2}>YouTube</Text>
                  </View>
                  <View style={styles.formatRow}>
                    <View style={[styles.formatIcon, { backgroundColor: lu.colors.blueSoft }]}>
                      <Film size={14} color={lu.colors.blue} strokeWidth={2.4} />
                    </View>
                    <Text variant="caption" color={lu.colors.ink2}>MP4 / WebM</Text>
                  </View>
                  <View style={styles.formatRow}>
                    <View style={[styles.formatIcon, { backgroundColor: lu.colors.bgPink }]}>
                      <Volume size={14} color={lu.colors.pink} strokeWidth={2.4} />
                    </View>
                    <Text variant="caption" color={lu.colors.ink2}>HLS Stream</Text>
                  </View>
                </View>
              </>
            )}

            {tab === 'upload' && (
              <>
                {!pickedVideo ? (
                  <Pressable onPress={handlePickVideo} style={styles.pickBtn}>
                    <View style={styles.pickIconWrap}>
                      <UploadCloud size={30} color={lu.colors.pink} strokeWidth={2} />
                    </View>
                    <Text variant="button" weight="bold" color={lu.colors.ink}>
                      اختر فيديو من جهازك
                    </Text>
                    <Text variant="caption" color={lu.colors.muted} align="center" style={{ marginTop: 4 }}>
                      الحد الأقصى 50MB / 10 دقائق
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.pickedCard}>
                    <View style={styles.pickedIconWrap}>
                      <Film size={20} color="#fff" strokeWidth={2.4} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="button" weight="bold" color={lu.colors.ink} numberOfLines={1}>
                        {pickedVideo.fileName ?? 'فيديو محدّد'}
                      </Text>
                      <Text variant="caption" color={lu.colors.ink2}>
                        {pickedVideo.duration ? `${Math.round(pickedVideo.duration / 1000)} ث` : ''}
                        {pickedVideo.fileSize ? ` • ${(pickedVideo.fileSize / 1024 / 1024).toFixed(1)} MB` : ''}
                      </Text>
                    </View>
                    {!uploading && (
                      <Pressable onPress={() => setPickedVideo(null)} hitSlop={10} style={styles.removePicked}>
                        <Trash2 size={16} color={lu.colors.live} strokeWidth={2.4} />
                      </Pressable>
                    )}
                  </View>
                )}

                {pickedVideo && !uploading && (
                  <View style={styles.inputCard}>
                    <Text variant="caption" weight="bold" color={lu.colors.ink2} style={styles.fieldLabel}>
                      عنوان اختياري
                    </Text>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="عنوان الفيديو..."
                      placeholderTextColor={lu.colors.muted}
                      style={styles.input}
                      maxLength={50}
                    />
                  </View>
                )}

                {uploading && (
                  <View style={styles.progressCard}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                    </View>
                    <Text variant="caption" color={lu.colors.ink2} align="center">
                      جارٍ الرفع... {uploadProgress}%
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* ملاحظة */}
            <View style={styles.noteRow}>
              <Info size={13} color={lu.colors.muted} strokeWidth={2.4} />
              <Text variant="caption" color={lu.colors.muted} style={{ flex: 1, fontSize: 11 }}>
                صوت الفيديو مكتوم افتراضياً لحماية المايكات
              </Text>
            </View>
          </ScrollView>

          {/* CTA */}
          <View style={styles.actions}>
            <Pressable
              onPress={tab === 'url' ? handleSubmitUrl : handleUpload}
              disabled={
                (tab === 'url' && (!parsed?.isValid || submitting)) ||
                (tab === 'upload' && (!pickedVideo || uploading))
              }
              style={[
                styles.submit,
                ((tab === 'url' && (!parsed?.isValid || submitting)) ||
                  (tab === 'upload' && (!pickedVideo || uploading))) && { opacity: 0.5 },
              ]}
            >
              <LinearGradient
                colors={lu.gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Send size={17} color="#fff" strokeWidth={2.4} />
                  <Text variant="button" color="#fff" weight="bold">
                    {canPublishDirectly
                      ? tab === 'url'
                        ? 'عرض الفيديو'
                        : 'رفع وعرض الفيديو'
                      : tab === 'url'
                        ? 'إرسال للمراجعة'
                        : 'رفع وإرسال للمراجعة'}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable onPress={handleClose} disabled={busy} style={styles.cancelBtn}>
              <Text variant="button" color={lu.colors.ink2} weight="bold">إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26, 10, 12,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 22,
    paddingBottom: 32,
  },
  handle: {
    width: 44, height: 5, borderRadius: 3,
    backgroundColor: lu.colors.line,
    alignSelf: 'center',
    marginBottom: 18,
  },
  iconWrap: { alignItems: 'center', marginBottom: 14 },
  iconRingOuter: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: lu.colors.bgPink,
    alignItems: 'center', justifyContent: 'center',
  },
  iconRingInner: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: lu.colors.pinkSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  subtitle: { marginTop: 4, marginBottom: 20 },

  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    backgroundColor: lu.colors.bg,
    borderRadius: lu.radius.base,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: lu.radius.sm,
  },
  tabActive: { backgroundColor: lu.colors.purple },
  tabText: {
    fontSize: 12.5,
    lineHeight: 18,
    includeFontPadding: false,
  },

  inputCard: {
    backgroundColor: lu.colors.bg2,
    borderRadius: lu.radius.base,
    borderWidth: 1.5,
    borderColor: lu.colors.line,
    padding: 14,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11,
    lineHeight: 16,
    includeFontPadding: false,
    marginBottom: 8,
  },
  input: {
    fontSize: 15,
    lineHeight: 22,
    color: lu.colors.ink,
    fontFamily: lu.fonts.body,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    includeFontPadding: false,
    padding: 0,
  },

  parseResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: lu.radius.sm,
    marginBottom: 10,
  },

  formatsCard: {
    backgroundColor: lu.colors.bg,
    borderRadius: lu.radius.base,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  formatIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  pickBtn: {
    alignItems: 'center',
    padding: 26,
    borderWidth: 2,
    borderColor: lu.colors.line,
    borderStyle: 'dashed',
    borderRadius: lu.radius.base,
    backgroundColor: lu.colors.bg2,
  },
  pickIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: lu.colors.bgPink,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  pickedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: lu.colors.bg2,
    borderRadius: lu.radius.base,
    borderWidth: 1.5,
    borderColor: lu.colors.line,
  },
  pickedIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: lu.colors.pink,
    alignItems: 'center', justifyContent: 'center',
  },
  removePicked: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: lu.colors.redSoft,
    alignItems: 'center', justifyContent: 'center',
  },

  progressCard: {
    backgroundColor: lu.colors.bg2,
    borderRadius: lu.radius.base,
    padding: 16,
    gap: 10,
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: lu.colors.line,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: lu.colors.pink,
    borderRadius: 4,
  },

  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 4,
  },

  actions: { marginTop: 16, gap: 10 },
  submit: {
    height: 54,
    borderRadius: lu.radius.base,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...lu.shadows.grad,
  },
  cancelBtn: {
    height: 50,
    borderRadius: lu.radius.base,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lu.colors.bg,
  },
});
