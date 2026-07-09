/**
 * ترقيم — تصفير دعم المقاعد (تحديد أشخاص أو الكل)
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { X, Hash, Check, User } from 'lucide-react-native';

import { Text } from '@/components/ui';
import {
  clearRoomSeatSupport,
  clearRoomSeatSupportForUsers,
} from '@/services/roomContributions';
import { lu } from '@/theme/lu-brand';
import { ROOM_DESIGN } from '@/theme/room-design';
import { colors, radius, spacing } from '@/theme';

export type MicSupportResetMember = {
  uid: string;
  name: string;
  avatar?: string;
  coins: number;
  seatIndex?: number;
};

type Props = {
  visible: boolean;
  roomId: string;
  members: MicSupportResetMember[];
  onClose: () => void;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

function formatCoins(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  return value.toLocaleString('en-US');
}

export function RoomResetMicSupportModal({
  visible,
  roomId,
  members,
  onClose,
  onSuccess,
  onError,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const memberUids = useMemo(() => members.map((m) => m.uid), [members]);
  const allSelected = members.length > 0 && selected.size === members.length;

  useEffect(() => {
    if (visible) setSelected(new Set());
  }, [visible, memberUids.join(',')]);

  const toggleOne = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(memberUids));
  };

  const handleReset = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      if (allSelected) {
        await clearRoomSeatSupport(roomId);
      } else {
        await clearRoomSeatSupportForUsers(roomId, [...selected]);
      }
      onSuccess?.();
      onClose();
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.base }]}
          onPress={(e) => e.stopPropagation()}
        >
          <LinearGradient colors={[...ROOM_DESIGN.panelGradientShort]} style={StyleSheet.absoluteFill} />
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Hash size={20} color="#34D399" strokeWidth={2.5} />
              <Text variant="h3" weight="bold" color={colors.white}>
                {t('roomTools.interactive.tarqeem')}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} disabled={busy}>
              <X size={20} color={colors.white} strokeWidth={2.5} />
            </Pressable>
          </View>

          <Text variant="caption" color="rgba(255,255,255,0.6)" style={styles.hint}>
            {t('roomEffects.resetMicSupportSelectHint')}
          </Text>

          {members.length > 0 ? (
            <Pressable onPress={toggleAll} style={styles.selectAllRow} disabled={busy}>
              <View style={[styles.checkbox, allSelected && styles.checkboxOn]}>
                {allSelected ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
              </View>
              <Text variant="body" weight="bold" color={colors.white}>
                {t('roomEffects.resetMicSupportSelectAll')}
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.45)">
                ({members.length})
              </Text>
            </Pressable>
          ) : null}

          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {members.length === 0 ? (
              <View style={styles.empty}>
                <Text variant="bodySmall" color="rgba(255,255,255,0.5)" align="center">
                  {t('roomEffects.resetMicSupportEmpty')}
                </Text>
              </View>
            ) : (
              members.map((m) => {
                const isOn = selected.has(m.uid);
                return (
                  <Pressable
                    key={m.uid}
                    onPress={() => toggleOne(m.uid)}
                    style={[styles.memberRow, isOn && styles.memberRowOn]}
                    disabled={busy}
                  >
                    <View style={[styles.checkbox, isOn && styles.checkboxOn]}>
                      {isOn ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
                    </View>
                    {m.avatar ? (
                      <Image source={{ uri: m.avatar }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <User size={16} color="rgba(255,255,255,0.5)" />
                      </View>
                    )}
                    <View style={styles.memberInfo}>
                      <Text variant="body" weight="semibold" color={colors.white} numberOfLines={1}>
                        {m.name}
                      </Text>
                      {m.seatIndex != null ? (
                        <Text variant="caption" color="rgba(255,255,255,0.45)">
                          {t('room.seat')} {m.seatIndex}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.coinsChip}>
                      <LinearGradient
                        colors={['rgba(225, 20, 20,0.88)', 'rgba(232, 23, 23, 0.78)']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <Text variant="caption" weight="bold" color="#fff">
                        {formatCoins(m.coins)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <Pressable
            onPress={() => void handleReset()}
            disabled={busy || selected.size === 0}
            style={[styles.resetBtn, (busy || selected.size === 0) && { opacity: 0.45 }]}
          >
            <LinearGradient
              colors={['#F43F5E', '#E11414']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text variant="button" weight="bold" color="#fff">
                {selected.size === members.length && members.length > 0
                  ? t('roomEffects.resetMicSupportAllAction')
                  : t('roomEffects.resetMicSupportSelected', { count: selected.size })}
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    overflow: 'hidden',
    maxHeight: '78%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginBottom: spacing.md,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: spacing.sm,
    borderRadius: radius.base,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.35)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: '#34D399',
    borderColor: '#34D399',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderRadius: radius.base,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  memberRowOn: {
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderColor: 'rgba(52,211,153,0.25)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInfo: {
    flex: 1,
    alignItems: I18nManager.isRTL ? 'flex-end' : 'flex-start',
  },
  coinsChip: {
    minWidth: 44,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  resetBtn: {
    marginTop: spacing.md,
    height: 50,
    borderRadius: radius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
