/**
 * ورقة دعوة التحدي — أصدقاء / مطابقة / معرّف المستخدم
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Coins,
  Users,
  Zap,
  Hash,
  Send,
  Search,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { createChallenge } from '@/services/firebase/challenges';
import { notifyChallengeInvite } from '@/services/firebase/challengeInvites';
import {
  joinChallengeMatchQueue,
  leaveChallengeMatchQueue,
  subscribeWhileWaitingForMatch,
} from '@/services/firebase/challengeMatchmaking';
import { resolveUserIdentifier } from '@/services/userIdentifier';
import { getUser } from '@/services/firebase/users';
import type { ChallengeGameId } from '@/services/firebase/challenges';
import { getChallengeGameLabel } from '@/utils/challengeI18n';
import {
  useChallengeInviteContacts,
  type ChallengeInviteContactFilter,
} from '@/hooks/useChallengeInviteContacts';

export type InviteGameInfo = {
  id: ChallengeGameId;
  name: string;
  colors: [string, string];
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

type InviteMode = 'friends' | 'match' | 'id';

const RELATION_KEYS: Record<string, string> = {
  friend: 'challenges.invite.relations.friend',
  follower: 'challenges.invite.relations.follower',
  following: 'challenges.invite.relations.following',
};

type Props = {
  visible: boolean;
  game: InviteGameInfo | null;
  bet: number;
  betOptions: number[];
  onClose: () => void;
  onBetChange: (bet: number) => void;
  onChallengeSent: (challengeId: string) => void;
};

export function ChallengeInviteSheet({
  visible,
  game,
  bet,
  betOptions,
  onClose,
  onBetChange,
  onChallengeSent,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [mode, setMode] = useState<InviteMode>('friends');
  const [idInput, setIdInput] = useState('');
  const [matching, setMatching] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const matchedRef = useRef(false);

  const {
    contacts,
    loading: loadingContacts,
    filter: contactFilter,
    setFilter: setContactFilter,
    counts: contactCounts,
  } = useChallengeInviteContacts(visible && mode === 'friends');

  const goToMatchedGame = useCallback(
    (challengeId: string) => {
      if (matchedRef.current) return;
      matchedRef.current = true;
      setMatching(false);
      void leaveChallengeMatchQueue();
      onClose();
      router.push(`/games/challenges/active?challengeId=${challengeId}` as any);
    },
    [onClose, router],
  );

  useEffect(() => {
    if (!visible) {
      setMode('friends');
      setIdInput('');
      setMatching(false);
      matchedRef.current = false;
      void leaveChallengeMatchQueue();
      return;
    }
  }, [visible]);

  useEffect(() => {
    if (!matching || !game) return;
    matchedRef.current = false;
    const unsub = subscribeWhileWaitingForMatch(game.id, bet, goToMatchedGame);
    return unsub;
  }, [matching, game?.id, bet, goToMatchedGame]);

  const sendToUser = async (toUid: string, toName: string, toAvatar: string) => {
    if (!game || sending) return;
    setSending(true);
    try {
      const challengeId = await createChallenge(game.id, bet, toUid, toName, toAvatar);
      await notifyChallengeInvite({
        challengeId,
        gameId: game.id,
        bet,
        toUid,
        toName,
      });
      onChallengeSent(challengeId);
    } catch (e: any) {
      Alert.alert(t('challenges.active.error'), e?.message ?? t('challenges.invite.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  const handleMatch = async () => {
    if (!game || matching) return;
    setMatching(true);
    matchedRef.current = false;
    try {
      const result = await joinChallengeMatchQueue(game.id, bet);
      if (result.status === 'matched') {
        goToMatchedGame(result.challengeId);
      }
    } catch (e: any) {
      setMatching(false);
      Alert.alert(t('challenges.active.error'), e?.message ?? t('challenges.invite.matchFailed'));
    }
  };

  const handleCancelMatch = async () => {
    setMatching(false);
    await leaveChallengeMatchQueue();
  };

  const handleSendById = async () => {
    if (!game || !idInput.trim()) return;
    setSearching(true);
    try {
      const uid = await resolveUserIdentifier(idInput.trim());
      if (!uid) {
        Alert.alert(t('challenges.invite.notFound'), t('challenges.invite.userNotFound'));
        return;
      }
      const profile = await getUser(uid);
      if (!profile) {
        Alert.alert(t('challenges.invite.notFound'), t('challenges.invite.accountNotFound'));
        return;
      }
      await sendToUser(uid, profile.displayName || 'مستخدم', profile.avatar || '');
    } finally {
      setSearching(false);
    }
  };

  if (!game) return null;
  const GameIcon = game.Icon;

  const gameDisplayName = getChallengeGameLabel(game.id);

  const modes: { key: InviteMode; label: string; Icon: typeof Users }[] = [
    { key: 'friends', label: t('challenges.invite.modes.friends'), Icon: Users },
    { key: 'match', label: t('challenges.invite.modes.match'), Icon: Zap },
    { key: 'id', label: t('challenges.invite.modes.id'), Icon: Hash },
  ];

  const contactFilters: { key: ChallengeInviteContactFilter; label: string; count: number }[] = [
    { key: 'all', label: t('challenges.invite.filters.all'), count: contactCounts.all },
    { key: 'friends', label: t('challenges.invite.filters.friends'), count: contactCounts.friends },
    { key: 'followers', label: t('challenges.invite.filters.followers'), count: contactCounts.followers },
    { key: 'following', label: t('challenges.invite.filters.following'), count: contactCounts.following },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.gameInfo}>
              <View style={[styles.gameIcon, { backgroundColor: `${game.colors[1]}20` }]}>
                <GameIcon size={22} color={game.colors[1]} strokeWidth={2} />
              </View>
              <View>
                <Text variant="h4" weight="bold">{gameDisplayName}</Text>
                <Text variant="caption" color={colors.text.secondary}>
                  {t('challenges.invite.chooseMethod')}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={22} color={colors.text.primary} />
            </Pressable>
          </View>

          <View style={styles.betRow}>
            {betOptions.map((b) => (
              <Pressable
                key={b}
                onPress={() => onBetChange(b)}
                style={[styles.betChip, bet === b && styles.betChipActive]}
              >
                <Coins size={12} color={bet === b ? colors.white : '#F59E0B'} strokeWidth={2.5} />
                <Text variant="caption" weight="bold" color={bet === b ? colors.white : '#F59E0B'}>
                  {b.toLocaleString()}
                </Text>
              </Pressable>
            ))}
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
                  <ModeIcon size={14} color={active ? '#fff' : '#E11414'} />
                  <Text variant="caption" weight="bold" color={active ? '#fff' : '#E11414'}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {mode === 'friends' && (
            <>
              <View style={styles.contactFilterRow}>
                {contactFilters.map((f) => {
                  const active = contactFilter === f.key;
                  return (
                    <Pressable
                      key={f.key}
                      onPress={() => setContactFilter(f.key)}
                      style={[styles.contactFilterChip, active && styles.contactFilterChipActive]}
                    >
                      <Text
                        variant="caption"
                        weight="bold"
                        color={active ? '#fff' : '#6B7280'}
                      >
                        {f.label} ({f.count})
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {contactCounts.online > 0 && (
                <Text variant="caption" color="#10B981" style={styles.onlineHint}>
                  {t('challenges.invite.onlineNow', { count: contactCounts.online })}
                </Text>
              )}
              {loadingContacts ? (
                <ActivityIndicator size="small" color="#E11414" style={{ margin: 24 }} />
              ) : contacts.length === 0 ? (
                <Text variant="caption" align="center" color={colors.text.secondary} style={{ margin: 24 }}>
                  {t('challenges.invite.noContacts')}
                </Text>
              ) : (
                <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                  {contacts.map((person) => (
                    <Pressable
                      key={person.uid}
                      onPress={() => sendToUser(person.uid, person.name, person.avatar)}
                      disabled={sending}
                      style={styles.friendRow}
                    >
                      <View style={styles.avatarWrap}>
                        {person.avatar ? (
                          <Image source={{ uri: person.avatar }} style={styles.avatar} contentFit="cover" />
                        ) : (
                          <View style={[styles.avatar, styles.avatarFallback]}>
                            <Text variant="body" color={colors.white}>{person.name?.[0] ?? '؟'}</Text>
                          </View>
                        )}
                        {person.isOnline && <View style={styles.onlineDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="body" weight="semibold">{person.name}</Text>
                        <Text variant="caption" color={colors.text.secondary}>
                          {t('challenges.invite.levelOnline', {
                            level: person.level,
                            relation: t(RELATION_KEYS[person.relation] ?? 'challenges.invite.relations.user'),
                            status: person.isOnline
                              ? t('challenges.invite.online')
                              : t('challenges.invite.offline'),
                          })}
                        </Text>
                      </View>
                      <Send size={18} color="#E11414" />
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </>
          )}

          {mode === 'match' && (
            <View style={styles.matchBox}>
              <LinearGradient
                colors={['#E11414', '#C40E1E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Zap size={36} color="rgba(255,255,255,0.9)" fill="#FCD34D" />
              <Text variant="h4" weight="bold" color="#fff" align="center">
                {t('challenges.invite.quickMatch')}
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.9)" align="center">
                {t('challenges.invite.matchDesc')}
              </Text>
              {matching ? (
                <View style={styles.matchActions}>
                  <ActivityIndicator color="#fff" />
                  <Text variant="caption" color="#fff" weight="bold">
                    {t('challenges.invite.searching')}
                  </Text>
                  <Pressable onPress={handleCancelMatch} style={styles.cancelMatchBtn}>
                    <Text variant="caption" weight="bold" color="#fff">{t('challenges.invite.cancel')}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={handleMatch} style={styles.matchBtn}>
                  <Text variant="body" weight="bold" color="#E11414">{t('challenges.invite.startMatch')}</Text>
                </Pressable>
              )}
            </View>
          )}

          {mode === 'id' && (
            <View style={styles.idBox}>
              <Text variant="label" color={colors.text.secondary}>
                {t('challenges.invite.idLabel')}
              </Text>
              <View style={styles.idInputRow}>
                <Search size={18} color="#9CA3AF" />
                <TextInput
                  value={idInput}
                  onChangeText={setIdInput}
                  placeholder={t('challenges.invite.idPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  style={styles.idInput}
                  autoCapitalize="none"
                  keyboardType="default"
                />
              </View>
              <Pressable
                onPress={handleSendById}
                disabled={searching || !idInput.trim()}
                style={[styles.idSendBtn, (!idInput.trim() || searching) && { opacity: 0.5 }]}
              >
                {searching ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Send size={16} color="#fff" />
                    <Text variant="body" weight="bold" color="#fff">{t('challenges.invite.sendInvite')}</Text>
                  </>
                )}
              </Pressable>
              <Text variant="caption" color={colors.text.secondary} align="center">
                {t('challenges.invite.idNote')}
              </Text>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  gameInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  gameIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  betRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  betChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  betChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: '#FEE2E2',
  },
  modeChipActive: {
    backgroundColor: '#E11414',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  contactFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  contactFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: '#F3F4F6',
  },
  contactFilterChipActive: {
    backgroundColor: '#E11414',
  },
  onlineHint: {
    marginBottom: 4,
    textAlign: 'right',
  },
  avatarWrap: {
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    backgroundColor: '#E11414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchBox: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: spacing.lg,
    alignItems: 'center',
    gap: 8,
    minHeight: 200,
    justifyContent: 'center',
  },
  matchBtn: {
    marginTop: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  matchActions: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  cancelMatchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  idBox: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  idInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  idInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    textAlign: 'right',
  },
  idSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E11414',
    paddingVertical: 14,
    borderRadius: radius.lg,
    marginTop: 4,
  },
});
