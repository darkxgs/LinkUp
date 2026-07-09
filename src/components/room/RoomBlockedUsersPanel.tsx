/**
 * RoomBlockedUsersPanel — قائمة المحظورين من الغرفة (داخل معلومات الروم)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
  I18nManager,
} from 'react-native';
import { Image } from 'expo-image';
import { Shield, Unlock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';
import {
  getRoomBlockedUsers,
  unblockUserFromRoom,
  type RoomBlockedUser,
} from '@/services/firebase/rooms';
import { formatBlockRemaining } from '@/utils/roomBlockDuration';

const SCREEN_H = Dimensions.get('window').height;

type Props = {
  roomId: string;
  canManage: boolean;
};

export function RoomBlockedUsersPanel({ roomId, canManage }: Props) {
  const { t, i18n } = useTranslation();
  const [blockedUsers, setBlockedUsers] = useState<RoomBlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBlocked = useCallback(async () => {
    setLoading(true);
    try {
      setBlockedUsers(await getRoomBlockedUsers(roomId));
    } catch {
      setBlockedUsers([]);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void loadBlocked();
  }, [loadBlocked]);

  const handleUnblock = (entry: RoomBlockedUser) => {
    if (!canManage) return;
    const name = entry.displayName ?? entry.uid;
    Alert.alert(t('room.unblockTitle'), t('room.unblockConfirm', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('room.unblockAction'),
        style: 'destructive',
        onPress: async () => {
          try {
            await unblockUserFromRoom(roomId, entry.uid);
            setBlockedUsers((prev) => prev.filter((u) => u.uid !== entry.uid));
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('room.unblockFailed');
            Alert.alert(t('common.error'), msg);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text variant="caption" color={lu.colors.ink2} style={styles.hint}>
        {t('room.blockedListHint')}
      </Text>

      {loading ? (
        <ActivityIndicator color={lu.colors.purple} style={{ marginVertical: 32 }} />
      ) : blockedUsers.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Shield size={48} color={lu.colors.muted} strokeWidth={1} style={{ marginBottom: 16 }} />
          <Text variant="body" weight="bold" color={lu.colors.ink2} align="center">
            {t('room.noBlockedUsers')}
          </Text>
          <Text variant="caption" color={lu.colors.muted} align="center" style={{ marginTop: 8 }}>
            لا يوجد مستخدمين محظورين في هذه الغرفة حالياً
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: SCREEN_H * 0.58 }}
          contentContainerStyle={{ paddingBottom: spacing.md }}
        >
          {blockedUsers.map((entry) => {
            const isPermanent = entry.blockedUntil == null || entry.blockedUntil === undefined;
            const remaining = isPermanent
              ? t('room.blockPermanent')
              : t('room.blockExpires', {
                  time: formatBlockRemaining(entry.blockedUntil, i18n.language),
                });
            return (
              <View key={entry.uid} style={styles.row}>
                <View style={styles.avatar}>
                  {entry.avatar ? (
                    <Image source={{ uri: entry.avatar }} style={styles.avatarImg} contentFit="cover" cachePolicy="memory-disk" recyclingKey={entry.avatar} />
                  ) : (
                    <Text variant="caption" weight="bold" color="#fff">
                      {(entry.displayName ?? '?').charAt(0)}
                    </Text>
                  )}
                </View>
                <View style={styles.meta}>
                  <Text variant="bodySmall" weight="bold" color={lu.colors.ink} numberOfLines={1}>
                    {entry.displayName ?? entry.uid}
                  </Text>
                  <Text variant="caption" color={lu.colors.muted} style={{ fontSize: 10, marginTop: 2 }}>
                    {remaining}
                  </Text>
                </View>
                {canManage ? (
                  <Pressable onPress={() => handleUnblock(entry)} style={styles.unblockBtn}>
                    <Text variant="caption" weight="bold" color={lu.colors.purple} style={{ fontSize: 11 }}>
                      {t('room.unblockAction')}
                    </Text>
                    <Unlock size={14} color={lu.colors.purple} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  hint: {
    textAlign: 'center',
    marginBottom: spacing.base,
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(225, 20, 20,0.05)',
    paddingVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyWrap: {
    marginTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  meta: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  unblockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: '#FEE2E2',
  },
});
