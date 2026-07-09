/**
 * PinnedMessagesBanner — شريط رسالة مثبّتة مدمج وشفاف أعلى الشات:
 * سطر واحد مصغّر قابل للتوسيع بالضغط + إمكانية الإخفاء المؤقت.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  I18nManager,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Pin, X, Plus, ChevronDown, ChevronUp } from 'lucide-react-native';

import { Text, useAlert } from '@/components/ui';
import {
  type PinnedMessage,
  unpinMessage,
  pinCustomNotice,
  MAX_PINNED_MESSAGES,
} from '@/services/roomPins';
import { lu } from '@/theme/lu-brand';
import { ROOM_DESIGN } from '@/theme/room-design';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  roomId: string;
  pins: PinnedMessage[];
  canManage: boolean;
  onAddPress?: () => void;
}

export function PinnedMessagesBanner({
  roomId,
  pins,
  canManage,
  onAddPress,
}: Props) {
  const { showAlert } = useAlert();
  const [activeIdx, setActiveIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (pins.length === 0 && !canManage) return null;

  const handleUnpin = (pin: PinnedMessage) => {
    if (!canManage) return;
    showAlert({
      type: 'warning',
      title: 'إزالة التثبيت؟',
      message: 'ستعود لرسالة عادية في المحادثة',
      buttons: [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إزالة',
          style: 'destructive',
          onPress: async () => {
            try {
              await unpinMessage(roomId, pin.id);
              setActiveIdx(0);
            } catch (e: any) {
              showAlert({ type: 'error', title: 'فشل', message: e?.message ?? 'خطأ' });
            }
          },
        },
      ],
    });
  };

  if (pins.length === 0) {
    return (
      <View style={styles.wrap}>
        <Pressable onPress={onAddPress} style={styles.addPill} hitSlop={6}>
          <Pin size={11} color={lu.colors.pink} strokeWidth={2.4} />
          <Text style={styles.addLabel}>تثبيت رسالة</Text>
        </Pressable>
      </View>
    );
  }

  if (hidden && canManage) {
    return (
      <View style={styles.wrap}>
        <Pressable
          onPress={() => { setHidden(false); }}
          style={styles.showPill}
          hitSlop={8}
        >
          <Pin size={10} color={lu.colors.pink} strokeWidth={2.4} />
          <Text style={styles.showLabel}>{pins.length}</Text>
        </Pressable>
      </View>
    );
  }

  const idx = Math.min(activeIdx, pins.length - 1);
  const pin = pins[idx];
  if (!pin) return null;

  const cycleNext = () => {
    if (pins.length > 1) setActiveIdx((idx + 1) % pins.length);
  };

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.strip}>
        <View style={styles.accentLine} />

        <Pressable style={styles.textArea} onPress={toggleExpand} onLongPress={cycleNext}>
          <View style={styles.inlineRow}>
            <Pin size={10} color={lu.colors.pink} strokeWidth={2.4} />
            {pins.length > 1 && (
              <Text style={styles.counter}>{idx + 1}/{pins.length}</Text>
            )}
            <Text style={styles.inlineText} numberOfLines={expanded ? 6 : 1}>
              {pin.text}
            </Text>
          </View>
        </Pressable>

        <View style={styles.trailingBtns}>
          <Pressable onPress={toggleExpand} style={styles.tinyBtn} hitSlop={6}>
            {expanded
              ? <ChevronUp size={12} color="rgba(255,255,255,0.6)" />
              : <ChevronDown size={12} color="rgba(255,255,255,0.6)" />}
          </Pressable>

          {canManage && (
            <>
              <Pressable onPress={() => setHidden(true)} style={styles.tinyBtn} hitSlop={6}>
                <X size={11} color="rgba(255,255,255,0.5)" />
              </Pressable>

              {expanded && (
                <>
                  {pins.length < MAX_PINNED_MESSAGES && onAddPress && (
                    <Pressable onPress={onAddPress} style={styles.tinyBtn} hitSlop={6}>
                      <Plus size={12} color={ROOM_DESIGN.textPrimary} />
                    </Pressable>
                  )}
                  <Pressable onPress={() => handleUnpin(pin)} style={[styles.tinyBtn, styles.unpinBtn]} hitSlop={6}>
                    <X size={11} color="#FF6B6B" />
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export function PinCustomMessageModal({
  visible,
  onClose,
  roomId,
  canManage,
}: {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  canManage: boolean;
}) {
  const { showAlert } = useAlert();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!canManage) return null;

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await pinCustomNotice(roomId, text.trim());
      setText('');
      onClose();
    } catch (e: any) {
      showAlert({ type: 'error', title: 'فشل', message: e?.message ?? 'خطأ' });
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = !text.trim() || submitting;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={!submitting ? onClose : undefined}
        />
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />

          <View style={modalStyles.titleRow}>
            <Pin size={16} color={ROOM_DESIGN.purple} fill={ROOM_DESIGN.purple} strokeWidth={0} />
            <Text variant="h4" weight="bold" color={lu.colors.ink}>
              تثبيت رسالة
            </Text>
          </View>

          <View style={modalStyles.inputCard}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="اكتب الرسالة التي تظهر لكل من في الغرفة…"
              placeholderTextColor={lu.colors.muted}
              multiline
              maxLength={500}
              style={modalStyles.input}
              autoFocus
            />
          </View>
          <Text variant="caption" color={lu.colors.muted} style={modalStyles.charCount}>
            {text.length} / 500
          </Text>

          <Pressable
            onPress={handleSubmit}
            disabled={disabled}
            style={[modalStyles.submit, disabled && { opacity: 0.5 }]}
          >
            <LinearGradient
              colors={lu.gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text variant="button" color="#fff" weight="bold">تثبيت</Text>
            )}
          </Pressable>

          <Pressable onPress={onClose} disabled={submitting} style={modalStyles.cancelBtn}>
            <Text variant="button" color={lu.colors.ink2} weight="bold">إلغاء</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(45, 12, 12, 0.35)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  addLabel: {
    color: ROOM_DESIGN.textPrimary,
    fontSize: 10,
    fontWeight: '600',
    fontFamily: lu.fonts.body,
  },
  showPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(45, 12, 12, 0.3)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  showLabel: {
    color: lu.colors.pink,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: lu.fonts.body,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(30, 8, 10, 0.4)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    minHeight: 28,
  },
  accentLine: {
    width: 2.5,
    alignSelf: 'stretch',
    backgroundColor: lu.colors.pink,
  },
  textArea: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  counter: {
    color: ROOM_DESIGN.textMuted,
    fontSize: 9,
    fontFamily: lu.fonts.body,
    fontWeight: '600',
  },
  inlineText: {
    flex: 1,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: lu.fonts.body,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  trailingBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingEnd: 6,
  },
  tinyBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unpinBtn: {
    backgroundColor: 'rgba(255,107,107,0.15)',
  },
});

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26, 10, 12,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: lu.colors.line,
    alignSelf: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 14,
  },
  inputCard: {
    backgroundColor: lu.colors.bg2,
    borderRadius: lu.radius.base,
    borderWidth: 1.5,
    borderColor: lu.colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    minHeight: 90,
    maxHeight: 160,
    fontSize: 15,
    lineHeight: 22,
    color: lu.colors.ink,
    fontFamily: lu.fonts.body,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    textAlignVertical: 'top',
    includeFontPadding: false,
  },
  charCount: {
    alignSelf: 'flex-end',
    marginTop: 6,
    fontSize: 11,
  },
  submit: {
    height: 50,
    borderRadius: lu.radius.base,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    ...lu.shadows.grad,
  },
  cancelBtn: {
    height: 46,
    borderRadius: lu.radius.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: lu.colors.bg,
  },
});
