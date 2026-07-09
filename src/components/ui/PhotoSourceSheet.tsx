/**
 * اختيار مصدر الصورة — كاميرا أو معرض (تصميم LinkUp)
 */

import React from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, ImageIcon } from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text } from './Text';
import { lu } from '@/theme/lu-brand';
import { radius } from '@/theme';

export interface PhotoSourceSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  cameraLabel: string;
  cameraHint?: string;
  galleryLabel: string;
  galleryHint?: string;
  cancelLabel: string;
  onCamera: () => void;
  onGallery: () => void;
  onClose: () => void;
}

export function PhotoSourceSheet({
  visible,
  title,
  subtitle,
  cameraLabel,
  cameraHint,
  galleryLabel,
  galleryHint,
  cancelLabel,
  onCamera,
  onGallery,
  onClose,
}: PhotoSourceSheetProps) {
  const insets = useSafeAreaInsets();

  const runAfterDismiss = (action: () => void) => {
    onClose();
    // iOS لا يفتح المعرض إذا بقي Modal الشيت ظاهراً أثناء العرض
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        const delay = Platform.OS === 'ios' ? 550 : 120;
        setTimeout(action, delay);
      });
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />

          <LinearGradient
            colors={[lu.colors.bgPink, lu.colors.bg]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerCard}
          >
            <Text variant="h3" weight="bold" align="center" color={lu.colors.ink}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="caption" align="center" color={lu.colors.ink2} style={styles.subtitle}>
                {subtitle}
              </Text>
            ) : null}
          </LinearGradient>

          <SourceOption
            label={cameraLabel}
            hint={cameraHint}
            iconColors={lu.gradients.purple}
            Icon={Camera}
            onPress={() => runAfterDismiss(onCamera)}
          />

          <SourceOption
            label={galleryLabel}
            hint={galleryHint}
            iconColors={lu.gradients.gold}
            Icon={ImageIcon}
            onPress={() => runAfterDismiss(onGallery)}
          />

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
          >
            <Text variant="button" weight="bold" color={lu.colors.ink2}>
              {cancelLabel}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SourceOption({
  label,
  hint,
  iconColors,
  Icon,
  onPress,
}: {
  label: string;
  hint?: string;
  iconColors: readonly [string, string, ...string[]];
  Icon: typeof Camera;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}
    >
      <ChevronLeft size={18} color={lu.colors.muted} strokeWidth={2} />
      <View style={styles.optionText}>
        <Text variant="body" weight="bold" color={lu.colors.ink} align="right">
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" color={lu.colors.muted} align="right">
            {hint}
          </Text>
        ) : null}
      </View>
      <LinearGradient colors={iconColors} style={styles.optionIcon}>
        <Icon size={22} color={lu.colors.onGrad} strokeWidth={2.5} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 10, 12, 0.52)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: lu.colors.card,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: lu.colors.line,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerCard: {
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  subtitle: {
    marginTop: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: lu.colors.bg2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: lu.colors.line,
    marginBottom: 10,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: lu.colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  pressed: {
    opacity: 0.82,
  },
});
