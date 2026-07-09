/**
 * RoomEffectsModal — إدارة المؤثرات الخاصة (شخصية + إعدادات الغرفة)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, User, Home } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import {
  type RoomEffectsSettings,
  type PersonalEffectsPrefs,
  DEFAULT_PERSONAL_EFFECTS,
  loadPersonalEffectsPrefs,
  savePersonalEffectsPrefs,
  updateRoomEffectsSettings,
} from '@/services/roomEffects';
import { lu } from '@/theme/lu-brand';
import { spacing } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  roomEffects: RoomEffectsSettings;
  canManageRoom: boolean;
  myUid: string;
  onPersonalChange?: (prefs: PersonalEffectsPrefs) => void;
  onRoomChange?: (settings: RoomEffectsSettings) => void;
}

function EffectRow({
  label,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, disabled && { opacity: 0.5 }]}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: '#374151', true: lu.colors.mint }}
        thumbColor="#fff"
      />
      <Text variant="body" color="#fff" style={styles.rowLabel}>
        {label}
      </Text>
    </View>
  );
}

export function RoomEffectsModal({
  visible,
  onClose,
  roomId,
  roomEffects,
  canManageRoom,
  myUid,
  onPersonalChange,
  onRoomChange,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [personal, setPersonal] = useState<PersonalEffectsPrefs>(DEFAULT_PERSONAL_EFFECTS);
  const [roomLocal, setRoomLocal] = useState<RoomEffectsSettings>(roomEffects);
  const [loading, setLoading] = useState(true);
  const [savingRoom, setSavingRoom] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setRoomLocal(roomEffects);
    loadPersonalEffectsPrefs().then((p) => {
      setPersonal(p);
      setLoading(false);
    });
  }, [visible, roomEffects]);

  const patchPersonal = useCallback(
    async (patch: Partial<PersonalEffectsPrefs>) => {
      const next = { ...personal, ...patch };
      setPersonal(next);
      await savePersonalEffectsPrefs(next);
      onPersonalChange?.(next);
    },
    [onPersonalChange, personal],
  );

  const patchRoom = useCallback(
    async (patch: Partial<Pick<RoomEffectsSettings, 'soundEffects' | 'animations'>>) => {
      if (!canManageRoom || !myUid) return;
      setSavingRoom(true);
      const next = { ...roomLocal, ...patch, updatedAt: Date.now() };
      setRoomLocal(next);
      try {
        await updateRoomEffectsSettings(roomId, patch, myUid);
        onRoomChange?.(next);
      } finally {
        setSavingRoom(false);
      }
    },
    [canManageRoom, myUid, onRoomChange, roomId, roomLocal],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.base }]}
          onPress={(e) => e.stopPropagation()}
        >
          <LinearGradient
            colors={['rgba(71, 17, 17, 0.98)', 'rgba(61, 15, 15, 0.98)']}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.header}>
            <Text variant="h4" weight="bold" color="#fff" style={{ flex: 1, textAlign: 'center' }}>
              {t('roomEffects.title')}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={20} color="rgba(255,255,255,0.85)" />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={lu.colors.gold} style={{ marginVertical: 40 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <User size={16} color={lu.colors.blue} />
                  <Text variant="body" color="#fff" weight="bold">
                    {t('roomEffects.personalSettings')}
                  </Text>
                </View>
                <EffectRow
                  label={t('roomEffects.animatedGifts')}
                  value={personal.animatedGifts}
                  onValueChange={(v) => void patchPersonal({ animatedGifts: v })}
                />
                <EffectRow
                  label={t('roomEffects.animatedEntries')}
                  value={personal.animatedEntries}
                  onValueChange={(v) => void patchPersonal({ animatedEntries: v })}
                />
                <EffectRow
                  label={t('roomEffects.ambientSound')}
                  value={personal.ambientSoundEffects}
                  onValueChange={(v) => void patchPersonal({ ambientSoundEffects: v })}
                />
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Home size={16} color={lu.colors.gold} />
                  <Text variant="body" color="#fff" weight="bold">
                    {t('roomEffects.roomSettings')}
                  </Text>
                  {!canManageRoom ? (
                    <Text variant="caption" color="rgba(255,255,255,0.45)" style={{ marginStart: 'auto' }}>
                      {t('roomEffects.hostOnly')}
                    </Text>
                  ) : null}
                </View>
                {savingRoom ? (
                  <ActivityIndicator color={lu.colors.gold} size="small" style={{ marginVertical: 8 }} />
                ) : null}
                <EffectRow
                  label={t('roomEffects.roomSoundEffects')}
                  value={roomLocal.soundEffects}
                  onValueChange={(v) => void patchRoom({ soundEffects: v })}
                  disabled={!canManageRoom}
                />
                <EffectRow
                  label={t('roomEffects.roomAnimations')}
                  value={roomLocal.animations}
                  onValueChange={(v) => void patchRoom({ animations: v })}
                  disabled={!canManageRoom}
                />
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    maxHeight: '72%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    left: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 16,
    padding: 14,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
});
