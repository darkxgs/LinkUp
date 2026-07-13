/**
 * Feed (اللحظات) — تصميم LinkUp الجديد (عصري) + ثنائي الاتجاه (RTL/LTR) + ريسبونس
 * يحافظ على كل الوظائف والخدمات والأيقونات الأصلية.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, Pressable, FlatList, RefreshControl,
  ActivityIndicator, useWindowDimensions, Alert, ScrollView, I18nManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { IMG } from '@/utils/imageConfig';
import i18n from '@/localization/i18n';

import {
  LuNotificationIcon, LuCompassIcon, LuLikeIcon, LuCommentIcon, LuShareIcon,
  LuGiftIcon, LuEditIcon, LuSparkleIcon, LuCrownIcon, LuMoonIcon, LuGemIcon,
  LuMoreIcon, LuUserIcon, LuFileAttachIcon, LuSearchIcon,
} from '@/components/icons/LuDesignIcons';
import { TabScreenHeader, HeaderIconButton, useTabHeaderMetrics } from '@/components/layout/TabScreenHeader';
import { RealCountryFlag } from '@/components/ui/RealCountryFlag';
import { lu } from '@/theme/lu-brand';
import { useThemeMode } from '@/stores/themeStore';
import type { HotTopicIcon } from '@/services/firebase/posts';
import { useAuth } from '@/hooks/useAuth';
import {
  subscribeToFeedPosts, toggleLike, deletePost, getLikedPostIds,
  HOT_TOPICS, type Post, type FeedTab,
} from '@/services/firebase/posts';
import { toggleFollow, getFollowing } from '@/services/firebase/follow';
import { PostShareSheet } from '@/components/post/PostShareSheet';
import { prefetchPostShareMessage, type PostShareInput } from '@/utils/postShare';
import { PostGiftPickerModal } from '@/components/post/PostGiftPickerModal';
import { PostOptionsModal } from '@/components/post/PostOptionsModal';
import { getPostReportPath } from '@/services/firebase/reports';
import { FramedAvatar } from '@/components/ui/FramedAvatar';
import { subscribeToRoomFrames, type RoomFrame } from '@/services/firebase/roomDecor';
import { fetchEquippedFrameUrlsForUsers } from '@/services/firebase/userFrames';

const CARD_AVATAR_SIZE = 40;

/* ── اتجاه ثنائي اللغة ── */
const IS_RTL = I18nManager.isRTL;
const ROW = 'row';
const START = IS_RTL ? 'right' : 'left';
const WD = IS_RTL ? 'rtl' : 'ltr';
const END_SIDE = IS_RTL ? 'left' : 'right'; // للعناصر المطلقة (FAB)

const PAGE_BG = '#F7F7F9';
const INK = '#15151A';

const TAB_MAP: { labelKey: string; key: FeedTab; icon: 'discover' | 'follow' }[] = [
  { labelKey: 'feed.tabExplore', key: 'explore', icon: 'discover' },
  { labelKey: 'feed.tabFollowing', key: 'following', icon: 'follow' },
];

const FALLBACK_GRADS: ReadonlyArray<readonly [string, string]> = [
  ['#F0A0A0', '#FBD5D5'], ['#FFB199', '#FF7A8A'], ['#E36A6A', '#B00E0E'],
  ['#FF5C7A', '#E02B2B'], ['#FFD86F', '#FF9A2E'], ['#2BD9A8', '#22C58A'],
];
function gradFor(uid: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return FALLBACK_GRADS[h % FALLBACK_GRADS.length]!;
}
const TOPIC_GRADS: Record<HotTopicIcon, readonly [string, string]> = {
  crown: ['#FF5C5C', '#B00E0E'], moon: ['#E11414', '#8A0E0E'], gem: ['#FF3340', '#C40E1E'],
};

const SEP = () => <View style={{ height: 13 }} />;

function TopicIcon({ name, size = 24 }: { name: HotTopicIcon; size?: number }) {
  if (name === 'moon') return <LuMoonIcon size={size} color="#fff" filled />;
  if (name === 'gem') return <LuGemIcon size={size} color="#fff" filled />;
  return <LuCrownIcon size={size} color="#fff" filled />;
}
function TabIcon({ name, color }: { name: 'discover' | 'follow'; color: string }) {
  return name === 'discover'
    ? <LuCompassIcon size={16} color={color} />
    : <LuSparkleIcon size={15} color={color} filled />;
}

export default function FeedScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { isDark } = useThemeMode();
  const { user: currentUser } = useAuth();
  const isSmall = W < 360;
  const padX = isSmall ? 14 : 16;
  const topicW = Math.min(250, Math.round(W * 0.66)); // ريسبونس: عرض بطاقة الموضوع نسبة للشاشة

  const [tab, setTab] = useState<FeedTab>('explore');
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingUids, setFollowingUids] = useState<Set<string>>(new Set());
  const [giftTarget, setGiftTarget] = useState<Post | null>(null);
  const [shareTarget, setShareTarget] = useState<PostShareInput | null>(null);
  const [roomFrames, setRoomFrames] = useState<RoomFrame[]>([]);
  const [frameByUid, setFrameByUid] = useState<Record<string, string>>({});

  const openComposer = () => router.push('/post/create' as any);

  useEffect(() => {
    return subscribeToRoomFrames(setRoomFrames);
  }, []);

  const postAuthorUidsKey = useMemo(
    () => [...new Set(posts.map((p) => p.uid).filter(Boolean))].sort().join(','),
    [posts],
  );

  useEffect(() => {
    const uids = postAuthorUidsKey ? postAuthorUidsKey.split(',') : [];
    if (!uids.length || !roomFrames.length) {
      setFrameByUid({});
      return;
    }
    let cancelled = false;
    fetchEquippedFrameUrlsForUsers(uids, roomFrames).then((map) => {
      if (!cancelled) setFrameByUid(map);
    });
    return () => { cancelled = true; };
  }, [postAuthorUidsKey, roomFrames]);

  useEffect(() => {
    if (!currentUser?.uid) { setFollowingUids(new Set()); return; }
    getFollowing(currentUser.uid).then((uids) => setFollowingUids(new Set(uids)));
  }, [currentUser?.uid]);

  const followingSet = useMemo(() => (tab === 'following' ? followingUids : null), [tab, followingUids]);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToFeedPosts(tab, followingSet, (data) => {
      setPosts(data); setLoading(false); setRefreshing(false);
    });
    return unsub;
  }, [tab, followingSet]);

  // نجلب حالة الإعجاب للمنشورات الجديدة فقط (التي لم نفحصها سابقاً) بدل إعادة جلب الكل
  // عند كل تحديث للقائمة — يقلّل طلبات Firestore بشكل كبير عند ورود منشورات حيّة.
  const checkedLikeIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentUser || posts.length === 0) { setLikedIds(new Set()); checkedLikeIds.current = new Set(); return; }
    const fresh = posts.map((p) => p.id).filter((id) => !checkedLikeIds.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => checkedLikeIds.current.add(id));
    getLikedPostIds(fresh).then((liked) => {
      setLikedIds((prev) => { const n = new Set(prev); liked.forEach((id) => n.add(id)); return n; });
    });
  }, [posts, currentUser?.uid]);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setRefreshing(false), 600);
  }, []);

  const handleLikeChange = useCallback((id: string, isLiked: boolean) => {
    setLikedIds((prev) => { const n = new Set(prev); isLiked ? n.add(id) : n.delete(id); return n; });
  }, []);
  const handleFollowChange = useCallback((uid: string, isFollowing: boolean) => {
    setFollowingUids((prev) => { const n = new Set(prev); isFollowing ? n.add(uid) : n.delete(uid); return n; });
  }, []);
  const handleShareCount = useCallback((postId: string) => {
    setPosts((arr) => arr.map((p) => (p.id === postId ? { ...p, shares: (p.shares ?? 0) + 1 } : p)));
  }, []);
  const openShare = useCallback((target: PostShareInput) => {
    void prefetchPostShareMessage(target);
    setShareTarget(target);
  }, []);
  const handleDeletedPost = useCallback((id: string) => setPosts((arr) => arr.filter((p) => p.id !== id)), []);
  const openProfile = useCallback((uid: string) => router.push(`/profile/${uid}` as any), [router]);
  const openComments = useCallback((postId: string) => router.push(`/post/${postId}` as any), [router]);
  const openEdit = useCallback((postId: string) => router.push(`/post/edit/${postId}` as any), [router]);
  const handlePressGift = useCallback((post: Post) => {
    if (!currentUser) return;
    if (post.uid === currentUser.uid) { Alert.alert(t('common.error'), t('feed.cannotGiftSelf')); return; }
    setGiftTarget(post);
  }, [currentUser, t]);

  const tabLabel = t(TAB_MAP.find((mt) => mt.key === tab)?.labelKey ?? '');
  const headerMetrics = useTabHeaderMetrics(W);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? lu.colors.night0 : '#FBEAEA' }]}>
      <LinearGradient
        colors={
          (isDark
            ? [...lu.gradients.pageHomeNight]
            : ['#FBEAEA', '#FBF1F1', '#F8F6F7']) as [string, string, ...string[]]
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: insets.bottom + 172 }}
        ItemSeparatorComponent={SEP}
        initialNumToRender={5}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        updateCellsBatchingPeriod={50}
        extraData={frameByUid}
        renderItem={({ item }) => (
          <PostCard
            post={item} currentUid={currentUser?.uid} dark={isDark}
            liked={likedIds.has(item.id)} following={followingUids.has(item.uid)}
            padX={padX} frameUri={frameByUid[item.uid]}
            onLikeChange={handleLikeChange} onFollowChange={handleFollowChange}
            onPressUser={openProfile} onPressComments={openComments} onPressGift={handlePressGift}
            onPressShare={openShare} onPressEdit={openEdit} onDeleted={handleDeletedPost}
          />
        )}
        ListHeaderComponent={
          <View>
            <TabScreenHeader dark={isDark} pad={padX}>
              <HeaderIconButton dark={isDark} onPress={() => router.push('/search' as any)}>
                <LuSearchIcon size={headerMetrics.iconSize} color={isDark ? '#fff' : lu.colors.ink} />
              </HeaderIconButton>
              <HeaderIconButton dark={isDark} onPress={() => router.push('/notifications' as any)} badge>
                <LuNotificationIcon size={headerMetrics.iconSize} color={isDark ? '#fff' : lu.colors.ink} />
              </HeaderIconButton>
            </TabScreenHeader>

            {/* تبويبات على شكل أقراص */}
            <View style={[styles.tabsRow, { paddingHorizontal: padX }]}>
              {TAB_MAP.map(({ labelKey, key, icon }) => {
                const active = tab === key;
                // قرص زجاجي بإطار أحمر متوهج للنشط — نفس لغة صفحة المطابقة في الوضعين.
                const iconColor = active ? '#fff' : isDark ? 'rgba(255,255,255,0.6)' : '#8A8F98';
                return (
                  <Pressable
                    key={key}
                    onPress={() => setTab(key)}
                    style={[
                      styles.tabPill,
                      isDark
                        ? active ? styles.tabPillDarkActive : styles.tabPillDark
                        : active ? styles.tabPillLightActive : styles.tabPillLight,
                    ]}
                  >
                    {active ? (
                      <LinearGradient colors={['#FF4D66', '#C40E2E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tabIconCircle}>
                        <TabIcon name={icon} color={iconColor} />
                      </LinearGradient>
                    ) : (
                      <View style={[styles.tabIconCircle, isDark ? styles.tabIconCircleDark : styles.tabIconCircleLight]}>
                        <TabIcon name={icon} color={iconColor} />
                      </View>
                    )}
                    <Text
                      style={[
                        active ? styles.tabPillTextDarkActive : styles.tabPillTextDark,
                        !isDark && { color: active ? '#E11414' : '#6B7280' },
                      ]}
                    >
                      {t(labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* المواضيع الساخنة */}
            {tab === 'explore' && (
              <>
                <View style={[styles.sectionHead, { paddingHorizontal: padX }]}>
                  <Text style={[styles.sectionTitle, isDark && { color: lu.colors.nightInk }]}>{t('feed.topics')}</Text>
                  <Pressable onPress={() => router.push('/search' as any)} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                    <Text style={[styles.viewAll, isDark && { color: '#FF5C6C' }]}>{t('common.viewAll')}</Text>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.topicsScroll, { paddingHorizontal: padX }]}>
                  {HOT_TOPICS.map((tp) => (
                    <Pressable
                      key={tp.id}
                      style={({ pressed }) => [styles.topicCard, isDark ? styles.topicCardDark : styles.topicCardLight, { width: topicW }, pressed && { opacity: 0.75 }]}
                      onPress={() => router.push('/(tabs)/home' as any)}
                    >
                      {tp.image ? (
                        <Image source={typeof tp.image === 'number' ? tp.image : { uri: tp.image }} style={styles.topicThumb} contentFit="cover" />
                      ) : (
                        <LinearGradient colors={TOPIC_GRADS[tp.icon]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.topicThumb}>
                          <TopicIcon name={tp.icon} />
                        </LinearGradient>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.topicTitle, isDark && { color: lu.colors.nightInk }]} numberOfLines={1}>{tp.title}</Text>
                        <Text style={[styles.topicMembers, isDark && { color: lu.colors.nightMuted }]}>{tp.members}</Text>
                        <View style={[styles.topicHotRow, { flexDirection: ROW }]}>
                          <Image source={require('../../assets/images/hot_flame.png')} style={styles.topicHotIcon} contentFit="contain" />
                          <Text style={styles.topicHot}>{t('feed.hotTag')}</Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            {tab === 'following' && !loading && posts.length === 0 && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}><LuUserIcon size={30} color={isDark ? '#FF5C6C' : lu.colors.purple} /></View>
                <Text style={[styles.emptyText, isDark && { color: lu.colors.nightInk2 }]}>{t('feed.noFollowingPosts')}</Text>
                <Text style={[styles.emptySubtitle, isDark && { color: lu.colors.nightMuted }]}>{t('feed.noFollowingPostsDesc')}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}><ActivityIndicator size="large" color={lu.colors.pink} /></View>
          ) : tab !== 'following' ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}><LuFileAttachIcon size={30} color={isDark ? '#FF5C6C' : lu.colors.purple} /></View>
              <Text style={[styles.emptyText, isDark && { color: lu.colors.nightInk2 }]}>{t('feed.noPostsInTab', { tab: tabLabel })}</Text>
              <Pressable onPress={openComposer}>
                <Text style={[styles.emptySubtitle, { color: isDark ? '#FF5C6C' : lu.colors.purple, fontWeight: '800' }]}>{t('feed.createFirstPost')}</Text>
              </Pressable>
            </View>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lu.colors.pink} colors={[lu.colors.pink]} />}
      />

      {/* زر إنشاء منشور عائم — على الجهة النهائية حسب الاتجاه */}
      <Pressable onPress={openComposer} style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 96, [END_SIDE]: 18, opacity: pressed ? 0.85 : 1 }]}>
        <LinearGradient
          colors={['#FF4D5E', '#C40E2E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fabInner, isDark && styles.fabInnerDark]}
        >
          <LuEditIcon size={22} color="#fff" />
        </LinearGradient>
      </Pressable>

      {giftTarget ? (
        <PostGiftPickerModal
          visible
          postId={giftTarget.id}
          authorUid={giftTarget.uid}
          authorName={giftTarget.authorName}
          authorAvatar={giftTarget.authorAvatar}
          authorGender={giftTarget.authorGender}
          onClose={() => setGiftTarget(null)}
          onSent={() => {
            // #8: لا زيادة محلية — subscribeToFeedPosts (onSnapshot) هو مصدر الحقيقة الوحيد
            // للعدّاد ويحدّثه تلقائياً. الزيادة المحلية فوق قيمة الاشتراك الحيّ كانت
            // تُظهر الهدية الواحدة هديتين عند المُرسِل بينما يرى المستلم واحدة فقط.
            setGiftTarget(null);
          }}
        />
      ) : null}

      <PostShareSheet visible={!!shareTarget} onClose={() => setShareTarget(null)} post={shareTarget} onShared={handleShareCount} />
    </View>
  );
}

const PostCard = memo(function PostCard({
  post, currentUid, dark, liked: likedProp, following: followingProp, padX, frameUri,
  onLikeChange, onFollowChange, onPressUser, onPressComments, onPressGift, onPressEdit, onPressShare, onDeleted,
}: {
  post: Post; currentUid?: string; dark: boolean; liked: boolean; following: boolean; padX: number; frameUri?: string;
  onLikeChange: (id: string, liked: boolean) => void;
  onFollowChange: (uid: string, following: boolean) => void;
  onPressUser: (uid: string) => void;
  onPressComments: (id: string) => void;
  onPressGift: (post: Post) => void;
  onPressEdit: (id: string) => void;
  onPressShare: (post: PostShareInput) => void;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const grad = gradFor(post.uid);
  const initial = (post.authorName ?? '?').trim().charAt(0) || '★';
  const isOwner = currentUid === post.uid;

  const [liked, setLiked] = useState(likedProp);
  const [likes, setLikes] = useState(post.likes ?? 0);
  const [shares, setShares] = useState(post.shares ?? 0);
  const [gifts, setGifts] = useState(post.gifts ?? 0);
  const following = followingProp;
  const [busy, setBusy] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { setLiked(likedProp); }, [likedProp]);
  useEffect(() => { setLikes(post.likes ?? 0); }, [post.id, post.likes]);
  useEffect(() => { setShares(post.shares ?? 0); }, [post.shares]);
  useEffect(() => { setGifts(post.gifts ?? 0); }, [post.gifts]);

  const handleLike = async () => {
    if (busy || !currentUid) return;
    setBusy(true);
    const next = !liked;
    setLiked(next); setLikes((n) => n + (next ? 1 : -1)); onLikeChange(post.id, next);
    try { const real = await toggleLike(post.id); setLiked(real); onLikeChange(post.id, real); }
    catch { setLiked(!next); setLikes((n) => n + (next ? -1 : 1)); onLikeChange(post.id, !next); }
    finally { setBusy(false); }
  };
  const handleFollow = async () => {
    if (!currentUid || isOwner) return;
    try { onFollowChange(post.uid, await toggleFollow(post.uid)); }
    catch (e: any) { Alert.alert(t('common.error'), e?.message ?? t('feed.followFailed')); }
  };
  const handleShare = () => onPressShare({ id: post.id, authorName: post.authorName, text: post.text });
  const handleDelete = async () => {
    setDeleting(true);
    try { await deletePost(post.id); setOptionsOpen(false); onDeleted(post.id); }
    catch (e: unknown) { Alert.alert(t('common.error'), e instanceof Error ? e.message : t('feed.deleteFailed')); }
    finally { setDeleting(false); }
  };

  const imgs = post.images ?? [];
  const extra = imgs.slice(1, 3);
  const moreCount = imgs.length - 1 - extra.length;

  // لون العناصر الخاملة في شريط التفاعل حسب السمة.
  const dim = dark ? 'rgba(255,255,255,0.55)' : '#5C5C64';

  return (
    <View style={[styles.card, dark ? styles.cardDark : styles.cardLight, { marginHorizontal: padX }]}>
      {/* رأس البطاقة */}
      <View style={styles.cardHeader}>
        <Pressable onPress={() => onPressUser(post.uid)} style={styles.authorRow}>
          {frameUri ? (
            <FramedAvatar
              avatarUri={post.authorAvatar}
              frameUri={frameUri}
              avatarSize={CARD_AVATAR_SIZE}
              fallbackLetter={initial}
            />
          ) : (
            <View style={styles.avatarRing}>
              <LinearGradient colors={grad} style={styles.cardAvatar}>
                {post.authorAvatar ? <Image source={{ uri: post.authorAvatar }} style={styles.cardAvatarImg} contentFit="cover" recyclingKey={post.authorAvatar} {...IMG} /> : <Text style={styles.cardAvatarLetter}>{initial}</Text>}
              </LinearGradient>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.cardNameRow}>
              <Text style={[styles.cardName, dark && { color: lu.colors.nightInk }]} numberOfLines={1}>{post.authorName || t('rooms.userFallback')}</Text>
              <LuLikeIcon size={14} color={lu.colors.pink} filled />
            </View>
            <View style={styles.cardMetaRow}>
              <RealCountryFlag countryCode={post.authorCountry || 'PS'} size={17} shape="circle" />
              {(post.authorGender || (post.authorAge ?? 0) > 0) ? (
                <View style={[styles.genderPill, dark && styles.genderPillDark]}>
                  <Text style={[styles.genderSym, { color: post.authorGender === 'male' ? lu.colors.blue : lu.colors.pink }]}>{post.authorGender === 'male' ? '♂' : '♀'}</Text>
                  {(post.authorAge ?? 0) > 0 && <Text style={[styles.genderAge, dark && { color: 'rgba(255,255,255,0.78)' }]}>{post.authorAge}</Text>}
                </View>
              ) : post.authorLevel > 0 ? (
                <View style={styles.cardLevel}><Text style={styles.cardLevelText}>LV {post.authorLevel}</Text></View>
              ) : null}
            </View>
          </View>
        </Pressable>

        {!isOwner && currentUid ? (
          <View style={styles.headerActions}>
            <Pressable onPress={handleFollow}>
              {following ? (
                <View style={[styles.followBtn, styles.followBtnActive, dark && styles.followBtnActiveDark]}>
                  <Text style={[styles.followBtnTextActive, dark && { color: 'rgba(255,255,255,0.6)' }]}>{t('common.following')}</Text>
                </View>
              ) : (
                <View style={[styles.followBtn, dark ? styles.followBtnDark : styles.followBtnLight]}>
                  <Text style={[styles.followBtnText, !dark && { color: '#C40E1E' }]}>{t('common.follow')}</Text>
                </View>
              )}
            </Pressable>
            <Pressable onPress={() => setOptionsOpen(true)} style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.5 : 1 }]}><LuMoreIcon size={20} color={dark ? 'rgba(255,255,255,0.6)' : lu.colors.muted} /></Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setOptionsOpen(true)} style={({ pressed }) => [{ padding: 4, opacity: pressed ? 0.5 : 1 }]}><LuMoreIcon size={20} color={dark ? 'rgba(255,255,255,0.6)' : lu.colors.muted} /></Pressable>
        )}
      </View>

      {/* نص المنشور يفتح التفاصيل — كما تفعل الصورة وأيقونة التعليقات */}
      {!!post.text && (
        <Pressable onPress={() => onPressComments(post.id)}>
          <Text style={[styles.cardText, dark && { color: 'rgba(255,255,255,0.88)' }]}>{post.text}</Text>
        </Pressable>
      )}

      {post.hashtags && post.hashtags.length > 0 && (
        <View style={styles.tagsRow}>{post.hashtags.map((tag) => <Text key={tag} style={[styles.hashtag, dark && styles.hashtagDark]}>#{tag}</Text>)}</View>
      )}

      {imgs.length > 0 && (
        <Pressable onPress={() => onPressComments(post.id)} style={styles.imageWrap}>
          <Image source={{ uri: imgs[0] }} style={styles.postImage} contentFit="cover" recyclingKey={imgs[0]} {...IMG} />
          {(extra.length > 0 || moreCount > 0) && (
            <View style={styles.imageStack}>
              {extra.map((url, i) => <Image key={i} source={{ uri: url }} style={styles.stackAvatar} contentFit="cover" recyclingKey={url} {...IMG} />)}
              {moreCount > 0 && <View style={[styles.stackAvatar, styles.stackMore]}><Text style={styles.stackMoreText}>+{moreCount}</Text></View>}
            </View>
          )}
        </Pressable>
      )}

      {/* شريط التفاعل */}
      <View style={[styles.actionsRow, dark && { borderTopColor: 'rgba(255,255,255,0.08)' }]}>
        <Pressable onPress={handleLike} disabled={busy} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
          <LuLikeIcon size={21} color={liked ? '#FF3340' : dim} filled={liked} />
          <Text style={[styles.actionText, { color: liked ? '#FF3340' : dim }]}>{likes}</Text>
        </Pressable>
        <Pressable onPress={() => onPressComments(post.id)} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
          <LuCommentIcon size={21} color={post.comments > 0 ? '#ED4444' : dim} />
          <Text style={[styles.actionText, { color: post.comments > 0 ? '#ED4444' : dim }]}>{post.comments}</Text>
        </Pressable>
        <Pressable onPress={() => onPressGift(post)} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
          <LuGiftIcon size={21} color={gifts > 0 ? '#FFB000' : dim} filled={gifts > 0} />
          <Text style={[styles.actionText, { color: gifts > 0 ? '#FFB000' : dim }]}>{gifts}</Text>
        </Pressable>
        <Pressable onPress={handleShare} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
          <LuShareIcon size={21} color={shares > 0 ? '#10B981' : dim} />
          <Text style={[styles.actionText, { color: shares > 0 ? '#10B981' : dim }]}>{shares}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
      </View>

      <PostOptionsModal
        visible={optionsOpen} post={post} isOwner={isOwner} deleting={deleting}
        onClose={() => setOptionsOpen(false)} onEdit={() => onPressEdit(post.id)}
        onDelete={handleDelete} onReport={() => router.push(getPostReportPath(post.id, post.uid, 'feed') as any)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },

  tabsRow: { flexDirection: ROW, alignItems: 'center', gap: 10, paddingTop: 6, paddingBottom: 14 },
  tabPill: { flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 17, paddingVertical: 9, borderRadius: 99 },
  tabIconCircle: { width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  // أقراص التبويب — النمط الداكن.
  tabPillDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: lu.colors.nightLine },
  tabPillDarkActive: {
    backgroundColor: 'rgba(255,77,102,0.16)', borderWidth: 1.4, borderColor: '#FF3B55',
    shadowColor: '#FF1E30', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 12, elevation: 6,
  },
  tabIconCircleDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  // أقراص التبويب — النمط الفاتح.
  tabPillLight: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEE7E8', ...lu.shadows.card },
  tabPillLightActive: {
    backgroundColor: '#FFF7F7', borderWidth: 1.4, borderColor: 'rgba(225,20,20,0.55)',
    shadowColor: '#E11414', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 4,
  },
  tabIconCircleLight: { backgroundColor: '#F3EDEE' },
  tabPillTextDark: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.66)', fontFamily: lu.fonts.bodyBold, includeFontPadding: false },
  tabPillTextDarkActive: { fontSize: 15, fontWeight: '800', color: '#FF4D5E', fontFamily: lu.fonts.bodyHeavy, includeFontPadding: false },

  sectionHead: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', paddingTop: 2, paddingBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: INK, fontFamily: lu.fonts.bodyHeavy, textAlign: START, writingDirection: WD },
  viewAll: { fontSize: 12.5, fontWeight: '700', color: '#C0392B', fontFamily: lu.fonts.bodyBold },

  topicsScroll: { flexDirection: ROW, gap: 12, paddingBottom: 12 },
  topicCard: { flexDirection: ROW, alignItems: 'center', gap: 11, backgroundColor: '#fff', borderRadius: 18, padding: 10, ...lu.shadows.card },
  topicCardDark: {
    backgroundColor: lu.colors.nightCard, borderWidth: 1, borderColor: 'rgba(255,45,60,0.24)',
    shadowColor: '#FF1E30', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 5,
  },
  topicCardLight: {
    borderWidth: 1, borderColor: 'rgba(225,20,20,0.14)',
    shadowColor: '#9A1414', shadowOpacity: 0.12,
  },
  topicThumb: { width: 56, height: 56, borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  topicTitle: { fontSize: 14, fontWeight: '800', color: INK, textAlign: START, writingDirection: WD, fontFamily: lu.fonts.bodyHeavy, includeFontPadding: false },
  topicMembers: { fontSize: 11.5, color: lu.colors.muted, marginTop: 3, textAlign: START, includeFontPadding: false },
  topicHotRow: { alignItems: 'center', gap: 3.5, marginTop: 3.5 },
  topicHotIcon: { width: 13, height: 13 },
  topicHot: { fontSize: 10.5, fontWeight: '800', color: '#FF5C6C', textAlign: START, fontFamily: lu.fonts.bodyHeavy, includeFontPadding: false },

  card: { backgroundColor: '#fff', borderRadius: 22, padding: 15, ...lu.shadows.card },
  cardDark: {
    backgroundColor: lu.colors.nightCard, borderWidth: 1, borderColor: 'rgba(255,45,60,0.24)',
    shadowColor: '#FF1E30', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6,
  },
  cardLight: {
    borderWidth: 1, borderColor: 'rgba(225,20,20,0.14)',
    shadowColor: '#9A1414', shadowOpacity: 0.12,
  },
  cardHeader: { flexDirection: ROW, alignItems: 'center', gap: 10 },
  headerActions: { flexDirection: ROW, alignItems: 'center', gap: 4 },
  authorRow: { flex: 1, flexDirection: ROW, alignItems: 'center', gap: 10 },
  avatarRing: { width: 48, height: 48, borderRadius: 24, padding: 2, backgroundColor: lu.colors.purple, alignItems: 'center', justifyContent: 'center' },
  cardAvatar: { width: 100, height: 100, maxWidth: 44, maxHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cardAvatarImg: { ...StyleSheet.absoluteFillObject },
  cardAvatarLetter: { color: '#fff', fontSize: 17, fontWeight: '800', fontFamily: lu.fonts.bodyHeavy },
  cardNameRow: { flexDirection: ROW, alignItems: 'center', gap: 5 },
  cardName: { flexShrink: 1, fontSize: 15, lineHeight: 22, fontWeight: '800', color: INK, fontFamily: lu.fonts.bodyHeavy, textAlign: START, writingDirection: WD },
  cardMetaRow: { flexDirection: ROW, alignItems: 'center', gap: 7, marginTop: 5 },
  cardLevel: { backgroundColor: '#FCEDED', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  cardLevelText: { fontSize: 10, color: lu.colors.purple, fontWeight: '800', fontFamily: lu.fonts.bodyHeavy },
  genderPill: { flexDirection: ROW, alignItems: 'center', gap: 3, backgroundColor: lu.colors.card2, paddingHorizontal: 9, paddingVertical: 2.5, borderRadius: 99 },
  genderPillDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  genderSym: { fontSize: 13, fontWeight: '900' },
  genderAge: { fontSize: 12, fontWeight: '800', color: lu.colors.ink2, fontFamily: lu.fonts.bodyBold },

  followBtn: { minWidth: 76, paddingHorizontal: 14, paddingVertical: 7.5, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  followBtnDark: {
    backgroundColor: 'rgba(255,45,60,0.06)', borderWidth: 1.2, borderColor: 'rgba(255,95,115,0.85)',
    minWidth: 86, paddingVertical: 9,
    shadowColor: '#FF1E30', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 4,
  },
  followBtnLight: {
    backgroundColor: 'rgba(225,20,20,0.05)', borderWidth: 1.2, borderColor: 'rgba(225,20,20,0.45)',
    minWidth: 86, paddingVertical: 9,
  },
  followBtnActive: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: lu.colors.purple },
  followBtnActiveDark: { borderColor: 'rgba(255,255,255,0.28)' },
  followBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  followBtnTextActive: { fontSize: 12, fontWeight: '800', color: lu.colors.purple },

  cardText: { fontSize: 14.5, color: '#2A2A35', lineHeight: 24, marginTop: 11, fontFamily: lu.fonts.body, textAlign: START, writingDirection: WD },
  tagsRow: { flexDirection: ROW, flexWrap: 'wrap', gap: 8, marginTop: 9 },
  hashtag: { fontSize: 12, fontWeight: '700', color: lu.colors.purple, backgroundColor: 'rgba(225,20,20,0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9, writingDirection: WD },
  hashtagDark: { color: '#FF6B7A', backgroundColor: 'rgba(255,45,60,0.13)' },
  imageWrap: { marginTop: 11, borderRadius: 16, overflow: 'hidden' },
  postImage: { width: '100%', aspectRatio: 1.5, backgroundColor: lu.colors.line },
  imageStack: { position: 'absolute', bottom: 11, [START]: 11, flexDirection: ROW, alignItems: 'center' },
  stackAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff', marginStart: -12, backgroundColor: lu.colors.line, alignItems: 'center', justifyContent: 'center' },
  stackMore: { backgroundColor: 'rgba(20,10,12,0.78)' },
  stackMoreText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  actionsRow: { flexDirection: ROW, alignItems: 'center', marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#F1E7E7' },
  actionBtn: { flexDirection: ROW, alignItems: 'center', gap: 7, paddingVertical: 4, marginEnd: 22 },
  actionText: { fontSize: 14, fontWeight: '700', fontFamily: lu.fonts.bodyBold },

  fab: { position: 'absolute' },
  fabInner: {
    width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#E11414', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  fabInnerDark: { borderWidth: 1.4, borderColor: 'rgba(255,150,162,0.7)' },

  emptyState: { paddingVertical: 60, alignItems: 'center' },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(225,20,20,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyText: { fontSize: 15, color: lu.colors.ink2, fontWeight: '700', fontFamily: lu.fonts.bodyBold },
  emptySubtitle: { fontSize: 12.5, color: lu.colors.muted, marginTop: 4, textAlign: 'center', paddingHorizontal: 40, fontFamily: lu.fonts.body },
});
