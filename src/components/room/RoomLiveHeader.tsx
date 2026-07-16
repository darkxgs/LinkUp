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
const AGENCY_AVATAR = 62;
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
  // بطاقة الوكالة: صورة مربّعة بإطار أبيض (مرجع المالك) — الداخل أصغر بسماكة الإطار
  const avatarInner = isAgencyCard ? avatarSize - 4 : avatarSize;
  const avatarRadius = isAgencyCard ? 14 : avatarSize / 2;

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
          {isAgencyCard ? (
            // خلفية بطاقة الوكالة — تدرّج وردي-رمادي (مرجع المالك)
            <LinearGradient
              colors={['rgba(185,164,165,0.95)', 'rgba(153,133,133,0.90)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <GlassLayers />
          )}
          <View style={isAgencyCard ? styles.avatarColAgency : undefined}>
            <View style={isAgencyCard ? styles.avatarFrameAgency : undefined}>
              {hostFrameUri ? (
              headerFrameStyle === 'agencyCard' ? (
                <FramedAgencyCover
                  imageUri={hostAvatar}
                  frameUri={hostFrameUri}
                  width={avatarInner}
                  aspect={1}
                  borderRadius={avatarRadius}
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
                  { width: avatarInner, height: avatarInner, borderRadius: avatarRadius },
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
                  { width: avatarInner, height: avatarInner, borderRadius: avatarRadius },
                ]}
              >
                <Text style={[styles.hostFallbackLetter, isAgencyCard && styles.hostFallbackLetterAgency]}>
                  {(hostName ?? '?').charAt(0)}
                </Text>
              </View>
            )}
            </View>
            {isAgencyCard && levelLabel ? (
              // شارة LVL ملتصقة بأسفل الصورة (مرجع المالك v4) — تتراكب على حافتها بـ-6
              <View style={styles.levelPillWrap} pointerEvents="none">
                <LinearGradient
                  colors={['#58D8FF', '#1DA7FF', '#006AE8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
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
              numberOfLines={1}
            >
              {roomName}
            </Text>
            {showRoomIdOnCard ? (
              isAgencyCard ? (
                <Text style={styles.roomIdAgency} numberOfLines={1}>
                  ID: {displayId}
                </Text>
              ) : (
                <View style={styles.idRow}>
                  <Text style={styles.roomId} numberOfLines={1}>
                    ID: {displayId}
                  </Text>
                </View>
              )
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
  // بطاقة غرفة الوكالة (مرجع المالك v3): زوايا 24، حواف أوسع، ظل ناعم
  roomPillAgency: {
    paddingVertical: 14,
    paddingStart: 18,
    paddingEnd: 18,
    gap: 16,
    borderRadius: 24,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  // الصورة وفوقها شارة LVL الملتصقة بحافتها السفلية (مرجع المالك v4)
  avatarColAgency: {
    alignItems: 'center',
  },
  // إطار الصورة المربّعة — حد أبيض 2 وظل خلفها (مرجع المالك)
  avatarFrameAgency: {
    width: AGENCY_AVATAR,
    height: AGENCY_AVATAR,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  // موضع الشارة — منتصف الحافة السفلية للصورة، تتجاوزها بـ6 (داخل حشوة البطاقة فلا قصّ)
  levelPillWrap: {
    position: 'absolute',
    bottom: -6,
    left: -8,
    right: -8,
    alignItems: 'center',
    zIndex: 5,
  },
  // شارة LVL — تدرّج أزرق ثلاثي عمودي بحد لامع وتوهّج (مرجع المالك v4)
  levelPill: {
    height: 20,
    minWidth: 48,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#29B6FF',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  levelPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
    letterSpacing: 0.4,
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
    fontSize: 18,
  },
  roomPillText: {
    flexShrink: 1,
    maxWidth: 130,
    gap: 1,
  },
  roomPillTextAgency: {
    maxWidth: 190,
    gap: 4,
    justifyContent: 'center',
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
    color: '#fff',
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '700',
  },
  // سطر الـID تحت الاسم (مرجع المالك v3 — مثل @username)
  roomIdAgency: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    fontFamily: lu.fonts.body,
    letterSpacing: 0.5,
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
