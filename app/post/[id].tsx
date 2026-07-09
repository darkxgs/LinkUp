/**
 * تفاصيل المنشور + التعليقات (حية)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ScrollView,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Heart, MessageCircle, Share2, Send, ImageIcon, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { LuGiftIcon } from '@/components/icons/LuDesignIcons';
import { formatTimeAgo } from '@/utils/timeAgo';

import { Text, BackButton } from '@/components/ui';
import { FramedAvatar } from '@/components/ui/FramedAvatar';
import { useEquippedFrameUrl } from '@/hooks/useEquippedFrameUrl';
import { subscribeToRoomFrames, type RoomFrame } from '@/services/firebase/roomDecor';
import { fetchEquippedFrameUrlsForUsers } from '@/services/firebase/userFrames';
import {
  subscribeToPost,
  subscribeToPostComments,
  addComment,
  toggleLike,
  deletePost,
  getLikedPostIds,
  getLikedCommentIds,
  type Post,
  type PostComment,
} from '@/services/firebase/posts';
import { uploadCommentImage } from '@/services/firebase/storage';
import { PostCommentRow } from '@/components/post/PostCommentRow';
import { useAuth } from '@/hooks/useAuth';
import { lu } from '@/theme/lu-brand';
import { PostShareSheet } from '@/components/post/PostShareSheet';
import { prefetchPostShareMessage } from '@/utils/postShare';
import { requestMediaLibraryAccess } from '@/services/permissions';
import { PostGiftPickerModal } from '@/components/post/PostGiftPickerModal';
import { PostOptionsModal } from '@/components/post/PostOptionsModal';
import { getPostReportPath } from '@/services/firebase/reports';
import { LuMoreIcon } from '@/components/icons/LuDesignIcons';

function buildCommentRows(comments: PostComment[]) {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const tops = comments.filter((c) => !c.parentCommentId || !byId.has(c.parentCommentId));
  const repliesByParent = new Map<string, PostComment[]>();
  for (const c of comments) {
    if (!c.parentCommentId || !byId.has(c.parentCommentId)) continue;
    const list = repliesByParent.get(c.parentCommentId) ?? [];
    list.push(c);
    repliesByParent.set(c.parentCommentId, list);
  }
  const rows: { item: PostComment; isReply: boolean }[] = [];
  for (const top of tops) {
    rows.push({ item: top, isReply: false });
    for (const reply of repliesByParent.get(top.id) ?? []) {
      rows.push({ item: reply, isReply: true });
    }
  }
  return rows;
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, authReady } = useAuth();
  const { width: winW, height: winH } = useWindowDimensions();

  const [post, setPost] = useState<Post | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [shares, setShares] = useState(0);
  const [gifts, setGifts] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<PostComment | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [roomFrames, setRoomFrames] = useState<RoomFrame[]>([]);
  const [commentFrameByUid, setCommentFrameByUid] = useState<Record<string, string>>({});
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());
  const [commentLikeOverrides, setCommentLikeOverrides] = useState<Record<string, number>>({});
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [commentZoomUri, setCommentZoomUri] = useState<string | null>(null);

  const authorFrameUrl = useEquippedFrameUrl(post?.uid);

  useEffect(() => {
    return subscribeToRoomFrames(setRoomFrames);
  }, []);

  const commentUidsKey = useMemo(
    () => [...new Set(comments.map((c) => c.uid).filter(Boolean))].sort().join(','),
    [comments],
  );

  useEffect(() => {
    const uids = commentUidsKey ? commentUidsKey.split(',') : [];
    if (!uids.length || !roomFrames.length) {
      setCommentFrameByUid({});
      return;
    }
    let cancelled = false;
    fetchEquippedFrameUrlsForUsers(uids, roomFrames).then((map) => {
      if (!cancelled) setCommentFrameByUid(map);
    });
    return () => { cancelled = true; };
  }, [commentUidsKey, roomFrames]);

  useEffect(() => {
    if (!id || !authReady) return;
    setLoading(true);
    let first = true;
    const unsub = subscribeToPost(id, (p) => {
      setPost(p);
      if (p) {
        setLikes(p.likes);
        setShares(p.shares);
        setGifts(p.gifts);
        if (first) {
          first = false;
          void getLikedPostIds([p.id]).then((likedSet) => setLiked(likedSet.has(p.id)));
        }
      }
      setLoading(false);
    });
    return unsub;
  }, [id, authReady]);

  useEffect(() => {
    if (!id || !authReady) return;
    return subscribeToPostComments(id, (list) => {
      setComments(list);
      // اللقطة الحية تتضمن الإعجاب المؤكَّد من الخادم — إبقاء الفرق المحلي كان يضاعف العدّاد
      setCommentLikeOverrides({});
    });
  }, [id, authReady]);

  const commentIdsKey = useMemo(
    () => comments.map((c) => c.id).sort().join(','),
    [comments],
  );

  useEffect(() => {
    if (!id || !authReady || !user || !commentIdsKey) {
      setLikedCommentIds(new Set());
      return;
    }
    const ids = commentIdsKey.split(',');
    let cancelled = false;
    getLikedCommentIds(id, ids).then((set) => {
      if (!cancelled) setLikedCommentIds(set);
    });
    return () => { cancelled = true; };
  }, [id, authReady, user, commentIdsKey]);

  const handleCommentLikeChange = useCallback((commentId: string, nextLiked: boolean) => {
    setLikedCommentIds((prev) => {
      const wasLiked = prev.has(commentId);
      if (wasLiked !== nextLiked) {
        setCommentLikeOverrides((o) => ({
          ...o,
          [commentId]: (o[commentId] ?? 0) + (nextLiked ? 1 : -1),
        }));
      }
      const copy = new Set(prev);
      if (nextLiked) copy.add(commentId);
      else copy.delete(commentId);
      return copy;
    });
  }, []);

  const handleLike = async () => {
    if (!post || !user) return;
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      const real = await toggleLike(post.id);
      setLiked(real);
    } catch {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    }
  };

  const handleShare = () => {
    if (!post) return;
    void prefetchPostShareMessage({ id: post.id, authorName: post.authorName, text: post.text });
    setShareOpen(true);
  };

  const handleComment = async () => {
    if (!post || sending) return;
    const trimmed = commentText.trim();
    if (!trimmed && !pendingImageUri) return;
    setSending(true);
    try {
      let imageUrl: string | undefined;
      if (pendingImageUri) {
        imageUrl = await uploadCommentImage(pendingImageUri);
      }
      await addComment(post.id, trimmed, {
        parentCommentId: replyingTo?.id,
        imageUrl,
      });
      setCommentText('');
      setReplyingTo(null);
      setPendingImageUri(null);
      setPost((p) => (p ? { ...p, comments: p.comments + 1 } : p));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('post.commentFailed'));
    } finally {
      setSending(false);
    }
  };

  const handlePickCommentImage = async () => {
    const ok = await requestMediaLibraryAccess();
    if (!ok) {
      Alert.alert(t('post.permissionTitle'), t('post.permissionBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPendingImageUri(result.assets[0].uri);
    }
  };

  const canSendComment = Boolean(commentText.trim() || pendingImageUri);
  const isBusy = sending;

  const commentRows = useMemo(() => {
    return buildCommentRows(comments).map(({ item, isReply }) => ({
      item: {
        ...item,
        likes: Math.max(0, (item.likes ?? 0) + (commentLikeOverrides[item.id] ?? 0)),
      },
      isReply,
    }));
  }, [comments, commentLikeOverrides]);

  const handleDelete = async () => {
    if (!post) return;
    setDeleting(true);
    try {
      await deletePost(post.id);
      setOptionsOpen(false);
      router.back();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('post.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={lu.colors.pink} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text>{t('post.notFound')}</Text>
        <BackButton />
      </View>
    );
  }

  const isOwner = user?.uid === post.uid;

  return (
    <LinearGradient colors={lu.gradients.pageHome} locations={[0, 0.2]} style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={10}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <BackButton />
          <Text style={styles.headerTitle}>{t('post.title')}</Text>
          <Pressable onPress={() => setOptionsOpen(true)} style={styles.headerIconBtn}>
            <LuMoreIcon size={20} color={lu.colors.ink} />
          </Pressable>
        </View>

        <FlatList
          data={commentRows}
          keyExtractor={(row) => row.item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={
            <View style={styles.postCard}>
              <Pressable
                onPress={() => router.push(`/profile/${post.uid}` as any)}
                style={styles.authorRow}
              >
                {authorFrameUrl ? (
                  <FramedAvatar
                    avatarUri={post.authorAvatar}
                    frameUri={authorFrameUrl}
                    avatarSize={40}
                    fallbackLetter={(post.authorName || '?').charAt(0)}
                  />
                ) : post.authorAvatar ? (
                  <Image source={{ uri: post.authorAvatar }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" recyclingKey={post.authorAvatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>
                      {(post.authorName || '?').charAt(0)}
                    </Text>
                  </View>
                )}
                <View style={styles.authorMetaCol}>
                  <Text style={styles.authorName} numberOfLines={1}>
                    {post.authorName}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    LV {post.authorLevel}
                    {post.createdAt ? ` · ${formatTimeAgo(post.createdAt)}` : ''}
                  </Text>
                </View>
              </Pressable>

              {!!post.text && <Text style={styles.postText}>{post.text}</Text>}

              {post.hashtags && post.hashtags.length > 0 && (
                <View style={styles.tagsRow}>
                  {post.hashtags.map((tag) => (
                    <Text key={tag} style={styles.tag}>#{tag}</Text>
                  ))}
                </View>
              )}

              {post.images && post.images.length > 0 && (
                <Pressable onPress={() => setZoomOpen(true)}>
                  <Image
                    source={{ uri: post.images[0] }}
                    style={styles.heroImage}
                    contentFit="cover"
                  />
                </Pressable>
              )}

              <View style={styles.actions}>
                <Pressable onPress={handleLike} style={styles.actionItem}>
                  <Heart
                    size={22}
                    color={liked ? lu.colors.pink : lu.colors.ink2}
                    fill={liked ? lu.colors.pink : 'transparent'}
                  />
                  <Text style={styles.actionLabel}>{likes}</Text>
                </Pressable>
                <View style={styles.actionItem}>
                  <MessageCircle size={22} color={lu.colors.ink2} />
                  <Text style={styles.actionLabel}>
                    {Math.max(post.comments ?? 0, comments.length)}
                  </Text>
                </View>
                <Pressable onPress={handleShare} style={styles.actionItem}>
                  <Share2 size={22} color={lu.colors.ink2} />
                  <Text style={styles.actionLabel}>{shares}</Text>
                </Pressable>
                {/* نفس أيقونة الهدايا في تبويب اللحظات — توحيد الهوية البصرية */}
                {!isOwner && user ? (
                  <Pressable onPress={() => setGiftOpen(true)} style={styles.actionItem}>
                    <LuGiftIcon size={22} color={gifts > 0 ? '#FFB000' : lu.colors.ink2} filled={gifts > 0} />
                    <Text style={[styles.actionLabel, gifts > 0 && { color: '#FFB000' }]}>{gifts}</Text>
                  </Pressable>
                ) : (
                  <View style={styles.actionItem}>
                    <LuGiftIcon size={22} color={gifts > 0 ? '#FFB000' : lu.colors.ink2} filled={gifts > 0} />
                    <Text style={[styles.actionLabel, gifts > 0 && { color: '#FFB000' }]}>{gifts}</Text>
                  </View>
                )}
              </View>
            </View>
          }
          renderItem={({ item: row }) => (
            <PostCommentRow
              item={row.item}
              isReply={row.isReply}
              postId={post.id}
              liked={likedCommentIds.has(row.item.id)}
              onLikeChange={handleCommentLikeChange}
              onReply={setReplyingTo}
              onImagePress={setCommentZoomUri}
              frameUri={commentFrameByUid[row.item.uid]}
              canInteract={Boolean(user)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.noComments}>
              {post.comments > 0 ? t('post.commentsLoadFailed') : t('post.noComments')}
            </Text>
          }
        />

        {user ? (
          <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
            {replyingTo ? (
              <View style={styles.replyBanner}>
                <Text style={styles.replyBannerText} numberOfLines={1}>
                  {t('post.replyingTo', { name: replyingTo.authorName })}
                </Text>
                <Pressable
                  onPress={() => {
                    setReplyingTo(null);
                    setPendingImageUri(null);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.replyBannerCancel}>✕</Text>
                </Pressable>
              </View>
            ) : null}
            {pendingImageUri ? (
              <View style={styles.pendingImageRow}>
                <Image source={{ uri: pendingImageUri }} style={styles.pendingImage} contentFit="cover" />
                <Pressable onPress={() => setPendingImageUri(null)} style={styles.pendingImageRemove}>
                  <X size={14} color="#fff" />
                </Pressable>
              </View>
            ) : null}
            <View style={styles.composerRow}>
              <Pressable
                onPress={handlePickCommentImage}
                disabled={isBusy}
                style={[styles.attachBtn, isBusy && { opacity: 0.5 }]}
              >
                <ImageIcon size={20} color={lu.colors.purple} />
              </Pressable>
              <TextInput
                style={styles.commentInput}
                placeholder={replyingTo ? t('post.replyPlaceholder') : t('post.commentPlaceholder')}
                placeholderTextColor={lu.colors.muted}
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <Pressable
                onPress={handleComment}
                disabled={isBusy || !canSendComment}
                style={[styles.sendBtn, (!canSendComment || isBusy) && { opacity: 0.5 }]}
              >
                {isBusy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Send size={18} color="#fff" />
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {giftOpen && user && !isOwner ? (
        <PostGiftPickerModal
          visible
          postId={post.id}
          authorUid={post.uid}
          authorName={post.authorName}
          authorAvatar={post.authorAvatar}
          authorGender={post.authorGender}
          onClose={() => setGiftOpen(false)}
          onSent={() => {
            // #8: لا زيادة محلية — subscribeToPost مصدر الحقيقة الوحيد للعدّاد.
            // الزيادة المحلية فوق قيمة الاشتراك الحيّ كانت تُظهر الهدية الواحدة هديتين.
            setGiftOpen(false);
          }}
        />
      ) : null}

      <PostOptionsModal
        visible={optionsOpen}
        post={post}
        isOwner={isOwner}
        deleting={deleting}
        onClose={() => setOptionsOpen(false)}
        onEdit={() => router.push(`/post/edit/${post.id}` as any)}
        onDelete={handleDelete}
        onReport={() => router.push(getPostReportPath(post.id, post.uid, 'feed') as any)}
      />

      <PostShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        post={post ? { id: post.id, authorName: post.authorName, text: post.text } : null}
        onShared={() => {
          // #8: subscribeToPost يحدّث العدّاد من الخادم — الزيادة المحلية كانت تُضاعِفه
        }}
      />

      <Modal
        visible={Boolean(commentZoomUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setCommentZoomUri(null)}
      >
        <View style={styles.modalBg}>
          <Pressable style={styles.closeArea} onPress={() => setCommentZoomUri(null)} />
          <Image
            source={{ uri: commentZoomUri ?? '' }}
            style={{ width: winW, height: winH * 0.75 }}
            contentFit="contain"
          />
          <Pressable style={styles.closeBtn} onPress={() => setCommentZoomUri(null)}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={zoomOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setZoomOpen(false)}
      >
        <View style={styles.modalBg}>
          <Pressable style={styles.closeArea} onPress={() => setZoomOpen(false)} />
          <ScrollView
            maximumZoomScale={4}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.zoomScroll}
          >
            <Image
              source={{ uri: post.images?.[0] || '' }}
              style={{ width: winW, height: winH * 0.8 }}
              contentFit="contain"
            />
          </ScrollView>
          <Pressable style={styles.closeBtn} onPress={() => setZoomOpen(false)}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
  },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    ...lu.shadows.card,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorMetaCol: { flex: 1, minWidth: 0 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: { fontSize: 15, fontWeight: '800', color: lu.colors.ink },
  meta: { fontSize: 12, color: lu.colors.muted, marginTop: 2 },
  postText: { fontSize: 15, lineHeight: 22, marginTop: 12, color: lu.colors.ink },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tag: {
    fontSize: 12,
    fontWeight: '700',
    color: lu.colors.purple,
    backgroundColor: 'rgba(200, 40, 40, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    marginTop: 12,
    backgroundColor: lu.colors.line,
  },
  actions: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: lu.colors.line,
    flexWrap: 'wrap',
  },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionLabel: { fontSize: 14, fontWeight: '700', color: lu.colors.ink2 },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  commentRowReply: {
    paddingStart: 40,
  },
  giftCommentRow: {},
  commentAvatar: { width: 36, height: 36, borderRadius: 18 },
  commentBubble: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 10,
    ...lu.shadows.card,
  },
  giftBubble: {
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20,0.25)',
    backgroundColor: 'rgba(255, 240, 240, 0.95)',
  },
  commentAuthor: { fontSize: 13, fontWeight: '800', color: lu.colors.ink },
  commentText: { fontSize: 14, marginTop: 4, color: lu.colors.ink2 },
  replyToLabel: {
    fontSize: 12,
    color: lu.colors.purple,
    fontWeight: '700',
    marginTop: 2,
  },
  replyBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 2,
  },
  replyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: lu.colors.purple,
  },
  giftCommentBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  giftCommentText: {
    fontSize: 14,
    fontWeight: '700',
    color: lu.colors.pink,
    flex: 1,
  },
  noComments: {
    textAlign: 'center',
    color: lu.colors.muted,
    padding: 24,
    fontSize: 14,
  },
  composer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: lu.colors.line,
    backgroundColor: '#fff',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: lu.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingImageRow: {
    marginBottom: 8,
    alignSelf: 'flex-start',
    position: 'relative',
  },
  pendingImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
  },
  pendingImageRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(200, 40, 40, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  replyBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: lu.colors.purple,
  },
  replyBannerCancel: {
    fontSize: 16,
    color: lu.colors.muted,
    paddingHorizontal: 4,
  },
  commentInput: {
    flex: 1,
    backgroundColor: lu.colors.line,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: lu.colors.ink,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeArea: {
    ...StyleSheet.absoluteFillObject,
  },
  zoomScroll: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
