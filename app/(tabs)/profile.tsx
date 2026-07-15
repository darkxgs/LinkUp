/**
 * Profile (Me) — التصميم الجديد (RN / Expo)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Alert,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Settings, Share2, Pencil, Crown, Copy,
  Users, Heart, Eye, Gift, Trophy, ShoppingBag, Wallet, Gamepad2, Headphones,
  User, Award, Briefcase, MessageCircle, Ban, Lock, ShieldCheck, Info,
} from 'lucide-react-native';
import { ArrowRight } from '@/components/ui/RtlIcons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

import { lu } from '@/theme/lu-brand';
import { useThemeMode } from '@/stores/themeStore';
import { useAppLanguage } from '@/localization/useAppLanguage';
import { useAuthStore } from '@/stores/authStore';
import { resolveDisplayName } from '@/utils/displayName';
import { ensurePublicAccountId } from '@/services/accountSecurity';
import { getDisplayAccountId } from '@/services/userIdentifier';
import { copyToClipboard } from '@/utils/copyToClipboard';
import { isAgencyAgent } from '@/services/firebase/hostTasks';
import { canEarnHostTasks } from '@/utils/genderAccess';
import { getCachedMyAgency, subscribeToMyAgency } from '@/services/agencyService';
import { firestore } from '@/services/firebase';
import { COIN_CURRENCY_ICON } from '@/constants/brandAssets';
import { getEffectiveVipLevel, isUserVipActive } from '@/services/firebase/vipSystem';
import { ProfileVipStatusCard } from '@/components/profile/ProfileVipStatusCard';
import { ProfileBadgesRow } from '@/components/profile/ProfileBadgesRow';
import { FramedAvatar, getFramedAvatarContainerSize } from '@/components/ui/FramedAvatar';
import { useEquippedFrameUrl } from '@/hooks/useEquippedFrameUrl';
import { reconcileSocialCounts, subscribeToSocialCounts } from '@/services/firebase/follow';
import { reconcileVisitorCount, subscribeToProfileVisitorCount } from '@/services/firebase/profileVisitors';
import { reconcileUserBalances } from '@/utils/userBalance';
import { subscribeToMyRoomStats } from '@/services/roomFeatures';

/** شعارات SVIP لكل مستوى — أصول العميل كما هي */
const SVIP_LEVEL_BADGES: Record<number, number> = {
  1: require('../../assets/images/svip/svip1.webp'),
  2: require('../../assets/images/svip/svip2.webp'),
  3: require('../../assets/images/svip/svip3.webp'),
  4: require('../../assets/images/svip/svip4.webp'),
  5: require('../../assets/images/svip/svip5.webp'),
  6: require('../../assets/images/svip/svip6.webp'),
  7: require('../../assets/images/svip/svip7.webp'),
  8: require('../../assets/images/svip/svip8.webp'),
  9: require('../../assets/images/svip/svip9.webp'),
  10: require('../../assets/images/svip/svip10.webp'),
  11: require('../../assets/images/svip/svip11.webp'),
  12: require('../../assets/images/svip/svip12.webp'),
};

/** إطارات أفاتار SVIP لكل مستوى — أصول العميل كما هي */
const SVIP_LEVEL_FRAMES: Record<number, number> = {
  1: require('../../assets/images/svip/frame1.webp'),
  2: require('../../assets/images/svip/frame2.webp'),
  3: require('../../assets/images/svip/frame3.webp'),
  4: require('../../assets/images/svip/frame4.webp'),
  5: require('../../assets/images/svip/frame5.webp'),
  6: require('../../assets/images/svip/frame6.webp'),
  7: require('../../assets/images/svip/frame7.webp'),
  8: require('../../assets/images/svip/frame8.webp'),
  9: require('../../assets/images/svip/frame9.webp'),
  10: require('../../assets/images/svip/frame10.webp'),
  11: require('../../assets/images/svip/frame11.webp'),
  12: require('../../assets/images/svip/frame12.webp'),
};

const DISPLAY = lu.fonts.displayHeavy;
const HEAVY = lu.fonts.bodyHeavy;
const BODY = lu.fonts.body;
const SEMI = lu.fonts.bodySemi;
const AVATAR_SIZE = 84;

function formatCompact(n: number) {
  const v = Number.isFinite(n) ? Math.max(0, n) : 0;
  if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}T`;
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${(v / 1_000).toFixed(0)}K`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString('en-US');
}

function formatExact(n: number) {
  const v = Number.isFinite(n) ? Math.max(0, n) : 0;
  return v.toLocaleString('en-US');
}

export default function ProfileScreen() {
  const { t, isRTL: isRtl } = useAppLanguage();
  const L = (ar: string, en: string) => (isRtl ? ar : en);
  const ROW = 'row';

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { isDark } = useThemeMode();

  // لوحة ألوان الصفحة حسب السمة — نفس لغة صفحات Discover/Feed/Home.
  const pal = isDark
    ? {
        pageGrad: lu.gradients.pageHomeNight,
        cardBg: lu.colors.nightCard,
        cardBorder: 'rgba(255,45,60,0.24)',
        cardShadow: '#FF1E30',
        ink: '#FFFFFF',
        ink2: 'rgba(255,255,255,0.72)',
        muted: 'rgba(255,255,255,0.45)',
        line: 'rgba(255,255,255,0.08)',
        red: '#FF5C6C',
        glassBg: 'rgba(255,255,255,0.06)',
        glassBorder: 'rgba(255,45,60,0.35)',
        glassIcon: '#FFFFFF',
        chipBg: 'rgba(255,255,255,0.07)',
        toolBg: 'rgba(255,45,60,0.1)',
        toolBorder: 'rgba(255,45,60,0.35)',
        outlineBtnBg: 'rgba(255,45,60,0.1)',
        outlineBtnBorder: 'rgba(255,92,108,0.45)',
      }
    : {
        pageGrad: ['#FBEAEA', '#FBF1F1', '#F8F6F7'] as const,
        cardBg: '#FFFFFF',
        cardBorder: 'rgba(225,20,20,0.14)',
        cardShadow: '#9A1414',
        ink: '#15151A',
        ink2: '#3A3A44',
        muted: '#9A9AA5',
        line: '#F1E7E7',
        red: '#E11414',
        glassBg: '#FFFFFF',
        glassBorder: 'rgba(225,20,20,0.16)',
        glassIcon: '#15151A',
        chipBg: '#F6ECEC',
        toolBg: 'rgba(225,20,20,0.06)',
        toolBorder: 'rgba(225,20,20,0.16)',
        outlineBtnBg: 'rgba(225,20,20,0.07)',
        outlineBtnBorder: '#F0BABA',
      };
  const user = useAuthStore((s) => s.user);
  const socialStats = useAuthStore((s) => s.user?.stats);

  const stats = socialStats ?? {
    coins: 0,
    pearls: 0,
    followers: 0,
    following: 0,
    visitors: 0,
    level: 1,
    totalRoomsCreated: 0,
  };

  const name = resolveDisplayName(
    { displayName: user?.profile?.displayName, email: user?.email },
    t('rooms.userFallback'),
  );
  const avatar = user?.profile?.avatar;
  const uid = user?.uid ?? '';
  const [accountId, setAccountId] = useState(() => getDisplayAccountId(user?.publicAccountId, uid));
  const [hasPendingInvite, setHasPendingInvite] = useState(false);
  const [roomStats, setRoomStats] = useState({ joined: 0, agencies: 0, favorites: 0 });

  const followers = stats.followers ?? 0;
  const following = stats.following ?? 0;
  const [visitorCount, setVisitorCount] = useState(stats.visitors ?? 0);

  const pad = W < 360 ? 16 : 20;
  const equippedFrameUrl = useEquippedFrameUrl(uid);
  const frameBox = getFramedAvatarContainerSize(AVATAR_SIZE);
  const [ownsAgency, setOwnsAgency] = useState(() => !!getCachedMyAgency());
  const isAgent = isAgencyAgent(user) || ownsAgency;
  const isHost = !!user?.agencyId && !isAgent;
  const isFemale = user?.profile?.gender === 'female';
  const isMale = user?.profile?.gender !== 'female';
  // مستوى SVIP الفعّال فقط عند اشتراك نشط — لا إطار/وسم بدون المستوى فعلاً
  const vipLevel = isUserVipActive(user) ? getEffectiveVipLevel(user) : 0;
  const svipCardBadge = SVIP_LEVEL_BADGES[vipLevel] ?? require('../../assets/images/svip_badge.webp');
  // إطار SVIP على الأفاتار عند غياب إطار المتجر المجهّز
  const avatarFrame = equippedFrameUrl ?? SVIP_LEVEL_FRAMES[vipLevel];
  const birthYear = Number(user?.profile?.birthYear ?? 0);
  const age = birthYear > 1900 ? Math.max(0, new Date().getFullYear() - birthYear) : 0;
  const showHostTasks = canEarnHostTasks(user);

  useEffect(() => {
    if (!uid) return;
    void reconcileSocialCounts(uid).catch(() => {});
    void reconcileVisitorCount(uid).catch(() => {});
    void reconcileUserBalances(uid).catch(() => {});
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setOwnsAgency(false);
      return;
    }
    return subscribeToMyAgency((agency) => setOwnsAgency(!!agency));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToProfileVisitorCount(uid, setVisitorCount);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToSocialCounts(uid);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToMyRoomStats(setRoomStats);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const fromStore = user?.publicAccountId;
    if (fromStore) {
      setAccountId(getDisplayAccountId(fromStore, uid));
      return;
    }
    ensurePublicAccountId(uid).then((id) => {
      setAccountId(getDisplayAccountId(id, uid));
      useAuthStore.getState().updateUserData({ publicAccountId: id });
    });
  }, [uid, user?.publicAccountId]);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(firestore, 'agencyInvites'),
      where('invitedUid', '==', uid),
      where('status', '==', 'pending'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setHasPendingInvite(!snap.empty),
      (err) => console.warn('Error listening to agency invites:', err),
    );
    return () => unsub();
  }, [uid]);

  const copyAccountId = useCallback(async () => {
    if (!accountId || accountId.includes('-')) return;
    const ok = await copyToClipboard(accountId);
    if (ok) {
      Alert.alert(t('profile.idCopiedTitle'), t('profile.idCopiedMessage', { id: accountId }));
    } else {
      Alert.alert(t('roomSettings.text32386'), t('profile.idCopyFailed'));
    }
  }, [accountId, t]);

  const go = (r: string) => router.push(r as any);

  const statItems = [
    {
      n: formatCompact(following),
      label: t('profile.iFollow'),
      Icon: Users,
      color: '#ED4444',
      onPress: () => go(`/profile/list?userId=${uid}&type=following`),
    },
    {
      n: formatCompact(followers),
      label: t('profile.myFollowers'),
      Icon: Heart,
      color: '#E11414',
      onPress: () => go(`/profile/list?userId=${uid}&type=followers`),
    },
    {
      n: formatExact(visitorCount),
      label: t('profile.myVisitors'),
      Icon: Eye,
      color: '#E11414',
      onPress: () => go('/visitors'),
    },
    {
      n: formatCompact(roomStats.joined),
      label: t('profile.joinedRooms'),
      Icon: Headphones,
      color: '#C61414',
      onPress: () => go(`/profile/rooms?userId=${uid}&tab=joined`),
    },
  ];

  const tools = [
    { Icon: Gift, tint: 'rgba(237, 68, 68, 0.08)', color: '#ED4444', label: t('profile.gifts'), route: '/gifts' },
    { Icon: Trophy, tint: 'rgba(225,20,20,0.08)', color: '#E11414', label: L('المستويات', 'Levels'), route: '/wealth-level' },
    { Icon: ShoppingBag, tint: 'rgba(244,63,94,0.08)', color: '#F43F5E', label: t('profile.myStore'), route: '/store' },
    { Icon: Crown, tint: 'rgba(239, 70, 70, 0.08)', color: '#FF3340', label: t('profile.vipShort'), route: '/vip' },
    ...(showHostTasks
      ? [{ Icon: Award, tint: 'rgba(168, 85, 247, 0.08)', color: '#A855F7', label: t('profile.hostTasksPage'), route: '/host/tasks' }]
      : []),
    { Icon: Wallet, tint: 'rgba(198, 20, 20, 0.08)', color: '#C61414', label: t('profile.wallet'), route: '/wallet' },
    { Icon: Gamepad2, tint: 'rgba(249,115,22,0.08)', color: '#F97316', label: L('الألعاب', 'Games'), route: '/games' },
    { Icon: Settings, tint: 'rgba(225, 20, 20,0.08)', color: '#E11414', label: t('profile.appSettings'), route: '/settings' },
    { Icon: Headphones, tint: 'rgba(176, 14, 14,0.08)', color: '#E11414', label: t('profile.support'), route: '/support' },
  ];

  type MenuItem = { Icon: typeof User; label: string; route: string; isNew?: boolean };

  const menu: MenuItem[] = [
    { Icon: User, label: t('profile.myProfile'), route: '/profile/me' },
    { Icon: Award, label: t('profile.myTitle'), route: '/titles' },
    { Icon: Briefcase, label: t('profile.agency'), route: '/agency/hub' },
  ];

  if (isAgent) {
    menu.push({ Icon: Crown, label: t('profile.agencyPrince'), route: '/agency/prince' });
  }

  if (isFemale) {
    menu.push({ Icon: ShieldCheck, label: t('profile.verificationCenter'), route: '/wallet/kyc' });
    if (showHostTasks) {
      menu.push({ Icon: Award, label: t('profile.hostTasksPage'), route: '/host/tasks' });
    }
  }

  if (isHost || isAgent) {
    menu.push({ Icon: Briefcase, label: t('profile.agencyCenter'), route: '/agency/center' });
    if (isAgent) {
      menu.push({ Icon: Crown, label: t('bdCenter.title'), route: '/agency/bd-center' });
    }
  }

  if (hasPendingInvite) {
    menu.push({ Icon: Briefcase, label: t('profile.agencyInvites'), route: '/agency/my-invites', isNew: true });
  }

  menu.push(
    { Icon: MessageCircle, label: t('profile.feedback'), route: '/support' },
    { Icon: Ban, label: t('profile.blockedList'), route: '/blocked' },
    { Icon: Info, label: t('profile.aboutApp'), route: '/about' },
    { Icon: Lock, label: t('settings.privacy'), route: '/settings/privacy' },
  );

  return (
    <LinearGradient colors={pal.pageGrad as any} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      >
        {/* Header actions */}
        <View style={[styles.headerRow, { flexDirection: ROW, paddingHorizontal: pad, paddingTop: insets.top + 10 }]}>
          <GlassBtn pal={pal} onPress={() => go('/settings')}>
            <Settings size={19} color={pal.glassIcon} />
          </GlassBtn>
          <View style={{ flexDirection: ROW, gap: 9 }}>
            <GlassBtn
              pal={pal}
              onPress={() => {
                void Share.share({
                  message: t('profile.shareMessage', {
                    name,
                    id: accountId,
                    defaultValue: `${name} على LinkUp — ID: ${accountId}`,
                  }),
                }).catch(() => {});
              }}
            >
              <Share2 size={18} color={pal.glassIcon} />
            </GlassBtn>
            <GlassBtn pal={pal} onPress={() => go('/profile/edit')}>
              <Pencil size={18} color={pal.glassIcon} />
            </GlassBtn>
          </View>
        </View>

        {/* Identity — الصورة يسارًا والاسم والشارات بجانبها */}
        <View style={[styles.identityRow, { flexDirection: ROW, paddingHorizontal: pad }]}>
          <Pressable
            onPress={() => uid && go(`/profile/${uid}`)}
            style={[styles.avatarWrap, avatarFrame ? { width: frameBox, height: frameBox } : undefined]}
          >
            {avatarFrame ? (
              <FramedAvatar
                avatarUri={avatar}
                frameUri={avatarFrame}
                avatarSize={AVATAR_SIZE}
                fallbackLetter={name}
              />
            ) : (
              <View style={styles.avatarGlow}>
                <LinearGradient
                  colors={['#FF6670', '#C40E2E', '#7A0A14']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarRing}
                >
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatarImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatarImg, styles.avatarFallback, isDark && styles.avatarFallbackDark]}>
                      <Text style={styles.avatarFallbackText}>{name.charAt(0)}</Text>
                    </View>
                  )}
                </LinearGradient>
              </View>
            )}
            {!((user as any)?.privacyHideOnline === true ||
              (user as any)?.privacySettings?.hideOnline === true) ? (
              <View
                style={[
                  styles.onlineDot,
                  isDark && styles.onlineDotDark,
                  avatarFrame ? styles.onlineDotFramed : undefined,
                  isRtl && !avatarFrame ? { right: undefined, left: 4 } : undefined,
                  isRtl && avatarFrame ? { right: undefined, left: 26 } : undefined,
                ]}
              />
            ) : null}
            {vipLevel > 0 ? null : (
              <View style={[styles.crownBadge, avatarFrame ? styles.crownBadgeFramed : undefined]}>
                <Crown size={13} color="#FF4D5E" fill="#FF4D5E" />
              </View>
            )}
          </Pressable>

          <View style={styles.identityInfo}>
            <View style={[styles.nameRow, { flexDirection: ROW }]}>
              <Text style={[styles.name, { color: pal.ink }]} numberOfLines={1}>{name}</Text>
              {age > 0 ? (
                <LinearGradient
                  colors={isMale ? ['#4FACFE', '#2563EB'] : ['#FF7EB3', '#E1265E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.agePill}
                >
                  <Text style={styles.agePillText}>
                    {age} {isMale ? '♂' : '♀'}
                  </Text>
                </LinearGradient>
              ) : null}
            </View>

            <View style={[styles.idRow, { flexDirection: ROW }]}>
              <Pressable
                style={[
                  styles.idChip,
                  { flexDirection: ROW },
                  isDark
                    ? { backgroundColor: 'rgba(255,255,255,0.09)' }
                    : { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0BABA' },
                ]}
                onPress={copyAccountId}
              >
                <Text style={[styles.idText, { color: isDark ? 'rgba(255,255,255,0.78)' : pal.muted }]}>
                  ID: {accountId}
                </Text>
                <Copy size={15} color={isDark ? 'rgba(255,255,255,0.78)' : pal.muted} />
              </Pressable>
              <Image
                source={require('../../assets/images/sid_badge.webp')}
                style={styles.sidBadge}
                contentFit="contain"
              />
            </View>

            <ProfileBadgesRow
              horizontalPad={0}
              night={isDark}
              hideTags
              style={[styles.badgesRowWrap, { justifyContent: 'flex-start' }]}
            />
          </View>
        </View>

        {/* وسوم SVIP/الأرستقراطية — صف مستقل بمحاذاة عمود المعلومات */}
        <ProfileBadgesRow
          horizontalPad={0}
          night={isDark}
          tagsOnly
          style={[
            styles.badgesRowWrap,
            {
              justifyContent: 'flex-start',
              marginTop: 8,
              marginStart: pad + frameBox + 16,
              marginEnd: pad,
              width: 'auto',
            },
          ]}
        />

        {/* Stats */}
        <View
          style={[
            styles.card,
            styles.statsCard,
            { marginHorizontal: pad, backgroundColor: pal.cardBg, borderColor: pal.cardBorder, shadowColor: pal.cardShadow },
          ]}
        >
          <View style={[styles.statsRow, { flexDirection: ROW }]}>
            {statItems.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 ? <View style={[styles.statDivider, { backgroundColor: pal.line }]} /> : null}
                <Pressable style={styles.statCol} onPress={s.onPress}>
                  <Text
                    style={[styles.statN, { color: pal.ink }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {s.n}
                  </Text>
                  <View style={[styles.statLabelRow, { flexDirection: ROW }]}>
                    <View style={styles.statIconBox}>
                      <s.Icon size={11} color={isDark ? pal.red : s.color} />
                    </View>
                    <Text style={[styles.statLabel, { color: isDark ? pal.ink2 : '#5E5E68' }]} numberOfLines={1}>
                      {s.label}
                    </Text>
                  </View>
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Wallet */}
        <View
          style={[
            styles.card,
            { marginHorizontal: pad, padding: 16, backgroundColor: pal.cardBg, borderColor: pal.cardBorder, shadowColor: pal.cardShadow },
          ]}
        >
          <View style={[styles.walletHead, { flexDirection: ROW }]}>
            <Text style={[styles.walletTitle, { color: pal.ink }]}>{t('profile.wallet')}</Text>
            <Pressable style={{ flexDirection: ROW, alignItems: 'center', gap: 3 }} onPress={() => go('/wallet')}>
              <Text style={[styles.walletHistory, { color: pal.red }]}>{L('السجل', 'History')}</Text>
              <ArrowRight size={13} color={pal.red} />
            </Pressable>
          </View>

          <View style={[styles.walletRow, { flexDirection: ROW }]}>
            <View style={styles.walletCol}>
              <View style={[styles.walletBalRow, { flexDirection: ROW }]}>
                <Image
                  source={require('../../assets/images/wallet_diamond.png')}
                  style={styles.coinImg}
                  contentFit="contain"
                />
                <View style={{ flex: 1, alignItems: isRtl ? 'flex-end' : 'flex-start' }}>
                  <Text
                    style={[styles.walletVal, { color: pal.ink }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.55}
                  >
                    {formatExact(stats.pearls ?? 0)}
                  </Text>
                  <Text style={[styles.walletLabel, { color: pal.muted }]}>{t('profile.myPearls')}</Text>
                </View>
              </View>
              <Pressable
                style={[
                  styles.btnOutline,
                  { flexDirection: ROW, backgroundColor: pal.outlineBtnBg, borderColor: pal.outlineBtnBorder },
                ]}
                onPress={() => go('/wallet/exchange')}
              >
                <Text
                  style={[styles.btnOutlineText, { color: pal.red, flexShrink: 1 }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {t('wallet.exchangeWithdraw')}
                </Text>
                <ArrowRight size={13} color={pal.red} />
              </Pressable>
            </View>

            <View style={[styles.walletDivider, { backgroundColor: pal.line }]} />

            <View style={styles.walletCol}>
              <View style={[styles.walletBalRow, { flexDirection: ROW }]}>
                <Image
                  source={COIN_CURRENCY_ICON}
                  style={styles.coinImg}
                  contentFit="contain"
                />
                <View style={{ flex: 1, alignItems: isRtl ? 'flex-end' : 'flex-start' }}>
                  <Text
                    style={[styles.walletVal, { color: pal.ink }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.55}
                  >
                    {formatExact(stats.coins ?? 0)}
                  </Text>
                  <Text style={[styles.walletLabel, { color: pal.muted }]}>{t('profile.myCoins')}</Text>
                </View>
              </View>
              <Pressable onPress={() => go('/wallet/recharge')} style={styles.btnRedWrap}>
                <LinearGradient
                  colors={['#FF4D5E', '#C40E2E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.btnRed, { flexDirection: ROW }]}
                >
                  <Text
                    style={[styles.btnRedText, { flexShrink: 1 }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    + {L('شحن', 'Recharge')}
                  </Text>
                  <ArrowRight size={13} color="#fff" />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Tools grid */}
        <View
          style={[
            styles.card,
            styles.toolsCard,
            { marginHorizontal: pad, backgroundColor: pal.cardBg, borderColor: pal.cardBorder, shadowColor: pal.cardShadow },
          ]}
        >
          {tools.map((tool, i) => (
            <Pressable key={i} style={styles.toolCell} onPress={() => go(tool.route)}>
              <View style={styles.toolCircle}>
                <Image
                  source={require('../../assets/images/tool_circle_bg.png')}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
                <tool.Icon size={20} color="#FF8A94" />
              </View>
              <Text style={[styles.toolLabel, { color: isDark ? pal.ink2 : '#5E5E68' }]}>{tool.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* SVIP status card */}
        <ProfileVipStatusCard horizontalPad={pad} />

        {/* Memberships — كرت عريض: قرص التاج يسارًا والنص والزر يمينًا */}
        <View style={[styles.membersCol, { flexDirection: ROW, marginHorizontal: pad }]}>
          <Pressable style={{ flex: 1 }} onPress={() => go('/vip')}>
            <LinearGradient
              colors={['#571019', '#33080E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.memberCard, { borderColor: 'rgba(255,77,102,0.6)', shadowColor: '#FF1E30' }]}
            >
              <Image
                source={svipCardBadge}
                style={styles.memberCrown}
                contentFit="contain"
              />
              <View style={styles.memberBody}>
                <Text style={[styles.memberTitle, { color: '#FF5C6C' }]}>{t('profile.superVip')}</Text>
                <Text style={styles.memberPerk} numberOfLines={2}>
                  {L('شارات حصرية ومكافآت كبرى', 'Exclusive badges & rewards')}
                </Text>
                <LinearGradient
                  colors={['#FF4D5E', '#C40E2E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.memberCta, { flexDirection: ROW }]}
                >
                  <Text style={styles.memberCtaText}>{L('ترقية', 'Upgrade')}</Text>
                  <ArrowRight size={15} color="#fff" />
                </LinearGradient>
              </View>
            </LinearGradient>
          </Pressable>

          <Pressable style={{ flex: 1 }} onPress={() => go('/vip/aristocracy')}>
            <LinearGradient
              colors={['#331253', '#1E0A33']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.memberCard, { borderColor: 'rgba(168,85,247,0.6)', shadowColor: '#8B5CF6' }]}
            >
              <Image
                source={require('../../assets/images/aristocracy_badge.webp')}
                style={styles.memberCrown}
                contentFit="contain"
              />
              <View style={styles.memberBody}>
                <Text style={[styles.memberTitle, { color: '#B981F7' }]}>{t('profile.aristocracy')}</Text>
                <Text style={styles.memberPerk} numberOfLines={2}>
                  {L('امتيازات النبلاء وعائدات مجمدة', 'Noble privileges & frozen returns')}
                </Text>
                <LinearGradient
                  colors={['#8B5CF6', '#6D28D9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.memberCta, { flexDirection: ROW }]}
                >
                  <Text style={styles.memberCtaText}>{L('انضم', 'Join')}</Text>
                  <ArrowRight size={15} color="#fff" />
                </LinearGradient>
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Menu */}
        <View
          style={[
            styles.card,
            { marginHorizontal: pad, paddingHorizontal: 16, paddingVertical: 4, backgroundColor: pal.cardBg, borderColor: pal.cardBorder, shadowColor: pal.cardShadow },
          ]}
        >
          {menu.map((m, i) => (
            <Pressable
              key={i}
              onPress={() => go(m.route)}
              style={[
                styles.menuRow,
                { flexDirection: ROW },
                i < menu.length - 1 && [styles.menuBorder, { borderBottomColor: pal.line }],
              ]}
            >
              <View style={[styles.menuIcon, { backgroundColor: pal.toolBg }]}>
                <m.Icon size={18} color={pal.red} />
              </View>
              <Text style={[styles.menuLabel, { color: pal.ink, textAlign: isRtl ? 'right' : 'left' }]}>{m.label}</Text>
              {m.isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>{t('profile.newBadge')}</Text>
                </View>
              )}
              <ArrowRight size={16} color={pal.muted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

type Pal = { glassBg: string; glassBorder: string };

function GlassBtn({ children, onPress, pal }: { children: React.ReactNode; onPress: () => void; pal: Pal }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.glassBtn,
        { backgroundColor: pal.glassBg, borderColor: pal.glassBorder },
        pressed && { opacity: 0.85 },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerRow: { alignItems: 'center', justifyContent: 'space-between' },
  glassBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  identityRow: { alignItems: 'center', gap: 16, marginTop: 18 },
  identityInfo: { flex: 1, minWidth: 0, gap: 8, alignItems: 'flex-start' },
  avatarWrap: { position: 'relative' },
  avatarGlow: {
    borderRadius: 63,
    shadowColor: '#FF1E30', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 16,
    elevation: 10,
  },
  avatarRing: { width: 126, height: 126, borderRadius: 63, padding: 4, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%', borderRadius: 59, borderWidth: 3, borderColor: 'rgba(0,0,0,0.35)' },
  avatarFallback: { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackDark: { backgroundColor: '#3A2228' },
  avatarFallbackText: { fontSize: 34, fontWeight: '900', color: '#E11414', fontFamily: DISPLAY },
  onlineDot: { position: 'absolute', bottom: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#10B981', borderWidth: 2.5, borderColor: '#fff' },
  onlineDotDark: { borderColor: '#1D1317' },
  onlineDotFramed: { bottom: 26, right: 26 },
  crownBadge: {
    position: 'absolute', bottom: -7, alignSelf: 'center',
    backgroundColor: '#0B0608', paddingHorizontal: 13, paddingVertical: 3,
    borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  crownBadgeFramed: { bottom: 2 },

  nameRow: { alignItems: 'center', gap: 8 },
  name: { fontSize: 24, fontWeight: '900', fontFamily: DISPLAY, flexShrink: 1 },
  idChip: { alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, alignSelf: 'center' },
  idRow: { alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  sidBadge: { width: 52, height: 52 },
  agePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
  agePillText: { fontSize: 12, fontWeight: '800', color: '#fff', fontFamily: HEAVY, includeFontPadding: false, writingDirection: 'ltr' },
  idText: { fontSize: 13.5, fontWeight: '600', fontFamily: SEMI },

  badgesRowWrap: { paddingVertical: 0, alignSelf: 'stretch' },

  card: {
    borderRadius: 24, marginTop: 16, borderWidth: 1,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 3,
  },
  statCol: { flex: 1, alignItems: 'center', gap: 3, minWidth: 0 },
  statDivider: { width: 1, alignSelf: 'stretch', marginVertical: 4 },
  statsCard: { paddingVertical: 14, paddingHorizontal: 4 },
  statsRow: { alignItems: 'stretch', justifyContent: 'space-between' },
  statN: { fontSize: 16, fontWeight: '900', fontFamily: DISPLAY, maxWidth: '100%' },
  statLabelRow: { alignItems: 'center', gap: 3, maxWidth: '100%' },
  statIconBox: { height: 12, width: 12, alignItems: 'center', justifyContent: 'center', transform: [{ translateY: -1.5 }] },
  statLabel: { fontSize: 9.5, fontWeight: '600', fontFamily: SEMI, flexShrink: 1, includeFontPadding: false, lineHeight: 12, textAlignVertical: 'center' },

  walletHead: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  walletTitle: { fontSize: 16, fontWeight: '800', fontFamily: HEAVY },
  walletHistory: { fontSize: 12.5, fontWeight: '700', fontFamily: SEMI },
  walletRow: { alignItems: 'stretch' },
  walletCol: { flex: 1, alignItems: 'center', gap: 12 },
  walletDivider: { width: 1, marginHorizontal: 8 },
  walletBalRow: { alignItems: 'center', gap: 10, width: '100%', paddingHorizontal: 4 },
  coinImg: { width: 46, height: 46 },
  walletVal: { fontSize: 18, fontWeight: '800', fontFamily: DISPLAY, maxWidth: '100%' },
  walletLabel: { fontSize: 11, fontFamily: BODY },
  btnOutline: { width: '90%', height: 38, borderRadius: 99, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  btnOutlineText: { fontSize: 12.5, fontWeight: '800', fontFamily: HEAVY },
  btnRedWrap: {
    width: '90%', height: 38, borderRadius: 99, overflow: 'hidden',
    shadowColor: '#FF1E30', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  btnRed: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  btnRedText: { color: '#fff', fontSize: 12.5, fontWeight: '800', fontFamily: HEAVY },

  toolsCard: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 18, paddingHorizontal: 8, rowGap: 18 },
  toolCell: { width: '25%', alignItems: 'center', gap: 7 },
  toolCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  toolLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center', fontFamily: SEMI },

  membersCol: { gap: 14, marginTop: 16 },
  memberCard: {
    borderRadius: 24, paddingVertical: 18, paddingHorizontal: 12, borderWidth: 1.2, alignItems: 'center', gap: 10,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 6,
  },
  memberCrown: { width: 116, height: 116 },
  memberBody: { alignSelf: 'stretch', minWidth: 0, gap: 7, alignItems: 'center' },
  memberTitle: { fontSize: 18, fontWeight: '900', fontFamily: DISPLAY, textAlign: 'center' },
  memberPerk: { fontSize: 11.5, color: 'rgba(255,255,255,0.72)', lineHeight: 16, minHeight: 32, textAlign: 'center' },
  memberCta: {
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 99, marginTop: 4,
  },
  memberCtaText: { fontSize: 13.5, fontWeight: '900', color: '#fff', fontFamily: HEAVY },

  menuRow: { alignItems: 'center', gap: 12, paddingVertical: 14 },
  menuBorder: { borderBottomWidth: 1 },
  menuIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 14.5, fontWeight: '600', fontFamily: SEMI },
  newBadge: { backgroundColor: '#FF3340', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, marginEnd: 4 },
  newBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', fontFamily: HEAVY },
});
