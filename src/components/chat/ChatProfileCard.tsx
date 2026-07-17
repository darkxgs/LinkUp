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
  /** الوضع الداكن */
  night?: boolean;
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

const AVATAR_OUTER = 56;
const AVATAR_INNER = 48;

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
      colors={['#FF4D5E', '#C40E2E']}
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
  night = true,
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
      <BlurView
        intensity={night ? 40 : 75}
        tint={night ? 'dark' : 'light'}
        style={[styles.blurContainer, !night && styles.blurContainerLight]}
      >
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
              <Text weight="bold" style={[styles.name, !night && { color: lu.colors.ink }]} numberOfLines={1}>
                {displayName}
              </Text>
              {showVerified ? (
                <LuVerifiedIcon size={16} color="#FF3B4E" />
              ) : null}
            </View>

            <View style={styles.metaRow}>
              <RNText style={[styles.pointsLabel, !night && { color: '#B00E0E' }]}>
                {t('chat.points')}: {points}
              </RNText>
              <LuCoinIcon size={15} color="#F5C242" />
              {!!countryCode && (
                <RealCountryFlag countryCode={countryCode} size={15} />
              )}
              {age != null && age > 0 ? (
                <View style={[styles.ageBadge, !night && styles.ageBadgeLight]}>
                  {gender === 'female' ? (
                    <LuFemaleIcon size={12} color={night ? '#FF7EB3' : '#E1265E'} />
                  ) : (
                    <RNText style={[styles.genderSymbol, !night && { color: '#2563EB' }]}>♂</RNText>
                  )}
                  <RNText style={[styles.ageText, !night && { color: lu.colors.ink2 }]}>{age}</RNText>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>

        <Pressable
          onPress={onPressRocket}
          style={[styles.actionBtn, !night && styles.actionBtnLight]}
          hitSlop={6}
          accessibilityRole="button"
        >
          <LuRocketIcon size={22} color="#FF4D5A" />
        </Pressable>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'center',
    marginBottom: 10,
    marginTop: 4,
    height: 92,
    borderRadius: 26,
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 8,
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(255,45,60,0.85)',
    backgroundColor: 'rgba(30,12,16,0.72)',
    overflow: 'hidden',
  },
  blurContainerLight: {
    borderColor: 'rgba(225,20,20,0.45)',
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: AVATAR_INNER,
    height: AVATAR_INNER,
    borderRadius: AVATAR_INNER / 2,
    overflow: 'hidden',
    backgroundColor: '#2A1A20',
    borderWidth: 1.5,
    borderColor: '#1A0D11',
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
    fontSize: 17,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 5,
  },
  pointsLabel: {
    fontSize: 13,
    color: '#FF4D5A',
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
  },
  ageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  ageBadgeLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F0BABA',
  },
  genderSymbol: {
    fontSize: 12,
    color: '#6EB6FF',
    fontWeight: '700',
  },
  ageText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyHeavy,
  },
  actionBtnLight: {
    backgroundColor: 'rgba(225,20,20,0.07)',
    borderColor: 'rgba(225,20,20,0.4)',
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(225,20,20,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,77,94,0.55)',
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
});
