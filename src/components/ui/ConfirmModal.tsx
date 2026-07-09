/**
 * ConfirmModal — مودال تأكيد موحّد بهوية LinkUp
 *
 * يستبدل Alert.alert العامة بتصميم احترافي متناسق:
 *  - أيقونة دائرية ملوّنة (نوع الإجراء)
 *  - عنوان + رسالة
 *  - زرّان: تأكيد (gradient) + إلغاء
 *  - responsive + RTL
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Heart,
  RefreshCw,
  LogOut,
  AlertTriangle,
  Trash2,
  Check,
  type LucideIcon,
} from 'lucide-react-native';

import { Text } from './Text';
import { lu } from '@/theme/lu-brand';

export type ConfirmVariant = 'favorite' | 'seat' | 'leave' | 'warning' | 'delete' | 'success';

const VARIANT_CONFIG: Record<ConfirmVariant, { Icon: LucideIcon; color: string; gradient: readonly [string, string, ...string[]] }> = {
  favorite: { Icon: Heart, color: lu.colors.pink, gradient: lu.gradients.pink },
  seat: { Icon: RefreshCw, color: lu.colors.purple, gradient: lu.gradients.purple },
  leave: { Icon: LogOut, color: lu.colors.live, gradient: ['#FF2E62', '#E02B2B'] as const },
  warning: { Icon: AlertTriangle, color: lu.colors.gold2, gradient: lu.gradients.gold },
  delete: { Icon: Trash2, color: lu.colors.live, gradient: ['#FF2E62', '#E02B2B'] as const },
  success: { Icon: Check, color: lu.colors.mint, gradient: lu.gradients.mint },
};

interface Props {
  visible: boolean;
  variant?: ConfirmVariant;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  /** نص فرعي صغير (مثل التكلفة) */
  hint?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  variant = 'warning',
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  loading,
  hint,
  onConfirm,
  onCancel,
}: Props) {
  const cfg = VARIANT_CONFIG[variant];
  const { Icon } = cfg;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* أيقونة */}
          <View style={styles.iconWrap}>
            <LinearGradient
              colors={cfg.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconCircle}
            >
              <Icon size={30} color="#fff" strokeWidth={2.4} />
            </LinearGradient>
          </View>

          {/* العنوان والرسالة */}
          <Text variant="h4" weight="bold" align="center" color={lu.colors.ink} style={{ marginBottom: 6 }}>
            {title}
          </Text>
          {message && (
            <Text variant="body" align="center" color={lu.colors.ink2} style={{ lineHeight: 22 }}>
              {message}
            </Text>
          )}
          {hint && (
            <View style={styles.hintBox}>
              <Text variant="caption" weight="bold" align="center" color={cfg.color}>
                {hint}
              </Text>
            </View>
          )}

          {/* الأزرار */}
          <View style={styles.actions}>
            <Pressable onPress={onConfirm} disabled={loading} style={styles.confirmBtn}>
              <LinearGradient
                colors={cfg.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text variant="button" color="#fff" weight="bold">{confirmText}</Text>
              )}
            </Pressable>

            <Pressable onPress={onCancel} disabled={loading} style={styles.cancelBtn}>
              <Text variant="button" color={lu.colors.ink2} weight="bold">{cancelText}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 10, 12,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: lu.radius.xl,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
    ...lu.shadows.pop,
  },
  iconWrap: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...lu.shadows.grad,
  },
  hintBox: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: lu.radius.sm,
    backgroundColor: lu.colors.bg,
  },
  actions: {
    width: '100%',
    marginTop: 22,
    gap: 10,
  },
  confirmBtn: {
    height: 50,
    borderRadius: lu.radius.base,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    height: 48,
    borderRadius: lu.radius.base,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lu.colors.bg,
  },
});
