/**
 * VoiceMicModal — لوحة الصوت: كتم المايك، صوت الروم، المؤثرات
 * تُعرض فوق شريط الروم السفلي (أو كمودال مستقل عند الحاجة)
 */
import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { X, Mic, MicOff, Volume2, VolumeX, AudioLines } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { spacing, radius } from '@/theme';

interface VoiceMicPanelProps {
  onClose: () => void;
  roomId: string;
  canMic: boolean;
  micMuted: boolean;
  onToggleMic: () => void;
  volumeMuted: boolean;
  onToggleVolume: () => void;
}

interface VoiceMicModalProps extends VoiceMicPanelProps {
  visible: boolean;
}

function MicOptionButton({
  label,
  active,
  disabled,
  activeColor,
  onPress,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  activeColor: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.micOption,
        pressed && !disabled && { opacity: 0.85 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <View
        style={[
          styles.micCircle,
          active && { borderColor: activeColor, backgroundColor: `${activeColor}33` },
        ]}
      >
        {children}
      </View>
      <Text variant="caption" color="rgba(255,255,255,0.9)" weight="semibold" style={styles.micLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

export function VoiceMicPanel({
  onClose,
  roomId,
  canMic,
  micMuted,
  onToggleMic,
  volumeMuted,
  onToggleVolume,
}: VoiceMicPanelProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.sheet}>
      <LinearGradient
        colors={['#3A1316', '#1A0A0C', '#1F0606']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <LinearGradient colors={lu.gradients.pink} style={styles.headerMic}>
            <Mic size={18} color="#fff" strokeWidth={2.4} />
          </LinearGradient>
          <Text variant="button" weight="bold" color="#fff">
            {t('room.voicePanelTitle', 'الصوت')}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
          <X size={20} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </View>

      <View style={styles.optionsRow}>
        <MicOptionButton
          label={micMuted ? t('room.micUnmute', 'فتح المايك') : t('room.micOn', 'المايك')}
          active={micMuted}
          disabled={!canMic}
          activeColor={lu.colors.live}
          onPress={onToggleMic}
        >
          {micMuted ? (
            <MicOff size={26} color={lu.colors.live} strokeWidth={2.5} />
          ) : (
            <Mic size={26} color={lu.colors.mint} strokeWidth={2.5} />
          )}
        </MicOptionButton>

        <MicOptionButton
          label={volumeMuted ? t('room.unmuteRoom', 'إلغاء كتم') : t('room.muteRoom', 'كتم الغرفة')}
          active={volumeMuted}
          activeColor={lu.colors.live}
          onPress={onToggleVolume}
        >
          <Mic size={26} color={volumeMuted ? lu.colors.live : '#fff'} strokeWidth={2.5} />
          <View style={styles.badge}>
            {volumeMuted ? (
              <VolumeX size={11} color={lu.colors.live} strokeWidth={2.5} />
            ) : (
              <Volume2 size={11} color={lu.colors.mint} strokeWidth={2.5} />
            )}
          </View>
        </MicOptionButton>

        <MicOptionButton
          label={t('room.sfxPanelTitle', 'مؤثرات')}
          active
          activeColor={lu.colors.purple}
          onPress={() => {}}
        >
          <Mic size={26} color={lu.colors.pink} strokeWidth={2.5} />
          <View style={styles.badge}>
            <AudioLines size={11} color={lu.colors.pink} strokeWidth={2.5} />
          </View>
        </MicOptionButton>
      </View>

      {/* الأصوات انتقلت لتبويب الطبلة 🥁 داخل لوحة الإيموجي */}
    </View>
  );
}

export function VoiceMicModal({
  visible,
  onClose,
  roomId,
  canMic,
  micMuted,
  onToggleMic,
  volumeMuted,
  onToggleVolume,
}: VoiceMicModalProps) {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <VoiceMicPanel
            onClose={onClose}
            roomId={roomId}
            canMic={canMic}
            micMuted={micMuted}
            onToggleMic={onToggleMic}
            volumeMuted={volumeMuted}
            onToggleVolume={onToggleVolume}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const MIC_CIRCLE = 64;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
    maxHeight: 420,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerMic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: spacing.sm,
  },
  micOption: { alignItems: 'center', width: 90 },
  micCircle: {
    width: MIC_CIRCLE,
    height: MIC_CIRCLE,
    borderRadius: MIC_CIRCLE / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  micLabel: { marginTop: 8, fontSize: 11, textAlign: 'center' },
  badge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  sfxHint: { textAlign: 'center', marginBottom: spacing.sm },
  sfxScroll: { paddingBottom: spacing.sm },
  sfxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  sfxItem: { width: 72, alignItems: 'center' },
  sfxMicCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sfxLabel: { fontSize: 10, marginTop: 6, textAlign: 'center' },
});
