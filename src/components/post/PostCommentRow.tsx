/**
 * صف تعليق على منشور — أسلوب فيسبوك (إعجاب · رد · صورة)
 */

import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { ThumbsUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { LuCoinIcon } from '@/components/icons/LuDesignIcons';
import { FramedAvatar } from '@/components/ui/FramedAvatar';
import { lu } from '@/theme/lu-brand';
import { toggleCommentLike, type PostComment } from '@/services/firebase/posts';
import { formatTimeAgo } from '@/utils/timeAgo';

// memo: كتابة تعليق في الشاشة الأم كانت تعيد رسم كل الصفوف مع كل حرف
export const PostCommentRow = React.memo(function PostCommentRow({
  item,
  isReply,
  postId,
  liked,
  onLikeChange,
  onReply,
  onImagePress,
  frameUri,
  canInteract,
}: {
  item: PostComment;
  isReply?: boolean;
  postId: string;
  liked: boolean;
  onLikeChange: (commentId: string, liked: boolean, revert?: boolean) => void;
  onReply?: (comment: PostComment) => void;
  onImagePress?: (uri: string) => void;
  frameUri?: string;
  canInteract?: boolean;
}) {
  const { t } = useTranslation();
  const isGift = item.type === 'gift';
  const hasImage = Boolean(item.imageUrl?.trim());
  const initial = (item.authorName || '?').charAt(0);
  const [liking, setLiking] = useState(false);
  const likes = Math.max(0, item.likes ?? 0);
  const giftQty = Math.max(1, item.giftQuantity ?? 1);
  const giftName =
    (item.giftName ?? item.text.replace(/^🎁\s*/, '')).trim() || t('post.giftFallback');
  const giftValue = item.giftPrice ?? 0;

  const handleLike = async () => {
    if (!canInteract || liking || isGift) return;
    setLiking(true);
    const prevLiked = liked;
    const next = !prevLiked;
    onLikeChange(item.id, next);
    try {
      const real = await toggleCommentLike(postId, item.id);
      if (real !== next) onLikeChange(item.id, real);
    } catch {
      onLikeChange(item.id, prevLiked);
    } finally {
      setLiking(false);
    }
  };

  const avatarNode = frameUri ? (
    <FramedAvatar
      avatarUri={item.authorAvatar}
      frameUri={frameUri}
      avatarSize={32}
      fallbackLetter={initial}
    />
  ) : item.authorAvatar ? (
    <Image
      source={{ uri: item.authorAvatar }}
      style={styles.commentAvatar}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={item.authorAvatar}
    />
  ) : (
    <View style={[styles.commentAvatar, styles.avatarPlaceholder]}>
      <Text style={styles.avatarLetter}>{initial}</Text>
    </View>
  );

  return (
    <View style={[styles.commentRow, isReply && styles.commentRowReply, isGift && styles.giftCommentRow]}>
      {avatarNode}
      <View style={styles.commentBody}>
        <View style={[styles.commentBubble, isGift && styles.giftBubble]}>
          <Text style={styles.commentAuthor}>{item.authorName}</Text>
          {isReply && item.replyToName ? (
            <Text style={styles.replyToLabel}>
              <Text style={styles.replyToName}>@{item.replyToName}</Text>
            </Text>
          ) : null}
          {isGift ? (
            <View style={styles.giftCommentBody}>
              <View style={styles.giftMeta}>
                <Text style={styles.giftActionText}>{t('post.sentGift')}</Text>
                <Text style={styles.giftCommentText}>
                  {giftQty > 1 ? `${giftName} ×${giftQty}` : giftName}
                </Text>
                {giftValue > 0 ? (
                  <View style={styles.giftValueRow}>
                    <LuCoinIcon size={14} />
                    <Text style={styles.giftValueText}>
                      {Math.round(giftValue).toLocaleString('en-US')}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <>
              {!!item.text && <Text style={styles.commentText}>{item.text}</Text>}
              {hasImage ? (
                <Pressable onPress={() => onImagePress?.(item.imageUrl!)} style={styles.commentImageWrap}>
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.commentImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    recyclingKey={item.id}
                  />
                </Pressable>
              ) : null}
            </>
          )}
        </View>

        {isGift ? (
          <Text style={[styles.timeText, styles.giftTimeText]}>{formatTimeAgo(item.createdAt)}</Text>
        ) : null}

        {canInteract && !isGift ? (
          <View style={styles.actionsRow}>
            <Pressable onPress={handleLike} hitSlop={8} style={styles.actionBtn} disabled={liking}>
              <ThumbsUp
                size={13}
                color={liked ? lu.colors.purple : lu.colors.muted}
                fill={liked ? lu.colors.purple : 'transparent'}
              />
              <Text style={[styles.actionText, liked && styles.actionTextActive]}>
                {liked ? t('post.likedAction') : t('post.likeAction')}
              </Text>
            </Pressable>
            <Text style={styles.actionDot}>·</Text>
            <Pressable onPress={() => onReply?.(item)} hitSlop={8} style={styles.actionBtn}>
              <Text style={styles.actionText}>{t('post.replyAction')}</Text>
            </Pressable>
            <Text style={styles.actionDot}>·</Text>
            <Text style={styles.timeText}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
        ) : null}

        {likes > 0 ? (
          <View style={styles.likeCountRow}>
            <View style={styles.likeBadge}>
              <ThumbsUp size={10} color="#fff" fill="#fff" />
            </View>
            <Text style={styles.likeCountText}>{likes}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  commentRowReply: {
    paddingStart: 52,
  },
  giftCommentRow: {},
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholder: {
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 12, fontWeight: '700' },
  commentBody: { flex: 1 },
  commentBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: lu.colors.line,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  giftBubble: {
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20,0.25)',
    backgroundColor: 'rgba(255, 240, 240, 0.95)',
  },
  commentAuthor: { fontSize: 13, fontWeight: '800', color: lu.colors.ink },
  commentText: { fontSize: 14, marginTop: 2, color: lu.colors.ink2, lineHeight: 20 },
  replyToLabel: { fontSize: 13, marginTop: 2 },
  replyToName: { color: lu.colors.purple, fontWeight: '700' },
  commentImageWrap: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: 220,
  },
  commentImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
  },
  giftCommentBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 6,
  },
  giftMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  giftActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: lu.colors.muted,
  },
  giftCommentText: {
    fontSize: 14,
    fontWeight: '800',
    color: lu.colors.pink,
  },
  giftValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  giftValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: lu.colors.blue,
  },
  giftTimeText: {
    marginTop: 4,
    paddingStart: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingStart: 4,
    gap: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: lu.colors.muted,
  },
  actionTextActive: {
    color: lu.colors.purple,
  },
  actionDot: {
    fontSize: 12,
    color: lu.colors.muted,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    color: lu.colors.muted,
    fontWeight: '600',
  },
  likeCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingStart: 4,
  },
  likeBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: lu.colors.muted,
  },
});
