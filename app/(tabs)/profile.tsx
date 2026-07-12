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
  Settings, Share2, Pencil, BadgeCheck, Crown, Copy,
  Users, Heart, Eye, Gift, Trophy, ShoppingBag, Wallet, Gamepad2, Headphones,
  User, Award, Briefcase, MessageCircle, Ban, Lock, ShieldCheck,
} from 'lucide-react-native';
import { ArrowRight } from '@/components/ui/RtlIcons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

import { lu } from '@/theme/lu-brand';
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
import { ProfileVipStatusCard } from '@/components/profile/ProfileVipStatusCard';
import { ProfileBadgesRow } from '@/components/profile/ProfileBadgesRow';
import { FramedAvatar, getFramedAvatarContainerSize } from '@/components/ui/FramedAvatar';
import { useEquippedFrameUrl } from '@/hooks/useEquippedFrameUrl';
import { reconcileSocialCounts, subscribeToSocialCounts } from '@/services/firebase/follow';
import { reconcileVisitorCount, subscribeToProfileVisitorCount } from '@/services/firebase/profileVisitors';
import { reconcileUserBalances } from '@/utils/userBalance';
import { COIN_CURRENCY_ICON } from '@/constants/brandAssets';
import { subscribeToMyRoomStats } from '@/services/roomFeatures';

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
    { Icon: Crown, tint: 'rgba(239, 70, 70, 0.08)', color: '#FF3340', label: 'VIP', route: '/vip' },
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
    { Icon: Lock, label: t('settings.privacy'), route: '/settings/privacy' },
  );

  return (
    <LinearGradient colors={['#FAF5F5', '#FFFFFF', '#F5F5F7']} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      >
        {/* Cover */}
        <LinearGradient
          colors={['#FF2D2D', '#B00E0E', '#3A0A0A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cover, { paddingTop: insets.top + 8 }]}
        >
          <View style={styles.coverOrbA} />
          <View style={styles.coverOrbB} />
          <Heart
            size={78}
            color="rgba(255,255,255,0.16)"
            fill="rgba(255,255,255,0.16)"
            style={[styles.coverHeart, isRtl ? { left: undefined, right: 22 } : undefined]}
          />

          <View style={[styles.coverTop, { flexDirection: ROW, paddingHorizontal: pad }]}>
            <GlassBtn onPress={() => go('/settings')}>
              <Settings size={19} color="#fff" />
            </GlassBtn>
            <View style={{ flexDirection: ROW, gap: 9 }}>
              {/* كان زرّاً ميّتاً بلا أي فعل */}
              <GlassBtn
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
                <Share2 size={18} color="#fff" />
              </GlassBtn>
              <GlassBtn onPress={() => go('/profile/edit')}>
                <Pencil size={18} color="#fff" />
              </GlassBtn>
            </View>
          </View>
        </LinearGradient>

        {/* Identity */}
        <View style={styles.identity}>
          <Pressable
            onPress={() => uid && go(`/profile/${uid}`)}
            style={[
              styles.avatarWrap,
              equippedFrameUrl && { width: frameBox, height: frameBox },
            ]}
          >
            {equippedFrameUrl ? (
              <FramedAvatar
                avatarUri={avatar}
                frameUri={equippedFrameUrl}
                avatarSize={AVATAR_SIZE}
                fallbackLetter={name}
              />
            ) : (
              <LinearGradient
                colors={['#FFD86F', '#FF2D2D', '#B00E0E', '#7A0A0A', '#FFD86F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              >
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <View style={[styles.avatarImg, styles.avatarFallback]}>
                    <Text style={styles.avatarFallbackText}>{name.charAt(0)}</Text>
                  </View>
                )}
              </LinearGradient>
            )}
            {/* النقطة الخضراء تختفي عند تفعيل «إخفاء حالة الاتصال» — حتى في ملفك */}
            {!((user as any)?.privacyHideOnline === true ||
              (user as any)?.privacySettings?.hideOnline === true) ? (
              <View
                style={[
                  styles.onlineDot,
                  equippedFrameUrl && styles.onlineDotFramed,
                  isRtl && !equippedFrameUrl ? { right: undefined, left: 6 } : undefined,
                  isRtl && equippedFrameUrl ? { right: undefined, left: frameBox * 0.22 } : undefined,
                ]}
              />
            ) : null}
            <View style={[styles.crownBadge, equippedFrameUrl && styles.crownBadgeFramed]}>
              <Crown size={12} color="#FFD700" fill="#FFD700" />
            </View>
          </Pressable>

          <View style={[styles.nameRow, { flexDirection: ROW }]}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <BadgeCheck size={18} color="#E11414" fill="#FFE0E0" />
          </View>

          <Pressable style={[styles.idChip, { flexDirection: ROW }]} onPress={copyAccountId}>
            <Text style={styles.idText}>ID: {accountId}</Text>
            <Copy size={13} color="#9A9AA5" />
          </Pressable>

          <ProfileBadgesRow horizontalPad={0} style={styles.badgesRowWrap} />
        </View>

        {/* Stats */}
        <View style={[styles.card, styles.statsCard, { marginHorizontal: pad }]}>
          <View style={[styles.statsRow, { flexDirection: ROW }]}>
            {statItems.map((s, i) => (
              <Pressable key={i} style={styles.statCol} onPress={s.onPress}>
                <Text style={styles.statN} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {s.n}
                </Text>
                <View style={[styles.statLabelRow, { flexDirection: ROW }]}>
                  <s.Icon size={11} color={s.color} />
                  <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Wallet */}
        <View style={[styles.card, { marginHorizontal: pad, padding: 16 }]}>
          <View style={[styles.walletHead, { flexDirection: ROW }]}>
            <Text style={styles.walletTitle}>{t('profile.wallet')}</Text>
            <Pressable style={{ flexDirection: ROW, alignItems: 'center', gap: 3 }} onPress={() => go('/wallet')}>
              <Text style={styles.walletHistory}>{L('السجل', 'History')}</Text>
              <ArrowRight size={13} color="#9A9AA5" />
            </Pressable>
          </View>

          <View style={[styles.walletRow, { flexDirection: ROW }]}>
            <View style={styles.walletCol}>
              <View style={[styles.walletBalRow, { flexDirection: ROW }]}>
                <Image source={require('../../assets/masa.webp')} style={styles.coinImg} contentFit="contain" />
                <View style={{ flex: 1, alignItems: isRtl ? 'flex-end' : 'flex-start' }}>
                  <Text style={styles.walletVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
                    {formatExact(stats.pearls ?? 0)}
                  </Text>
                  <Text style={styles.walletLabel}>{t('profile.myPearls')}</Text>
                </View>
              </View>
              <Pressable style={[styles.btnOutline, { flexDirection: ROW }]} onPress={() => go('/wallet/exchange')}>
                {/* النص الإنجليزي أطول من العربي — تصغير تلقائي حتى لا يتجاوز حدود الزر */}
                <Text style={[styles.btnOutlineText, { flexShrink: 1 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {t('wallet.exchangeWithdraw')}
                </Text>
                <ArrowRight size={13} color="#E11414" />
              </Pressable>
            </View>

            <View style={styles.walletDivider} />

            <View style={styles.walletCol}>
              <View style={[styles.walletBalRow, { flexDirection: ROW }]}>
                <Image source={COIN_CURRENCY_ICON} style={styles.coinImg} contentFit="contain" />
                <View style={{ flex: 1, alignItems: isRtl ? 'flex-end' : 'flex-start' }}>
                  {/* الرقم الدقيق — التقريب المضغوط (4.7M) كان يوحي برصيد مختلف عن شاشة الشحن */}
                  <Text style={styles.walletVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
                    {formatExact(stats.coins ?? 0)}
                  </Text>
                  <Text style={styles.walletLabel}>{t('profile.myCoins')}</Text>
                </View>
              </View>
              <Pressable onPress={() => go('/wallet/recharge')} style={styles.btnGoldWrap}>
                <LinearGradient colors={['#FBBF24', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.btnGold, { flexDirection: ROW }]}>
                  <Text style={[styles.btnGoldText, { flexShrink: 1 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>+ {L('شحن', 'Recharge')}</Text>
                  <ArrowRight size={13} color="#fff" />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Tools grid */}
        <View style={[styles.card, styles.toolsCard, { marginHorizontal: pad }]}>
          {tools.map((tool, i) => (
            <Pressable key={i} style={styles.toolCell} onPress={() => go(tool.route)}>
              <View style={[styles.toolCircle, { backgroundColor: tool.tint }]}>
                <tool.Icon size={20} color={tool.color} />
              </View>
              <Text style={styles.toolLabel}>{tool.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* SVIP status card */}
        <ProfileVipStatusCard horizontalPad={pad} />

        {/* Memberships */}
        <View style={[styles.membersRow, { flexDirection: ROW, marginHorizontal: pad }]}>
          <LinearGradient colors={['#3A0A0A', '#1A0A0C']} style={[styles.memberCard, { borderColor: '#F26161' }]}>
            <View style={[styles.memberIcon, { backgroundColor: 'rgba(253,224,71,0.15)', borderColor: '#FDE047' }]}>
              <Crown size={22} color="#FEF08A" fill="#FEF08A" />
            </View>
            <Text style={[styles.memberTitle, { color: '#FDE047' }]}>SUPER VIP</Text>
            <Text style={styles.memberPerk}>{L('شارات حصرية ومكافآت كبرى', 'Exclusive badges & rewards')}</Text>
            <Pressable onPress={() => go('/vip')}>
              <LinearGradient colors={['#FDE047', '#EAB308']} style={styles.memberCta}>
                <Text style={[styles.memberCtaText, { color: '#422006' }]}>{L('ترقية', 'Upgrade')}</Text>
              </LinearGradient>
            </Pressable>
          </LinearGradient>

          <LinearGradient colors={['#9A1414', '#1A0A0C']} style={[styles.memberCard, { borderColor: '#F26161' }]}>
            <View style={[styles.memberIcon, { backgroundColor: 'rgba(255,140,140,0.15)', borderColor: '#F26161' }]}>
              <Crown size={22} color="#FCA5A5" fill="#FCA5A5" />
            </View>
            <Text style={[styles.memberTitle, { color: '#F26161' }]}>{t('profile.aristocracy')}</Text>
            <Text style={styles.memberPerk}>{L('امتيازات النبلاء وعائدات مجمدة', 'Noble privileges & frozen returns')}</Text>
            <Pressable onPress={() => go('/vip/aristocracy')}>
              <LinearGradient colors={['#FFE0E0', '#F26161']} style={styles.memberCta}>
                <Text style={[styles.memberCtaText, { color: '#9A1414' }]}>{L('انضم', 'Join')}</Text>
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </View>

        {/* Menu */}
        <View style={[styles.card, { marginHorizontal: pad, paddingHorizontal: 16, paddingVertical: 4 }]}>
          {menu.map((m, i) => (
            <Pressable
              key={i}
              onPress={() => go(m.route)}
              style={[
                styles.menuRow,
                { flexDirection: ROW },
                i < menu.length - 1 && styles.menuBorder,
              ]}
            >
              <View style={styles.menuIcon}>
                <m.Icon size={18} color="#E11414" />
              </View>
              <Text style={[styles.menuLabel, { textAlign: isRtl ? 'right' : 'left' }]}>{m.label}</Text>
              {m.isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>{t('profile.newBadge')}</Text>
                </View>
              )}
              <ArrowRight size={16} color="#9A9AA5" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function GlassBtn({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.glassBtn, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  cover: { height: 122, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  coverOrbA: { position: 'absolute', top: -34, right: -24, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.12)' },
  coverOrbB: { position: 'absolute', bottom: -54, left: -24, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.1)' },
  coverHeart: { position: 'absolute', top: 14, left: 22 },
  coverTop: { alignItems: 'center', justifyContent: 'space-between' },
  glassBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center', justifyContent: 'center',
  },

  identity: { alignItems: 'center', paddingHorizontal: 20, marginTop: -52 },
  avatarWrap: { position: 'relative' },
  avatarRing: { width: 104, height: 104, borderRadius: 52, padding: 3.5, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%', borderRadius: 50, borderWidth: 3, borderColor: '#fff' },
  avatarFallback: { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { fontSize: 32, fontWeight: '900', color: '#E11414', fontFamily: DISPLAY },
  onlineDot: { position: 'absolute', bottom: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: '#10B981', borderWidth: 2.5, borderColor: '#fff' },
  onlineDotFramed: { bottom: 14, right: 14 },
  crownBadge: {
    position: 'absolute', bottom: -7, alignSelf: 'center',
    backgroundColor: '#1A0A0C', paddingHorizontal: 9, paddingVertical: 2,
    borderRadius: 10, borderWidth: 1, borderColor: '#FFD700',
  },
  crownBadgeFramed: { bottom: 2 },

  nameRow: { alignItems: 'center', gap: 6, marginTop: 13 },
  name: { fontSize: 22, fontWeight: '900', color: '#15151A', fontFamily: DISPLAY },
  idChip: { alignItems: 'center', gap: 6, marginTop: 7, backgroundColor: '#F6ECEC', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9 },
  idText: { fontSize: 12, color: '#9A9AA5', fontWeight: '600', fontFamily: SEMI },

  badgesRowWrap: { paddingVertical: 4, alignSelf: 'stretch' },

  card: {
    backgroundColor: '#fff', borderRadius: 24, marginTop: 16,
    shadowColor: '#9A1414', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 22, elevation: 3,
  },
  statCol: { flex: 1, alignItems: 'center', gap: 3, minWidth: 0 },
  statsCard: { paddingVertical: 12, paddingHorizontal: 4 },
  statsRow: { alignItems: 'stretch', justifyContent: 'space-between' },
  statN: { fontSize: 16, fontWeight: '900', color: '#15151A', fontFamily: DISPLAY, maxWidth: '100%' },
  statLabelRow: { alignItems: 'center', gap: 2, maxWidth: '100%' },
  statLabel: { fontSize: 9.5, color: '#5E5E68', fontWeight: '600', fontFamily: SEMI, flexShrink: 1 },

  walletHead: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  walletTitle: { fontSize: 16, fontWeight: '800', color: '#15151A', fontFamily: HEAVY },
  walletHistory: { fontSize: 12.5, color: '#9A9AA5', fontWeight: '600', fontFamily: SEMI },
  walletRow: { alignItems: 'stretch' },
  walletCol: { flex: 1, alignItems: 'center', gap: 12 },
  walletDivider: { width: 1, backgroundColor: '#EEE', marginHorizontal: 8 },
  walletBalRow: { alignItems: 'center', gap: 10, width: '100%', paddingHorizontal: 4 },
  coinImg: { width: 44, height: 44 },
  walletVal: { fontSize: 18, fontWeight: '800', color: '#15151A', fontFamily: DISPLAY, maxWidth: '100%' },
  walletLabel: { fontSize: 11, color: '#9A9AA5', fontFamily: BODY },
  btnOutline: { width: '90%', height: 38, borderRadius: 12, borderWidth: 1, borderColor: '#F0BABA', backgroundColor: 'rgba(225,20,20,0.08)', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  btnOutlineText: { color: '#E11414', fontSize: 12.5, fontWeight: '800', fontFamily: HEAVY },
  btnGoldWrap: { width: '90%', height: 38, borderRadius: 12, overflow: 'hidden', shadowColor: '#F59E0B', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  btnGold: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  btnGoldText: { color: '#fff', fontSize: 12.5, fontWeight: '800', fontFamily: HEAVY },

  toolsCard: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 16, paddingHorizontal: 8 },
  toolCell: { width: '25%', alignItems: 'center', gap: 7, marginBottom: 14 },
  toolCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { fontSize: 11, fontWeight: '600', color: '#5E5E68', textAlign: 'center', fontFamily: SEMI },

  membersRow: { gap: 12, marginTop: 4 },
  memberCard: { flex: 1, borderRadius: 20, padding: 15, borderWidth: 1, gap: 10 },
  memberIcon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  memberTitle: { fontSize: 15, fontWeight: '900', fontFamily: DISPLAY },
  memberPerk: { fontSize: 10.5, color: '#FEE2E2', lineHeight: 15 },
  memberCta: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99 },
  memberCtaText: { fontSize: 11, fontWeight: '900', fontFamily: HEAVY },

  menuRow: { alignItems: 'center', gap: 12, paddingVertical: 14 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: '#F1E7E7' },
  menuIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(225,20,20,0.08)', alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 14.5, fontWeight: '600', color: '#15151A', fontFamily: SEMI },
  newBadge: { backgroundColor: '#FF3340', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, marginEnd: 4 },
  newBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', fontFamily: HEAVY },
});
