/**
 * LuActionSheet — قائمة خيارات iOS-style بهوية LinkUp (#E11414)
 * بديل Alert.alert للقوائم (تثبيت، أرشفة، فلتر، …)
 */
import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { Text } from './Text';
import { lu } from '@/theme/lu-brand';

const SHEET_MAX_H = Dimensions.get('window').height * 0.72;

export type ActionSheetButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type ActionSheetConfig = {
  title?: string;
  message?: string;
  buttons: ActionSheetButton[];
};

type Props = {
  visible: boolean;
  config: ActionSheetConfig | null;
  onClose: () => void;
};

export function LuActionSheet({ visible, config, onClose }: Props) {
  if (!config) return null;

  const handlePress = (btn: ActionSheetButton) => {
    onClose();
    setTimeout(() => btn.onPress?.(), 120);
  };

  const cancelIdx = config.buttons.findIndex((b) => b.style === 'cancel');
  const mainButtons =
    cancelIdx >= 0
      ? config.buttons.filter((_, i) => i !== cancelIdx)
      : config.buttons;
  const cancelButton = cancelIdx >= 0 ? config.buttons[cancelIdx] : null;
  const allRows = cancelButton ? [...mainButtons, cancelButton] : mainButtons;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheetWrap} onPress={(e) => e.stopPropagation()}>
          <View style={styles.card}>
            {(config.title || config.message) ? (
              <View style={styles.headerBlock}>
                {config.title ? (
                  <Text weight="bold" style={styles.title}>
                    {config.title}
                  </Text>
                ) : null}
                {config.message ? (
                  <Text style={styles.message}>{config.message}</Text>
                ) : null}
              </View>
            ) : null}

            <ScrollView
              style={{ maxHeight: SHEET_MAX_H }}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              {allRows.map((btn, idx) => (
                <View key={`${btn.text}-${idx}`}>
                  {idx > 0 || config.title ? <View style={styles.divider} /> : null}
                  <Pressable
                    onPress={() => handlePress(btn)}
                    style={({ pressed }) => [
                      styles.actionRow,
                      pressed && styles.actionRowPressed,
                    ]}
                  >
                    <Text
                      weight="semibold"
                      style={[
                        styles.actionText,
                        btn.style === 'destructive' && styles.actionDestructive,
                        btn.style === 'cancel' && styles.cancelInlineText,
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 10, 12, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  sheetWrap: {
    width: '100%',
    maxWidth: 340,
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...lu.shadows.pop,
  },
  headerBlock: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    color: lu.colors.ink,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: lu.colors.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#FBEAEA',
  },
  actionRow: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionRowPressed: {
    backgroundColor: lu.colors.bg,
  },
  actionText: {
    fontSize: 16,
    color: '#E11414',
    textAlign: 'center',
  },
  actionDestructive: {
    color: '#EF4444',
  },
  cancelInlineText: {
    color: '#E11414',
    fontWeight: '700',
  },
});
