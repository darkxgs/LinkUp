/**
 * LinkUp App — شاشة الإبلاغ (تصميم LinkUp)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';

import { Text, useAlert } from '@/components/ui';
import { LuArrowIcon, LuFlagIcon } from '@/components/icons/LuDesignIcons';
import {
  LuReportHeroIcon,
  LuChatSpamIcon,
  LuHarassmentIcon,
  LuInappropriateIcon,
  LuFakeAccountIcon,
  LuScamIcon,
  LuHateSpeechIcon,
  LuViolenceIcon,
  LuUnderageIcon,
  LuReportOtherIcon,
  LuAddIcon,
  LuPrivacyCheckIcon,
  type ReportIconComponent,
} from '@/components/icons/LuReportIcons';
import { TAB_DESIGN } from '@/components/navigation/TabBarNavigationSvg';
import { lu } from '@/theme/lu-brand';
import { submitReport, type ReportReason } from '@/services/firebase/reports';
import { getUser, type UserDoc } from '@/services/firebase/users';
import { getPostById, type Post } from '@/services/firebase/posts';
import { resolveDisplayName } from '@/utils/displayName';
import { sendChatMessage, getOrCreateConversation } from '@/services/firebase/chat';
import { SUPPORT_UID, SUPPORT_CHAT_DISPLAY_NAME } from '@/services/supportAccount';

const REASON_META: Record<
  ReportReason,
  { Icon: ReportIconComponent; color: string; bg: string; labelKey: string }
> = {
  spam: { Icon: LuChatSpamIcon, color: '#D97706', bg: '#FEF3C7', labelKey: 'report.text34773' },
  harassment: { Icon: LuHarassmentIcon, color: '#DC2626', bg: '#FEE2E2', labelKey: 'report.text75572' },
  inappropriate: { Icon: LuInappropriateIcon, color: '#C40E1E', bg: '#FFE6E9', labelKey: 'report.text46086' },
  fake: { Icon: LuFakeAccountIcon, color: '#E11414', bg: '#FEE2E2', labelKey: 'report.text28356' },
  scam: { Icon: LuScamIcon, color: '#B91C1C', bg: '#FEE2E2', labelKey: 'report.text40896' },
  hate: { Icon: LuHateSpeechIcon, color: '#991B1B', bg: '#FEE2E2', labelKey: 'report.text43452' },
  violence: { Icon: LuViolenceIcon, color: '#9A3412', bg: '#FFEDD5', labelKey: 'report.text88656' },
  underage: { Icon: LuUnderageIcon, color: '#EA2626', bg: '#FCDDDD', labelKey: 'report.text32386' },
  other: { Icon: LuReportOtherIcon, color: '#5E5E68', bg: '#F3F4F6', labelKey: 'report.text52088' },
};

export default function ReportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { type, target, source, messageId, conversationId, messagePreview, messageType, postId } =
    useLocalSearchParams<{
    type?: string;
    target?: string;
    source?: string;
    messageId?: string;
    conversationId?: string;
    messagePreview?: string;
    messageType?: string;
    postId?: string;
  }>();

  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [targetUser, setTargetUser] = useState<UserDoc | null>(null);
  const [targetPost, setTargetPost] = useState<Post | null>(null);

  const isMessageReport = type === 'message' && !!messageId;
  const isUserReport = type === 'user' && !!target;
  const isPostReport = type === 'post' && !!postId;

  useEffect(() => {
    if (isMessageReport && !details) {
      const preview = messagePreview?.trim();
      setDetails(
        preview
          ? t('report.messageReportDetails', {
              text: preview.slice(0, 160),
              id: (messageId ?? '').slice(0, 10),
            })
          : t('report.messageReportHint', { id: messageId }),
      );
      setSelectedReason('inappropriate');
    }
  }, [isMessageReport, messageId, messagePreview, details, t]);

  useEffect(() => {
    if (isPostReport && postId) {
      void getPostById(postId).then(setTargetPost).catch(() => setTargetPost(null));
    } else {
      setTargetPost(null);
    }
  }, [isPostReport, postId]);

  useEffect(() => {
    if (isPostReport && !details) {
      const preview = targetPost?.text?.trim() ?? messagePreview?.trim();
      setDetails(
        preview
          ? t('feed.reportPostDetails', { text: preview.slice(0, 160) })
          : t('feed.reportPostHint'),
      );
      setSelectedReason('inappropriate');
    }
  }, [isPostReport, targetPost, messagePreview, details, t]);

  useEffect(() => {
    if (!target || (type !== 'user' && type !== 'message' && type !== 'post')) {
      setTargetUser(null);
      return;
    }
    void getUser(target).then(setTargetUser).catch(() => setTargetUser(null));
  }, [target, type]);

  useEffect(() => {
    if ((type === 'user' || type === 'post') && !target) {
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: t('report.targetRequired'),
        buttons: [{ text: t('common.ok'), onPress: () => router.back() }],
      });
    }
    if (type === 'post' && !postId) {
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: t('feed.reportPostMissing'),
        buttons: [{ text: t('common.ok'), onPress: () => router.back() }],
      });
    }
  }, [type, target, postId, showAlert, t, router]);

  const targetDisplayName = useMemo(() => {
    if (!targetUser) return target?.slice(0, 12) ?? '';
    return resolveDisplayName({
      displayName: targetUser.displayName,
      email: targetUser.email,
    });
  }, [targetUser, target]);

  const sourceLabel = useMemo(() => {
    if (source === 'chat') return t('chat.title');
    if (source === 'profile') return t('profile.title');
    if (source === 'support') return t('profile.support');
    if (source === 'feed') return t('feed.title');
    return 'LinkUp';
  }, [source, t]);

  const pickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          type: 'warning',
          title: t('roomCreate.text20152'),
          message: t('roomCreate.text82696'),
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset) {
        if (photos.length < 4) {
          setPhotos((p) => [...p, asset.uri]);
        } else {
          showAlert({
            type: 'info',
            title: t('report.text20574'),
            message: t('report.text92928'),
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const resolveSource = (): 'app' | 'support' | 'profile' | 'chat' | 'feed' => {
    if (source === 'chat' || source === 'profile' || source === 'support' || source === 'feed') {
      return source;
    }
    return 'app';
  };

  const canSubmit = !!selectedReason && details.trim().length >= 10;
  const detailsRemaining = Math.max(0, 10 - details.trim().length);

  const handleSubmit = async () => {
    if (!selectedReason) {
      showAlert({ type: 'warning', title: t('report.text22000'), message: t('report.text79730') });
      return;
    }
    if (details.trim().length < 10) {
      showAlert({ type: 'warning', title: t('report.text63151'), message: t('report.text63082') });
      return;
    }

    if (type === 'user' && !target?.trim()) {
      showAlert({ type: 'warning', title: t('common.error'), message: t('report.targetRequired') });
      return;
    }
    if (type === 'post' && !postId?.trim()) {
      showAlert({ type: 'warning', title: t('common.error'), message: t('feed.reportPostMissing') });
      return;
    }

    setSubmitting(true);
    try {
      const reportId = await submitReport({
        reason: selectedReason,
        details: details.trim(),
        photoUris: photos,
        targetUid: target,
        targetType: type ?? 'general',
        source: resolveSource(),
        messageId: messageId ?? undefined,
        conversationId: conversationId ?? undefined,
        messageText: messagePreview?.trim() || undefined,
        messageType: messageType ?? undefined,
        postId: postId ?? undefined,
        postText: targetPost?.text?.trim() || messagePreview?.trim() || undefined,
        postImageUrl: targetPost?.images?.[0] ?? undefined,
      });

      if (source === 'support') {
        try {
          const convId = await getOrCreateConversation(SUPPORT_UID, SUPPORT_CHAT_DISPLAY_NAME, '');
          await sendChatMessage(
            convId,
            SUPPORT_UID,
            t('supportChat.reportSubmitted', { reason: selectedReason }),
          );
        } catch {
          /* optional */
        }
      }

      showAlert({
        type: 'success',
        title: t('report.text90667'),
        message: `${t('report.text40091')}\n\n${t('report.reportRef', { id: reportId.slice(0, 8).toUpperCase() })}`,
        buttons: [
          {
            text: t('report.viewMyReports'),
            onPress: () => router.replace(`/report/${reportId}` as any),
          },
          { text: t('common.ok'), onPress: () => router.back() },
        ],
      });
    } catch (e: any) {
      const msg =
        e?.message === 'TARGET_USER_REQUIRED'
          ? t('report.targetRequired')
          : e?.message === 'TARGET_POST_REQUIRED'
            ? t('feed.reportPostMissing')
            : (e?.message ?? t('report.submitFailed'));
      showAlert({
        type: 'error',
        title: t('common.error'),
        message: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={lu.gradients.pageChat} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 120,
            paddingHorizontal: 16,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backPill} hitSlop={10}>
              <LuArrowIcon size={18} color={lu.colors.ink} direction="left" />
            </Pressable>
            <Text weight="bold" style={styles.headerTitle}>
              {t('common.report')}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <LinearGradient
            colors={['#FFE0E0', '#FECACA', '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroIcon}>
              <LuReportHeroIcon size={34} color={TAB_DESIGN.purple} strokeWidth={1.5} />
            </View>
            <Text weight="bold" style={styles.heroTitle}>
              {isMessageReport
                ? t('chat.reportMessage')
                : isPostReport
                  ? t('feed.reportPost')
                  : t('report.text60995')}
            </Text>
            <Text style={styles.heroSub}>
              {t('report.text50773')}
            </Text>
            <View style={styles.sourcePill}>
              <Text style={styles.sourcePillText}>{sourceLabel}</Text>
            </View>
          </LinearGradient>

          {isUserReport || isMessageReport || isPostReport ? (
            <View style={styles.targetCard}>
              {isPostReport && targetPost?.images?.[0] ? (
                <Image source={{ uri: targetPost.images[0] }} style={styles.targetAvatar} />
              ) : targetUser?.avatar ? (
                <Image source={{ uri: targetUser.avatar }} style={styles.targetAvatar} />
              ) : (
                <View style={[styles.targetAvatar, styles.targetAvatarPlaceholder]}>
                  <Text weight="bold" style={styles.targetAvatarLetter}>
                    {(targetDisplayName || targetPost?.authorName || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.targetBody}>
                <Text style={styles.targetLabel}>
                  {isMessageReport
                    ? t('report.reportingMessage')
                    : isPostReport
                      ? t('feed.reportingPost')
                      : t('report.reportingUser')}
                </Text>
                <Text weight="bold" style={styles.targetName}>
                  {isPostReport ? targetPost?.authorName ?? targetDisplayName : targetDisplayName}
                </Text>
                {isMessageReport ? (
                  <View style={styles.messagePreviewBubble}>
                    <Text style={styles.messagePreviewText} numberOfLines={3}>
                      {messagePreview?.trim() || t('report.messagePreviewMissing')}
                    </Text>
                  </View>
                ) : isPostReport ? (
                  <View style={styles.messagePreviewBubble}>
                    <Text style={styles.messagePreviewText} numberOfLines={4}>
                      {targetPost?.text?.trim() || t('feed.newPost')}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.targetHint}>{t('report.userReportHint')}</Text>
                )}
              </View>
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>{t('report.text88870')}</Text>
          <View style={styles.reasonsList}>
            {(Object.keys(REASON_META) as ReportReason[]).map((id) => {
              const meta = REASON_META[id];
              const isSelected = selectedReason === id;
              const Icon = meta.Icon;
              return (
                <Pressable
                  key={id}
                  onPress={() => setSelectedReason(id)}
                  style={[styles.reasonRow, isSelected && styles.reasonRowSelected]}
                >
                  <View style={[styles.reasonIconBg, { backgroundColor: meta.bg }]}>
                    <Icon size={20} color={meta.color} strokeWidth={1.5} />
                  </View>
                  <Text
                    weight={isSelected ? 'bold' : 'regular'}
                    style={[styles.reasonLabel, isSelected && { color: TAB_DESIGN.purple }]}
                  >
                    {t(meta.labelKey)}
                  </Text>
                  <View style={[styles.radio, isSelected && { borderColor: TAB_DESIGN.purple }]}>
                    {isSelected ? (
                      <View style={[styles.radioInner, { backgroundColor: TAB_DESIGN.purple }]} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>{t('report.text3731')}</Text>
          <Text style={styles.fieldHint}>{t('report.text63082')}</Text>
          <View
            style={[
              styles.textareaWrap,
              selectedReason && details.trim().length < 10 && styles.textareaWrapWarn,
            ]}
          >
            <TextInput
              style={styles.textarea}
              value={details}
              onChangeText={setDetails}
              placeholder={t('report.text62604')}
              placeholderTextColor={lu.colors.muted}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text
              style={[
                styles.charCount,
                details.trim().length < 10 && styles.charCountWarn,
              ]}
            >
              {details.trim().length < 10
                ? `${details.length}/500 — متبقي ${detailsRemaining} أحرف`
                : `${details.length}/500`}
            </Text>
          </View>

          <Text style={styles.fieldLabel}>{t('report.text95502')}</Text>
          <View style={styles.photosRow}>
            {photos.map((uri, idx) => (
              <View key={uri} style={styles.photoItem}>
                <Image source={{ uri }} style={styles.photoImg} contentFit="cover" />
                <Pressable
                  onPress={() => setPhotos((p) => p.filter((_, i) => i !== idx))}
                  style={styles.photoRemove}
                >
                  <X size={12} color="#fff" strokeWidth={3} />
                </Pressable>
              </View>
            ))}
            {photos.length < 4 ? (
              <Pressable onPress={pickPhoto} style={styles.addPhotoBtn}>
                <LuAddIcon size={22} color={TAB_DESIGN.purple} strokeWidth={1.5} />
                <Text style={styles.addPhotoText}>{t('common.add')}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.privacyCard}>
            <LuPrivacyCheckIcon size={16} color={lu.colors.mint} strokeWidth={2} />
            <Text style={styles.privacyText}>{t('report.text44891')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        {selectedReason && !canSubmit ? (
          <Text style={styles.submitHint}>
            اكتب {detailsRemaining} {detailsRemaining === 1 ? 'حرفاً' : 'أحرف'} إضافية في التفاصيل
          </Text>
        ) : null}
        <Pressable
          onPress={handleSubmit}
          disabled={submitting || !canSubmit}
          style={[
            styles.submitBtn,
            (submitting || !canSubmit) && { opacity: 0.55 },
          ]}
        >
          <LinearGradient
            colors={[...TAB_DESIGN.activeGrad]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <LuFlagIcon size={18} color="#fff" strokeWidth={1.5} />
          <Text weight="bold" style={styles.submitText}>
            {submitting ? t('common.loading') : t('report.text23027')}
          </Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    color: lu.colors.ink,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 17,
    color: lu.colors.ink,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 13,
    color: lu.colors.ink2,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  sourcePill: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(225, 20, 20,0.12)',
  },
  sourcePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: TAB_DESIGN.purple,
  },
  targetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  targetAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  targetAvatarPlaceholder: {
    backgroundColor: TAB_DESIGN.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetAvatarLetter: {
    fontSize: 20,
    color: TAB_DESIGN.purple,
  },
  targetBody: { flex: 1 },
  targetLabel: {
    fontSize: 11,
    color: lu.colors.muted,
    marginBottom: 2,
  },
  targetName: {
    fontSize: 16,
    color: lu.colors.ink,
    marginBottom: 4,
  },
  targetHint: {
    fontSize: 12,
    color: lu.colors.muted,
    lineHeight: 17,
  },
  messagePreviewBubble: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FEE2E2',
  },
  messagePreviewText: {
    fontSize: 12,
    color: lu.colors.ink2,
    lineHeight: 17,
    textAlign: 'right',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: lu.colors.ink2,
    marginBottom: 8,
    marginTop: 4,
  },
  fieldHint: {
    fontSize: 12,
    color: lu.colors.muted,
    marginTop: -4,
    marginBottom: 8,
    lineHeight: 17,
  },
  reasonsList: { gap: 8, marginBottom: 16 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  reasonRowSelected: {
    borderColor: TAB_DESIGN.purple,
    backgroundColor: '#FEF2F2',
  },
  reasonIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonLabel: {
    flex: 1,
    marginStart: 10,
    fontSize: 14,
    color: lu.colors.ink,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: lu.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  textareaWrap: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  textareaWrapWarn: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  textarea: {
    fontSize: 14,
    color: lu.colors.ink,
    minHeight: 110,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: lu.colors.muted,
    textAlign: 'right',
    marginTop: 6,
  },
  charCountWarn: {
    color: '#DC2626',
    fontWeight: '700',
  },
  photosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  photoItem: {
    width: 78,
    height: 78,
    borderRadius: 14,
    overflow: 'hidden',
  },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtn: {
    width: 78,
    height: 78,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: TAB_DESIGN.purple,
    borderStyle: 'dashed',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 11,
    fontWeight: '700',
    color: TAB_DESIGN.purple,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(43,217,168,0.12)',
    marginBottom: 8,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: lu.colors.ink2,
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: lu.colors.line,
  },
  submitHint: {
    fontSize: 12,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },
  submitBtn: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
  },
});
