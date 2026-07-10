/**
 * RoomSeat — مقعد في الغرفة مع animation للصوت
 * تصميم مستقبلي نيون (Futuristic Neon)
 */

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Pressable } from 'react-native';
import { SeatSoundAura } from '@/components/room/SeatSoundAura';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Mic, MicOff, Plus, Crown, Lock } from 'lucide-react-native';
import { Text } from './index';
import { FramedAvatar, FRAMED_AVATAR_INNER_RATIO } from './FramedAvatar';
import { RoomReactionDisplay } from '@/components/room/RoomReactionDisplay';
import { GiftVisual } from './GiftVisual';
import type { GiftLike } from './giftUtils';
import { colors, radius } from '@/theme';
import { lu } from '@/theme/lu-brand';
import { IMG_AVATAR } from '@/utils/imageConfig';

function SeatFaceImage({
  uri,
  size,
  borderRadius,
  fallbackLetter,
}: {
  uri?: string;
  size: number;
  borderRadius: number;
  fallbackLetter?: string;
}) {
  const validUri = uri?.trim();
  if (!validUri) {
    return (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius }]}>
        <Text weight="bold" style={{ fontSize: size * 0.38, color: '#fff' }}>
          {(fallbackLetter?.trim() || '?').charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: validUri }}
      style={{ width: size, height: size, borderRadius }}
      contentFit="cover"
      recyclingKey={validUri}
      {...IMG_AVATAR}
    />
  );
}

interface RoomSeatProps {
  seatIndex: number;
  avatar?: string;
  displayName?: string;
  isHost?: boolean;
  isMuted?: boolean;
  isSpeaking?: boolean;
  audioLevel?: number;
  isVIP?: boolean;
  level?: number;
  coins?: number;
  size?: 'xsmall' | 'small' | 'medium' | 'large';
  onPress?: () => void;
  empty?: boolean;
  overlayEmoji?: string;
  overlayGift?: GiftLike;
  pkTeam?: 'blue' | 'red';
  isPlayingMusic?: boolean;
  frameUri?: string;
  shape?: 'circle' | 'rounded';
  emptySeatLabel?: string;
  hideEmptySeatLabel?: boolean;
  isLocked?: boolean;
}

function formatSeatCoins(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  return value.toLocaleString('en-US');
}

export const RoomSeat = memo(
  ({
    seatIndex,
    avatar,
    displayName,
    isHost = false,
    isMuted = false,
    isSpeaking = false,
    audioLevel,
    isVIP = false,
    level = 1,
    coins,
    size = 'medium',
    onPress,
    empty = true,
    overlayEmoji,
    overlayGift,
    pkTeam,
    isPlayingMusic = false,
    frameUri,
    shape = 'circle',
    emptySeatLabel,
    hideEmptySeatLabel = false,
    isLocked = false,
  }: RoomSeatProps) => {
    const { t } = useTranslation();
    const soundActive = isPlayingMusic || (isSpeaking && !isMuted);
    const auraVariant = isPlayingMusic ? 'music' : 'voice';
    const corner = (sizePx: number) => (shape === 'rounded' ? Math.max(12, Math.round(sizePx * 0.28)) : sizePx / 2);

    const sizes = {
      xsmall: { avatar: 34, pulse: 44, mic: 12, micIcon: 7 },
      small: { avatar: 40, pulse: 50, mic: 14, micIcon: 8 },
      medium: { avatar: 46, pulse: 58, mic: 16, micIcon: 9 },
      large: { avatar: 62, pulse: 78, mic: 18, micIcon: 10 },
    };
    const supportChip = {
      xsmall: { h: 14, minW: 20, px: 3, font: 7, radius: 7, mt: 2 },
      small: { h: 15, minW: 22, px: 3.5, font: 7.5, radius: 7.5, mt: 2 },
      medium: { h: 16, minW: 24, px: 4, font: 8, radius: 8, mt: 2 },
      large: { h: 18, minW: 26, px: 4.5, font: 8.5, radius: 9, mt: 3 },
    }[size];
    const s = sizes[size];

    if (empty) {
      // نفس المربّع الموحّد للمقاعد المشغولة + صندوق «+» بنفس قياس الأفاتار المؤطَّر/العادي
      const emptyBoxSize = s.avatar + 4;
      return (
        <Pressable onPress={onPress} style={[styles.seatWrap, { width: s.pulse }]}>
          <View style={{ width: s.pulse, height: s.pulse, alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={[
                styles.emptySeat,
                {
                  width: emptyBoxSize,
                  height: emptyBoxSize,
                  borderRadius: corner(emptyBoxSize),
                  borderColor: isLocked ? 'rgba(239,68,68,0.55)' : 'rgba(232, 23, 23, 0.25)',
                },
              ]}
            >
              <LinearGradient
                colors={
                  isLocked
                    ? ['rgba(239,68,68,0.18)', 'rgba(127,29,29,0.12)']
                    : ['rgba(225, 20, 20,0.15)', 'rgba(232, 23, 23, 0.05)']
                }
                style={[StyleSheet.absoluteFill, { borderRadius: corner(emptyBoxSize) }]}
              />
              {isLocked ? (
                <Lock size={s.avatar / 2.8} color="rgba(239,68,68,0.85)" strokeWidth={2.5} />
              ) : (
                <Plus size={s.avatar / 2.5} color="rgba(232, 23, 23, 0.6)" strokeWidth={2.5} />
              )}
            </View>
          </View>
          {!hideEmptySeatLabel || isLocked ? (
            <Text
              variant="caption"
              color={isLocked ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.5)'}
              align="center"
              numberOfLines={1}
              style={{ fontSize: 10, lineHeight: 14, marginTop: 6, maxWidth: s.pulse + 8 }}
            >
              {isLocked
                ? t('room.seatLockedShort')
                : (emptySeatLabel ?? `${t('room.seat')} ${seatIndex}`)}
            </Text>
          ) : null}
        </Pressable>
      );
    }

    const showCoins = typeof coins === 'number';
    const hasFrame = !!frameUri;
    // ⚡ مربّع موحّد لكل المقاعد (مؤطّر أو لا) → نفس الحجم ونفس المحاذاة، والأسطر مرتبة.
    //    المقعد المؤطّر كان 1.72× حجم العادي فيكسر الشبكة؛ الآن الإطار يُحسب ليملأ نفس المربّع.
    const seatBox = s.pulse;
    const framedAvatarSize = Math.round(seatBox * FRAMED_AVATAR_INNER_RATIO);
    const wrapWidth = seatBox;
    const auraSize = seatBox;

    const baseColor = pkTeam === 'blue'
      ? '#E81717'
      : pkTeam === 'red'
        ? '#FF2E3E'
        : isPlayingMusic
          ? '#FF3340'
          : isHost
            ? '#FFD700'
            : isVIP
              ? '#E11414'
              : 'rgba(255,255,255,0.2)';

    const activeColor = '#E81717'; // Electric blue for active speaker

    const borderColor = soundActive ? activeColor : baseColor;

    const seatOverlays = (
      <>
        {isHost && (
          <View style={styles.crownIcon}>
            <Crown size={14} color="#FFD700" fill="#FFD700" strokeWidth={0} />
          </View>
        )}
        <View
          style={[
            styles.micIndicator,
            {
              width: s.mic,
              height: s.mic,
              borderRadius: s.mic / 2,
              borderColor: soundActive ? activeColor : 'rgba(27, 8, 8, 0.9)',
            },
          ]}
        >
          {isMuted ? (
            <MicOff size={s.micIcon} color="#FF2E3E" strokeWidth={2.5} />
          ) : (
            <Mic
              size={s.micIcon}
              color={soundActive ? activeColor : '#E11414'}
              strokeWidth={2.5}
            />
          )}
        </View>
      </>
    );

    const emojiOverlayEl = overlayEmoji ? (
      <View
        style={[
          styles.emojiOverlay,
          {
            width: hasFrame ? seatBox : s.avatar + 4,
            height: hasFrame ? seatBox : s.avatar + 4,
            borderRadius: corner(hasFrame ? seatBox : s.avatar + 4),
          },
        ]}
        pointerEvents="none"
      >
        <RoomReactionDisplay value={overlayEmoji} size={Math.round(s.avatar * 0.82)} />
      </View>
    ) : null;

    const giftOverlayEl = overlayGift ? (
      <View
        style={[
          styles.giftOverlay,
          {
            width: hasFrame ? seatBox : s.avatar + 4,
            height: hasFrame ? seatBox : s.avatar + 4,
            borderRadius: corner(hasFrame ? seatBox : s.avatar + 4),
          },
        ]}
        pointerEvents="none"
      >
        <GiftVisual
          gift={overlayGift}
          size={Math.max(22, Math.round(s.avatar * 0.52))}
          preferAnimation={false}
        />
      </View>
    ) : null;

    return (
      <Pressable onPress={onPress} style={[styles.seatWrap, { width: wrapWidth }]}>
        {soundActive ? (
          <SeatSoundAura size={auraSize} variant={auraVariant} audioLevel={audioLevel} />
        ) : null}

        {hasFrame ? (
          <View style={{ width: seatBox, height: seatBox, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
            <FramedAvatar
              avatarUri={avatar}
              frameUri={frameUri}
              avatarSize={framedAvatarSize}
              fallbackLetter={displayName}
            >
              {seatOverlays}
            </FramedAvatar>
            {giftOverlayEl}
            {emojiOverlayEl}
          </View>
        ) : (
          <View style={{ width: seatBox, height: seatBox, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <View
              style={[
                styles.avatarBorder,
                {
                  width: s.avatar + 4,
                  height: s.avatar + 4,
                  borderRadius: corner(s.avatar + 4),
                  shadowColor: soundActive ? activeColor : (isHost || isVIP || pkTeam ? borderColor : 'transparent'),
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: soundActive ? 0.9 : 0.5,
                  shadowRadius: soundActive ? 12 : 6,
                  elevation: soundActive ? 10 : 4,
                },
              ]}
            >
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: corner(s.avatar + 4),
                    borderWidth: soundActive ? 2 : 1.5,
                    borderColor: borderColor,
                  },
                ]}
              />
              <SeatFaceImage
                uri={avatar}
                size={s.avatar}
                borderRadius={corner(s.avatar)}
                fallbackLetter={displayName}
              />
            </View>
            {giftOverlayEl}
            {seatOverlays}
            {emojiOverlayEl}
          </View>
        )}

        {displayName ? (
          <Text
            variant="caption"
            color={colors.white}
            weight="semibold"
            align="center"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              fontSize: size === 'large' ? 11 : 10,
              lineHeight: size === 'large' ? 14 : 13,
              marginTop: showCoins ? 5 : 8,
              // عرض ثابت بدل maxWidth — القياس المرن مع أسماء مختلطة الاتجاه
              // كان يطويها إلى «...» بلا أي حرف على أندرويد
              width: wrapWidth + 12,
              textAlign: 'center',
              textShadowColor: 'rgba(0,0,0,0.8)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}
          >
            {displayName}
          </Text>
        ) : null}

        {showCoins ? (
          <View
            style={[
              styles.supportChip,
              {
                marginTop: supportChip.mt,
                minWidth: supportChip.minW,
                maxWidth: wrapWidth,
                height: supportChip.h,
                paddingHorizontal: supportChip.px,
                borderRadius: supportChip.radius,
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(225, 20, 20,0.88)', 'rgba(232, 23, 23, 0.78)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[StyleSheet.absoluteFill, { borderRadius: supportChip.radius }]}
            />
            <Text
              variant="caption"
              weight="bold"
              color={colors.white}
              numberOfLines={1}
              style={{ fontSize: supportChip.font, lineHeight: supportChip.font + 2 }}
            >
              {formatSeatCoins(coins!)}
            </Text>
          </View>
        ) : level > 1 ? (
          <View style={styles.lvBadge}>
            <LinearGradient
              colors={['#E11414', '#7A0A0A']}
              style={StyleSheet.absoluteFill}
            />
            <Text variant="caption" weight="bold" color={colors.white} style={{ fontSize: 8 }}>
              LV{level}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  seatWrap: {
    alignItems: 'center',
    position: 'relative',
  },
  avatarBorder: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: lu.colors.purple,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lu.colors.purple,
  },
  emptySeat: {
    backgroundColor: 'rgba(27, 8, 8, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(232, 23, 23, 0.25)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  crownIcon: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 4,
  },
  micIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2, // Move mic slightly off-center
    backgroundColor: 'rgba(27, 8, 8, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  supportChip: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    shadowColor: '#E81717',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
    elevation: 2,
  },
  lvBadge: {
    marginTop: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20,0.5)',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 2,
  },
  emojiOverlay: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  giftOverlay: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    zIndex: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
});
