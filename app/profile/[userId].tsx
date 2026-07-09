/**
 * LinkUp App — شاشة الملف الشخصي لمستخدم آخر
 * تستخدم بيانات Firestore الحقيقية
 */

import { useTranslation } from 'react-i18next';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  I18nManager,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  MoreVertical,
  Crown,
  MessageCircle,
  Gift,
  Phone,
  Video,
  UserPlus,
  UserCheck,
  Heart,
  Users,
  Award,
  Coins,
  Sparkles,
  Shield,
  Flag,
  Ban,
  Copy,
  Cake,
  Calendar,
  Globe,
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
  Pencil,
} from 'lucide-react-native';
import i18n from '@/localization/i18n';

import { Text, BackButton, RealCountryFlag } from '@/components/ui';
import { getUser, UserDoc } from '@/services/firebase/users';
import { useAuth } from '@/hooks/useAuth';
import {
  canMakeRelationshipLevelCall,
  canUserMakeCalls,
  getRequiredBondLevelForChatCall,
} from '@/utils/genderAccess';
import { getRelationshipWith } from '@/services/firebase/social';
import { isFollowing, toggleFollow, subscribeToSocialCounts } from '@/services/firebase/follow';
import { recordProfileVisit } from '@/services/firebase/profileVisitors';
import { ringUser } from '@/services/incomingCalls';
import { startCall } from '@/services/firebase/rtc';
import { subscribeToUserPresence, isTrackableAgencyPresence, type UserPresence } from '@/services/roomFeatures';
import { colors, radius, spacing, shadows } from '@/theme';
import { lu } from '@/theme/lu-brand';
import { blockUser } from '@/services/firebase/blocks';
import { resolveDisplayName } from '@/utils/displayName';
import { getCountryByCode } from '@/data/countries';
import { usePresenceForUids } from '@/hooks/usePresence';
import { isUserOnline, resolveLastSeenMs } from '@/utils/presence';
import { getDisplayAccountId } from '@/services/userIdentifier';
import { copyToClipboard } from '@/utils/copyToClipboard';
import { useAlert } from '@/components/ui';
import { getUserReportPath } from '@/services/firebase/reports';
import { useConfig } from '@/contexts/ConfigContext';
import { TitleBanner } from '@/components/titles/TitleBanner';
import { ProfileAlbumOvals } from '@/components/profile/ProfileAlbumOvals';
import { ProfileImagePreview } from '@/components/profile/ProfileImagePreview';
import { VerifiedHostBadge } from '@/components/profile/VerifiedHostBadge';
import { VoiceMessagePlayer } from '@/components/ui';
import { readUserTitles, getTitleDef } from '@/services/firebase/titleSystem';
import {
  getUserPrivacy,
  shouldHideGiftWall,
  shouldHideWealthLevel,
  shouldHideSvipIdentity,
} from '@/utils/privacyDisplay';
import { hasVipPrivilege, resolveVipPrivilegeAsset } from '@/services/firebase/vipSystem';
import { resolveAgencyPrinceBadgeForUser } from '@/services/firebase/agencyPrinceBadge';
import { ProfileImageBadge } from '@/components/profile/ProfileBadgesRow';
import { resolveAristocracyBadgeUrl } from '@/services/firebase/aristocracySystem';
import { isOnlineHidden } from '@/services/firebase/svipPerks';
import { ChatGiftPickerModal } from '@/components/chat/ChatGiftPickerModal';
import { buyAndSendGift, type Gift as GiftType } from '@/services/firebase/shop';
import { getPostsByUser, type Post } from '@/services/firebase/posts';
import { useEquippedFrameUrl } from '@/hooks/useEquippedFrameUrl';
import { FramedAvatar, getFramedAvatarContainerSize } from '@/components/ui/FramedAvatar';
import { AgencyRoomTrackingAvatar } from '@/components/chat/AgencyRoomTrackingAvatar';
import { GiftVisual } from '@/components/ui/GiftVisual';
import { getGiftWall, countGiftWallItems } from '@/services/firebase/giftWall';
import { getJoinDays } from '@/utils/joinDays';
import { resolveWealthLevel, statsFromFirestoreDoc } from '@/utils/userBalance';
import { getRoomByHostUid, type Room } from '@/services/firebase/rooms';
import { Radio } from 'lucide-react-native';
import { RoomEntryVideoOverlay } from '@/components/room/RoomEntryVideoOverlay';
import { useProfileEntryVideo } from '@/hooks/useProfileEntryVideo';

function formatCompact(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) {
    return `${(v / 1_000_000).toFixed(1)} ${i18n.t('common.millionShort')}`;
  }
  if (v >= 1_000) {
    return `${(v / 1_000).toFixed(1)} ${i18n.t('common.thousandShort')}`;
  }
  return v.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-US');
}

export default function UserProfileScreen() {
  const { t, i18n } = useTranslation();
  const { showToast } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user: myUser, refreshUser } = useAuth();
  const { titles: titlesConfig, gifts: catalogGifts, giftCategories, vipSystem, aristocracy, agencyPrince } = useConfig();
  const { presenceMap, now: presenceNow } = usePresenceForUids(
    userId ? [userId] : [],
  );

  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [presence, setPresence] = useState<UserPresence | null>(null);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [sendingGift, setSendingGift] = useState(false);
  const { width: W } = useWindowDimensions();
  const [tab, setTab] = useState<'about' | 'posts' | 'honor'>('about');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [giftWallCount, setGiftWallCount] = useState(0);
  const [giftWallPreview, setGiftWallPreview] = useState<
    {
      giftId: string;
      imageUrl?: string;
      animationUrl?: string;
      iconName?: string;
      iconColor?: string;
      count: number;
    }[]
  >([]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [hostRoom, setHostRoom] = useState<Room | null>(null);
  const equippedFrameUrl = useEquippedFrameUrl(userId);

  const profileDisplayName = resolveDisplayName(
    { displayName: profile?.displayName, email: profile?.email },
    t('rooms.userFallback'),
  );
  const { entryVideo, clearEntryVideo } = useProfileEntryVideo({
    userId,
    displayName: profileDisplayName,
    profileReady: !loading && Boolean(profile),
    vipSystem,
    aristocracy,
  });

  useEffect(() => {
    const load = async () => {
      if (!userId) return;
      try {
        const data = await getUser(userId);
        setProfile(data);
        // جلب حالة المتابعة الفعلية من Firestore
        const followState = await isFollowing(userId);
        setFollowing(followState);
      } catch (e) {
        console.error('Load profile:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToSocialCounts(userId, (counts) => {
      setProfile((p) => (p ? { ...p, ...counts } : p));
    });
  }, [userId]);

  // اشترك في live presence (هل المستخدم في روم الآن؟)
  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToUserPresence(userId, (p) => setPresence(p));
    return unsub;
  }, [userId]);

  // جلب روم المستخدم إن وُجد
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void getRoomByHostUid(userId).then((r) => {
      if (!cancelled) setHostRoom(r);
    });
    return () => { cancelled = true; };
  }, [userId]);

  // تسجيل زيارة الملف (مرة عند فتح الشاشة)
  const visitRecordedRef = React.useRef(false);
  useEffect(() => {
    if (!userId || !myUser?.uid || userId === myUser.uid) return;
    if (visitRecordedRef.current) return;
    visitRecordedRef.current = true;
    void recordProfileVisit(userId);
  }, [userId, myUser?.uid]);

  // منشورات المستخدم عند فتح تبويب المنشورات
  useEffect(() => {
    if (!userId || tab !== 'posts') return;
    setLoadingPosts(true);
    getPostsByUser(userId, 30)
      .then(setPosts)
      .catch(() => {})
      .finally(() => setLoadingPosts(false));
  }, [userId, tab]);

  // جدار الهدايا
  useEffect(() => {
    if (!userId || !myUser?.uid) return;
    const privacy = getUserPrivacy(profile as unknown as Record<string, unknown>);
    if (shouldHideGiftWall(userId, myUser.uid, privacy)) {
      setGiftWallCount(0);
      setGiftWallPreview([]);
      return;
    }
    getGiftWall(userId, myUser.uid, catalogGifts)
      .then((items) => {
        setGiftWallCount(countGiftWallItems(items));
        setGiftWallPreview(
          items.slice(0, 4).map((i) => ({
            giftId: i.giftId,
            imageUrl: i.imageUrl,
            animationUrl: i.animationUrl,
            iconName: i.iconName,
            iconColor: i.iconColor,
            count: i.count,
          })),
        );
      })
      .catch(() => {});
  }, [userId, myUser?.uid, catalogGifts, profile]);

  // الاتصال بالشخص: نرنّ عنده أولاً ثم ندخل القناة
  const handleCall = async (type: 'voice' | 'video') => {
    if (!userId || !myUser) return;
    if (!canUserMakeCalls(myUser)) {
      Alert.alert(
        t('common.error'),
        t('genderAccess.callsNeedVerification'),
        myUser.profile?.gender === 'female'
          ? [{ text: t('common.ok'), onPress: () => router.push('/wallet/kyc' as any) }]
          : undefined,
      );
      return;
    }
    if (userId === myUser.uid) {
      Alert.alert(t('common.error'), t('profile.cannotCallSelf'));
      return;
    }
    const rel = await getRelationshipWith(userId);
    const bondLevel = rel?.level ?? 1;
    if (!canMakeRelationshipLevelCall(myUser, type, bondLevel)) {
      Alert.alert(
        t('common.error'),
        t('chat.callBondLevelRequired', {
          level: getRequiredBondLevelForChatCall(type),
          type: type === 'video' ? t('call.video') : t('chat.voice'),
        }),
      );
      return;
    }
    try {
      const channelName = `call_${myUser.uid}_${userId}_${Date.now()}`;
      const ringPromise = ringUser(userId, type, channelName);
      const sessionPromise = startCall(userId, type, channelName, 'chat');
      const [, session] = await Promise.all([ringPromise, sessionPromise]);
      // ادخل قناة المكالمة من جهتي وانتظره (مع معرّف الجلسة لتفعيل الفوترة)
      const ch = encodeURIComponent(channelName);
      const sp = `?channel=${ch}&session=${encodeURIComponent(session.sessionId)}`;
      if (type === 'video') {
        router.push(`/call/video/${userId}${sp}` as any);
      } else {
        router.push(`/call/${userId}${sp}` as any);
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message ?? t('profile.callFailed'));
    }
  };
  // متابعة/إلغاء متابعة حقيقية (تكتب في Firestore)
  const handleToggleFollow = async () => {
    if (!userId || followLoading) return;
    if (!myUser) {
      Alert.alert(t('profile.loginRequired'), t('profile.loginRequiredDesc'));
      return;
    }
    setFollowLoading(true);
    // تحديث متفائل (فوري للمستخدم) ثم تأكيد من السيرفر
    const optimistic = !following;
    setFollowing(optimistic);
    setProfile((p) => p ? {
      ...p,
      followers: Math.max((p.followers ?? 0) + (optimistic ? 1 : -1), 0),
    } as UserDoc : p);
    try {
      const newState = await toggleFollow(userId);
      setFollowing(newState);
    } catch (e: any) {
      // فشل → ارجع للحالة السابقة
      setFollowing(!optimistic);
      setProfile((p) => p ? {
        ...p,
        followers: Math.max((p.followers ?? 0) + (optimistic ? -1 : 1), 0),
      } as UserDoc : p);
      Alert.alert(t('common.error'), e.message ?? t('profile.followFailed'));
    } finally {
      setFollowLoading(false);
    }
  };

  const accountId = useMemo(
    () =>
      profile
        ? getDisplayAccountId(profile.publicAccountId, userId ?? profile.uid)
        : getDisplayAccountId(undefined, userId ?? ''),
    [profile, userId],
  );

  const copyAccountId = useCallback(async () => {
    if (!accountId || accountId.includes('-')) return;
    const ok = await copyToClipboard(accountId);
    if (ok) {
      showToast(t('common.copied'));
    } else {
      showToast(t('profile.idCopyFailed'));
    }
  }, [accountId, showToast, t]);

  const equippedTitles = useMemo(() => {
    const state = readUserTitles({ userTitles: profile?.userTitles });
    const isAr = i18n.language?.startsWith('ar');
    return state.equipped
      .filter((id): id is string => Boolean(id))
      .map((id) => getTitleDef(titlesConfig, id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((t) => ({ def: t, label: isAr ? t.nameAr : t.nameEn }));
  }, [profile?.userTitles, titlesConfig, i18n.language]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text variant="body" color={colors.text.secondary}>
          {t('profile.notFound')}
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text variant="body" color={colors.brand.primary}>
            {t('profile.back')}
          </Text>
        </Pressable>
      </View>
    );
  }

  const isSelf = Boolean(myUser?.uid && userId && myUser.uid === userId);
  const canMakeCalls = canUserMakeCalls(myUser);
  const lastSeenMs = profile
    ? resolveLastSeenMs(profile.lastSeen, userId ? presenceMap[userId] : undefined)
    : 0;
  const isOnline =
    isUserOnline(lastSeenMs, presenceNow) &&
    !isOnlineHidden(profile as unknown as Record<string, unknown>, vipSystem);
  const age = profile.birthYear
    ? new Date().getFullYear() - profile.birthYear
    : 0;
  const displayName = resolveDisplayName({
    displayName: profile.displayName,
    email: profile.email,
  });
  const countryName =
    getCountryByCode(profile.country)?.name ?? profile.country ?? '—';
  const level = resolveWealthLevel(profile as unknown as Record<string, unknown>);
  const xp = statsFromFirestoreDoc(profile as unknown as Record<string, unknown>).xp;
  const vipLevel = profile.vipLevel ?? 0;
  const vipLabel = `SVIP${vipLevel}`;
  const agencyRole = (profile as unknown as { agency?: { role?: string } }).agency?.role;
  const profilePrivacy = getUserPrivacy(profile as unknown as Record<string, unknown>);
  const showWealthLevel = !shouldHideWealthLevel(userId ?? '', myUser?.uid, profilePrivacy);
  const hideGiftWallFromViewer = shouldHideGiftWall(userId ?? '', myUser?.uid, profilePrivacy);

  const hideSvip = shouldHideSvipIdentity(userId ?? '', myUser?.uid, profilePrivacy);
  const hasBadgePriv = !hideSvip && hasVipPrivilege(profile, 'vipBadge', vipSystem.privileges);

  const vipBadgePriv = resolveVipPrivilegeAsset(vipLevel, 'vipBadge', vipSystem);
  const vipBadgeUrl = vipBadgePriv?.imageUrl;

  const princeBadgeUrl = resolveAgencyPrinceBadgeForUser(
    userId,
    agencyPrince,
    (profile as unknown as Record<string, unknown>)?.agencyPrince,
  );

  const aristocracyBadgeUrl = resolveAristocracyBadgeUrl(
    profile as unknown as Record<string, unknown>,
    aristocracy,
  );

  let coverImageUrl = profile.avatar;
  const isVipCardActive = hasVipPrivilege(profile, 'profileCard', vipSystem.privileges);
  if (isVipCardActive) {
    const cardPriv = resolveVipPrivilegeAsset(vipLevel, 'profileCard', vipSystem);
    if (cardPriv?.imageUrl) {
      coverImageUrl = cardPriv.imageUrl;
    }
  }

  const isAr = i18n.language?.startsWith('ar');
  const rowDir = (isAr ? 'row-reverse' : 'row') as 'row' | 'row-reverse';
  const flipRow = { flexDirection: rowDir };
  const coverH = Math.round(W * 0.78);
  const birthStr = profile.birthYear ? `${profile.birthYear}` : '—';
  const joinDays = getJoinDays(profile.createdAt);
  const inVoiceRoom = isTrackableAgencyPresence(presence);
  const coverAvatarInnerSize = 46;
  const coverAvatarTrackSize = equippedFrameUrl
    ? getFramedAvatarContainerSize(coverAvatarInnerSize)
    : 72;

  const handleCoverAvatarPress = () => {
    if (inVoiceRoom && presence?.currentRoomId) {
      router.push(`/room/${presence.currentRoomId}` as any);
      return;
    }
    if (profile.avatar) setAvatarPreview(profile.avatar);
  };

  const handleSendGift = async (gift: GiftType, quantity: number) => {
    if (!userId || !myUser || sendingGift) return;
    const total = gift.price * quantity;
    if ((myUser.stats?.coins ?? 0) < total) {
      Alert.alert(t('chat.insufficientCoinsForGift'), t('gifts.insufficientCoins'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('wallet.recharge'), onPress: () => router.push('/wallet/recharge' as any) },
      ]);
      return;
    }
    setSendingGift(true);
    try {
      await buyAndSendGift(gift, userId, displayName, undefined, quantity);
      await refreshUser?.();
      setShowGiftPicker(false);
      Alert.alert(t('gifts.giftSent'), displayName);
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSendingGift(false);
    }
  };

  const handleMore = () => {
    if (!userId || !myUser?.uid) return;
    setOptionsVisible(true);
  };

  return (
    <View style={styles.fill}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {/* Cover */}
        <View style={[styles.coverWrap, { height: coverH }]}>
          {coverImageUrl ? (
            <Image source={{ uri: coverImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={coverImageUrl} transition={150} />
          ) : (
            <LinearGradient colors={lu.gradients.brand} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.28)', 'transparent', 'rgba(0,0,0,0.62)']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.topBar, { paddingTop: insets.top + 8, flexDirection: rowDir }]}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              {isAr
                ? <ChevronRight size={22} color="#fff" />
                : <ChevronLeft size={22} color="#fff" />}
            </Pressable>
            <Text weight="bold" style={styles.topName} numberOfLines={1}>{displayName}</Text>
            <Pressable onPress={handleMore} style={styles.iconBtn}>
              <MoreVertical size={20} color="#fff" />
            </Pressable>
          </View>

          <View style={[styles.coverFooter, { flexDirection: rowDir }]}>
            <Pressable
              onPress={handleCoverAvatarPress}
              accessibilityRole="button"
              accessibilityLabel={
                inVoiceRoom
                  ? t('profile.joinVoiceRoom', { room: presence?.roomName || t('room.defaultRoomName') })
                  : displayName
              }
            >
              <AgencyRoomTrackingAvatar size={coverAvatarTrackSize} active={inVoiceRoom}>
                {profile.avatar ? (
                  equippedFrameUrl ? (
                    <FramedAvatar
                      avatarUri={profile.avatar}
                      frameUri={equippedFrameUrl}
                      avatarSize={coverAvatarInnerSize}
                      fallbackLetter={displayName}
                    />
                  ) : (
                    <View style={styles.coverAvatarRing}>
                      <Image
                        source={{ uri: profile.avatar }}
                        style={styles.coverAvatarImg}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    </View>
                  )
                ) : (
                  <View style={styles.coverAvatarRing} />
                )}
              </AgencyRoomTrackingAvatar>
            </Pressable>

            <ProfileAlbumOvals photos={profile.photos} />

            {profile.voiceBio ? (
              <View style={styles.coverVoiceInline}>
                <VoiceMessagePlayer
                  voiceUrl={profile.voiceBio}
                  duration={profile.voiceBioDuration || 30}
                  variant="profile"
                  compact
                />
              </View>
            ) : null}

            <View style={[styles.statusPill, flipRow]}>
              {inVoiceRoom ? (
                <>
                  <View style={[styles.statusDot, { backgroundColor: '#F97316' }]} />
                  <Text style={styles.statusText} numberOfLines={1}>
                    {t('profile.inVoiceRoom', { room: presence?.roomName || t('room.defaultRoomName') })}
                  </Text>
                </>
              ) : (
                <>
                  <View style={[styles.statusDot, { backgroundColor: isOnline ? '#22C55E' : '#9CA3AF' }]} />
                  <Text style={styles.statusText}>{isOnline ? t('common.online') : t('common.offline')}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Identity */}
        <View style={styles.identity}>
          <View style={[styles.nameRow, flipRow]}>
            <Text weight="bold" style={styles.name} numberOfLines={1}>{displayName}</Text>
            <RealCountryFlag countryCode={profile.country ?? ''} size={20} />
            {age > 0 ? (
              <View style={[styles.agePill, profile.gender === 'male' ? styles.agePillMale : styles.agePillFemale]}>
                <Text style={[styles.ageText, profile.gender === 'male' ? styles.ageTextMale : styles.ageTextFemale]}>
                  {profile.gender === 'male' ? '♂' : '♀'} {age}
                </Text>
              </View>
            ) : null}
          </View>

          <Pressable style={[styles.idRow, flipRow]} onPress={copyAccountId}>
            <Text style={styles.idText}>ID:{accountId}</Text>
            <Copy size={13} color={lu.colors.muted} />
          </Pressable>

          {joinDays > 0 ? (
          <View style={[styles.joinPill, flipRow]}>
            <Calendar size={13} color={lu.colors.purple} strokeWidth={2.2} />
            <Text style={styles.joinPillText}>{t('profileEdit.joinedDays', { days: joinDays })}</Text>
          </View>
          ) : null}

          {(profile.isVerified || agencyRole || hasBadgePriv || equippedTitles.length > 0 || (showWealthLevel && level > 0)) ? (
            <View style={[styles.badgeRow, flipRow]}>
              {profile.isVerified && profile.gender === 'female' ? <VerifiedHostBadge /> : null}

              {agencyRole && agencyRole !== 'host' ? (
                <View style={styles.roleBadge}>
                  <Shield size={11} color="#fff" fill="#fff" strokeWidth={1.6} />
                  <Text style={styles.roleBadgeText}>
          {t('agency.roleManager')}
                  </Text>
                </View>
              ) : null}

              {hasBadgePriv ? (
                vipBadgeUrl ? (
                  <ProfileImageBadge uri={vipBadgeUrl} />
                ) : (
                  <View style={styles.vipBadge}>
                    <Crown size={11} color="#7A4E00" fill="#7A4E00" strokeWidth={1.4} />
                    <Text style={styles.vipBadgeText}>{vipLabel}</Text>
                  </View>
                )
              ) : null}

              {princeBadgeUrl ? (
                <ProfileImageBadge uri={princeBadgeUrl} wide />
              ) : null}

              {aristocracyBadgeUrl ? (
                <ProfileImageBadge uri={aristocracyBadgeUrl} />
              ) : null}

              {equippedTitles.map(({ def, label }) => (
                <TitleBanner key={def.id} title={def} label={label} width={112} height={28} />
              ))}

              {showWealthLevel && level > 0 ? (
                <View style={styles.levelBadge}>
                  <Crown size={12} color="#fff" fill="#fff" strokeWidth={1.3} />
                  <Text style={styles.levelBadgeText}>Lv.{level}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Room shortcut */}
        {hostRoom ? (
          <Pressable
            style={({ pressed }) => [styles.roomCard, flipRow, pressed && { opacity: 0.85 }]}
            onPress={() => router.push(`/room/${hostRoom.id}` as any)}
          >
            <LinearGradient
              colors={['rgba(225,20,20,0.12)', 'rgba(225,20,20,0.04)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.roomCardIcon}>
              <Radio size={18} color="#E11414" strokeWidth={2.2} />
            </View>
            <View style={styles.roomCardInfo}>
              <Text weight="bold" numberOfLines={1} style={styles.roomCardName}>{hostRoom.name}</Text>
              <Text variant="caption" color={lu.colors.muted} numberOfLines={1}>
                {hostRoom.isActive
                  ? `${t('common.online')} · ${hostRoom.audienceCount} ${t('room.members')}`
                  : t('common.offline')}
              </Text>
            </View>
            <View style={[styles.roomCardArrow, isAr && { transform: [{ scaleX: -1 }] }]}>
              <ChevronRight size={18} color={lu.colors.muted} />
            </View>
          </Pressable>
        ) : null}

        {/* Tabs */}
        <View style={[styles.tabBar, flipRow]}>
          {PROFILE_TABS.map((tb) => (
            <Pressable key={tb.id} style={styles.tabItem} onPress={() => setTab(tb.id)}>
              <Text style={[styles.tabLabel, tab === tb.id && styles.tabLabelActive]}>{t(tb.label)}</Text>
              {tab === tb.id ? <View style={styles.tabLine} /> : null}
            </Pressable>
          ))}
        </View>

        {tab === 'about' && (
          <View style={styles.tabContent}>
            <SectionLabel text={t('profileMe.about')} />
            <View style={[styles.bioCard, flipRow]}>
              <View style={styles.bioIcon}>
                <Sparkles size={14} color={lu.colors.pink} />
              </View>
              <Text style={styles.bioText}>{profile.bio || t('profileMe.bioPlaceholder')}</Text>
            </View>

            <SectionLabel text={t('profileMe.basicInfo')} style={{ marginTop: 20 }} />
            <View style={[styles.chipRow, flipRow]}>
              <View style={[styles.chip, flipRow]}>
                <Cake size={14} color="#F59E0B" />
                <Text style={styles.chipText}>{birthStr}</Text>
              </View>
              <View style={[styles.chip, flipRow]}>
                <Globe size={14} color="#ED4444" />
                <Text style={styles.chipText}>{countryName}</Text>
              </View>
              {joinDays > 0 ? (
              <View style={[styles.chip, flipRow, { backgroundColor: '#FEE2E2', borderColor: '#FBD5D5' }]}>
                <Calendar size={14} color="#E11414" />
                <Text style={[styles.chipText, { color: '#E11414' }]}>
                  {t('profileEdit.joinedDays', { days: joinDays })}
                </Text>
              </View>
              ) : null}
            </View>

            <SectionLabel text={t('profile.personalTags')} style={{ marginTop: 20 }} />
            <View style={[styles.chipRow, flipRow]}>
              {(profile.tags ?? []).map((tag) => (
                <View key={tag} style={[styles.chip, { backgroundColor: '#FEE2E2', borderColor: '#FBD5D5' }]}>
                  <Text style={[styles.chipText, { color: '#E11414' }]}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {tab === 'posts' && (
          <View style={styles.tabContent}>
            {loadingPosts ? (
              <ActivityIndicator color={lu.colors.pink} style={{ marginTop: 24 }} />
            ) : posts.length === 0 ? (
              <Text style={styles.empty}>{t('profileMe.noPosts')}</Text>
            ) : (
              posts.map((p) => (
                <View key={p.id} style={styles.postCard}>
                  <Text style={styles.postText} numberOfLines={4}>{p.text}</Text>
                  {p.images?.[0] ? (
                    <Image source={{ uri: p.images[0] }} style={styles.postImg} contentFit="cover" />
                  ) : null}
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'honor' && (
          <View style={styles.tabContent}>
            <HonorSection title={t('profileMe.titles')} count={equippedTitles.length} empty={t('profileMe.noTitles')}>
              {equippedTitles.length > 0 ? (
                <View style={[styles.titlesRow, flipRow]}>
                  {equippedTitles.map(({ def, label }) => (
                    <TitleBanner key={def.id} title={def} label={label} width={140} height={36} />
                  ))}
                </View>
              ) : null}
            </HonorSection>
            {!hideGiftWallFromViewer ? (
              <HonorSection title={t('profileMe.giftWall')} count={giftWallCount} empty={t('profileMe.noGifts')}>
                {giftWallPreview.length > 0 ? (
                  <View style={[styles.giftPreviewRow, flipRow]}>
                    {giftWallPreview.map((g) => (
                      <View key={g.giftId} style={styles.giftPreviewCard}>
                        <GiftVisual
                          gift={{
                            iconName: g.iconName ?? 'Gift',
                            iconColor: g.iconColor ?? lu.colors.pink,
                            imageUrl: g.imageUrl,
                            animationUrl: g.animationUrl,
                          }}
                          size={40}
                        />
                        <Text style={styles.giftPreviewCount}>×{g.count}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </HonorSection>
            ) : null}
          </View>
        )}
      </ScrollView>

      {!isSelf && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, flexDirection: rowDir }]}>
          <Pressable style={styles.followBtnWrap} onPress={handleToggleFollow} disabled={followLoading}>
            {following ? (
              <View style={[styles.followBtn, styles.followingBtn, flipRow]}>
                <UserCheck size={18} color="#6B7280" strokeWidth={2.4} />
                <Text style={styles.followingText}>{followLoading ? '...' : t('profile.followingState')}</Text>
              </View>
            ) : (
              <LinearGradient colors={lu.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.followBtn, flipRow]}>
                <UserPlus size={18} color="#fff" strokeWidth={2.4} />
                <Text style={styles.followText}>{followLoading ? '...' : t('profile.follow')}</Text>
              </LinearGradient>
            )}
          </Pressable>
          <Pressable style={styles.roundBtn} onPress={() => router.push(`/chat/${userId}` as any)}>
            <MessageCircle size={21} color="#4B5563" strokeWidth={2.2} />
          </Pressable>
          {canMakeCalls ? (
            <Pressable style={styles.roundBtn} onPress={() => handleCall('voice')}>
              <Phone size={21} color="#4B5563" strokeWidth={2.2} />
            </Pressable>
          ) : null}
          <Pressable style={styles.roundBtn} onPress={() => setShowGiftPicker(true)}>
            <Gift size={21} color="#E11414" strokeWidth={2.2} />
          </Pressable>
        </View>
      )}

      <ChatGiftPickerModal
        visible={showGiftPicker}
        gifts={catalogGifts}
        categories={giftCategories}
        balance={myUser?.stats?.coins ?? 0}
        sending={sendingGift}
        titleKey="gifts.sendGift"
        onClose={() => setShowGiftPicker(false)}
        onSend={handleSendGift}
        onRecharge={() => router.push('/wallet/recharge' as any)}
      />

      <ProfileImagePreview uri={avatarPreview} onClose={() => setAvatarPreview(null)} />

      {entryVideo ? (
        <RoomEntryVideoOverlay
          key={entryVideo.key}
          userName={entryVideo.name}
          videoUrl={entryVideo.videoUrl}
          videoUrlMp4={entryVideo.videoUrlMp4}
          mode="profile"
          onComplete={clearEntryVideo}
        />
      ) : null}

      {/* Custom Options Bottom Sheet */}
      <Modal
        visible={optionsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setOptionsVisible(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setOptionsVisible(false)}>
          <Pressable
            style={[styles.sheetContent, { paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text weight="bold" style={styles.sheetTitle}>
                {t('profile.options')}
              </Text>
            </View>

            {isSelf ? (
              // Own profile: edit option
              <Pressable
                style={({ pressed }) => [
                  styles.sheetOption,
                  flipRow,
                  pressed && styles.sheetPressed,
                ]}
                onPress={() => {
                  setOptionsVisible(false);
                  router.push('/profile/edit' as any);
                }}
              >
                <LinearGradient
                  colors={lu.gradients.brand}
                  style={styles.sheetOptionIcon}
                >
                  <Pencil size={20} color="#FFF" />
                </LinearGradient>
                <Text
                  style={[
                    styles.sheetOptionLabel,
                    { textAlign: isAr ? 'right' : 'left' }
                  ]}
                >
                  {t('profileEdit.text5672')}
                </Text>
                {isAr ? (
                  <ChevronLeft size={18} color={lu.colors.muted} />
                ) : (
                  <ChevronRight size={18} color={lu.colors.muted} />
                )}
              </Pressable>
            ) : (
              // Someone else's profile: report & block options
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.sheetOption,
                    flipRow,
                    pressed && styles.sheetPressed,
                  ]}
                  onPress={() => {
                    setOptionsVisible(false);
                    router.push(getUserReportPath(userId, 'profile') as any);
                  }}
                >
                  <LinearGradient
                    colors={lu.gradients.brand}
                    style={styles.sheetOptionIcon}
                  >
                    <Flag size={20} color="#FFF" />
                  </LinearGradient>
                  <Text
                    style={[
                      styles.sheetOptionLabel,
                      { textAlign: isAr ? 'right' : 'left' }
                    ]}
                  >
                    {t('profile.reportUser')}
                  </Text>
                  {isAr ? (
                    <ChevronLeft size={18} color={lu.colors.muted} />
                  ) : (
                    <ChevronRight size={18} color={lu.colors.muted} />
                  )}
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.sheetOption,
                    flipRow,
                    pressed && styles.sheetPressed,
                  ]}
                  onPress={() => {
                    setOptionsVisible(false);
                    setTimeout(() => {
                      Alert.alert(
                        t('profile.blockUser'),
                        t('profile.blockConfirmUser', { name: displayName }),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('profile.blockUser'),
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await blockUser(userId);
                                Alert.alert(
                                  t('common.done'),
                                  t('profile.blockSuccess', { name: displayName }),
                                  [{ text: t('common.ok'), onPress: () => router.back() }],
                                );
                              } catch {
                                Alert.alert(t('common.error'), t('profile.blockFailed'));
                              }
                            },
                          },
                        ],
                      );
                    }, 350);
                  }}
                >
                  <LinearGradient
                    colors={['#EF4444', '#F87171']}
                    style={styles.sheetOptionIcon}
                  >
                    <Ban size={20} color="#FFF" />
                  </LinearGradient>
                  <Text
                    style={[
                      styles.sheetOptionLabel,
                      { color: '#EF4444', textAlign: isAr ? 'right' : 'left' }
                    ]}
                  >
                    {t('profile.blockUser')}
                  </Text>
                  {isAr ? (
                    <ChevronLeft size={18} color={lu.colors.muted} />
                  ) : (
                    <ChevronRight size={18} color={lu.colors.muted} />
                  )}
                </Pressable>
              </>
            )}

            <Pressable
              onPress={() => setOptionsVisible(false)}
              style={({ pressed }) => [
                styles.sheetCancelBtn,
                pressed && styles.sheetPressed,
              ]}
            >
              <Text weight="bold" style={styles.sheetCancelText}>
                {t('common.cancel')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const PROFILE_TABS: { id: 'about' | 'posts' | 'honor'; label: string }[] = [
  { id: 'about', label: 'profileMe.about' },
  { id: 'posts', label: 'profileMe.posts' },
  { id: 'honor', label: 'profileMe.honor' },
];

function SectionLabel({ text, style }: { text: string; style?: object }) {
  const { i18n } = useTranslation();
  const dir = 'row';
  return (
    <View style={[styles.sectionLabelRow, { flexDirection: dir }, style]}>
      <View style={styles.sectionAccent} />
      <Text weight="bold" style={styles.sectionLabel}>{text}</Text>
    </View>
  );
}

function HonorSection({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children?: React.ReactNode;
}) {
  const { i18n } = useTranslation();
  const dir = 'row';
  return (
    <View style={styles.honorBlock}>
      <View style={[styles.honorHead, { flexDirection: dir }]}>
        <View style={[styles.sectionLabelRow, { flexDirection: dir }]}>
          <View style={styles.sectionAccent} />
          <Text weight="bold" style={styles.honorTitle}>{title}</Text>
        </View>
        <Text style={styles.honorCount}>{count}</Text>
      </View>
      {children ?? <Text style={styles.empty}>{empty}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#F9FAFC' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFC' },
  coverWrap: { width: '100%', backgroundColor: '#E5E7EB' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  topName: { color: '#fff', fontSize: 18, flex: 1, textAlign: 'center', marginHorizontal: 8, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3, includeFontPadding: false, lineHeight: 28, paddingTop: 4 },
  coverFooter: {
    position: 'absolute',
    bottom: 50,
    start: 20,
    end: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  coverAvatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  coverAvatarImg: { width: '100%', height: '100%' },
  coverVoiceInline: { flexShrink: 1, flex: 1, minWidth: 0, maxWidth: 140 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#374151', fontSize: 13, fontFamily: lu.fonts.bodyBold, includeFontPadding: false },
  identity: { paddingHorizontal: 20, paddingTop: 24, backgroundColor: '#F9FAFC', borderTopLeftRadius: 36, borderTopRightRadius: 36, marginTop: -36 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 24, color: '#111827', fontFamily: lu.fonts.displayHeavy, flexShrink: 1, includeFontPadding: false, lineHeight: 36, paddingTop: 6 },
  agePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99 },
  agePillMale: { backgroundColor: '#FCE2E2' },
  agePillFemale: { backgroundColor: '#FFE6E9' },
  ageText: { fontSize: 13, fontFamily: lu.fonts.bodyBold, includeFontPadding: false },
  ageTextMale: { color: '#B71212' },
  ageTextFemale: { color: '#C40E1E' },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  idText: { fontSize: 14, color: '#6B7280', fontFamily: lu.fonts.bodyBold, writingDirection: 'ltr' },
  joinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: '#FEE2E2',
  },
  joinPillText: { fontSize: 13, color: '#E11414', fontFamily: lu.fonts.bodyBold, includeFontPadding: false },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignContent: 'center',
    justifyContent: 'center',
    gap: 5,
    rowGap: 5,
    marginTop: 16,
    width: '100%',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 99,
    shadowColor: '#F59E0B', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  levelBadgeText: { color: '#FFF', fontSize: 12, fontFamily: lu.fonts.displayHeavy, includeFontPadding: false, writingDirection: 'ltr' },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 99,
  },
  vipBadgeText: { color: '#B45309', fontSize: 12, fontFamily: lu.fonts.displayHeavy, includeFontPadding: false, writingDirection: 'ltr' },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E11414',
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 99,
  },
  roleBadgeText: { color: '#FFF', fontSize: 12, fontFamily: lu.fonts.bodyBold, includeFontPadding: false },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(225,20,20,0.15)',
    overflow: 'hidden',
    gap: 10,
  },
  roomCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(225,20,20,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomCardInfo: {
    flex: 1,
    gap: 2,
  },
  roomCardName: {
    fontSize: 14,
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyBold,
  },
  roomCardArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    marginTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  tabLabel: { fontSize: 15, color: '#9CA3AF', fontFamily: lu.fonts.bodyBold },
  tabLabelActive: { color: '#111827', fontFamily: lu.fonts.displayHeavy },
  tabLine: {
    position: 'absolute',
    bottom: -1,
    width: 50,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E11414',
  },
  tabContent: { paddingHorizontal: 20, paddingTop: 24 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionAccent: { width: 4, height: 16, borderRadius: 2, backgroundColor: '#E11414' },
  sectionLabel: { fontSize: 16, color: '#111827', fontFamily: lu.fonts.bodyBold },
  bioCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  bioIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioText: { flex: 1, fontSize: 15, color: '#4B5563', lineHeight: 24 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  chipText: { fontSize: 13, color: '#4B5563', fontFamily: lu.fonts.bodyBold },
  empty: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 20 },
  postCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
  postText: { fontSize: 15, color: '#111827', lineHeight: 24 },
  postImg: { width: '100%', height: 200, borderRadius: 12, marginTop: 12 },
  honorBlock: { marginBottom: 26 },
  honorHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  honorTitle: { fontSize: 16, fontFamily: lu.fonts.bodyBold, color: '#111827' },
  honorCount: { fontSize: 14, color: '#6B7280', fontFamily: lu.fonts.bodyBold },
  titlesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start' },
  giftPreviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-start' },
  giftPreviewCard: { width: 78, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
  giftPreviewImg: { width: 54, height: 46 },
  giftPreviewCount: { fontSize: 13, fontFamily: lu.fonts.displayHeavy, color: '#E11414', marginTop: 6 },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 99,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  followBtnWrap: { flex: 1, borderRadius: 99, overflow: 'hidden' },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 99,
  },
  followingBtn: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  followText: { color: '#fff', fontFamily: lu.fonts.bodyBold, fontSize: 16 },
  followingText: { color: '#4B5563', fontFamily: lu.fonts.bodyBold, fontSize: 16 },
  roundBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    color: '#111827',
    fontFamily: lu.fonts.displayHeavy,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sheetOptionLabel: {
    fontSize: 16,
    color: '#111827',
    fontFamily: lu.fonts.bodyBold,
    flex: 1,
    marginHorizontal: 14,
  },
  sheetOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  sheetCancelText: {
    fontSize: 17,
    color: '#111827',
    fontFamily: lu.fonts.bodyBold,
  },
  sheetPressed: {
    opacity: 0.7,
  },
});
