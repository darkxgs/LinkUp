/**
 * هيدر الروم — مطابق Live room.png / Line up App Full File
 */
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Heart } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { FramedAvatar } from '@/components/ui/FramedAvatar';
import { FramedAgencyCover } from '@/components/agency/FramedAgencyCover';
import { spacing } from '@/theme';
import { ROOM_DESIGN } from '@/theme/room-design';
import { lu } from '@/theme/lu-brand';
import {
  RoomEditIcon,
  RoomPowerIcon,
  RoomTrophyIcon,
  RoomPartyIcon,
} from '@/components/room/RoomDesignIcons';
import { RoomMediaPlayingPill, type RoomMediaPlayingKind } from '@/components/room/RoomMediaPlayingPill';
import { RoomRocketFloatingBadge } from '@/components/room/RoomRocketFloatingBadge';
import { LuckyBagFloatingBadge } from '@/components/room/LuckyBagFloatingBadge';
import type { RoomRocketLaunch } from '@/services/roomRocket';
import type { LuckyBag } from '@/services/luckyBag';

const AVATAR = 22;
const AGENCY_AVATAR = 28;
const ICON_BTN = 32;

export type RoomLiveHeaderAudience = {
  uid: string;
  name: string;
  avatar?: string;
};

type Props = {
  topInset: number;
  roomName: string;
  roomId: string;
  /** معرّف مميز للعرض والنسخ (vanity) — إن وُجد */
  vanityId?: string;
  hostName?: string;
  hostAvatar?: string;
  /** شارة مستوى الوكالة أسفل صورة الروم (مثل "LV9") — تُخفى إن غابت */
  levelLabel?: string;
  hostFrameUri?: string;
  /** إطار بطاقة الوكالة (مستطيل) أو إطار مستخدم (دائري) */
  headerFrameStyle?: 'avatar' | 'agencyCard';
  hostLevel?: number;
  presenceCount: number;
  audience: RoomLiveHeaderAudience[];
  onExit: () => void;
  onAudience: () => void;
  /** عرض سطر ID داخل الكرت (بدون نسخ) */
  showRoomIdOnCard?: boolean;
  onContribution: () => void;
  onRoomPress?: () => void;
  onFollow?: () => void;
  showFollow?: boolean;
  onFavorite?: () => void;
  isFavorited?: boolean;
  showFavorite?: boolean;
  onEdit?: () => void;
  showEdit?: boolean;
  contributionLabel: string;
  showPartyBadge?: boolean;
  onPartyBadge?: () => void;
  partyBadgeLabel?: string;
  mediaPlayingKind?: RoomMediaPlayingKind;
  mediaPlayingLabel?: string;
  mediaPlayingTitle?: string;
  /** فتح ورقة الموسيقى عند الضغط على حبّة الموسيقى — المدخل الوحيد للجمهور خارج المقاعد */
  onMusicPress?: () => void;
  showRoomEventBadges?: boolean;
  rocketLaunch?: RoomRocketLaunch | null;
  onRocketPress?: () => void;
  luckyBags?: LuckyBag[];
  onLuckyBagPress?: (bagId: string) => void;
};

function GlassLayers() {
  return (
    <>
      <View style={styles.glassWhite} />
      <View style={styles.glassPurple} />
    </>
  );
}

export function RoomLiveHeader({
  topInset,
  roomName,
  roomId,
  vanityId,
  hostName,
  hostAvatar,
  levelLabel,
  hostFrameUri,
  headerFrameStyle = 'avatar',
  presenceCount,
  audience,
  onExit,
  onAudience,
  showRoomIdOnCard = true,
  onContribution,
  onRoomPress,
  onFollow,
  showFollow,
  onFavorite,
  isFavorited = false,
  showFavorite,
  onEdit,
  showEdit,
  contributionLabel,
  showPartyBadge,
  onPartyBadge,
  partyBadgeLabel,
  mediaPlayingKind,
  mediaPlayingLabel,
  mediaPlayingTitle,
  onMusicPress,
  showRoomEventBadges = false,
  rocketLaunch = null,
  onRocketPress,
  luckyBags = [],
  onLuckyBagPress,
}: Props) {
  const shortId = roomId.length > 8 ? roomId.slice(-7) : roomId;
  const displayId = vanityId?.trim() || shortId;
  const isAgencyCard = headerFrameStyle === 'agencyCard';
  const avatarSize = isAgencyCard ? AGENCY_AVATAR : AVATAR;

  return (
    <View style={[styles.wrap, { paddingTop: topInset }]}>
      <View style={styles.leftCol}>
        <Pressable
          onPress={onRoomPress}
          disabled={!onRoomPress}
          style={({ pressed }) => [
            styles.roomPill,
            isAgencyCard && styles.roomPillAgency,
            onRoomPress && pressed && { opacity: 0.88 },
          ]}
        >
          <GlassLayers />
          <View style={styles.avatarCol}>
            {hostFrameUri ? (
              headerFrameStyle === 'agencyCard' ? (
                <FramedAgencyCover
                  imageUri={hostAvatar}
                  frameUri={hostFrameUri}
                  width={avatarSize}
                  aspect={1}
                  borderRadius={avatarSize / 2}
                  fallbackGrad={['#E11414', '#8A0E0E']}
                />
              ) : (
                <FramedAvatar
                  avatarUri={hostAvatar}
                  frameUri={hostFrameUri}
                  avatarSize={avatarSize}
                  fallbackLetter={hostName}
                />
              )
            ) : hostAvatar ? (
              <Image
                source={{ uri: hostAvatar }}
                style={[
                  styles.hostAvatarImg,
                  { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
                ]}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={hostAvatar}
                transition={150}
              />
            ) : (
              <View
                style={[
                  styles.hostFallback,
                  { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
                ]}
              >
                <Text style={[styles.hostFallbackLetter, isAgencyCard && styles.hostFallbackLetterAgency]}>
                  {(hostName ?? '?').charAt(0)}
                </Text>
              </View>
            )}
            {levelLabel ? (
              // شارة مستوى الوكالة أسفل صورة الروم — نفس عائلة شارة بطاقات الرئيسية
              // (مرجع LV9). في التدفق العادي كي لا تُقصّها حدود البيل المدوّرة.
              <View style={styles.levelPillWrap} pointerEvents="none">
                <LinearGradient
                  colors={['#46D3FF', '#0A8DFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.levelPill}
                >
                  <Text style={styles.levelPillText}>{levelLabel}</Text>
                </LinearGradient>
              </View>
            ) : null}
          </View>
          <View style={[styles.roomPillText, isAgencyCard && styles.roomPillTextAgency]}>
            <Text
              style={[styles.roomName, isAgencyCard && styles.roomNameAgency]}
              numberOfLines={isAgencyCard ? 2 : 1}
            >
              {roomName}
            </Text>
            {showRoomIdOnCard ? (
              <View style={styles.idRow}>
                <Text style={styles.roomId} numberOfLines={1}>
                  ID: {displayId}
                </Text>
              </View>
            ) : null}
          </View>
          {showEdit ? (
            <Pressable onPress={onEdit} style={styles.followBtn} hitSlop={6}>
              <GlassLayers />
              <RoomEditIcon size={13} />
            </Pressable>
          ) : showFollow ? (
            <Pressable onPress={onFollow} style={styles.followBtn} hitSlop={6}>
              <GlassLayers />
              <Plus size={13} color={ROOM_DESIGN.ink} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </Pressable>

        <View style={styles.subRow}>
          <Pressable onPress={onContribution} style={styles.miniPill}>
            <GlassLayers />
            <RoomTrophyIcon size={11} />
            <Text style={styles.miniPillText} numberOfLines={1}>
              {contributionLabel}
            </Text>
          </Pressable>
        </View>
        {showRoomEventBadges && (rocketLaunch || luckyBags.length > 0) ? (
          <View style={styles.leftEventCol}>
            {rocketLaunch && onRocketPress ? (
              <RoomRocketFloatingBadge
                variant="inline"
                launch={rocketLaunch}
                onPress={onRocketPress}
              />
            ) : null}
            {luckyBags.length > 0 && onLuckyBagPress ? (
              <LuckyBagFloatingBadge
                variant="inline"
                bags={luckyBags}
                onPress={onLuckyBagPress}
              />
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.rightCol}>
        <View style={styles.rightTop}>
          {showFavorite ? (
            <GlassIconBtn onPress={onFavorite}>
              <Heart
                size={16}
                color={isFavorited ? '#E11414' : ROOM_DESIGN.textPrimary}
                fill={isFavorited ? '#E11414' : 'transparent'}
                strokeWidth={2.2}
              />
            </GlassIconBtn>
          ) : null}
          <Pressable onPress={onAudience} style={styles.audiencePill}>
            <GlassLayers />
            <View style={styles.audienceStack}>
              {audience.slice(0, 2).map((aud, i) =>
                aud.avatar ? (
                  <Image
                    key={`${aud.uid}-${i}`}
                    source={{ uri: aud.avatar }}
                    style={[styles.audienceAvatar, i > 0 && { marginStart: -7 }]}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    recyclingKey={aud.uid}
                    transition={150}
                  />
                ) : (
                  <View
                    key={`${aud.uid}-${i}`}
                    style={[styles.audienceAvatar, styles.audienceFallback, i > 0 && { marginStart: -7 }]}
                  >
                    <Text style={styles.audienceInitial}>{aud.name.charAt(0)}</Text>
                  </View>
                ),
              )}
            </View>
            <Text style={styles.audienceCount}>
              {presenceCount > 99 ? '99+' : presenceCount}
            </Text>
          </Pressable>
          <GlassIconBtn onPress={onExit}>
            <RoomPowerIcon size={16} />
          </GlassIconBtn>
        </View>
        <View style={styles.rightBottomCol}>
          {showPartyBadge ? (
            <Pressable onPress={onPartyBadge} style={styles.partyBadge}>
              <RoomPartyIcon size={12} />
              <Text style={styles.partyBadgeText}>{partyBadgeLabel}</Text>
            </Pressable>
          ) : null}
          {mediaPlayingKind ? (
            // الموسيقى تأخذ نفس معاملة الفيديو: حبّة صغيرة بدل نبض الترددات الأحمر.
            // حبّة الموسيقى قابلة للضغط (تفتح ورقة الموسيقى) — المدخل الوحيد
            // للجمهور خارج المقاعد لتحكم الاستماع/مستوى الصوت.
            <Pressable
              onPress={mediaPlayingKind === 'music' ? onMusicPress : undefined}
              disabled={mediaPlayingKind !== 'music'}
            >
              <RoomMediaPlayingPill
                kind={mediaPlayingKind}
                label={mediaPlayingLabel}
                title={mediaPlayingTitle}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function GlassIconBtn({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}>
      <GlassLayers />
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: 0,
    zIndex: 10,
  },
  leftCol: {
    flexShrink: 1,
    maxWidth: '62%',
    gap: 3,
  },
  glassWhite: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ROOM_DESIGN.glass,
  },
  glassPurple: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ROOM_DESIGN.glassPurple,
  },
  roomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 3,
    paddingStart: 3,
    paddingEnd: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ROOM_DESIGN.glassBorder,
    overflow: 'hidden',
    maxWidth: '100%',
  },
  roomPillAgency: {
    paddingVertical: 4,
    paddingEnd: 8,
    gap: 10,
  },
  // عمود الصورة + شارة المستوى — الشارة تتراكب على الحافة السفلية للصورة
  avatarCol: {
    alignItems: 'center',
  },
  // شارة مستوى الوكالة أسفل صورة الروم (مرجع LV9)
  levelPillWrap: {
    marginTop: -7,
    zIndex: 5,
  },
  levelPill: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#008CFF',
    shadowOpacity: 0.33,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  levelPillText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
    letterSpacing: 0.6,
  },
  hostAvatarImg: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  hostFallback: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: ROOM_DESIGN.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostFallbackLetter: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: lu.fonts.body,
  },
  hostFallbackLetterAgency: {
    fontSize: 14,
  },
  roomPillText: {
    flexShrink: 1,
    maxWidth: 130,
    gap: 1,
  },
  roomPillTextAgency: {
    maxWidth: 168,
    gap: 0,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    marginTop: 1,
  },
  roomName: {
    color: ROOM_DESIGN.textPrimary,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    fontFamily: lu.fonts.body,
  },
  roomNameAgency: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  roomId: {
    color: ROOM_DESIGN.textPrimary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    fontFamily: lu.fonts.body,
    letterSpacing: 0.5,
  },
  followBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ROOM_DESIGN.glassBorder,
    flexShrink: 0,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  miniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ROOM_DESIGN.glassBorder,
    overflow: 'hidden',
    maxWidth: 150,
  },
  miniPillText: {
    color: ROOM_DESIGN.textPrimary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    fontFamily: lu.fonts.body,
    flexShrink: 1,
  },
  leftEventCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 4,
    paddingStart: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 3,
    flexShrink: 0,
  },
  rightTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: ICON_BTN,
    height: ICON_BTN,
    borderRadius: ICON_BTN / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ROOM_DESIGN.glassBorder,
    overflow: 'hidden',
  },
  audiencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ROOM_DESIGN.glassBorder,
    overflow: 'hidden',
  },
  audienceStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audienceAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: ROOM_DESIGN.stageBottom,
  },
  audienceFallback: {
    backgroundColor: ROOM_DESIGN.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audienceInitial: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
    fontFamily: lu.fonts.body,
  },
  audienceCount: {
    color: ROOM_DESIGN.textPrimary,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: lu.fonts.body,
  },
  rightBottomCol: {
    alignItems: 'flex-end',
    gap: 5,
    marginTop: 1,
  },
  partyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(225, 20, 20,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 209, 0.35)',
  },
  partyBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: lu.fonts.body,
  },
});
