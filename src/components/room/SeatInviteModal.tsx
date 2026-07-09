/**
 * SeatInviteModal — دعوة شخص للمقعد: بحث بـ ID + المتابَعين + المتصلين
 * يرسل إشعار دعوة للمقعد (قبول/رفض) بدل الإضافة المباشرة
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { X, Search, Users, Radio } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { FramedAvatar } from '@/components/ui/FramedAvatar';
import { lu } from '@/theme/lu-brand';
import { spacing } from '@/theme';
import { auth } from '@/services/firebase';
import { getFollowing } from '@/services/firebase/follow';
import { getUser } from '@/services/firebase/users';
import { resolveUserIdentifier, getDisplayAccountId } from '@/services/userIdentifier';
import { sendRoomMicInvite } from '@/services/firebase/roomMicInvites';
import { resolveDisplayName } from '@/utils/displayName';
import type { ConnectedUserRow } from './ConnectedUsersSheet';

const SCREEN_H = Dimensions.get('window').height;

type Tab = 'connected' | 'following' | 'search';

interface FollowingUser {
  uid: string;
  name: string;
  avatar?: string;
  publicAccountId?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  seatIdx: number;
  roomId: string;
  roomName: string;
  connectedUsers: ConnectedUserRow[];
  frameByUid: Record<string, string>;
  includeMembership?: boolean;
}

export function SeatInviteModal({
  visible,
  onClose,
  seatIdx,
  roomId,
  roomName,
  connectedUsers,
  frameByUid,
  includeMembership = false,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const myUid = auth.currentUser?.uid;

  const [tab, setTab] = useState<Tab>('connected');
  const [searchId, setSearchId] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<FollowingUser | null>(null);
  const [followingUsers, setFollowingUsers] = useState<FollowingUser[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [sendingUid, setSendingUid] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setTab('connected');
      setSearchId('');
      setFoundUser(null);
      setSendingUid(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || tab !== 'following' || !myUid) return;
    if (followingUsers.length > 0) return;

    let cancelled = false;
    setLoadingFollowing(true);

    (async () => {
      try {
        const uids = await getFollowing(myUid, 50);
        const profiles = await Promise.all(
          uids.map((uid) => getUser(uid).catch(() => null)),
        );
        if (cancelled) return;
        const list: FollowingUser[] = [];
        uids.forEach((uid, i) => {
          const p = profiles[i];
          if (p) {
            list.push({
              uid,
              name: p.displayName || resolveDisplayName({ displayName: p.displayName }),
              avatar: p.avatar,
              publicAccountId: getDisplayAccountId(p.publicAccountId, uid),
            });
          }
        });
        setFollowingUsers(list);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoadingFollowing(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, tab, myUid, followingUsers.length]);

  const handleSearch = useCallback(async () => {
    const raw = searchId.trim();
    if (!raw) return;
    setSearching(true);
    setFoundUser(null);
    try {
      const uid = await resolveUserIdentifier(raw);
      if (!uid) {
        Alert.alert(t('common.error'), t('errors.userNotFound'));
        return;
      }
      const userDoc = await getUser(uid);
      if (!userDoc) {
        Alert.alert(t('common.error'), t('errors.userNotFound'));
        return;
      }
      setFoundUser({
        uid,
        name: userDoc.displayName || resolveDisplayName({ displayName: userDoc.displayName }),
        avatar: userDoc.avatar,
        publicAccountId: getDisplayAccountId(userDoc.publicAccountId, uid),
      });
    } catch {
      Alert.alert(t('common.error'), t('errors.userNotFound'));
    } finally {
      setSearching(false);
    }
  }, [searchId, t]);

  const sendMicInvite = useCallback(async (targetUid: string, targetName: string) => {
    if (!myUid || sendingUid) return;
    setSendingUid(targetUid);
    try {
      const myProfile = await getUser(myUid).catch(() => null);
      await sendRoomMicInvite({
        targetUid,
        targetName,
        roomId,
        roomName,
        seatIdx: seatIdx >= 0 ? seatIdx : undefined,
        includeMembership,
        inviterName: myProfile?.displayName || t('room.agencyManagerFallback'),
        inviterAvatar: myProfile?.avatar,
      });
      Alert.alert(t('common.done'), t('room.micInviteSent'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('common.error');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSendingUid(null);
    }
  }, [myUid, roomId, roomName, seatIdx, includeMembership, sendingUid, t]);

  const offSeatConnected = connectedUsers.filter((u) => !u.onSeat && u.uid !== myUid);

  const renderConnectedUser = useCallback(({ item }: { item: ConnectedUserRow }) => {
    const frameUri = frameByUid[item.uid];
    return (
      <View style={styles.userRow}>
        <View style={styles.userInfo}>
          {frameUri ? (
            <FramedAvatar avatarUri={item.avatar} frameUri={frameUri} avatarSize={40} fallbackLetter={item.name} />
          ) : item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text variant="body" color="#FFF" weight="bold">{item.name.charAt(0)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text variant="bodySmall" weight="bold" color={lu.colors.ink} numberOfLines={1}>{item.name}</Text>
            <Text variant="caption" color="#9CA3AF">LV.{item.level}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={styles.inviteBtn}
            onPress={() => sendMicInvite(item.uid, item.name)}
            disabled={!!sendingUid}
          >
            {sendingUid === item.uid ? (
              <ActivityIndicator size="small" color={lu.colors.pink} />
            ) : (
              <Text variant="caption" weight="bold" color={lu.colors.pink}>{t('room.sendInvite')}</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }, [frameByUid, sendMicInvite, sendingUid, t]);

  const renderFollowingUser = useCallback(({ item }: { item: FollowingUser }) => (
    <View style={styles.userRow}>
      <View style={styles.userInfo}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text variant="body" color="#FFF" weight="bold">{item.name.charAt(0)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text variant="bodySmall" weight="bold" color={lu.colors.ink} numberOfLines={1}>{item.name}</Text>
          <Text variant="caption" color="#9CA3AF">ID: {item.publicAccountId ?? item.uid.slice(0, 8)}</Text>
        </View>
      </View>
      <Pressable
        style={styles.inviteBtn}
        onPress={() => sendMicInvite(item.uid, item.name)}
        disabled={!!sendingUid}
      >
        {sendingUid === item.uid ? (
          <ActivityIndicator size="small" color={lu.colors.pink} />
        ) : (
          <Text variant="caption" weight="bold" color={lu.colors.pink}>{t('room.sendInvite')}</Text>
        )}
      </Pressable>
    </View>
  ), [sendMicInvite, sendingUid, t]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={lu.colors.ink} />
            </Pressable>
            <Text variant="h3" weight="bold" color={lu.colors.ink}>
              دعوة للمقعد {seatIdx}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {([
              { id: 'connected' as Tab, label: 'المتصلين', icon: Radio },
              { id: 'following' as Tab, label: 'المتابَعين', icon: Users },
              { id: 'search' as Tab, label: 'بحث بـ ID', icon: Search },
            ]).map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
              >
                <t.icon size={14} color={tab === t.id ? '#FFF' : lu.colors.muted} />
                <Text variant="caption" weight="bold" color={tab === t.id ? '#FFF' : lu.colors.muted}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Content */}
          {tab === 'connected' && (
            <FlatList
              data={offSeatConnected}
              keyExtractor={(item) => item.uid}
              renderItem={renderConnectedUser}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: spacing.md }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text variant="body" color="#9CA3AF">لا يوجد مستخدمين متصلين خارج المايك</Text>
                </View>
              }
            />
          )}

          {tab === 'following' && (
            loadingFollowing ? (
              <View style={styles.center}>
                <ActivityIndicator color={lu.colors.pink} />
              </View>
            ) : (
              <FlatList
                data={followingUsers}
                keyExtractor={(item) => item.uid}
                renderItem={renderFollowingUser}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: spacing.md }}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text variant="body" color="#9CA3AF">لا يوجد متابَعين</Text>
                  </View>
                }
              />
            )
          )}

          {tab === 'search' && (
            <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
              <View style={styles.searchRow}>
                <Pressable
                  onPress={handleSearch}
                  disabled={searching || !searchId.trim()}
                  style={styles.searchBtn}
                >
                  {searching ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Search size={18} color="#FFF" />
                  )}
                </Pressable>
                <TextInput
                  value={searchId}
                  onChangeText={setSearchId}
                  placeholder="أدخل أيدي المستخدم"
                  placeholderTextColor="#9CA3AF"
                  style={styles.searchInput}
                  autoCapitalize="none"
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
              </View>

              {foundUser && (
                <View style={styles.foundCard}>
                  {foundUser.avatar ? (
                    <Image source={{ uri: foundUser.avatar }} style={styles.avatarLg} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatarLg, styles.avatarFallback]}>
                      <Text variant="h3" color="#FFF" weight="bold">{foundUser.name.charAt(0)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="bold" color={lu.colors.ink}>{foundUser.name}</Text>
                    <Text variant="caption" color="#9CA3AF">
                      ID: {foundUser.publicAccountId ?? foundUser.uid.slice(0, 8)}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.inviteBtnLg}
                    onPress={() => sendMicInvite(foundUser.uid, foundUser.name)}
                    disabled={!!sendingUid}
                  >
                    {sendingUid === foundUser.uid ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text variant="bodySmall" weight="bold" color="#FFF">إرسال دعوة</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_H * 0.7,
    minHeight: SCREEN_H * 0.45,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  tabBtnActive: {
    backgroundColor: lu.colors.pink,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarLg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: lu.colors.purple,
  },
  inviteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: lu.colors.pink,
  },
  inviteBtnLg: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: lu.colors.pink,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: lu.colors.ink,
    textAlign: 'right',
    backgroundColor: '#FAFAFA',
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: lu.colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
});
