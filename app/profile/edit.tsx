/**
 * LinkUp App — Edit Profile Screen v3
 *
 * ميزات:
 * - RTL كامل لكل العناصر
 * - كل القيم حقيقية ومربوطة بـ Firestore + Storage
 * - حفظ تلقائي عند تعديل أي حقل
 * - شريط تقدم Data Integrity ديناميكي
 * - رفع صورة Avatar + Album لـ Firebase Storage
 * - دعم Tags + Voice Bio
 * - جميع التحديثات تظهر فوراً في profile/[userId]
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  I18nManager,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { X, Camera, HelpCircle, Plus, Mic, Edit3, Check, Trash2, Award, Hash, Package } from 'lucide-react-native';
import { lu } from '@/theme/lu-brand';
import { ForwardChevron } from '@/components/ui/RtlChevron';
import i18n from '@/localization/i18n';

import { Text, RealCountryFlag, PhotoSourceSheet, FramedAvatar, getFramedAvatarContainerSize } from '@/components/ui';
import { CountryPickerSheet } from '@/components/ui/CountryPickerSheet';
import { getCountryByCode } from '@/data/countries';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { userHasVipFeature } from '@/services/firebase/vipSystem';
import { useEquippedFrameUrl } from '@/hooks/useEquippedFrameUrl';
import { useAuthStore } from '@/stores/authStore';
import { uploadAvatar, uploadAlbumImage, uploadVoiceBio } from '@/services/firebase/storage';
import { requestMediaLibraryAccess, requestCameraAccess } from '@/services/permissions';
import { VoiceRecorder } from '@/components/ui/VoiceRecorder';
import { VoiceMessagePlayer, stopVoicePlayback } from '@/components/ui/VoiceMessagePlayer';
import { ProfileImagePreview } from '@/components/profile/ProfileImagePreview';
import {
  updateUser,
  calculateProfileCompleteness,
  addPhotoToAlbum,
  removePhotoFromAlbum,
  addUserTag,
  removeUserTag,
} from '@/services/firebase/users';
import { clearEquippedUserFrame } from '@/services/firebase/roomDecor';
import { getJoinDays } from '@/utils/joinDays';
import { colors, radius, spacing, shadows } from '@/theme';

// ==================== CONSTANTS ====================

const MAX_ALBUM_PHOTOS = 9;

const GENDER_OPTIONS = [
  { value: 'male' as const, label: i18n.t('profile.male'), symbol: '♂', accent: '#ED4444', soft: '#FCDDDD' },
  { value: 'female' as const, label: i18n.t('profile.female'), symbol: '♀', accent: '#E11414', soft: '#FFE6E9' },
] as const;

const RELATIONSHIP_OPTIONS = [
  { value: 'single', label: i18n.t('profile.single'), emoji: '💚' },
  { value: 'engaged', label: i18n.t('profile.engaged'), emoji: '💍' },
  { value: 'married', label: i18n.t('profile.married'), emoji: '💍' },
  { value: 'complicated', label: i18n.t('profileEdit.text32556'), emoji: '🤷' },
  { value: 'prefer-not', label: i18n.t('profile.preferNotSay'), emoji: '🤐' },
];

const EDUCATION_OPTIONS = [
  i18n.t('profileEdit.text45754'),
  i18n.t('profileEdit.text80920'),
  i18n.t('profileEdit.text82151'),
  i18n.t('profileEdit.text41468'),
  i18n.t('profileEdit.text39193'),
  i18n.t('agency.text84518'),
];

interface DetailField {
  key: 'height' | 'weight' | 'education' | 'job' | 'relationship';
  label: string;
  placeholder?: string;
  type: 'text' | 'number' | 'select';
  options?: { value: string; label: string; emoji?: string }[];
  unit?: string;
}

const DETAIL_FIELDS: DetailField[] = [
  { key: 'height', label: i18n.t('profile.height'), placeholder: i18n.t('profileEdit.text774192'), type: 'number', unit: i18n.t('profile.cm') },
  { key: 'weight', label: i18n.t('profile.weight'), placeholder: i18n.t('profileEdit.text774193'), type: 'number', unit: i18n.t('profile.kg') },
  {
    key: 'education',
    label: i18n.t('profile.education'),
    type: 'select',
    options: EDUCATION_OPTIONS.map((e) => ({ value: e, label: e })),
  },
  { key: 'job', label: i18n.t('profile.job'), placeholder: i18n.t('profileEdit.text14709'), type: 'text' },
  {
    key: 'relationship',
    label: i18n.t('profile.relationshipStatus'),
    type: 'select',
    options: RELATIONSHIP_OPTIONS,
  },
];

// ==================== MAIN ====================

export default function EditProfileScreen() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const textAlign = isAr ? 'right' : 'left';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { vipSystem } = useConfig();
  // امتياز SVIP «صورة متحركة»: السماح بصورة GIF متحركة (دون قص يُفقد الحركة)
  const canAnimatedAvatar = userHasVipFeature(user, 'animatedAvatar', vipSystem);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const updateUserData = useAuthStore((s) => s.updateUserData);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [frameBusy, setFrameBusy] = useState(false);
  const equippedFrameUrl = useEquippedFrameUrl(user?.uid);
  const framedAvatarSize = 72;
  const framedContainerSize = getFramedAvatarContainerSize(framedAvatarSize);

  // ==================== STATE ====================

  // معلومات أساسية
  const [displayName, setDisplayName] = useState(user?.profile.displayName ?? '');
  const [bio, setBio] = useState(user?.profile.bio ?? '');
  const [gender, setGender] = useState<'male' | 'female'>(
    user?.profile.gender ?? 'male',
  );
  const [country, setCountry] = useState(user?.profile.country ?? '');
  const [residence, setResidence] = useState(user?.profile.residence ?? '');
  const [birthYear, setBirthYear] = useState<number>(
    user?.profile.birthYear ?? 1995,
  );

  // الأفاتار والألبوم
  const [avatarUrl, setAvatarUrl] = useState(user?.profile.avatar ?? '');
  const [albums, setAlbums] = useState<string[]>(user?.profile.photos ?? []);
  // معاينة صورة الألبوم بالحجم الكامل عند الضغط
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // الوسوم
  const [tags, setTags] = useState<string[]>(user?.profile.tags ?? []);
  const [voiceBioUrl, setVoiceBioUrl] = useState(user?.profile.voiceBio ?? '');
  const [voiceBioDuration, setVoiceBioDuration] = useState(user?.profile.voiceBioDuration ?? 0);
  const [voiceUploading, setVoiceUploading] = useState(false);

  // التفاصيل
  const [details, setDetails] = useState({
    height: user?.profile.height ?? '',
    weight: user?.profile.weight ?? '',
    education: user?.profile.education ?? '',
    job: user?.profile.job ?? '',
    relationship: user?.profile.relationship ?? '',
  });

  // Modals
  const [showNameModal, setShowNameModal] = useState(false);
  const [showBioModal, setShowBioModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState<'country' | 'residence' | null>(null);
  const [showBirthModal, setShowBirthModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<DetailField | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);
  const [photoTarget, setPhotoTarget] = useState<'avatar' | 'album'>('avatar');
  const photoTargetRef = useRef<'avatar' | 'album'>('avatar');
  const [showPhotoSource, setShowPhotoSource] = useState(false);

  // Temp values for modals
  const [tempValue, setTempValue] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // ==================== COMPUTED ====================

  const integrity = calculateProfileCompleteness({
    displayName,
    avatar: avatarUrl,
    gender,
    birthYear,
    country,
    residence,
    bio,
    photos: albums,
    voiceBio: voiceBioUrl,
    ...details,
  } as any);

  const age = birthYear ? new Date().getFullYear() - birthYear : 0;
  const joinDays = getJoinDays(user?.createdAt);

  // ==================== HANDLERS ====================

  /** حفظ سريع لحقل واحد في Firestore */
  const saveField = useCallback(
    async (updates: any) => {
      if (!user?.uid) return false;
      try {
        await updateUser(user.uid, updates);
        await refreshUser();
        return true;
      } catch (e: any) {
        Alert.alert(t('roomSettings.text32386'), e.message ?? t('errors.saveFailed'));
        return false;
      }
    },
    [user?.uid, refreshUser, t],
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopVoicePlayback();
      };
    }, []),
  );

  const openPhotoSourceSheet = (target: 'avatar' | 'album') => {
    photoTargetRef.current = target;
    setPhotoTarget(target);
    setShowPhotoSource(true);
  };

  const handleRemoveFrame = () => {
    Alert.alert(
      t('profileEdit.removeActiveFrame'),
      t('profileEdit.removeActiveFrameConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profileEdit.removeActiveFrameAction'),
          style: 'destructive',
          onPress: async () => {
            setFrameBusy(true);
            try {
              await clearEquippedUserFrame();
              await refreshUser();
              await updateUserData({ equippedFrameId: '' });
            } catch (e: unknown) {
              Alert.alert(
                t('common.error'),
                e instanceof Error ? e.message : t('errors.saveFailed'),
              );
            } finally {
              setFrameBusy(false);
            }
          },
        },
      ],
    );
  };

  const handlePickPhoto = async (fromCamera: boolean) => {
    const target = photoTargetRef.current;

    try {
      if (target === 'album' && !fromCamera && albums.length >= MAX_ALBUM_PHOTOS) {
        Alert.alert(t('profile.loginRequired'), t('profileEdit.text49622'));
        return;
      }

      if (fromCamera) {
        const camOk = await requestCameraAccess();
        if (!camOk) {
          Alert.alert(t('profileEdit.text69529'), t('profileEdit.text14924'));
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: target === 'avatar' && !canAnimatedAvatar,
          ...(target === 'avatar' && !canAnimatedAvatar ? { aspect: [1, 1] as [number, number] } : {}),
          quality: 0.85,
        });
        if (result.canceled || !result.assets[0]) return;

        setUploading(true);
        setUploadProgress(0);
        const onProgress = (p: number) => setUploadProgress(p);
        const uri = result.assets[0].uri;
        const url =
          target === 'avatar'
            ? await uploadAvatar(uri, onProgress)
            : await uploadAlbumImage(uri, onProgress);

        if (target === 'avatar') {
          setAvatarUrl(url);
          await saveField({ avatar: url });
        } else {
          const newAlbums = [...albums, url].slice(0, MAX_ALBUM_PHOTOS);
          setAlbums(newAlbums);
          await saveField({ photos: newAlbums });
        }
        return;
      }

      const libraryOk = await requestMediaLibraryAccess();
      if (!libraryOk) {
        Alert.alert(
          t('profileEdit.text69529'),
          'نحتاج إذن الوصول للمعرض. فعّله من إعدادات الجهاز ثم حاول مرة أخرى.',
        );
        return;
      }

      const remainingAlbumSlots =
        target === 'album' ? MAX_ALBUM_PHOTOS - albums.length : 1;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: target === 'avatar' && !canAnimatedAvatar,
        ...(target === 'avatar' && !canAnimatedAvatar ? { aspect: [1, 1] as [number, number] } : {}),
        ...(target === 'album'
          ? {
              allowsMultipleSelection: true,
              selectionLimit: remainingAlbumSlots,
            }
          : {}),
        quality: 0.85,
        ...(Platform.OS === 'ios'
          ? { presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN }
          : {}),
      });

      if (result.canceled || !result.assets.length) return;

      if (target === 'avatar') {
        const uri = result.assets[0]!.uri;
        setUploading(true);
        setUploadProgress(0);
        const url = await uploadAvatar(uri, setUploadProgress);
        setAvatarUrl(url);
        await saveField({ avatar: url });
        return;
      }

      const uris = result.assets
        .map((a) => a.uri)
        .slice(0, remainingAlbumSlots);
      if (!uris.length) return;

      setUploading(true);
      setUploadProgress(0);
      const uploaded: string[] = [];
      for (let i = 0; i < uris.length; i++) {
        const url = await uploadAlbumImage(uris[i]!, (p) => {
          setUploadProgress(((i + p / 100) / uris.length) * 100);
        });
        uploaded.push(url);
      }

      const newAlbums = [...albums, ...uploaded].slice(0, MAX_ALBUM_PHOTOS);
      setAlbums(newAlbums);
      await saveField({ photos: newAlbums });
    } catch (e: any) {
      Alert.alert(t('roomSettings.text32386'), e?.message ?? t('errors.saveFailed'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ===== Delete album photo =====
  const handleDeletePhoto = (url: string) => {
    Alert.alert(t('profileEdit.text45885'), t('profileEdit.text23082'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const newAlbums = albums.filter((p) => p !== url);
          setAlbums(newAlbums);
          await saveField({ photos: newAlbums });
        },
      },
    ]);
  };

  // ===== Save name =====
  const handleSaveName = async () => {
    if (!tempValue.trim() || tempValue.length < 2) {
      Alert.alert(t('roomSettings.text32386'), t('auth.nameMin'));
      return;
    }
    setSaving(true);
    const ok = await saveField({ displayName: tempValue.trim() });
    if (ok) {
      setDisplayName(tempValue.trim());
      setShowNameModal(false);
    }
    setSaving(false);
  };

  // ===== Save bio =====
  const handleSaveBio = async () => {
    setSaving(true);
    const ok = await saveField({ bio: tempValue.trim() });
    if (ok) {
      setBio(tempValue.trim());
      setShowBioModal(false);
    }
    setSaving(false);
  };

  // ===== Save gender =====
  const handleSaveGender = async (g: 'male' | 'female') => {
    if (g === gender) return;
    const prev = gender;
    setGender(g);
    const ok = await saveField({ gender: g });
    if (!ok) setGender(prev); // فشل الحفظ = إرجاع القيمة الحقيقية بدل عرض قيمة لم تُحفظ
  };

  // ===== Save birth year =====
  const handleSaveBirthYear = async () => {
    const year = parseInt(tempValue);
    if (isNaN(year) || year < 1940 || year > new Date().getFullYear() - 13) {
      Alert.alert(t('roomSettings.text32386'), t('profileEdit.text96114'));
      return;
    }
    setSaving(true);
    const ok = await saveField({ birthYear: year });
    if (ok) {
      setBirthYear(year);
      setShowBirthModal(false);
    }
    setSaving(false);
  };

  // ===== Save country / residence =====
  const handleSaveCountry = async (code: string) => {
    if (showCountryModal === 'country') {
      const prev = country;
      setCountry(code);
      const ok = await saveField({ country: code });
      if (!ok) setCountry(prev);
    } else {
      const prev = residence;
      setResidence(code);
      const ok = await saveField({ residence: code });
      if (!ok) setResidence(prev);
    }
    setShowCountryModal(null);
  };

  // ===== Save detail =====
  const handleSaveDetail = async () => {
    if (!showDetailModal) return;
    const key = showDetailModal.key;
    setSaving(true);
    const ok = await saveField({ [key]: tempValue.trim() });
    if (ok) {
      setDetails((p) => ({ ...p, [key]: tempValue.trim() }));
      setShowDetailModal(null);
      setTempValue('');
    }
    setSaving(false);
  };

  // ===== Save select detail =====
  const handleSelectDetailOption = async (value: string) => {
    if (!showDetailModal) return;
    const key = showDetailModal.key;
    setDetails((p) => ({ ...p, [key]: value }));
    setShowDetailModal(null);
    await saveField({ [key]: value });
  };

  // ===== Add tag =====
  // منطق مشترك يصلح للإدخال اليدوي وللأوسمة الجاهزة. يرجع true عند النجاح.
  const addTag = async (raw: string): Promise<boolean> => {
    const tag = raw.trim();
    if (!tag || tag.length < 2) {
      Alert.alert(t('roomSettings.text32386'), t('profileEdit.text80586'));
      return false;
    }
    if (tags.includes(tag)) {
      Alert.alert(t('profile.loginRequired'), t('profileEdit.text20058'));
      return false;
    }
    if (tags.length >= 6) {
      Alert.alert(t('profile.loginRequired'), t('profileEdit.text30581'));
      return false;
    }
    setSaving(true);
    const newTags = [...tags, tag];
    const ok = await saveField({ tags: newTags });
    if (ok) {
      setTags(newTags);
      setTempValue('');
    }
    setSaving(false);
    return ok;
  };

  // إدخال يدوي من حقل النص → يغلق المودال بعد الإضافة
  const handleAddTag = async () => {
    const ok = await addTag(tagDraft);
    if (ok) setShowTagModal(false);
  };

  // نقرة على وسم جاهز → يُضاف مباشرة ويبقى المودال مفتوحاً لاختيار المزيد
  const handleAddPresetTag = (preset: string) => {
    void addTag(preset);
  };

  const handleRemoveTag = async (tag: string) => {
    const prev = tags;
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    const ok = await saveField({ tags: newTags });
    if (!ok) setTags(prev); // فشل الحفظ = إرجاع الوسوم الحقيقية
  };

  // ==================== RENDER ====================

  const currentCountry = getCountryByCode(country);
  const currentResidence = getCountryByCode(residence);

  // قيمة معروضة للحقل
  const getDetailDisplay = (key: DetailField['key']): string => {
    const value = details[key];
    if (!value) return '';
    const field = DETAIL_FIELDS.find((f) => f.key === key);
    if (field?.unit) return `${value} ${field.unit}`;
    if (field?.options) {
      const opt = field.options.find((o) => o.value === value);
      return opt?.label ?? value;
    }
    return value;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <X size={22} color="#1F2937" strokeWidth={2.5} />
        </Pressable>
        <Text variant="h3" weight="bold" color="#1F2937">
          {t('profileEdit.text5672')}
        </Text>
        <View style={styles.integrityCircle}>
          <Text variant="caption" weight="bold" color="#E11414" style={{ fontSize: 11 }}>
            {integrity}%
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ==================== Data Integrity ==================== */}
        <View style={styles.integrityCard}>
          <View style={styles.integrityHeader}>
            <Text variant="bodySmall" weight="bold" color="#E11414">
              {t('profileEdit.text35838')}
            </Text>
            <Text variant="h2" weight="bold" color="#E11414">
              {integrity}%
            </Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${integrity}%` }]}>
              <LinearGradient
                colors={['#FF5C5C', '#E11414']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            {/* مؤشرات على شريط التقدم */}
            <View
              style={[
                styles.progressMarker,
                {
                  start: '40%',
                  backgroundColor: integrity >= 40 ? '#E11414' : '#FBD5D5',
                },
              ]}
            >
              <Award size={14} color={colors.white} strokeWidth={2.5} />
            </View>
            <View
              style={[
                styles.progressMarker,
                {
                  start: '100%',
                  marginStart: -28,
                  backgroundColor: integrity >= 100 ? '#FCD34D' : '#FBD5D5',
                },
              ]}
            >
              <Award size={14} color={colors.white} strokeWidth={2.5} fill={integrity >= 100 ? colors.white : 'transparent'} />
            </View>
          </View>
          <Text variant="caption" color="#E11414" weight="medium" style={{ marginTop: 14, textAlign }}>
            {integrity >= 100
              ? t('profileEdit.profileComplete')
              : t('profileEdit.profileIncomplete', { percent: 100 - integrity })}
          </Text>
        </View>

        {/* ==================== Avatar + Albums ==================== */}
        <View style={styles.section}>
          <View style={styles.avatarRow}>
            <Pressable
              onPress={() =>
                Alert.alert(t('profileEdit.text23299'), t('profileEdit.photoTips'))
              }
              style={styles.rulesBtn}
            >
              <Text variant="bodySmall" color="#9CA3AF">{t('vip.rules')}</Text>
              <HelpCircle size={14} color="#9CA3AF" />
            </Pressable>

            <Pressable
              onPress={() => openPhotoSourceSheet('avatar')}
              disabled={uploading}
              style={[
                styles.avatarWrap,
                equippedFrameUrl && {
                  width: framedContainerSize,
                  height: framedContainerSize,
                },
              ]}
            >
              {equippedFrameUrl ? (
                <FramedAvatar
                  avatarUri={avatarUrl || undefined}
                  frameUri={equippedFrameUrl}
                  avatarSize={framedAvatarSize}
                  fallbackLetter={displayName || '?'}
                />
              ) : (
                <Image
                  source={{ uri: avatarUrl || 'https://i.pravatar.cc/200?img=12' }}
                  style={styles.avatarImg}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
              )}
              <View style={styles.cameraOverlay}>
                {uploading && photoTarget === 'avatar' ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Camera size={24} color={colors.white} strokeWidth={2.5} />
                )}
              </View>
              <View style={styles.replaceBadge}>
                <Text variant="caption" weight="bold" color="#1F2937" style={{ fontSize: 11 }}>
                  {uploading && photoTarget === 'avatar' ? `${Math.round(uploadProgress)}%` : t('wallet.exchange')}
                </Text>
              </View>
            </Pressable>
          </View>

          {equippedFrameUrl ? (
            <Pressable
              onPress={handleRemoveFrame}
              disabled={frameBusy}
              style={styles.removeFrameBtn}
            >
              {frameBusy ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <>
                  <X size={14} color="#EF4444" strokeWidth={2.5} />
                  <Text variant="caption" weight="semibold" color="#EF4444">
                    {t('profileEdit.removeActiveFrame')}
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}

          {/* مقتنياتي — خزانة العناصر المملوكة (إطارات/دخوليات/فقاعات): يعرض كل
              ما يملكه المستخدم ويختار ماذا يرتدي؛ المنتهي يسقط تلقائياً */}
          <Pressable
            onPress={() => router.push('/store/inventory' as any)}
            style={styles.wardrobeBtn}
          >
            <Package size={16} color="#7C3AED" strokeWidth={2.2} />
            <Text variant="caption" weight="bold" color="#7C3AED">
              {t('store.myItems', 'مقتنياتي — الإطارات والدخوليات والفقاعات')}
            </Text>
          </Pressable>

          {/* Albums header */}
          <View style={styles.albumsHeader}>
            <Text variant="body" weight="bold" color="#1F2937">
              {t('profileEdit.text51647')}
            </Text>
            <Text variant="caption" color="#9CA3AF">
              {albums.length}/{MAX_ALBUM_PHOTOS}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.albumsList}
          >
            <Pressable
              onPress={() => {
                if (albums.length >= MAX_ALBUM_PHOTOS) {
                  Alert.alert(t('profile.loginRequired'), t('profileEdit.text49622'));
                  return;
                }
                openPhotoSourceSheet('album');
              }}
              disabled={uploading || albums.length >= MAX_ALBUM_PHOTOS}
              style={styles.albumAdd}
            >
              {uploading && photoTarget === 'album' ? (
                <>
                  <ActivityIndicator color="#9CA3AF" size="small" />
                  <Text variant="caption" color="#9CA3AF" style={{ fontSize: 10, marginTop: 2 }}>
                    {Math.round(uploadProgress)}%
                  </Text>
                </>
              ) : (
                <Plus size={24} color="#9CA3AF" strokeWidth={2} />
              )}
            </Pressable>

            {albums.map((url, idx) => (
              <Pressable
                key={`${url}-${idx}`}
                style={styles.albumThumb}
                onPress={() => setPreviewUri(url)}
                onLongPress={() => handleDeletePhoto(url)}
              >
                <Image source={{ uri: url }} style={styles.albumThumbImg} contentFit="cover" cachePolicy="memory-disk" />
                <Pressable
                  onPress={() => handleDeletePhoto(url)}
                  style={styles.deletePhotoBtn}
                  hitSlop={6}
                >
                  <Trash2 size={11} color={colors.white} strokeWidth={2.5} />
                </Pressable>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ==================== Basic Information ==================== */}
        <View style={styles.section}>
          <Text
            variant="h4"
            weight="bold"
            color="#1F2937"
            style={[styles.sectionTitle, { textAlign }]}
          >
            {t('profileEdit.text34846')}
          </Text>

          {/* Display Name */}
          <Pressable
            style={styles.fieldRow}
            onPress={() => {
              setTempValue(displayName);
              setShowNameModal(true);
            }}
          >
            <Text variant="body" color="#6B7280" style={[styles.fieldLabel, { textAlign }]}>
              {t('profileEdit.text51454')}
            </Text>
            <View style={[styles.fieldValue, styles.fieldValueEnd]}>
              <Text
                variant="body"
                weight="semibold"
                color={displayName ? '#1F2937' : '#9CA3AF'}
                numberOfLines={1}
                style={[styles.fieldText, { textAlign }]}
              >
                {displayName || t('profileEdit.text71205')}
              </Text>
              <ForwardChevron size={16} color="#9CA3AF" />
            </View>
          </Pressable>

          {/* Gender */}
          <View style={styles.fieldRow}>
            <Text variant="body" color="#6B7280" style={[styles.fieldLabel, { textAlign }]}>
              {t('profile.gender')}
            </Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map((g) => {
                const active = gender === g.value;
                return (
                  <Pressable
                    key={g.value}
                    onPress={() => handleSaveGender(g.value)}
                    style={[
                      styles.genderBtn,
                      active && { backgroundColor: g.soft, borderColor: g.accent },
                    ]}
                  >
                    <View
                      style={[
                        styles.genderSymbolWrap,
                        active
                          ? { backgroundColor: g.accent, borderColor: g.accent }
                          : { borderColor: g.accent },
                      ]}
                    >
                      <Text
                        style={[
                          styles.genderSymbol,
                          { color: active ? '#FFFFFF' : g.accent },
                        ]}
                      >
                        {g.symbol}
                      </Text>
                    </View>
                    <Text
                      variant="caption"
                      weight={active ? 'bold' : 'medium'}
                      color={active ? g.accent : '#6B7280'}
                    >
                      {g.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Birth Year */}
          <Pressable
            style={styles.fieldRow}
            onPress={() => {
              setTempValue(birthYear.toString());
              setShowBirthModal(true);
            }}
          >
            <Text variant="body" color="#6B7280" style={[styles.fieldLabel, { textAlign }]}>
              {t('profile.ageLabel')}
            </Text>
            <View style={[styles.fieldValue, styles.fieldValueEnd]}>
              <Text variant="body" weight="semibold" color="#1F2937" style={{ textAlign }}>
                {t('profileEdit.age', { age, year: birthYear })}
              </Text>
              <ForwardChevron size={16} color="#9CA3AF" />
            </View>
          </Pressable>

          {/* Country */}
          <Pressable
            style={styles.fieldRow}
            onPress={() => setShowCountryModal('country')}
          >
            <Text variant="body" color="#6B7280" style={[styles.fieldLabel, { textAlign }]}>
              {t('profile.nationality')}
            </Text>
            <View style={[styles.fieldValue, styles.fieldValueEnd]}>
              <RealCountryFlag countryCode={country} size={18} shape="rectangle" />
              <Text variant="body" weight="semibold" color="#1F2937" style={{ textAlign }}>
                {currentCountry?.name ?? t('profileEdit.text71205')}
              </Text>
              <ForwardChevron size={16} color="#9CA3AF" />
            </View>
          </Pressable>

          {/* Residence */}
          <Pressable
            style={[styles.fieldRow, { borderBottomWidth: 0 }]}
            onPress={() => setShowCountryModal('residence')}
          >
            <Text variant="body" color="#6B7280" style={[styles.fieldLabel, { textAlign }]}>
              {t('profileEdit.text74943')}
            </Text>
            <View style={[styles.fieldValue, styles.fieldValueEnd]}>
              {residence ? (
                <RealCountryFlag countryCode={residence} size={18} shape="rectangle" />
              ) : null}
              <Text
                variant="body"
                weight="semibold"
                color={residence ? '#1F2937' : '#9CA3AF'}
                style={{ textAlign }}
              >
                {currentResidence?.name ?? t('profileEdit.text71205')}
              </Text>
              <ForwardChevron size={16} color="#9CA3AF" />
            </View>
          </Pressable>
        </View>

        {/* ==================== Details ==================== */}
        <View style={styles.section}>
          <Text
            variant="h4"
            weight="bold"
            color="#1F2937"
            style={[styles.sectionTitle, { textAlign }]}
          >
            {t('profile.details')}
          </Text>

          {DETAIL_FIELDS.map((field, idx) => {
            const value = getDetailDisplay(field.key);
            return (
              <Pressable
                key={field.key}
                style={[
                  styles.fieldRow,
                  idx === DETAIL_FIELDS.length - 1 && { borderBottomWidth: 0 },
                ]}
                onPress={() => {
                  setShowDetailModal(field);
                  setTempValue(details[field.key] ?? '');
                }}
              >
                <Text
                  variant="body"
                  weight="medium"
                  color="#374151"
                  style={[styles.fieldLabel, { textAlign }]}
                >
                  {field.label}
                </Text>
                <View style={[styles.fieldValue, styles.fieldValueEnd]}>
                  <Text
                    variant="body"
                    weight="semibold"
                    color={value ? '#1F2937' : '#9CA3AF'}
                    numberOfLines={1}
                    style={[styles.fieldText, { textAlign }]}
                  >
                    {value || t('profileEdit.text71205')}
                  </Text>
                  <ForwardChevron size={16} color="#9CA3AF" />
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ==================== Personality ==================== */}
        <View style={styles.section}>
          <Text
            variant="h4"
            weight="bold"
            color="#1F2937"
            style={[styles.sectionTitle, { textAlign }]}
          >
            {t('profileEdit.text99672')}
          </Text>

          {/* Bio */}
          <Text variant="caption" color="#6B7280" style={{ marginBottom: 8, textAlign }}>
            {t('profileEdit.text81513')}
          </Text>
          <Pressable
            style={styles.bioBox}
            onPress={() => {
              setTempValue(bio);
              setShowBioModal(true);
            }}
          >
            <Edit3 size={18} color="#9CA3AF" />
            <Text
              variant="body"
              weight="medium"
              color={bio ? '#1F2937' : '#E11414'}
              style={{ flex: 1, textAlign }}
            >
              {bio || t('profileEdit.text14004')}
            </Text>
          </Pressable>

          {/* Voice Bio */}
          <Text variant="caption" color="#6B7280" style={{ marginTop: 20, marginBottom: 8, textAlign }}>
            {t('profileMe.myVoice')}
          </Text>
          {voiceBioUrl ? (
            <View style={styles.voicePlayerWrap}>
              <View style={styles.voicePlayerCard}>
                <VoiceMessagePlayer
                  voiceUrl={voiceBioUrl}
                  duration={voiceBioDuration || 30}
                  variant="profile"
                />
                {voiceUploading ? (
                  <Text variant="caption" color="#E11414" style={{ marginTop: 6, textAlign: 'center' }}>
                    {t('common.uploading') || 'جاري الرفع...'} {Math.round(uploadProgress)}%
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={async () => {
                  stopVoicePlayback();
                  setVoiceBioUrl('');
                  setVoiceBioDuration(0);
                  await saveField({ voiceBio: '', voiceBioDuration: 0 });
                }}
                style={styles.voiceDelete}
                disabled={voiceUploading}
              >
                <Trash2 size={14} color="#EF4444" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.voiceRecordWrap}>
              {voiceUploading ? (
                <View style={styles.voiceUploading}>
                  <ActivityIndicator color="#E11414" />
                  <Text variant="caption" color="#6B7280">
                    {t('common.uploading') || 'جاري الرفع...'} {Math.round(uploadProgress)}%
                  </Text>
                </View>
              ) : (
                <VoiceRecorder
                  variant="bar"
                  color="#E11414"
                  onRecorded={async (uri, durationSec) => {
                    if (durationSec < 1) return;
                    setVoiceBioUrl(uri);
                    setVoiceBioDuration(durationSec);
                    setVoiceUploading(true);
                    setUploadProgress(0);
                    try {
                      const url = await uploadVoiceBio(uri, setUploadProgress);
                      setVoiceBioUrl(url);
                      const saved = await saveField({ voiceBio: url, voiceBioDuration: durationSec });
                      if (saved) {
                        Alert.alert(t('common.done'), t('profileMe.voiceSaved'));
                      }
                    } catch (e: any) {
                      setVoiceBioUrl('');
                      setVoiceBioDuration(0);
                      Alert.alert(t('common.error'), e?.message ?? t('common.errorOccurred'));
                    } finally {
                      setVoiceUploading(false);
                      setUploadProgress(0);
                    }
                  }}
                />
              )}
            </View>
          )}

          {/* Tags */}
          <Text variant="caption" color="#6B7280" style={{ marginTop: 20, marginBottom: 8, textAlign }}>
            {t('profile.personalTags')}
          </Text>
          <View style={styles.tagsRow}>
            <Pressable
              onPress={() => {
                setTagDraft('');
                setShowTagModal(true);
              }}
              style={styles.tagAdd}
              disabled={tags.length >= 6}
            >
              <Plus size={14} color="#6B7280" strokeWidth={2} />
              <Text variant="caption" color="#6B7280" weight="medium">
                {t('profileEdit.text55856')}
              </Text>
            </Pressable>

            {/* Auto tag - join days */}
            {joinDays > 0 ? (
            <View style={styles.tag}>
              <Text variant="caption" color="#E11414" weight="bold">
                {t('profileEdit.joinedDays', { days: joinDays })}
              </Text>
            </View>
            ) : null}

            {/* User tags */}
            {tags.map((tag, idx) => (
              <Pressable
                key={`${tag}-${idx}`}
                onLongPress={() =>
                  Alert.alert(t('profileEdit.text8028'), t('profileEdit.deleteTagConfirm', { tag }), [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('common.delete'), style: 'destructive', onPress: () => handleRemoveTag(tag) },
                  ])
                }
                style={styles.tagUser}
              >
                <Text variant="caption" color="#E11414" weight="bold">
                  {tag}
                </Text>
                <Pressable onPress={() => handleRemoveTag(tag)} hitSlop={6}>
                  <X size={10} color="#E11414" strokeWidth={3} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable style={styles.postIntroWrap} onPress={() => router.push('/post/create' as any)}>
          <LinearGradient
            colors={lu.gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.postIntroBtn}
          >
            <Hash size={18} color="#fff" strokeWidth={2.5} />
            <Text variant="body" weight="bold" color="#fff" style={{ flex: 1, textAlign }}>
              {t('profileEdit.introPostCta')}
            </Text>
            <ForwardChevron size={18} color="#fff" />
          </LinearGradient>
        </Pressable>
      </ScrollView>

      {/* ==================== Modals ==================== */}

      {/* Name Modal */}
      <ModalEditField
        visible={showNameModal}
        title={t('profileEdit.text49867')}
        placeholder={t('profileEdit.text37971')}
        value={tempValue}
        onChange={setTempValue}
        maxLength={20}
        saving={saving}
        onSave={handleSaveName}
        onCancel={() => setShowNameModal(false)}
      />

      {/* Bio Modal */}
      <ModalEditField
        visible={showBioModal}
        title={t('profileEdit.text81513')}
        placeholder={t('profileEdit.text38662')}
        value={tempValue}
        onChange={setTempValue}
        maxLength={150}
        multiline
        saving={saving}
        onSave={handleSaveBio}
        onCancel={() => setShowBioModal(false)}
      />

      {/* Birth Year Modal */}
      <ModalEditField
        visible={showBirthModal}
        title={t('auth.birthYearLabel')}
        placeholder={t('profileEdit.text77419')}
        value={tempValue}
        onChange={setTempValue}
        keyboardType="numeric"
        maxLength={4}
        saving={saving}
        onSave={handleSaveBirthYear}
        onCancel={() => setShowBirthModal(false)}
      />

      {/* Tag Modal — مع أوسمة جاهزة */}
      <TagPickerModal
        visible={showTagModal}
        value={tagDraft}
        onChange={setTagDraft}
        currentTags={tags}
        maxTags={6}
        saving={saving}
        onAddManual={handleAddTag}
        onAddPreset={handleAddPresetTag}
        onCancel={() => setShowTagModal(false)}
      />

      {/* Detail Modal (text/number/select) */}
      <Modal
        visible={!!showDetailModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDetailModal(null)}
      >
        <Pressable style={styles.modalBg} onPress={() => setShowDetailModal(null)}>
          <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
            <Text variant="h3" weight="bold" align="center" style={{ marginBottom: 16 }}>
              {showDetailModal?.label}
            </Text>

            {showDetailModal?.type === 'select' ? (
              <ScrollView style={{ maxHeight: 320 }}>
                {showDetailModal.options?.map((opt) => {
                  const active = details[showDetailModal.key] === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => handleSelectDetailOption(opt.value)}
                      style={[styles.optionRow, active && styles.optionRowActive]}
                    >
                      {active && (
                        <View style={styles.optionCheck}>
                          <Check size={14} color={colors.white} strokeWidth={3} />
                        </View>
                      )}
                      <Text
                        variant="body"
                        weight={active ? 'bold' : 'medium'}
                        color={active ? '#E11414' : '#1F2937'}
                        style={{ flex: 1 }}
                      >
                        {opt.label}
                      </Text>
                      {opt.emoji && <Text variant="h3">{opt.emoji}</Text>}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <>
                <View style={styles.inputWrap}>
                  {showDetailModal?.unit && (
                    <Text variant="bodySmall" color="#9CA3AF" style={styles.inputUnit}>
                      {showDetailModal.unit}
                    </Text>
                  )}
                  <TextInput
                    value={tempValue}
                    onChangeText={setTempValue}
                    style={[styles.input, { textAlign: isAr ? 'right' : 'left' }]}
                    placeholder={showDetailModal?.placeholder ?? ''}
                    placeholderTextColor="#9CA3AF"
                    keyboardType={showDetailModal?.type === 'number' ? 'numeric' : 'default'}
                    maxLength={showDetailModal?.type === 'number' ? 3 : 50}
                    autoFocus
                  />
                </View>
                <View style={styles.modalActions}>
                  <Pressable onPress={() => setShowDetailModal(null)} style={[styles.modalBtn, styles.modalBtnCancel]}>
                    <Text variant="button" weight="bold" color="#6B7280">{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable onPress={handleSaveDetail} disabled={saving} style={[styles.modalBtn, styles.modalBtnSave]}>
                    <LinearGradient colors={['#FF5C5C', '#E11414']} style={StyleSheet.absoluteFill} />
                    {saving ? <ActivityIndicator color={colors.white} /> : (
                      <Text variant="button" weight="bold" color={colors.white}>{t('common.save')}</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <CountryPickerSheet
        visible={!!showCountryModal}
        title={showCountryModal === 'country' ? t('auth.chooseNationality') : t('profileEdit.text20353')}
        selectedCode={showCountryModal === 'country' ? country : residence}
        onSelect={(c) => handleSaveCountry(c.code)}
        onClose={() => setShowCountryModal(null)}
      />

      <PhotoSourceSheet
        visible={showPhotoSource}
        title={photoTarget === 'avatar' ? t('profileEdit.text69529') : t('profileEdit.text94014')}
        subtitle={t('profileEdit.text30292')}
        cameraLabel={t('profileEdit.text44435')}
        cameraHint={t('profileEdit.text14924')}
        galleryLabel={t('profileEdit.text31778')}
        galleryHint={t('profileEdit.text30292')}
        cancelLabel={t('common.cancel')}
        onClose={() => setShowPhotoSource(false)}
        onCamera={() => void handlePickPhoto(true)}
        onGallery={() => void handlePickPhoto(false)}
      />

      {/* معاينة صورة الألبوم بالحجم الكامل */}
      <ProfileImagePreview uri={previewUri} onClose={() => setPreviewUri(null)} />

    </View>
  );
}

// ==================== HELPER: MODAL EDIT FIELD ====================
interface ModalEditFieldProps {
  visible: boolean;
  title: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

const ModalEditField: React.FC<ModalEditFieldProps> = ({
  visible,
  title,
  placeholder,
  value,
  onChange,
  maxLength,
  multiline,
  keyboardType,
  saving,
  onSave,
  onCancel,
}) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  return (
  <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <Pressable style={styles.modalBg} onPress={onCancel}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <Text variant="h3" weight="bold" align="center" style={{ marginBottom: 16 }}>
            {title}
          </Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            style={[
              // ⚠️ نستخدم modalInput (بلا flex:1) لأن flex العمودي داخل المودال
              //    كان يُنهي ارتفاع الحقل فلا يظهر النص. modalInput له minHeight ثابت.
              styles.modalInput,
              { textAlign: isAr ? 'right' : 'left', writingDirection: isAr ? 'rtl' : 'ltr' },
              multiline && {
                minHeight: 130,
                paddingTop: 12,
                textAlignVertical: 'top',
              },
            ]}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            maxLength={maxLength}
            multiline={multiline}
            keyboardType={keyboardType}
            autoFocus
          />
          {maxLength && (
            <Text variant="caption" color="#9CA3AF" align={isAr ? 'right' : 'left'} style={{ marginTop: 4 }}>
              {value.length}/{maxLength}
            </Text>
          )}
          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} style={[styles.modalBtn, styles.modalBtnCancel]}>
              <Text variant="button" weight="bold" color="#6B7280">{t('common.cancel')}</Text>
            </Pressable>
            <Pressable onPress={onSave} disabled={saving} style={[styles.modalBtn, styles.modalBtnSave]}>
              <LinearGradient colors={['#FF5C5C', '#E11414']} style={StyleSheet.absoluteFill} />
              {saving ? <ActivityIndicator color={colors.white} /> : (
                <Text variant="button" weight="bold" color={colors.white}>{t('common.save')}</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  </Modal>
  );
};

// ==================== HELPER: TAG PICKER MODAL ====================
// أوسمة جاهزة مبنية على طبيعة التطبيق (غرف صوتية، هدايا، ألعاب، صداقة، موسيقى)
const PRESET_TAGS_AR = [
  'دردشة', 'أصدقاء جدد', 'موسيقى', 'غناء', 'ألعاب', 'مرح',
  'رومانسي', 'هادئ', 'رياضة', 'سفر', 'طبخ', 'أفلام',
  'قهوة', 'تصوير', 'نجم الغرف', 'كريم',
];
const PRESET_TAGS_EN = [
  'Chatting', 'New Friends', 'Music', 'Singing', 'Gaming', 'Fun',
  'Romantic', 'Calm', 'Sports', 'Travel', 'Cooking', 'Movies',
  'Coffee', 'Photography', 'Room Star', 'Generous',
];

interface TagPickerModalProps {
  visible: boolean;
  value: string;
  onChange: (v: string) => void;
  currentTags: string[];
  maxTags: number;
  saving: boolean;
  onAddManual: () => void;
  onAddPreset: (tag: string) => void;
  onCancel: () => void;
}

const TagPickerModal: React.FC<TagPickerModalProps> = ({
  visible,
  value,
  onChange,
  currentTags,
  maxTags,
  saving,
  onAddManual,
  onAddPreset,
  onCancel,
}) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const align = isAr ? 'right' : 'left';
  const presets = isAr ? PRESET_TAGS_AR : PRESET_TAGS_EN;
  const reachedLimit = currentTags.length >= maxTags;
  // نُخفي الأوسمة الجاهزة التي أُضيفت بالفعل
  const available = presets.filter((p) => !currentTags.includes(p));

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.modalBg} onPress={onCancel}>
          <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
            <Text variant="h3" weight="bold" align="center" style={{ marginBottom: 4 }}>
              {t('profileEdit.text55856')}
            </Text>
            <Text variant="caption" color="#9CA3AF" align="center" style={{ marginBottom: 16 }}>
              {currentTags.length}/{maxTags}
            </Text>

            {/* حقل الإدخال — كبير وواضح ويظهر ما يُكتب */}
            <View style={styles.tagInputWrap}>
              <Hash size={18} color="#E11414" />
              <TextInput
                value={value}
                onChangeText={onChange}
                style={[styles.tagInput, { textAlign: align, writingDirection: isAr ? 'rtl' : 'ltr' }]}
                placeholder={t('profileEdit.text66805')}
                placeholderTextColor="#9CA3AF"
                maxLength={20}
                editable={!reachedLimit}
                returnKeyType="done"
                onSubmitEditing={onAddManual}
                autoFocus
              />
            </View>
            <Text variant="caption" color="#9CA3AF" align={align} style={{ marginTop: 6 }}>
              {value.length}/20
            </Text>

            <ScrollView
              style={styles.presetScroll}
              contentContainerStyle={styles.presetScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* الأوسمة الجاهزة */}
              {!reachedLimit && available.length > 0 && (
                <>
                  <Text variant="caption" color="#6B7280" weight="medium" align={align} style={{ marginTop: 16, marginBottom: 8 }}>
                    {t('profileEdit.presetTagsLabel')}
                  </Text>
                  <View style={styles.presetWrap}>
                    {available.map((p) => (
                      <Pressable
                        key={p}
                        onPress={() => onAddPreset(p)}
                        disabled={saving}
                        style={styles.presetChip}
                      >
                        <Plus size={12} color="#E11414" strokeWidth={2.5} />
                        <Text variant="caption" color="#E11414" weight="medium">{p}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            {reachedLimit && (
              <Text variant="caption" color="#E11414" align="center" style={{ marginTop: 12 }}>
                {t('profileEdit.text30581')}
              </Text>
            )}

            <View style={styles.modalActions}>
              <Pressable onPress={onCancel} style={[styles.modalBtn, styles.modalBtnCancel]}>
                <Text variant="button" weight="bold" color="#6B7280">{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={onAddManual}
                disabled={saving || reachedLimit || value.trim().length < 2}
                style={[styles.modalBtn, styles.modalBtnSave, (reachedLimit || value.trim().length < 2) && { opacity: 0.5 }]}
              >
                <LinearGradient colors={['#FF5C5C', '#E11414']} style={StyleSheet.absoluteFill} />
                {saving ? <ActivityIndicator color={colors.white} /> : (
                  <Text variant="button" weight="bold" color={colors.white}>{t('common.save')}</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },

  // Header
  header: {
    flexDirection: 'row', // RTL
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  integrityCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#E11414',
    alignItems: 'center', justifyContent: 'center',
  },

  scrollContent: {
    padding: spacing.base,
  },

  // Integrity card
  integrityCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.base,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  integrityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 4,
    position: 'relative',
    marginTop: 8,
  },
  progressBarFill: {
    position: 'absolute',
    start: 0, // يبدأ من جهة القراءة في اللغتين
    top: 0, bottom: 0,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressMarker: {
    position: 'absolute',
    top: -10,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: colors.white,
    ...shadows.sm,
  },

  // Section
  section: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.base,
    marginBottom: 12,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  postIntroWrap: { marginHorizontal: 4, marginTop: 4, marginBottom: 8 },
  postIntroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },

  // Avatar
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  avatarWrap: {
    width: 100, height: 100,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  avatarImg: {
    width: 100, height: 100, borderRadius: 50,
  },
  cameraOverlay: {
    position: 'absolute',
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  replaceBadge: {
    position: 'absolute',
    bottom: -10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...shadows.sm,
  },
  rulesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  removeFrameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  // زر «مقتنياتي» — مدخل خزانة العناصر من تعديل البروفايل
  wardrobeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },

  // Albums
  albumsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  albumsList: {
    gap: 8,
    flexDirection: 'row',
  },
  albumThumb: {
    width: 54,
    height: 78,
    borderRadius: 27,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  albumThumbImg: {
    width: '100%', height: '100%',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: 4, end: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  albumAdd: {
    width: 54, height: 78,
    borderRadius: 27,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },

  // Fields
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  fieldLabel: {
    flexShrink: 0,
    minWidth: 110,
  },
  fieldValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
  },
  fieldValueEnd: {
    justifyContent: 'flex-end',
  },
  fieldText: {
    flexShrink: 1,
  },

  // Gender
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  genderSymbolWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  genderSymbol: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
    includeFontPadding: false,
  },

  // Bio
  bioBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFE6E9',
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    borderRadius: radius.md,
  },

  // Tags
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: radius.full,
  },
  tagUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: radius.full,
  },
  tagAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: radius.full,
  },

  // Modals
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modal: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: spacing.base,
  },
  inputUnit: {
    paddingVertical: 12,
  },
  input: {
    fontSize: 15,
    color: '#1F2937',
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flex: 1,
  },
  // مدخل المودالات (الاسم/النبذة/السنة) — بلا flex حتى لا ينهار ارتفاعه عمودياً
  modalInput: {
    fontSize: 17,
    color: '#1F2937',
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    minHeight: 54,
    backgroundColor: '#F9FAFB',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  // مدخل الأوسمة — حقل كبير وواضح مع أيقونة
  tagInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: spacing.base,
    backgroundColor: '#F9FAFB',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
  },
  tagInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    paddingVertical: 14,
  },
  presetWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetScroll: {
    maxHeight: 170,
  },
  presetScrollContent: {
    paddingBottom: 4,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: { backgroundColor: '#F3F4F6' },
  modalBtnSave: { backgroundColor: '#E11414' },

  // Option rows (select)
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    marginBottom: 4,
  },
  optionRowActive: {
    backgroundColor: '#FEF2F2',
  },
  optionCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#E11414',
    alignItems: 'center', justifyContent: 'center',
  },

  // Country
  bottomSheet: {
    width: '100%',
    backgroundColor: colors.white,
    borderTopStartRadius: radius['2xl'],
    borderTopEndRadius: radius['2xl'],
    padding: spacing.base,
    position: 'absolute',
    bottom: 0,
  },
  sheetHandle: {
    width: 40, height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  countryRowActive: {
    backgroundColor: '#FEF2F2',
  },

  // Photo source
  photoSourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.base,
    backgroundColor: '#F9FAFB',
    borderRadius: radius.md,
    marginBottom: 8,
  },
  photoSourceIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  voiceRecordWrap: {
    backgroundColor: '#FFE6E9',
    borderRadius: 14,
    padding: 12,
    alignItems: 'stretch',
    width: '100%',
  },
  voicePlayerWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
  },
  voicePlayerCard: {
    flex: 1,
    backgroundColor: '#FFE6E9',
    borderRadius: 14,
    padding: 12,
  },
  voiceUploading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
  },
  voiceDelete: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
