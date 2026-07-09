/**
 * بطاقة دعوة غرفة أو وكالة داخل المحادثة
 */
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Volume2, Building2, ExternalLink, PartyPopper, Newspaper } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';
import type { ChatMessage } from '@/services/firebase/chat';
import { navigateToRoom } from '@/utils/navigateToRoom';

interface Props {
  msg: ChatMessage;
  isMine: boolean;
}

export function ChatInviteCard({ msg, isMine }: Props) {
  const router = useRouter();
  const isRoom = msg.type === 'room_invite';
  const isAgency = msg.type === 'agency_invite';
  const isParty = msg.type === 'party_invite';
  const isPost = msg.type === 'post_share';

  const title = isPost
    ? msg.invitePostAuthor ?? 'منشور'
    : isParty
    ? msg.invitePartyTitle ?? 'حفل'
    : isRoom
      ? msg.inviteRoomName ?? 'غرفة صوتية'
      : msg.inviteAgencyName ?? 'وكالة';

  const subtitle = isPost
    ? msg.invitePostPreview?.trim() || 'شاهد المنشور المشارَك'
    : isParty
      ? msg.inviteAgencyName
        ? `حفل في ${msg.inviteAgencyName} — ادخل الغرفة الآن`
        : 'ادعوك للانضمام إلى الاحتفال المباشر'
      : isRoom
        ? 'ادعوك للانضمام إلى الغرفة المباشرة'
        : 'ادعوك للانضمام إلى الوكالة مجاناً';

  const handleJoin = () => {
    if (isPost && msg.invitePostId) {
      router.push(`/post/${msg.invitePostId}` as any);
      return;
    }
    if ((isRoom || isParty) && msg.inviteRoomId) {
      void navigateToRoom(router, msg.inviteRoomId);
      return;
    }
    if (isAgency) {
      router.push('/agency/my-invites' as any);
    }
  };

  return (
    <View style={[styles.card, isMine ? styles.cardMine : styles.cardOther]}>
      <LinearGradient
        colors={
          isPost
            ? ['rgba(59, 130, 246, 0.28)', 'rgba(99, 102, 241, 0.22)']
            : isParty
            ? ['rgba(249, 115, 22, 0.28)', 'rgba(225, 20, 20, 0.22)']
            : isRoom
              ? ['rgba(198, 20, 20, 0.25)', 'rgba(225, 20, 20, 0.2)']
              : ['rgba(225, 20, 20, 0.22)', 'rgba(225, 20, 20, 0.2)']
        }
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.iconWrap}>
        {isPost ? (
          <Newspaper size={22} color="#fff" />
        ) : isParty ? (
          <PartyPopper size={22} color="#fff" />
        ) : isRoom ? (
          <Volume2 size={22} color="#fff" />
        ) : (
          <Building2 size={22} color="#fff" />
        )}
      </View>
      <Text variant="button" weight="bold" color="#fff" style={styles.title}>
        {title}
      </Text>
      <Text variant="caption" color="rgba(255,255,255,0.8)" align="center" style={styles.sub}>
        {subtitle}
      </Text>
      <Pressable onPress={handleJoin} style={styles.joinBtn}>
        <LinearGradient
          colors={[lu.colors.pink, lu.colors.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <ExternalLink size={14} color="#fff" />
        <Text variant="caption" weight="bold" color="#fff">
          {isPost ? 'عرض المنشور' : isParty ? 'دخول الحفل' : isRoom ? 'دخول الغرفة' : 'عرض الدعوة'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    minWidth: 220,
    maxWidth: 280,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cardMine: {
    alignSelf: 'flex-end',
  },
  cardOther: {
    alignSelf: 'flex-start',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    textAlign: 'center',
    marginBottom: 4,
  },
  sub: {
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
});
