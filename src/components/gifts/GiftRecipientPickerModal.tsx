/**
 * اختيار مستلم الهدية — أصدقاء أو معرّف المستخدم
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Users, Hash, Send, Search, X, Gift } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { lu } from '@/theme/lu-brand';
import { useAuth } from '@/hooks/useAuth';
import { getChatFriendUids } from '@/services/firebase/chatFriends';
import { getUser } from '@/services/firebase/users';
import { resolveUserIdentifier } from '@/services/userIdentifier';
import { buyAndSendGift, type Gift as GiftType } from '@/services/firebase/shop';
import {
  addRelationshipPoints,
  RELATIONSHIP_LEVELS,
} from '@/services/firebase/social';
import { GiftVisual } from '@/components/ui/GiftVisual';
import { COIN_CURRENCY_ICON } from '@/constants/brandAssets';

type RecipientMode = 'friends' | 'id';

type FriendRow = {
  uid: string;
  name: string;
  avatar?: string;
};

type Props = {
  visible: boolean;
  gift: GiftType | null;
  onClose: () => void;
  onSent?: () => void;
};

export function GiftRecipientPickerModal({ visible, gift, onClose, onSent }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [mode, setMode] = useState<RecipientMode>('friends');
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [idInput, setIdInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);

  const loadFriends = useCallback(async () => {
    if (!user?.uid) {
      setFriends([]);
      return;
    }
    setLoadingFriends(true);
    try {
      const friendUids = await getChatFriendUids(user.uid);
      const profiles = await Promise.all(
        [...friendUids].slice(0, 80).map(async (uid): Promise<FriendRow | null> => {
          const profile = await getUser(uid);
          if (!profile) return null;
          return {
            uid: profile.uid,
            name: profile.displayName || 'مستخدم',
            avatar: profile.avatar,
          };
        }),
      );
      const list = profiles
        .filter((p): p is FriendRow => p != null)
        .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      setFriends(list);
    } catch {
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  }, [user?.uid, t]);

  useEffect(() => {
    if (!visible) {
      setMode('friends');
      setIdInput('');
      setSending(false);
      setSearching(false);
      return;
    }
    if (mode === 'friends') void loadFriends();
  }, [visible, mode, loadFriends]);

  const sendGiftTo = async (toUid: string, toName: string) => {
    if (!gift || !user || sending) return;
    if (toUid === user.uid) {
      Alert.alert(t('common.error'), t('gifts.cannotSendToSelf'));
      return;
    }

    if (user.stats.coins < gift.price) {
      Alert.alert(
        t('gifts.insufficientCoins'),
        t('store.needMoreBalance', {
          amount: (gift.price - user.stats.coins).toLocaleString('en-US'),
          currency: t('lottery.text14819'),
        }),
      );
      return;
    }

    setSending(true);
    try {
      await buyAndSendGift(gift, toUid, toName);

      let levelUpInfo: { newLevel: number; previousLevel: number; levelUp: boolean } | null = null;
      try {
        const profile = await getUser(toUid);
        const result = await addRelationshipPoints(
          toUid,
          toName,
          profile?.avatar ?? '',
          gift.price,
          'gift',
        );
        if (result.levelUp) levelUpInfo = result;
      } catch {
        /* optional */
      }

      onClose();
      onSent?.();

      if (levelUpInfo) {
        const newLevelData = RELATIONSHIP_LEVELS.find((l) => l.level === levelUpInfo!.newLevel);
        Alert.alert(
          t('chat.levelUpgrade'),
          t('gifts.sendLevelUpMessage', {
            level: levelUpInfo.newLevel,
            title: newLevelData?.title ?? '',
            giftName: gift.name,
            name: toName,
          }),
        );
      } else {
        Alert.alert(
          t('gifts.text92285'),
          t('gifts.sendSuccessMessage', {
            giftName: gift.name,
            name: toName,
            price: gift.price.toLocaleString('en-US'),
          }),
        );
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('common.errorOccurred');
      Alert.alert(t('store.sendFailed'), message);
    } finally {
      setSending(false);
    }
  };

  const handleSendById = async () => {
    if (!gift || !idInput.trim() || searching) return;
    setSearching(true);
    try {
      const uid = await resolveUserIdentifier(idInput.trim());
      if (!uid) {
        Alert.alert(t('gifts.recipientNotFound'), t('gifts.recipientNotFoundHint'));
        return;
      }
      if (uid === user?.uid) {
        Alert.alert(t('common.error'), t('gifts.cannotSendToSelf'));
        return;
      }
      const profile = await getUser(uid);
      if (!profile) {
        Alert.alert(t('gifts.recipientNotFound'), t('gifts.recipientNotFoundHint'));
        return;
      }
      await sendGiftTo(uid, profile.displayName || 'مستخدم');
    } finally {
      setSearching(false);
    }
  };

  if (!gift) return null;

  const modes: { key: RecipientMode; label: string; Icon: typeof Users }[] = [
    { key: 'friends', label: t('gifts.recipientFriends'), Icon: Users },
    { key: 'id', label: t('gifts.recipientById'), Icon: Hash },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => !sending && onClose()}>
      <Pressable style={styles.overlay} onPress={() => !sending && onClose()}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.giftPreview}>
              <View style={[styles.giftIconWrap, { backgroundColor: `${gift.iconColor}15` }]}>
                <GiftVisual gift={gift} size={36} />
              </View>
              <View style={styles.giftMeta}>
                <Text style={styles.sheetTitle}>{t('gifts.selectRecipient')}</Text>
                <Text style={styles.giftName} numberOfLines={1}>
                  {gift.name}
                </Text>
                <View style={styles.priceRow}>
                  <Image source={COIN_CURRENCY_ICON} style={{ width: 14, height: 14 }} contentFit="contain" />
                  <Text style={styles.priceText}>{gift.price.toLocaleString('en-US')}</Text>
                </View>
              </View>
            </View>
            <Pressable onPress={() => !sending && onClose()} hitSlop={12} style={styles.closeBtn}>
              <X size={20} color={lu.colors.muted} />
            </Pressable>
          </View>

          <View style={styles.modeRow}>
            {modes.map((m) => {
              const ModeIcon = m.Icon;
              const active = mode === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setMode(m.key)}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                >
                  <ModeIcon size={14} color={active ? '#fff' : lu.colors.purple} />
                  <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {mode === 'friends' ? (
            loadingFriends ? (
              <ActivityIndicator color={lu.colors.purple} style={{ marginVertical: 32 }} />
            ) : friends.length === 0 ? (
              <View style={styles.emptyBox}>
                <Users size={32} color={lu.colors.muted} strokeWidth={1.5} />
                <Text style={styles.emptyText}>{t('gifts.noFriendsToSend')}</Text>
                <Pressable onPress={() => setMode('id')} style={styles.emptyAction}>
                  <Text style={styles.emptyActionText}>{t('gifts.searchByIdInstead')}</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {friends.map((person) => (
                  <Pressable
                    key={person.uid}
                    style={styles.friendRow}
                    disabled={sending}
                    onPress={() => void sendGiftTo(person.uid, person.name)}
                  >
                    {person.avatar ? (
                      <Image source={{ uri: person.avatar }} style={styles.avatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.avatarLetter}>{person.name.charAt(0)}</Text>
                      </View>
                    )}
                    <Text style={styles.friendName} numberOfLines={1}>
                      {person.name}
                    </Text>
                    <Send size={16} color={lu.colors.purple} />
                  </Pressable>
                ))}
              </ScrollView>
            )
          ) : (
            <View style={styles.idBox}>
              <Text style={styles.idLabel}>{t('gifts.idInputLabel')}</Text>
              <View style={styles.idInputRow}>
                <Search size={18} color={lu.colors.muted} />
                <TextInput
                  value={idInput}
                  onChangeText={setIdInput}
                  placeholder={t('gifts.idInputPlaceholder')}
                  placeholderTextColor={lu.colors.muted}
                  style={styles.idInput}
                  autoCapitalize="none"
                  editable={!searching && !sending}
                />
              </View>
              <Pressable
                onPress={() => void handleSendById()}
                disabled={searching || sending || !idInput.trim()}
                style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
              >
                <LinearGradient
                  colors={lu.gradients.pink}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.idSendBtn,
                    (!idInput.trim() || searching || sending) && { opacity: 0.5 },
                  ]}
                >
                  {searching || sending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Gift size={18} color="#fff" />
                      <Text style={styles.idSendText}>{t('gifts.sendGift')}</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
              <Text style={styles.idHint}>{t('gifts.idInputHint')}</Text>
            </View>
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: lu.colors.line,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  giftPreview: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  giftIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftMeta: {
    flex: 1,
    gap: 2,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
  },
  giftName: {
    fontSize: 13,
    color: lu.colors.ink2,
    fontFamily: lu.fonts.body,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '800',
    color: lu.colors.gold2,
    fontFamily: lu.fonts.bodyHeavy,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: lu.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 99,
    backgroundColor: lu.colors.bg,
    borderWidth: 1.5,
    borderColor: lu.colors.line,
  },
  modeChipActive: {
    backgroundColor: lu.colors.purple,
    borderColor: lu.colors.purple,
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: lu.colors.purple,
    fontFamily: lu.fonts.bodyHeavy,
  },
  modeChipTextActive: {
    color: '#fff',
  },
  list: {
    maxHeight: 340,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lu.colors.line,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  friendName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyBold,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: lu.colors.ink2,
    textAlign: 'center',
    fontFamily: lu.fonts.body,
    paddingHorizontal: 16,
  },
  emptyAction: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '800',
    color: lu.colors.purple,
    fontFamily: lu.fonts.bodyHeavy,
  },
  idBox: {
    gap: 10,
    paddingBottom: 8,
  },
  idLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: lu.colors.ink2,
    fontFamily: lu.fonts.bodyBold,
  },
  idInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: lu.colors.bg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  idInput: {
    flex: 1,
    fontSize: 15,
    color: lu.colors.ink,
    fontFamily: lu.fonts.body,
    textAlign: 'right',
  },
  idSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 25,
    marginTop: 4,
  },
  idSendText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  idHint: {
    fontSize: 12,
    color: lu.colors.muted,
    textAlign: 'center',
    fontFamily: lu.fonts.body,
    marginTop: 4,
  },
});
