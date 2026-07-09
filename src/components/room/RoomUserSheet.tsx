/**
 * RoomUserSheet — بطاقة تفاصيل المستخدم الجالس على مقعد في الروم (تصميم LinkUp الخاص).
 *
 * تعرض: صورة بارزة، الاسم، العمر+الجنس، المستوى، الدولة، المعرّف العام،
 * شارات (متابِعون/متابَعون/زوّار)، شارة VIP، النبذة.
 * أزرار: ملف شخصي · @ منشن في شات الروم · متابعة · إرسال هدية.
 * العملات والماسات والكازينو تظهر لحسابك فقط — لا تُعرض للآخرين.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AtSign,
  Gift,
  User as UserIcon,
  X,
  Crown,
  UserPlus,
  UserCheck,
  Users,
  Heart,
  Eye,
  Flag,
  UserX,
  Mic,
  Building2,
  MoreHorizontal,
  MicOff,
  MessageCircle,
  MessageCircleOff,
} from 'lucide-react-native';

import { Text, RealCountryFlag } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';
import { getUser, type UserDoc } from '@/services/firebase/users';
import { isFollowing as checkFollowing, toggleFollow } from '@/services/firebase/follow';
import { resolveDisplayName } from '@/utils/displayName';
import { resolveMentionToken } from '@/utils/mentions';
import { getTitlesConfigOnce, getTitleDef, type TitlesConfig } from '@/services/firebase/titleSystem';
import { useTranslation } from 'react-i18next';
import { RoomMemberActionMenu } from '@/components/room/RoomMemberActionMenu';
import {
  hasVipPrivilege,
  resolveVipPrivilegeAsset,
  type VipSystemConfig,
} from '@/services/firebase/vipSystem';

export interface RoomSeatUser {
  uid: string;
  displayName?: string;
  avatar?: string;
  level?: number;
  isVIP?: boolean;
  vipLevel?: number;
  onSeat?: boolean;
  /** رقم المقعد عند الفتح من المايك — لدعم مغادرة المايك */
  seatIndex?: number;
  agencyMemberDocId?: string;
}

interface Props {
  visible: boolean;
  user: RoomSeatUser | null;
  vipSystem: VipSystemConfig;
  /** هل البطاقة لحسابي أنا؟ */
  isSelf?: boolean;
  /** مغادرة المايك والبقاء متفرجاً في الروم */
  onLeaveMic?: () => void;
  /** صلاحيات إدارة الغرفة (مضيف/وكيل الوكالة) */
  canAdmin?: boolean;
  onClose: () => void;
  onMention: (token: string) => void;
  onGift: (uid: string) => void;
  onViewProfile: (uid: string) => void;
  onPrivateChat?: (target: { uid: string; name?: string; avatar?: string }) => void;
  onKick?: (uid: string) => void;
  onReport?: (uid: string) => void;
  onAddToMic?: (uid: string) => void;
  onRemoveFromMic?: (uid: string) => void;
  onInviteAgency?: (uid: string, displayName?: string) => void;
  onCancelMembership?: (memberDocId: string, uid: string) => void;
  /** عرض زر دعوة للوكالة (مدير الوكالة — حتى من الشات) */
  showAgencyInvite?: boolean;
  /** المستخدم على مقعد مايك حالياً */
  onSeat?: boolean;
  /** المستخدم مكتوم المايك (على مقعد) */
  seatIsMuted?: boolean;
  /** الكتابة والتعليقات موقوفة في شات الغرفة */
  isChatMuted?: boolean;
  onToggleMicMute?: (uid: string) => void;
  onToggleChatMute?: (uid: string) => void;
}

function ageFromBirthYear(y?: number): number | null {
  if (!y || y < 1900) return null;
  const age = new Date().getFullYear() - y;
  return age > 0 && age < 120 ? age : null;
}

export function RoomUserSheet({
  visible,
  user,
  vipSystem,
  isSelf,
  canAdmin,
  onClose,
  onMention,
  onGift,
  onViewProfile,
  onPrivateChat,
  onKick,
  onReport,
  onAddToMic,
  onRemoveFromMic,
  onInviteAgency,
  onCancelMembership,
  showAgencyInvite,
  onSeat: onSeatProp,
  onLeaveMic,
  seatIsMuted,
  isChatMuted,
  onToggleMicMute,
  onToggleChatMute,
}: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [full, setFull] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [titlesConfig, setTitlesConfig] = useState<TitlesConfig | null>(null);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    if (!visible || !user?.uid) return;
    let alive = true;
    setFull(null);
    setLoading(true);
    setFollowing(false);
    getUser(user.uid)
      .then((u) => alive && setFull(u))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    getTitlesConfigOnce()
      .then((cfg) => alive && setTitlesConfig(cfg))
      .catch(() => {});
    if (!isSelf) {
      checkFollowing(user.uid)
        .then((f) => alive && setFollowing(f))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [visible, user?.uid, isSelf]);

  const sheetOpen = visible && !!user;
  const name = user
    ? resolveDisplayName({ displayName: full?.displayName ?? user.displayName })
    : '';
  const avatar = user ? full?.avatar ?? user.avatar : undefined;
  const level = user ? full?.level ?? user.level ?? 1 : 1;
  const vipLevel = user ? full?.vipLevel ?? user.vipLevel ?? 0 : 0;
  const targetUser = full || (user ? { isVIP: user.isVIP, vipLevel, vipExpiresAt: null } : null);
  const showVip = targetUser ? hasVipPrivilege(targetUser, 'vipBadge', vipSystem.privileges) : false;
  const vipBadgePriv = resolveVipPrivilegeAsset(vipLevel, 'vipBadge', vipSystem);
  const vipBadgeUrl = vipBadgePriv?.imageUrl;

  const country = full?.country;
  const publicId = full?.publicAccountId;
  const bio = full?.bio;
  const gender = full?.gender;
  const age = ageFromBirthYear(full?.birthYear);
  const showPrivateBalances = isSelf === true;
  const coins = showPrivateBalances ? (full?.coins ?? 0) : 0;
  const pearls = showPrivateBalances ? (full?.pearls ?? 0) : 0;
  const onSeat = user ? onSeatProp ?? user.onSeat ?? false : false;

  const equippedTitles = (full?.userTitles?.equipped ?? [])
    .filter((id): id is string => !!id)
    .map((id) => (titlesConfig ? getTitleDef(titlesConfig, id) : undefined))
    .filter(Boolean);

  const handleFollow = async () => {
    if (followBusy || !user?.uid) return;
    setFollowBusy(true);
    const prev = following;
    setFollowing(!prev); // تفاؤلي
    try {
      const now = await toggleFollow(user.uid);
      setFollowing(now);
    } catch {
      setFollowing(prev);
    } finally {
      setFollowBusy(false);
    }
  };

  if (!user) {
    return <Modal visible={false} animationType="slide" transparent onRequestClose={onClose} />;
  }

  return (
    <Modal visible={sheetOpen} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['rgba(77, 18, 18, 0.99)', 'rgba(48, 10, 10, 0.99)']}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.avatarWrap}>
            <View style={[styles.avatarRing, showVip && styles.avatarRingVip]}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" recyclingKey={avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <UserIcon size={40} color="rgba(255,255,255,0.6)" />
                </View>
              )}
            </View>
          </View>

          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <X size={18} color="#fff" />
          </Pressable>

          {!isSelf && (canAdmin || onReport) ? (
            <Pressable onPress={() => setShowActions(true)} hitSlop={10} style={styles.moreBtn}>
              <MoreHorizontal size={18} color="#fff" />
            </Pressable>
          ) : null}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm },
            ]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.identityBlock}>
              <View style={styles.nameBlock}>
                <View style={styles.nameTitleRow}>
                  {showVip ? <Crown size={18} color={lu.colors.gold} fill={lu.colors.gold} /> : null}
                  <Text variant="h4" weight="bold" color="#fff" numberOfLines={2} align="center" style={styles.nameText}>
                    {name}
                  </Text>
                </View>
                {age != null ? (
                  <View
                    style={[
                      styles.genderChip,
                      { backgroundColor: gender === 'female' ? lu.colors.pink : '#ED4444' },
                    ]}
                  >
                    <Text variant="caption" weight="bold" color="#fff" style={{ fontSize: 11 }}>
                      {age} {gender === 'female' ? '♀' : '♂'}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.metaRow}>
                <View style={styles.levelBadge}>
                  <Text variant="caption" weight="bold" color="#fff" style={{ fontSize: 11 }}>
                    LV{level}
                  </Text>
                </View>
                {publicId ? (
                  <View style={styles.metaChip}>
                    <Text variant="caption" color="rgba(255,255,255,0.75)" style={{ fontSize: 11 }}>
                      ID: {publicId}
                    </Text>
                  </View>
                ) : null}
                {country ? (
                  <View style={styles.metaChip}>
                    <RealCountryFlag countryCode={country} size={14} />
                  </View>
                ) : null}
                {showVip ? (
                  vipBadgeUrl ? (
                    <Image source={{ uri: vipBadgeUrl }} style={styles.vipBadgeImg} contentFit="contain" />
                  ) : (
                    <LinearGradient
                      colors={['#F59E0B', '#D97706']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.vipBadge}
                    >
                      <Text variant="caption" weight="bold" color="#fff" style={{ fontSize: 11 }}>
                        {vipLevel ? `SVIP ${vipLevel}` : 'VIP'}
                      </Text>
                    </LinearGradient>
                  )
                ) : null}
                {showPrivateBalances && coins > 0 ? (
                  <View style={styles.metaChip}>
                    <Text variant="caption" color="rgba(255,255,255,0.75)" style={{ fontSize: 11 }}>
                      🪙 {coins.toLocaleString()}
                    </Text>
                  </View>
                ) : null}
                {showPrivateBalances && pearls > 0 ? (
                  <View style={styles.metaChip}>
                    <Text variant="caption" color="rgba(255,255,255,0.75)" style={{ fontSize: 11 }}>
                      💎 {pearls.toLocaleString()}
                    </Text>
                  </View>
                ) : null}
              </View>

              {equippedTitles.length > 0 ? (
                <View style={styles.titlesRow}>
                  {equippedTitles.map((title) => (
                    <View key={title!.id} style={styles.titleChip}>
                      <Text variant="caption" weight="bold" color="#fff" style={{ fontSize: 10 }}>
                        {i18n.language?.startsWith('ar') ? title!.nameAr : title!.nameEn}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.statsRow}>
                <StatChip icon={<Users size={13} color="#FCA5A5" />} value={full?.followers ?? 0} label="متابِع" />
                <StatChip icon={<Heart size={13} color={lu.colors.pink} />} value={full?.following ?? 0} label="يتابع" />
                <StatChip icon={<Eye size={13} color="#F06A6A" />} value={full?.visitors ?? 0} label="زائر" />
              </View>

              {loading ? (
                <ActivityIndicator color="rgba(255,255,255,0.6)" style={{ marginTop: 10 }} />
              ) : bio ? (
                <Text
                  variant="caption"
                  color="rgba(255,255,255,0.7)"
                  align="center"
                  numberOfLines={3}
                  style={styles.bio}
                >
                  {bio}
                </Text>
              ) : null}
            </View>

            {!isSelf && (canAdmin || showAgencyInvite) ? (
              <View style={styles.adminSection}>
                <View style={styles.adminActions}>
                  {canAdmin && onKick ? (
                    <ActionButton
                      icon={<UserX size={20} color="#fff" strokeWidth={2.4} />}
                      label={t('room.kickUser')}
                      danger
                      onPress={() => {
                        onClose();
                        onKick(user.uid);
                      }}
                    />
                  ) : null}
                  {canAdmin && onSeat && onRemoveFromMic ? (
                    <ActionButton
                      icon={<Mic size={20} color="#fff" strokeWidth={2.4} />}
                      label={t('room.removeFromMic')}
                      danger
                      onPress={() => onRemoveFromMic(user.uid)}
                    />
                  ) : null}
                  {canAdmin && onSeat && onToggleMicMute ? (
                    <ActionButton
                      icon={
                        seatIsMuted
                          ? <Mic size={20} color="#fff" strokeWidth={2.4} />
                          : <MicOff size={20} color="#fff" strokeWidth={2.4} />
                      }
                      label={seatIsMuted ? t('room.unlockMic') : t('room.lockMic')}
                      onPress={() => onToggleMicMute(user.uid)}
                    />
                  ) : null}
                  {canAdmin && !onSeat && onAddToMic ? (
                    <ActionButton
                      icon={<Mic size={20} color="#fff" strokeWidth={2.4} />}
                      label={t('room.addToMic')}
                      onPress={() => onAddToMic(user.uid)}
                    />
                  ) : null}
                  {showAgencyInvite && onInviteAgency ? (
                    <ActionButton
                      icon={<Building2 size={20} color="#fff" strokeWidth={2.4} />}
                      label={t('room.inviteAgency')}
                      onPress={() => onInviteAgency(user.uid, name)}
                    />
                  ) : null}
                  {canAdmin && onToggleChatMute ? (
                    <ActionButton
                      icon={
                        isChatMuted
                          ? <MessageCircle size={20} color="#fff" strokeWidth={2.4} />
                          : <MessageCircleOff size={20} color="#fff" strokeWidth={2.4} />
                      }
                      label={isChatMuted ? t('room.unmuteChat') : t('room.muteChat')}
                      danger={!isChatMuted}
                      onPress={() => onToggleChatMute(user.uid)}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={styles.actionsSection}>
              <View style={styles.actions}>
                {isSelf && onLeaveMic ? (
                  <ActionButton
                    icon={<MicOff size={20} color="#fff" strokeWidth={2.4} />}
                    label={t('room.leaveSeat')}
                    highlight
                    onPress={() => {
                      onClose();
                      onLeaveMic();
                    }}
                  />
                ) : null}
                <ActionButton
                  icon={<UserIcon size={20} color="#fff" strokeWidth={2.4} />}
                  label="الملف"
                  onPress={() => onViewProfile(user.uid)}
                />
                {!isSelf && (
                  <>
                    <ActionButton
                      icon={<Gift size={20} color="#fff" strokeWidth={2.4} />}
                      label="هدية"
                      highlight
                      onPress={() => onGift(user.uid)}
                    />
                    <ActionButton
                      icon={
                        following ? (
                          <UserCheck size={20} color="#fff" strokeWidth={2.4} />
                        ) : (
                          <UserPlus size={20} color="#fff" strokeWidth={2.4} />
                        )
                      }
                      label={following ? 'متابَع' : 'متابعة'}
                      onPress={handleFollow}
                    />
                    {onPrivateChat ? (
                      <ActionButton
                        icon={<MessageCircle size={20} color="#fff" strokeWidth={2.4} />}
                        label={t('room.privateChat')}
                        highlight
                        onPress={() => {
                          onClose();
                          onPrivateChat({
                            uid: user.uid,
                            name,
                            avatar,
                          });
                        }}
                      />
                    ) : null}
                    <ActionButton
                      icon={<AtSign size={20} color="#fff" strokeWidth={2.4} />}
                      label={t('room.mention')}
                      onPress={() => onMention(resolveMentionToken(name, publicId))}
                    />
                    {onReport ? (
                      <ActionButton
                        icon={<Flag size={20} color="#fff" strokeWidth={2.4} />}
                        label="إبلاغ"
                        onPress={() => onReport(user.uid)}
                      />
                    ) : null}
                  </>
                )}
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>

      <RoomMemberActionMenu
        visible={showActions}
        onClose={() => setShowActions(false)}
        showKick={canAdmin && !!onKick}
        showCancel={canAdmin && !!onCancelMembership && !!user.agencyMemberDocId}
        onReport={() => onReport?.(user.uid)}
        onKick={() => {
          onClose();
          onKick?.(user.uid);
        }}
        onCancel={
          user.agencyMemberDocId && onCancelMembership
            ? () => onCancelMembership(user.agencyMemberDocId!, user.uid)
            : undefined
        }
      />
    </Modal>
  );
}

function StatChip({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <View style={styles.statChip}>
      <View style={styles.statTop}>
        {icon}
        <Text variant="caption" weight="bold" color="#fff" style={{ fontSize: 13 }}>
          {value.toLocaleString()}
        </Text>
      </View>
      <Text variant="caption" color="rgba(255,255,255,0.55)" style={{ fontSize: 10 }}>
        {label}
      </Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  highlight,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.action}>
      {highlight ? (
        <LinearGradient
          colors={[lu.colors.pink, lu.colors.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.actionIcon}
        >
          {icon}
        </LinearGradient>
      ) : danger ? (
        <View style={[styles.actionIcon, styles.actionIconDanger]}>{icon}</View>
      ) : (
        <View style={[styles.actionIcon, styles.actionIconPlain]}>{icon}</View>
      )}
      <Text variant="caption" color="rgba(255,255,255,0.85)" numberOfLines={2} align="center" style={styles.actionLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const AVATAR = 92;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: AVATAR / 2 + spacing.lg,
    marginTop: AVATAR / 2,
    maxHeight: '88%',
    overflow: 'visible',
  },
  scroll: {
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  avatarWrap: {
    position: 'absolute',
    top: -AVATAR / 2,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -AVATAR / 2,
    zIndex: 3,
  },
  avatarRing: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  avatarRingVip: {
    backgroundColor: lu.colors.gold,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR / 2,
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    end: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  moreBtn: {
    position: 'absolute',
    top: 12,
    start: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  identityBlock: {
    width: '100%',
    alignItems: 'center',
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  nameBlock: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.xl,
  },
  nameTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  nameText: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 24,
  },
  genderChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    rowGap: 8,
    width: '100%',
    paddingHorizontal: spacing.xs,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  levelBadge: {
    backgroundColor: lu.colors.purple,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  vipBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  vipBadgeImg: {
    height: 24,
    width: 58,
  },
  titlesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    paddingHorizontal: spacing.sm,
  },
  titleChip: {
    backgroundColor: 'rgba(252, 165, 165, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.5)',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  statChip: {
    alignItems: 'center',
    gap: 2,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bio: {
    width: '100%',
    paddingHorizontal: spacing.md,
    lineHeight: 18,
  },
  adminSection: {
    width: '100%',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  adminActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    rowGap: spacing.md,
    width: '100%',
  },
  actionsSection: {
    width: '100%',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    rowGap: spacing.lg,
    width: '100%',
  },
  action: {
    alignItems: 'center',
    gap: 6,
    width: 72,
    minHeight: 78,
  },
  actionLabel: {
    fontSize: 10,
    lineHeight: 13,
    width: '100%',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconPlain: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  actionIconDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
  },
});
