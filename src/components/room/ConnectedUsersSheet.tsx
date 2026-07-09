/**
 * ConnectedUsersSheet — قائمة المستخدمين المتصلين في الروم (Luxurious Glassmorphism Design).
 * تبويب اون لاين / VIP، أزرار إخراج/طرد من المايك، وضغط على الصف لفتح التفاصيل.
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  X,
  Users,
  Crown,
  Award,
  Mic2,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  Gem,
  Coins,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { FramedAvatar } from '@/components/ui/FramedAvatar';
import { lu } from '@/theme/lu-brand';
import { colors, radius, spacing } from '@/theme';
import { ROOM_DESIGN } from '@/theme/room-design';

const SCREEN_H = Dimensions.get('window').height;

export type ConnectedUserRow = {
  uid: string;
  name: string;
  avatar?: string;
  isVIP: boolean;
  vipLevel?: number;
  level: number;
  onSeat: boolean;
  seatIndex?: number;
  gender?: 'male' | 'female';
  age?: number | null;
  coins?: number;
  pearls?: number;
  rank?: number;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  members: ConnectedUserRow[];
  vipMembers: ConnectedUserRow[];
  onlineCount: number;
  canManageMic: boolean;
  frameByUid: Record<string, string>;
  micBusyUid?: string | null;
  profilesLoading?: boolean;
  onPressUser: (user: ConnectedUserRow) => void;
  onAddToMic: (uid: string) => void;
  onRemoveFromMic: (uid: string) => void;
  /** لإظهار الأرصدة الخاصة لحسابك فقط */
  myUid?: string;
}

function ageChip(gender?: 'male' | 'female', age?: number | null) {
  if (age == null) return null;
  return (
    <View
      style={[
        styles.genderAgeChip,
        { backgroundColor: gender === 'female' ? 'rgba(255, 95, 95, 0.85)' : 'rgba(237, 68, 68, 0.85)' },
      ]}
    >
      <Text variant="caption" weight="bold" color="#fff" style={{ fontSize: 9 }}>
        {gender === 'female' ? '♀' : '♂'} {age}
      </Text>
    </View>
  );
}

function UserRow({
  member,
  canManageMic,
  frameUri,
  micBusy,
  myUid,
  onPress,
  onAddToMic,
  onRemoveFromMic,
}: {
  member: ConnectedUserRow;
  canManageMic: boolean;
  frameUri?: string;
  micBusy: boolean;
  myUid?: string;
  onPress: () => void;
  onAddToMic: () => void;
  onRemoveFromMic: () => void;
}) {
  const { t } = useTranslation();
  const showMicAction = canManageMic && !micBusy;
  const showPrivateBalances = !!myUid && member.uid === myUid;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      {/* يمين: الأفاتار + الإطار */}
      <View style={styles.avatarCol}>
        {frameUri ? (
          <FramedAvatar
            avatarUri={member.avatar}
            frameUri={frameUri}
            avatarSize={42}
            fallbackLetter={member.name}
          />
        ) : member.avatar ? (
          <Image source={{ uri: member.avatar }} style={styles.plainAvatar} contentFit="cover" cachePolicy="memory-disk" recyclingKey={member.avatar} transition={120} />
        ) : (
          <View style={[styles.plainAvatar, styles.avatarFallback]}>
            <Text variant="body" color={colors.white} weight="bold">
              {member.name.charAt(0)}
            </Text>
          </View>
        )}
      </View>

      {/* وسط: الاسم + الشارات */}
      <View style={styles.infoCol}>
        <Text variant="body" weight="bold" color={ROOM_DESIGN.textPrimary} numberOfLines={1}>
          {member.name}
        </Text>
        <View style={styles.badgesRow}>
          {ageChip(member.gender, member.age)}
          {member.isVIP && (
            <LinearGradient
              colors={['#FFD700', '#FFA500']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.vipChip}
            >
              <Crown size={9} color="#fff" fill="#fff" strokeWidth={0} />
              <Text variant="caption" weight="bold" color="#fff" style={{ fontSize: 9, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
                {member.vipLevel ? `SVIP ${member.vipLevel}` : 'VIP'}
              </Text>
            </LinearGradient>
          )}
          <View style={[styles.badgeChip, { backgroundColor: 'rgba(237, 68, 68, 0.2)', borderColor: 'rgba(237, 68, 68, 0.5)', borderWidth: 1 }]}>
            <Award size={9} color="#F06A6A" strokeWidth={2.3} />
            <Text variant="caption" color="#F06A6A" weight="bold" style={{ fontSize: 9 }}>
              {member.level}
            </Text>
          </View>
          {showPrivateBalances && (member.pearls ?? 0) > 0 && (
            <View style={[styles.badgeChip, { backgroundColor: 'rgba(183, 18, 18, 0.2)', borderColor: 'rgba(183, 18, 18, 0.5)', borderWidth: 1 }]}>
              <Gem size={9} color="#EC4444" strokeWidth={2.3} />
              <Text variant="caption" color="#EC4444" weight="bold" style={{ fontSize: 9 }}>
                {member.pearls! >= 1000 ? `${Math.floor(member.pearls! / 1000)}k` : member.pearls}
              </Text>
            </View>
          )}
          {showPrivateBalances && (member.coins ?? 0) > 0 && (
            <View style={[styles.badgeChip, { backgroundColor: 'rgba(217, 119, 6, 0.2)', borderColor: 'rgba(217, 119, 6, 0.5)', borderWidth: 1 }]}>
              <Coins size={9} color="#FBBF24" strokeWidth={2.3} />
              <Text variant="caption" color="#FBBF24" weight="bold" style={{ fontSize: 9 }}>
                {member.coins! >= 1000 ? `${Math.floor(member.coins! / 1000)}k` : member.coins}
              </Text>
            </View>
          )}
          {member.onSeat && (
            <View style={[styles.badgeChip, { backgroundColor: 'rgba(34, 197, 94, 0.2)', borderColor: 'rgba(34, 197, 94, 0.5)', borderWidth: 1 }]}>
              <Mic2 size={9} color="#4ADE80" strokeWidth={2.3} />
              <Text variant="caption" color="#4ADE80" weight="bold" style={{ fontSize: 9 }}>
                {t('room.onMic')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* يسار: زر المايك */}
      <View style={styles.actionCol}>
        {showMicAction ? (
          member.onSeat ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onRemoveFromMic();
              }}
              style={[styles.micBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)' }]}
              hitSlop={8}
            >
              <Mic2 size={13} color="#FCA5A5" strokeWidth={2.4} />
              <ArrowDown size={11} color="#FCA5A5" strokeWidth={2.8} />
            </Pressable>
          ) : (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onAddToMic();
              }}
              style={[styles.micBtn, { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.4)' }]}
              hitSlop={8}
            >
              <Mic2 size={13} color="#86EFAC" strokeWidth={2.4} />
              <ArrowUp size={11} color="#86EFAC" strokeWidth={2.8} />
            </Pressable>
          )
        ) : micBusy ? (
          <ActivityIndicator size="small" color={ROOM_DESIGN.giftPink} />
        ) : member.rank != null ? (
          <View style={styles.rankPill}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']}
              style={StyleSheet.absoluteFill}
            />
            <Text variant="caption" color={ROOM_DESIGN.textMuted} weight="bold" style={{ fontSize: 10 }}>
              #{member.rank}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ConnectedUsersSheet({
  visible,
  onClose,
  members,
  vipMembers,
  onlineCount,
  canManageMic,
  frameByUid,
  micBusyUid,
  profilesLoading,
  onPressUser,
  onAddToMic,
  onRemoveFromMic,
  myUid,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = React.useState<'online' | 'vip'>('online');

  const list = tab === 'vip' ? vipMembers : members;

  // قائمة مرتّبة بالرتبة مُحسوبة مرّة (بدل إنشاء كائن جديد لكل صف في كل رسم)
  const rankedList = React.useMemo(
    () => list.map((m, idx) => ({ ...m, rank: idx + 1 })),
    [list],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <BlurView tint="dark" intensity={60} style={styles.overlay}>
        <Pressable style={styles.overlayPressable} onPress={onClose}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing.base }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* الخلفية الزجاجية الفخمة */}
            <LinearGradient
              colors={['rgba(45, 15, 15, 0.95)', 'rgba(10, 4, 5, 0.98)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.glassTopBorder} />

            <View style={styles.handle} />

            <View style={styles.header}>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <LinearGradient colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']} style={StyleSheet.absoluteFill} />
                <X size={16} color={ROOM_DESIGN.textPrimary} strokeWidth={2.4} />
              </Pressable>
              <Text variant="h3" weight="bold" color={ROOM_DESIGN.textPrimary} style={{ textShadowColor: 'rgba(255,255,255,0.3)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 }}>
                {t('room.connectedUsers')}
              </Text>
              <Pressable style={styles.helpBtn} hitSlop={8}>
                <LinearGradient colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']} style={StyleSheet.absoluteFill} />
                <HelpCircle size={16} color={ROOM_DESIGN.textPrimary} strokeWidth={2.2} />
              </Pressable>
            </View>

            <View style={styles.tabs}>
              <Pressable
                onPress={() => setTab('online')}
                style={styles.tabItem}
              >
                <Text
                  variant="body"
                  weight="bold"
                  color={tab === 'online' ? '#FFF' : ROOM_DESIGN.textMuted}
                  style={tab === 'online' ? styles.activeTabText : undefined}
                >
                  {t('room.onlineTab')}({onlineCount})
                </Text>
                {tab === 'online' && (
                  <LinearGradient colors={ROOM_DESIGN.giftGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tabIndicator} />
                )}
              </Pressable>
              <Pressable
                onPress={() => setTab('vip')}
                style={styles.tabItem}
              >
                <Text
                  variant="body"
                  weight="bold"
                  color={tab === 'vip' ? '#FFF' : ROOM_DESIGN.textMuted}
                  style={tab === 'vip' ? styles.activeTabText : undefined}
                >
                  {t('room.vipTab')}({vipMembers.length})
                </Text>
                {tab === 'vip' && (
                  <LinearGradient colors={ROOM_DESIGN.giftGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tabIndicator} />
                )}
              </Pressable>
            </View>

            {/* Glowing Notice Banner */}
            <View style={styles.hintBannerContainer}>
              <LinearGradient
                colors={['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.hintBannerBorder} />
              <View style={styles.hintIcons}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.hintIcon, i > 0 && { marginStart: -6 }]}>
                    <LinearGradient colors={['#FFD700', '#FFA500']} style={StyleSheet.absoluteFill} />
                    <Crown size={10} color="#000" fill="#000" strokeWidth={0} />
                  </View>
                ))}
              </View>
              <Text variant="caption" color="#FFD700" weight="bold" style={{ flex: 1, textShadowColor: 'rgba(255, 215, 0, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }}>
                {t('room.connectedUsersHint')}
              </Text>
            </View>

            {profilesLoading && (
              <ActivityIndicator size="small" color={ROOM_DESIGN.giftPink} style={{ marginBottom: 6 }} />
            )}

            <FlatList
              style={{ maxHeight: SCREEN_H * 0.54 }}
              showsVerticalScrollIndicator={false}
              data={rankedList}
              keyExtractor={(m) => m.uid}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={7}
              removeClippedSubviews
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Users size={32} color={ROOM_DESIGN.textMuted} strokeWidth={1.5} />
                  <Text variant="body" color={ROOM_DESIGN.textMuted} style={{ marginTop: 8 }}>
                    {t('room.noMembersCategory')}
                  </Text>
                </View>
              }
              renderItem={({ item: m }) => (
                <UserRow
                  member={m}
                  canManageMic={canManageMic}
                  frameUri={frameByUid[m.uid]}
                  micBusy={micBusyUid === m.uid}
                  myUid={myUid}
                  onPress={() => onPressUser(m)}
                  onAddToMic={() => onAddToMic(m.uid)}
                  onRemoveFromMic={() => onRemoveFromMic(m.uid)}
                />
              )}
            />
          </Pressable>
        </Pressable>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  overlayPressable: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)', // Extra darkening over blur
  },
  sheet: {
    borderTopStartRadius: 32,
    borderTopEndRadius: 32,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    maxHeight: SCREEN_H * 0.85,
    overflow: 'hidden',
  },
  glassTopBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    marginBottom: spacing.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
    paddingHorizontal: 4,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  helpBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: spacing.md,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  activeTabText: {
    textShadowColor: ROOM_DESIGN.giftPink,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    width: '60%',
    height: 3,
    borderRadius: 2,
  },
  hintBannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.base,
    overflow: 'hidden',
  },
  hintBannerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  hintIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hintIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  avatarCol: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plainAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarFallback: {
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  genderAgeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  vipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.5)',
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  actionCol: {
    width: 50,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderWidth: 1,
  },
  rankPill: {
    minWidth: 32,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
});
