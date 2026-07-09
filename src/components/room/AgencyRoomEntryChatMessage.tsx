/**
 * إشعار دخول عضو في شات غرفة الوكالة — شريحة صغيرة بسيطة وهادئة (متجاوبة)
 */
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui';
import { resolveDisplayName } from '@/utils/displayName';
import { textDirectionStyle } from '@/utils/rtl';

type Props = {
  name: string;
  avatar?: string;
  isSelf?: boolean;
  onPress?: () => void;
};

export function AgencyRoomEntryChatMessage({ name, avatar, isSelf, onPress }: Props) {
  const { t } = useTranslation();
  const displayName = resolveDisplayName({ displayName: name });
  const initial = (displayName?.trim()?.[0] ?? '?').toUpperCase();
  const actionText = isSelf ? t('room.agencyEntrySelf') : t('room.agencyEntryGuest');
  // #14: الاتجاه الأساس من عبارة الدخول المترجمة لا من اسم المستخدم —
  // اسم لاتيني كان يقلب الجملة العربية إلى LTR
  const lineDir = textDirectionStyle(actionText);

  const content = (
    <View style={styles.chip}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" recyclingKey={avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.initial}>{initial}</Text>
        </View>
      )}
      <Text variant="caption" numberOfLines={1} style={[styles.line, lineDir]}>
        <Text style={styles.name}>{displayName} </Text>
        <Text style={styles.action}>{actionText}</Text>
      </Text>
    </View>
  );

  return (
    <View style={styles.wrap}>
      {onPress ? (
        <Pressable onPress={onPress} hitSlop={6}>
          {content}
        </Pressable>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginVertical: 3,
    paddingHorizontal: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 13,
    backgroundColor: 'rgba(28, 18, 18, 0.5)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: '90%',
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 10,
    lineHeight: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  line: {
    flexShrink: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  name: {
    fontSize: 11.5,
    color: '#FFD86F',
  },
  action: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.65)',
  },
});
