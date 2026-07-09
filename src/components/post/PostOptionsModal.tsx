/**
 * خيارات المنشور — تعديل / حذف / بلاغ (هوية LinkUp)
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { X, Pencil, Trash2, Flag, AlertTriangle } from 'lucide-react-native';

import { lu } from '@/theme/lu-brand';
import type { Post } from '@/services/firebase/posts';

type Step = 'menu' | 'deleteConfirm';

type Props = {
  visible: boolean;
  post: Post | null;
  isOwner: boolean;
  deleting?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
  onReport: () => void;
};

export function PostOptionsModal({
  visible,
  post,
  isOwner,
  deleting = false,
  onClose,
  onEdit,
  onDelete,
  onReport,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const sheetW = Math.min(W - 24, 420);
  const [step, setStep] = useState<Step>('menu');

  useEffect(() => {
    if (visible) setStep('menu');
  }, [visible, post?.id]);

  if (!post) return null;

  const preview =
    post.text.trim().length > 0
      ? post.text.trim().slice(0, 90) + (post.text.trim().length > 90 ? '…' : '')
      : t('feed.newPost');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { width: sheetW, paddingBottom: insets.bottom + 16 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <LinearGradient
            colors={['#FFFFFF', '#FEF2F2', '#FDECEC']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.sheetTitle}>
                {step === 'deleteConfirm' ? t('feed.deletePost') : t('feed.options')}
              </Text>
              <Text style={styles.sheetSubtitle} numberOfLines={1}>
                {post.authorName}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <X size={20} color={lu.colors.ink2} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.previewCard}>
            {post.images?.[0] ? (
              <Image source={{ uri: post.images[0] }} style={styles.previewThumb} contentFit="cover" />
            ) : (
              <LinearGradient colors={lu.gradients.brand} style={styles.previewThumbPlaceholder}>
                <Text style={styles.previewInitial}>
                  {(post.authorName || '?').trim().charAt(0)}
                </Text>
              </LinearGradient>
            )}
            <Text style={styles.previewText} numberOfLines={2}>{preview}</Text>
          </View>

          {step === 'menu' ? (
            <View style={styles.actions}>
              {isOwner ? (
                <>
                  <ActionRow
                    icon={Pencil}
                    label={t('feed.editPost')}
                    colors={['#FDECEC', '#FEE2E2']}
                    iconColor={lu.colors.purple}
                    onPress={() => {
                      onClose();
                      onEdit();
                    }}
                  />
                  <ActionRow
                    icon={Trash2}
                    label={t('feed.deletePost')}
                    colors={['#FEE2E2', '#FECACA']}
                    iconColor="#DC2626"
                    destructive
                    onPress={() => setStep('deleteConfirm')}
                  />
                </>
              ) : (
                <ActionRow
                  icon={Flag}
                  label={t('feed.reportPost')}
                  colors={['#FFF8EE', '#FFEFD6']}
                  iconColor="#D97706"
                  onPress={() => {
                    onClose();
                    onReport();
                  }}
                />
              )}
              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.confirmBlock}>
              <View style={styles.warnRow}>
                <AlertTriangle size={22} color="#DC2626" />
                <Text style={styles.confirmText}>{t('feed.deletePostConfirm')}</Text>
              </View>
              <Pressable
                onPress={() => void onDelete()}
                disabled={deleting}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  pressed && { opacity: 0.9 },
                  deleting && { opacity: 0.65 },
                ]}
              >
                <LinearGradient
                  colors={['#FF5C7A', '#FF2E62']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Trash2 size={18} color="#fff" />
                    <Text style={styles.deleteBtnText}>{t('feed.deletePost')}</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={() => setStep('menu')}
                disabled={deleting}
                style={styles.backBtn}
              >
                <Text style={styles.backBtnText}>{t('common.back')}</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({
  icon: Icon,
  label,
  colors,
  iconColor,
  destructive,
  onPress,
}: {
  icon: typeof Pencil;
  label: string;
  colors: readonly [string, string];
  iconColor: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.88 }]}
    >
      <LinearGradient colors={colors} style={styles.actionIcon}>
        <Icon size={20} color={iconColor} strokeWidth={2.2} />
      </LinearGradient>
      <Text style={[styles.actionLabel, destructive && { color: '#DC2626' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(46, 11, 11, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    overflow: 'hidden',
    ...lu.shadows.grad,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(200, 40, 40, 0.22)',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerTextWrap: { flex: 1, paddingEnd: 8 },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: lu.colors.muted,
    marginTop: 4,
    fontFamily: lu.fonts.body,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(200, 40, 40, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  previewThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: lu.colors.line,
  },
  previewThumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInitial: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  previewText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: lu.colors.ink2,
    fontFamily: lu.fonts.body,
  },
  actions: { gap: 8 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
  },
  cancelBtn: {
    marginTop: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: lu.colors.muted,
  },
  confirmBlock: { gap: 12 },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  confirmText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: '#991B1B',
    fontFamily: lu.fonts.body,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
  },
  deleteBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  backBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: lu.colors.purple,
  },
});
