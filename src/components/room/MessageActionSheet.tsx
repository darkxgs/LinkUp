/**
 * MessageActionSheet
 *
 * يظهر عند الضغط الطويل على رسالة في chat الروم
 * الإجراءات: تثبيت / إلغاء التثبيت / إبلاغ
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Pin,
  PinOff,
  Flag,
  Copy,
  X,
} from 'lucide-react-native';

import { Text, useAlert } from '@/components/ui';
import { pinMessage, unpinMessage } from '@/services/roomPins';
import { lu } from '@/theme/lu-brand';
import { radius } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  canManagePins: boolean;
  message: {
    id: string;
    uid: string;
    name: string;
    avatar?: string;
    text?: string;
  };
  /** هل الرسالة مثبتة بالفعل؟ */
  isPinned?: boolean;
  pinnedId?: string;
}

export function MessageActionSheet({
  visible,
  onClose,
  roomId,
  canManagePins,
  message,
  isPinned,
  pinnedId,
}: Props) {
  const { showAlert } = useAlert();

  const handlePin = async () => {
    if (!message.text) {
      showAlert({ type: 'warning', title: 'لا يمكن تثبيت رسالة فارغة' });
      return;
    }
    try {
      await pinMessage(roomId, {
        text: message.text,
        fromUid: message.uid,
        fromName: message.name,
        fromAvatar: message.avatar,
        messageId: message.id,
      });
      onClose();
    } catch (e: any) {
      showAlert({
        type: 'error',
        title: 'فشل التثبيت',
        message: e?.message ?? 'خطأ',
      });
    }
  };

  const handleUnpin = async () => {
    if (!pinnedId) return;
    try {
      await unpinMessage(roomId, pinnedId);
      onClose();
    } catch (e: any) {
      showAlert({ type: 'error', title: 'فشل', message: e?.message ?? 'خطأ' });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.bg} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header — الرسالة */}
          <View style={styles.header}>
            <Text variant="caption" color="#9CA3AF" weight="bold">
              رسالة من {message.name}
            </Text>
            {message.text && (
              <Text variant="caption" color="#374151" numberOfLines={2} style={{ marginTop: 4 }}>
                {message.text}
              </Text>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {canManagePins && !isPinned && (
              <ActionBtn
                Icon={Pin}
                label="تثبيت الرسالة"
                color={lu.colors.pink}
                bg="#FFE6E9"
                onPress={handlePin}
              />
            )}

            {canManagePins && isPinned && (
              <ActionBtn
                Icon={PinOff}
                label="إلغاء التثبيت"
                color="#F59E0B"
                bg="#FEF3C7"
                onPress={handleUnpin}
              />
            )}

            <ActionBtn
              Icon={Flag}
              label="الإبلاغ عن الرسالة"
              color="#EF4444"
              bg="#FEE2E2"
              onPress={() => {
                onClose();
                // TODO: report flow
                showAlert({
                  type: 'info',
                  title: 'تم تسجيل البلاغ',
                  message: 'سنراجع المحتوى قريباً',
                });
              }}
            />

            <ActionBtn
              Icon={X}
              label="إلغاء"
              color="#6B7280"
              bg="#F3F4F6"
              onPress={onClose}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionBtn({
  Icon,
  label,
  color,
  bg,
  onPress,
}: {
  Icon: any;
  label: string;
  color: string;
  bg: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}>
      <View style={[styles.actionIcon, { backgroundColor: bg }]}>
        <Icon size={18} color={color} />
      </View>
      <Text variant="button" weight="bold" color={color}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actions: {
    padding: 8,
    gap: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
