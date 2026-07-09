/**
 * لوحة ومشغّل المؤثرات — نفس أسلوب Interactive Tools في الروم
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Volume2 } from 'lucide-react-native';

import { Text } from '@/components/ui';
import {
  ROOM_SOUND_EFFECTS,
  triggerSoundEffect,
  subscribeToSoundEffects,
  getSoundEffect,
  playSoundEffectLocal,
  type SoundEffectEvent,
  type SoundEffectId,
  type SoundEffectDef,
} from '@/services/roomSoundEffects';
import { playRoomSoundSource } from '@/utils/playRoomSound';
import { lu } from '@/theme/lu-brand';
import { ROOM_DESIGN } from '@/theme/room-design';
import { spacing } from '@/theme';

const COOLDOWN_MS = 700;
const ICON_SIZE = 22;
const ICON_BOX = 52;

function SfxIconButton({
  effect,
  label,
  busy,
  disabled,
  onPress,
}: {
  effect: SoundEffectDef;
  label: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { Icon } = effect;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.sfxItem,
        pressed && !disabled && styles.sfxItemPressed,
      ]}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: `${effect.color}22`,
            borderColor: busy ? effect.color : `${effect.color}44`,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={effect.color} />
        ) : (
          <Icon size={ICON_SIZE} color={effect.color} strokeWidth={2.5} />
        )}
      </View>
      <Text
        variant="caption"
        color="rgba(255,255,255,0.88)"
        weight="semibold"
        numberOfLines={1}
        style={styles.sfxLabel}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface PanelProps {
  roomId: string;
  myUid?: string | null;
  onClose?: () => void;
}

export function SoundEffectsPanel({ roomId, onClose }: PanelProps) {
  const { t } = useTranslation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const lastTriggerRef = useRef(0);

  const handleTrigger = useCallback(
    async (effectId: SoundEffectId) => {
      const now = Date.now();
      if (now - lastTriggerRef.current < COOLDOWN_MS) return;
      lastTriggerRef.current = now;
      setBusyId(effectId);
      try {
        await playSoundEffectLocal(effectId, 0.92);
        await triggerSoundEffect(roomId, effectId);
      } catch {
        // ignore
      } finally {
        setTimeout(() => setBusyId(null), COOLDOWN_MS);
      }
    },
    [roomId],
  );

  return (
    <View style={styles.panel}>
      <LinearGradient
        colors={[...ROOM_DESIGN.panelGradient]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.panelHeader}>
        <View style={styles.titleRow}>
          <LinearGradient colors={lu.gradients.pink} style={styles.titleIcon}>
            <Volume2 size={18} color="#fff" strokeWidth={2.4} />
          </LinearGradient>
          <View style={styles.titleTextWrap}>
            <Text variant="button" weight="bold" color="#fff">
              {t('room.sfxPanelTitle')}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.55)" style={styles.hint}>
              {t('room.sfxPanelHint')}
            </Text>
          </View>
        </View>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Text variant="caption" color="rgba(255,255,255,0.75)" weight="semibold">
              {t('common.close')}
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.scrollInner}
      >
        <View style={styles.grid}>
          {ROOM_SOUND_EFFECTS.map((effect) => (
            <SfxIconButton
              key={effect.id}
              effect={effect}
              label={t(effect.labelKey)}
              busy={busyId === effect.id}
              disabled={!!busyId}
              onPress={() => handleTrigger(effect.id)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

interface PlayerProps {
  roomId: string;
  myUid?: string | null;
  muted?: boolean;
}

export function SoundEffectsPlayer({ roomId, myUid, muted }: PlayerProps) {
  const { t } = useTranslation();
  const [toast, setToast] = useState<{
    effect: SoundEffectDef;
    label: string;
    name: string;
  } | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const myUidRef = useRef(myUid);
  myUidRef.current = myUid;

  const showToast = useCallback(
    (effect: SoundEffectDef, label: string, name: string) => {
      setToast({ effect, label, name });
      Animated.sequence([
        Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, friction: 6 }),
        Animated.delay(1600),
        Animated.timing(toastAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start(() => setToast(null));
    },
    [toastAnim],
  );

  useEffect(() => {
    if (!roomId) return;

    return subscribeToSoundEffects(roomId, async (event: SoundEffectEvent) => {
      const effect = getSoundEffect(event.effectId);
      if (!effect) return;

      const label = t(effect.labelKey);
      showToast(effect, label, event.triggeredByName);

      if (muted) return;
      if (event.triggeredBy && event.triggeredBy === myUidRef.current) return;

      try {
        await playRoomSoundSource(effect.source, 0.88, effect.id);
      } catch {
        // ignore
      }
    });
  }, [roomId, muted, t, showToast]);

  if (!toast) return null;

  const { Icon } = toast.effect;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          opacity: toastAnim,
          transform: [
            {
              scale: toastAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.88, 1],
              }),
            },
            {
              translateY: toastAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={lu.gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.toastInner}
      >
        <View
          style={[
            styles.toastIconBox,
            { backgroundColor: `${toast.effect.color}33` },
          ]}
        >
          <Icon size={20} color="#fff" strokeWidth={2.5} />
        </View>
        <View>
          <Text variant="caption" color="#fff" weight="bold">
            {toast.label}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.85)" style={{ fontSize: 10 }}>
            {toast.name}
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(225, 20, 20,0.22)',
    maxHeight: 300,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: 14,
    paddingBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  titleIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  hint: {
    marginTop: 2,
    fontSize: 11,
  },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginStart: 8,
  },
  scrollInner: {
    paddingBottom: 18,
    paddingTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    justifyContent: 'flex-start',
  },
  sfxItem: {
    width: '23%',
    minWidth: 72,
    maxWidth: 88,
    alignItems: 'center',
    paddingVertical: 4,
  },
  sfxItemPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  iconBox: {
    width: ICON_BOX,
    height: ICON_BOX,
    borderRadius: ICON_BOX / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: 6,
  },
  sfxLabel: {
    fontSize: 10,
    textAlign: 'center',
    width: '100%',
  },
  toast: {
    position: 'absolute',
    top: '36%',
    alignSelf: 'center',
    zIndex: 120,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: lu.colors.pink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  toastIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
