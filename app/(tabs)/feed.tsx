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
function TabIcon({ name, active }: { name: 'discover' | 'follow'; active: boolean }) {
  const color = active ? lu.colors.purple : lu.colors.ink2;
  return name === 'discover'
    ? <LuCompassIcon size={16} color={color} />
    : <LuSparkleIcon size={15} color={color} filled />;
}

export default function FeedScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
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
  const headerSubtitle = i18n.language?.startsWith('ar') ? 'اللحظات · شارك يومك' : 'Moments · share your day';

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: insets.bottom + 110 }}
        ItemSeparatorComponent={SEP}
        initialNumToRender={5}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        updateCellsBatchingPeriod={50}
        extraData={frameByUid}
        renderItem={({ item }) => (
          <PostCard
            post={item} currentUid={currentUser?.uid}
            liked={likedIds.has(item.id)} following={followingUids.has(item.uid)}
            padX={padX} frameUri={frameByUid[item.uid]}
            onLikeChange={handleLikeChange} onFollowChange={handleFollowChange}
            onPressUser={openProfile} onPressComments={openComments} onPressGift={handlePressGift}
            onPressShare={openShare} onPressEdit={openEdit} onDeleted={handleDeletedPost}
          />
        )}
        ListHeaderComponent={
          <View>
            <TabScreenHeader pad={padX} subtitle={headerSubtitle}>
              <HeaderIconButton onPress={() => router.push('/search' as any)}>
                <LuSearchIcon size={headerMetrics.iconSize} color={lu.colors.ink} />
              </HeaderIconButton>
              <HeaderIconButton onPress={() => router.push('/notifications' as any)} badge>
                <LuNotificationIcon size={headerMetrics.iconSize} color={lu.colors.ink} />
              </HeaderIconButton>
            </TabScreenHeader>

            {/* تبويبات على شكل أقراص */}
            <View style={[styles.tabsRow, { paddingHorizontal: padX }]}>
              {TAB_MAP.map(({ labelKey, key, icon }) => {
                const active = tab === key;
                const inner = (
                  <>
                    <View style={[styles.tabIconCircle, active && styles.tabIconCircleActive]}>
                      <TabIcon name={icon} active={active} />
                    </View>
                    <Text style={active ? styles.tabPillTextActive : styles.tabPillText}>{t(labelKey)}</Text>
                  </>
                );
                return (
                  <Pressable key={key} onPress={() => setTab(key)}>
                    {active ? (
                      <LinearGradient colors={lu.gradients.purple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tabPill}>{inner}</LinearGradient>
                    ) : (
                      <View style={[styles.tabPill, styles.tabPillInactive]}>{inner}</View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* المواضيع الساخنة */}
            {tab === 'explore' && (
              <>
                <View style={[styles.sectionHead, { paddingHorizontal: padX }]}>
                  <Text style={styles.sectionTitle}>{t('feed.topics')}</Text>
                  <Pressable onPress={() => router.push('/search' as any)} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                    <Text style={styles.viewAll}>{t('common.viewAll')}</Text>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.topicsScroll, { paddingHorizontal: padX }]}>
                  {HOT_TOPICS.map((tp) => (
                    <View key={tp.id} style={[styles.topicCard, { width: topicW }]}>
                      {tp.image ? (
                        <Image source={typeof tp.image === 'number' ? tp.image : { uri: tp.image }} style={styles.topicThumb} contentFit="cover" />
                      ) : (
                        <LinearGradient colors={TOPIC_GRADS[tp.icon]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.topicThumb}>
                          <TopicIcon name={tp.icon} />
                        </LinearGradient>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.topicTitle} numberOfLines={1}>{tp.title}</Text>
                        <Text style={styles.topicMembers}>{tp.members}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            {tab === 'following' && !loading && posts.length === 0 && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}><LuUserIcon size={30} color={lu.colors.purple} /></View>
                <Text style={styles.emptyText}>{t('feed.noFollowingPosts')}</Text>
                <Text style={styles.emptySubtitle}>{t('feed.noFollowingPostsDesc')}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}><ActivityIndicator size="large" color={lu.colors.pink} /></View>
          ) : tab !== 'following' ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}><LuFileAttachIcon size={30} color={lu.colors.purple} /></View>
              <Text style={styles.emptyText}>{t('feed.noPostsInTab', { tab: tabLabel })}</Text>
              <Pressable onPress={openComposer}>
                <Text style={[styles.emptySubtitle, { color: lu.colors.purple, fontWeight: '800' }]}>{t('feed.createFirstPost')}</Text>
              </Pressable>
            </View>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lu.colors.pink} colors={[lu.colors.pink]} />}
      />

      {/* زر إنشاء منشور عائم — على الجهة النهائية حسب الاتجاه */}
      <Pressable onPress={openComposer} style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 96, [END_SIDE]: 18, opacity: pressed ? 0.85 : 1 }]}>
        <LinearGradient colors={['#FF2D2D', '#8A0E0E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}>
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
  post, currentUid, liked: likedProp, following: followingProp, padX, frameUri,
  onLikeChange, onFollowChange, onPressUser, onPressComments, onPressGift, onPressEdit, onPressShare, onDeleted,
}: {
  post: Post; currentUid?: string; liked: boolean; following: boolean; padX: number; frameUri?: string;
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

  return (
    <View style={[styles.card, { marginHorizontal: padX }]}>
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
              <Text style={styles.cardName} numberOfLines={1}>{post.authorName || t('rooms.userFallback')}</Text>
              <LuLikeIcon size={14} color={lu.colors.pink} filled />
            </View>
            <View style={styles.cardMetaRow}>
              <RealCountryFlag countryCode={post.authorCountry || 'PS'} size={17} shape="circle" />
              {(post.authorGender || (post.authorAge ?? 0) > 0) ? (
                <View style={styles.genderPill}>
                  <Text style={[styles.genderSym, { color: post.authorGender === 'male' ? lu.colors.blue : lu.colors.pink }]}>{post.authorGender === 'male' ? '♂' : '♀'}</Text>
                  {(post.authorAge ?? 0) > 0 && <Text style={styles.genderAge}>{post.authorAge}</Text>}
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
                <View style={[styles.followBtn, styles.followBtnActive]}><Text style={styles.followBtnTextActive}>{t('common.following')}</Text></View>
              ) : (
                <LinearGradient colors={['#FF2D2D', '#8A0E0E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.followBtn}><Text style={styles.followBtnText}>{t('common.follow')}</Text></LinearGradient>
              )}
            </Pressable>
            <Pressable onPress={() => setOptionsOpen(true)} style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.5 : 1 }]}><LuMoreIcon size={20} color={lu.colors.muted} /></Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setOptionsOpen(true)} style={({ pressed }) => [{ padding: 4, opacity: pressed ? 0.5 : 1 }]}><LuMoreIcon size={20} color={lu.colors.muted} /></Pressable>
        )}
      </View>

      {/* نص المنشور يفتح التفاصيل — كما تفعل الصورة وأيقونة التعليقات */}
      {!!post.text && (
        <Pressable onPress={() => onPressComments(post.id)}>
          <Text style={styles.cardText}>{post.text}</Text>
        </Pressable>
      )}

      {post.hashtags && post.hashtags.length > 0 && (
        <View style={styles.tagsRow}>{post.hashtags.map((tag) => <Text key={tag} style={styles.hashtag}>#{tag}</Text>)}</View>
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
      <View style={styles.actionsRow}>
        <Pressable onPress={handleLike} disabled={busy} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
          <LuLikeIcon size={21} color={liked ? '#FF3340' : '#5C5C64'} filled={liked} />
          <Text style={[styles.actionText, { color: liked ? '#FF3340' : '#5C5C64' }]}>{likes}</Text>
        </Pressable>
        <Pressable onPress={() => onPressComments(post.id)} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
          <LuCommentIcon size={21} color={post.comments > 0 ? '#ED4444' : '#5C5C64'} />
          <Text style={[styles.actionText, { color: post.comments > 0 ? '#ED4444' : '#5C5C64' }]}>{post.comments}</Text>
        </Pressable>
        <Pressable onPress={() => onPressGift(post)} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
          <LuGiftIcon size={21} color={gifts > 0 ? '#FFB000' : '#5C5C64'} filled={gifts > 0} />
          <Text style={[styles.actionText, { color: gifts > 0 ? '#FFB000' : '#5C5C64' }]}>{gifts}</Text>
        </Pressable>
        <Pressable onPress={handleShare} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}>
          <LuShareIcon size={21} color={shares > 0 ? '#10B981' : '#5C5C64'} />
          <Text style={[styles.actionText, { color: shares > 0 ? '#10B981' : '#5C5C64' }]}>{shares}</Text>
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
  tabPill: { flexDirection: ROW, alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99 },
  tabPillInactive: { backgroundColor: '#fff', ...lu.shadows.card },
  tabIconCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: lu.colors.card2, alignItems: 'center', justifyContent: 'center' },
  tabIconCircleActive: { backgroundColor: '#fff' },
  tabPillText: { fontSize: 14.5, fontWeight: '700', color: lu.colors.ink2, fontFamily: lu.fonts.bodyBold },
  tabPillTextActive: { fontSize: 14.5, fontWeight: '800', color: '#fff', fontFamily: lu.fonts.bodyHeavy },

  sectionHead: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', paddingTop: 2, paddingBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: INK, fontFamily: lu.fonts.bodyHeavy, textAlign: START, writingDirection: WD },
  viewAll: { fontSize: 12.5, fontWeight: '700', color: '#C0392B', fontFamily: lu.fonts.bodyBold },

  topicsScroll: { flexDirection: ROW, gap: 12, paddingBottom: 12 },
  topicCard: { flexDirection: ROW, alignItems: 'center', gap: 11, backgroundColor: '#fff', borderRadius: 18, padding: 10, ...lu.shadows.card },
  topicThumb: { width: 54, height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  topicTitle: { fontSize: 14, fontWeight: '800', color: INK, textAlign: START, writingDirection: WD },
  topicMembers: { fontSize: 11.5, color: lu.colors.muted, marginTop: 3, textAlign: START },

  card: { backgroundColor: '#fff', borderRadius: 22, padding: 15, ...lu.shadows.card },
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
  genderSym: { fontSize: 13, fontWeight: '900' },
  genderAge: { fontSize: 12, fontWeight: '800', color: lu.colors.ink2, fontFamily: lu.fonts.bodyBold },

  followBtn: { minWidth: 76, paddingHorizontal: 14, paddingVertical: 7.5, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  followBtnActive: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: lu.colors.purple },
  followBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  followBtnTextActive: { fontSize: 12, fontWeight: '800', color: lu.colors.purple },

  cardText: { fontSize: 14.5, color: '#2A2A35', lineHeight: 24, marginTop: 11, fontFamily: lu.fonts.body, textAlign: START, writingDirection: WD },
  tagsRow: { flexDirection: ROW, flexWrap: 'wrap', gap: 8, marginTop: 9 },
  hashtag: { fontSize: 12, fontWeight: '700', color: lu.colors.purple, backgroundColor: 'rgba(225,20,20,0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9, writingDirection: WD },
  imageWrap: { marginTop: 11, borderRadius: 16, overflow: 'hidden' },
  postImage: { width: '100%', aspectRatio: 1.5, backgroundColor: lu.colors.line },
  imageStack: { position: 'absolute', bottom: 11, [START]: 11, flexDirection: ROW, alignItems: 'center' },
  stackAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff', marginStart: -12, backgroundColor: lu.colors.line, alignItems: 'center', justifyContent: 'center' },
  stackMore: { backgroundColor: 'rgba(20,10,12,0.78)' },
  stackMoreText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  actionsRow: { flexDirection: ROW, alignItems: 'center', marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#F1E7E7' },
  actionBtn: { flexDirection: ROW, alignItems: 'center', gap: 7, paddingVertical: 4, marginEnd: 22 },
  actionText: { fontSize: 14, fontWeight: '700', fontFamily: lu.fonts.bodyBold },

  fab: { position: 'absolute', shadowColor: '#E11414', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  fabInner: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  emptyState: { paddingVertical: 60, alignItems: 'center' },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(225,20,20,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyText: { fontSize: 15, color: lu.colors.ink2, fontWeight: '700', fontFamily: lu.fonts.bodyBold },
  emptySubtitle: { fontSize: 12.5, color: lu.colors.muted, marginTop: 4, textAlign: 'center', paddingHorizontal: 40, fontFamily: lu.fonts.body },
});
