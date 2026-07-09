/**
 * كارد المستخدم في شاشة المحادثة — مطابق لـ Line up App Full File
 */
import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Text as RNText,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { Text } from '@/components/ui';
import { RealCountryFlag } from '@/components/ui/RealCountryFlag';
import {
  LuVerifiedIcon,
  LuCoinIcon,
  LuRocketIcon,
  LuFemaleIcon,
} from '@/components/icons/LuDesignIcons';
import { TAB_DESIGN } from '@/components/navigation/TabBarNavigationSvg';
import { lu } from '@/theme/lu-brand';
import {
  ChatProfileCardShape,
  CHAT_PROFILE_CARD_VIEW_H,
} from '@/components/chat/ChatProfileCardShape';
import { AgencyRoomTrackingAvatar } from '@/components/chat/AgencyRoomTrackingAvatar';

export type ChatProfileCardProps = {
  displayName: string;
  avatarUri: string;
  points: number;
  countryCode?: string;
  age?: number | null;
  gender?: 'male' | 'female';
  showVerified?: boolean;
  inVoiceRoom?: boolean;
  onPressMain?: () => void;
  /** الضغط على الصورة للدخول للغرفة */
  onPressAvatarRoom?: () => void;
  /** زر الصاروخ — العلاقات */
  onPressRocket?: () => void;
};

const AVATAR_OUTER = 42;
const AVATAR_INNER = 35;

function ProfileAvatar({
  uri,
  inVoiceRoom,
  onPressRoom,
}: {
  uri: string;
  inVoiceRoom?: boolean;
  onPressRoom?: () => void;
}) {
  const innerAvatar = (
    <View style={styles.avatarInner}>
      <Image source={{ uri }} style={styles.avatarImg} contentFit="cover" />
    </View>
  );

  const avatarNode = inVoiceRoom ? (
    <AgencyRoomTrackingAvatar size={AVATAR_INNER} active>
      {innerAvatar}
    </AgencyRoomTrackingAvatar>
  ) : (
    <LinearGradient
      colors={[TAB_DESIGN.purpleSoft, TAB_DESIGN.purple]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.avatarRing}
    >
      {innerAvatar}
    </LinearGradient>
  );

  return (
    <View style={styles.avatarWrap}>
      {inVoiceRoom && onPressRoom ? (
        <Pressable onPress={onPressRoom} hitSlop={6} accessibilityRole="button">
          {avatarNode}
        </Pressable>
      ) : (
        avatarNode
      )}
    </View>
  );
}

export function ChatProfileCard({
  displayName,
  avatarUri,
  points,
  countryCode,
  age,
  gender,
  showVerified = true,
  inVoiceRoom = false,
  onPressMain,
  onPressAvatarRoom,
  onPressRocket,
}: ChatProfileCardProps) {
  const { t } = useTranslation();
  const { width: screenW } = useWindowDimensions();
  const cardWidth = screenW - 28;

  return (
    <View style={[styles.outer, { width: cardWidth }]}>
      <BlurView intensity={75} tint="light" style={styles.blurContainer}>
        <View style={styles.content}>
          <Pressable
          onPress={onPressMain}
          style={styles.mainPressable}
          accessibilityRole="button"
        >
          <ProfileAvatar
            uri={avatarUri}
            inVoiceRoom={inVoiceRoom}
            onPressRoom={onPressAvatarRoom}
          />

          <View style={styles.body}>
            <View style={styles.nameRow}>
              <Text weight="bold" style={styles.name} numberOfLines={1}>
                {displayName}
              </Text>
              {showVerified ? (
                <LuVerifiedIcon size={13} color={TAB_DESIGN.purple} />
              ) : null}
            </View>

            <View style={styles.metaRow}>
              <RNText style={styles.pointsLabel}>
                {t('chat.points')}: {points}
              </RNText>
              <LuCoinIcon size={13} color={lu.colors.ink} />
              {!!countryCode && (
                <RealCountryFlag countryCode={countryCode} size={13} />
              )}
              {age != null && age > 0 ? (
                <View style={styles.ageBadge}>
                  {gender === 'female' ? (
                    <LuFemaleIcon size={12} color={lu.colors.ink2} />
                  ) : (
                    <RNText style={styles.genderSymbol}>♂</RNText>
                  )}
                  <RNText style={styles.ageText}>{age}</RNText>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>

        <Pressable
          onPress={onPressRocket}
          style={styles.actionBtn}
          hitSlop={6}
          accessibilityRole="button"
        >
          <LuRocketIcon size={16} color={TAB_DESIGN.purple} />
        </Pressable>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'center',
    marginBottom: 8,
    marginTop: 4,
    height: 72,
    borderRadius: 24,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 28,
    elevation: 6,
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 12,
  },
  mainPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  avatarWrap: {
    width: AVATAR_OUTER,
    height: AVATAR_OUTER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: AVATAR_OUTER,
    height: AVATAR_OUTER,
    borderRadius: AVATAR_OUTER / 2,
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: AVATAR_INNER,
    height: AVATAR_INNER,
    borderRadius: AVATAR_INNER / 2,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    fontSize: 14,
    color: lu.colors.ink,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  pointsLabel: {
    fontSize: 11,
    color: TAB_DESIGN.purple,
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
  },
  ageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(250, 230, 230, 0.9)',
  },
  genderSymbol: {
    fontSize: 11,
    color: lu.colors.ink2,
    fontWeight: '700',
  },
  ageText: {
    fontSize: 11,
    fontWeight: '800',
    color: lu.colors.ink2,
    fontFamily: lu.fonts.bodyHeavy,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(250, 230, 230, 0.9)',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
});
