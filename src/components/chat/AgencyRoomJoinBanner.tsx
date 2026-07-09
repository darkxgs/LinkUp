/**
 * شريط «في روم» داخل المحادثة — انضم للروم
 */
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Headphones } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { ForwardChevron } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { spacing, radius } from '@/theme';

interface Props {
  roomName: string;
  onPressJoin: () => void;
}

export function AgencyRoomJoinBanner({ roomName, onPressJoin }: Props) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPressJoin}
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.92 }]}
    >
      <Headphones size={16} color={lu.colors.pink} strokeWidth={2.2} />
      <Text variant="caption" color={lu.colors.ink} style={styles.text} numberOfLines={2}>
        {t('chat.agencyInRoom', { room: roomName })}
      </Text>
      <View style={styles.joinPill}>
        <Text variant="caption" weight="bold" color={lu.colors.pink}>
          {t('chat.joinRoom')}
        </Text>
        <ForwardChevron size={14} color={lu.colors.pink} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255, 95, 95, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 95, 95, 0.28)',
  },
  text: { flex: 1, lineHeight: 18 },
  joinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
