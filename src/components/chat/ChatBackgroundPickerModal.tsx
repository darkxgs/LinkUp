/**
 * اختيار خلفية المحادثة — تُفتح حسب مستوى العلاقة
 */
import React from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Text as RNText,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Lock, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { TAB_DESIGN } from '@/components/navigation/TabBarNavigationSvg';
import {
  isChatBackgroundUnlocked,
  type ChatBackground,
} from '@/constants/chatBackgrounds';
import { ChatBackgroundPreview } from '@/components/chat/ChatBackgroundLayer';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';

type Props = {
  visible: boolean;
  bondLevel: number;
  selectedId: string;
  backgrounds: ChatBackground[];
  saving?: boolean;
  onClose: () => void;
  onSelect: (backgroundId: string) => void;
};

export function ChatBackgroundPickerModal({
  visible,
  bondLevel,
  selectedId,
  backgrounds,
  saving = false,
  onClose,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.base }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text weight="bold" style={styles.title}>
                {t('chat.chatBackgroundTitle')}
              </Text>
              <RNText style={styles.subtitle}>
                {t('chat.chatBackgroundBondHint', { level: bondLevel })}
              </RNText>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <X size={20} color={lu.colors.ink} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {backgrounds.map((bg) => {
              const unlocked = isChatBackgroundUnlocked(bg.id, bondLevel, backgrounds);
              const selected = selectedId === bg.id;

              return (
                <Pressable
                  key={bg.id}
                  disabled={!unlocked || saving}
                  onPress={() => onSelect(bg.id)}
                  style={({ pressed }) => [
                    styles.card,
                    selected && styles.cardSelected,
                    !unlocked && styles.cardLocked,
                    pressed && unlocked && { opacity: 0.88 },
                  ]}
                >
                  <View style={styles.previewWrap}>
                    <ChatBackgroundPreview background={bg} size={100} />
                    {!unlocked ? (
                      <View style={styles.lockOverlay}>
                        <Lock size={18} color="#fff" />
                      </View>
                    ) : null}
                    {selected ? (
                      <LinearGradient
                        colors={lu.gradients.blue}
                        style={styles.checkBadge}
                      >
                        <Check size={14} color="#fff" strokeWidth={3} />
                      </LinearGradient>
                    ) : null}
                  </View>
                  <RNText
                    style={[styles.cardLabel, !unlocked && styles.cardLabelLocked]}
                    numberOfLines={1}
                  >
                    {bg.name}
                  </RNText>
                  {!unlocked ? (
                    <RNText style={styles.levelHint}>
                      {t('chat.chatBackgroundBondRequired', { level: bg.minBondLevel })}
                    </RNText>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {saving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator size="small" color={TAB_DESIGN.purple} />
              <RNText style={styles.savingText}>{t('common.loading')}</RNText>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 10, 12, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: lu.colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '78%',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: lu.colors.line,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  title: {
    fontSize: 17,
    color: lu.colors.ink,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: lu.colors.muted,
    fontFamily: lu.fonts.body,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: lu.colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.base,
  },
  card: {
    width: '47%',
    padding: spacing.sm,
    borderRadius: radius.base,
    backgroundColor: lu.colors.bg2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: TAB_DESIGN.purple,
    backgroundColor: lu.colors.purpleSoft,
  },
  cardLocked: {
    opacity: 0.72,
  },
  previewWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: spacing.xs,
    position: 'relative',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 10, 12, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
  },
  cardLabelLocked: {
    color: lu.colors.muted,
  },
  levelHint: {
    marginTop: 2,
    fontSize: 11,
    color: lu.colors.muted,
    fontFamily: lu.fonts.body,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
  },
  savingText: {
    fontSize: 13,
    color: lu.colors.muted,
    fontFamily: lu.fonts.body,
  },
});
