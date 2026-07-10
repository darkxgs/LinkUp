/**
 * بطاقة مستخدم — شبكة الاستكشاف (مطابقة home.jsx + تصميم Line up)
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  FadeInUp,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

import { RealCountryFlag } from '@/components/ui';
import { UserPlus, UserCheck, MapPin, BadgeCheck } from 'lucide-react-native';
import { lu } from '@/theme/lu-brand';
import { UserDoc } from '@/services/firebase/users';
import { followUser, isFollowing as checkFollowing } from '@/services/firebase/follow';
import { sendLikeWelcomeChatMessage } from '@/services/firebase/chat';
import { resolveDisplayName } from '@/utils/displayName';
import { getCountryByCode } from '@/data/countries';
import { isUserOnline, resolveLastSeenMs } from '@/utils/presence';
import { resolveDiscoverCardPhoto } from '@/utils/userAvatar';
import { formatDistance } from '@/services/locationService';

const CARD_ASPECT = 0.68;
const HEART_GRAD = ['#E11414', '#FF5C5C', '#FF7A2E'] as const;

const FALLBACK_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#F0A0A0', '#FBD5D5'],
  ['#FFB199', '#FF7A8A'],
  ['#E36A6A', '#B00E0E'],
  ['#FF5C7A', '#E02B2B'],
];

function pickGrad(index: number): readonly [string, string] {
  return FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length] ?? ['#F0A0A0', '#FBD5D5'];
}

function gradFor(uid: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return pickGrad(h);
}

function getAge(birthYear?: number): number {
  if (!birthYear) return 0;
  return new Date().getFullYear() - birthYear;
}

function countryLabel(code?: string): string {
  if (!code) return '—';
  return getCountryByCode(code)?.name ?? code;
}

export type ExploreUserCardProps = {
  user: UserDoc;
  width: number;
  currentUid?: string;
  presenceTs?: number;
  presenceNow: number;
  distanceKm?: number;
  onPress: () => void;
  dark?: boolean;
};

export const ExploreUserCard = React.memo(function ExploreUserCard({
  user,
  width,
  currentUid,
  presenceTs,
  presenceNow,
  distanceKm,
  onPress,
  dark = true,
}: ExploreUserCardProps) {
  const { t } = useTranslation();
  const grad = gradFor(user.uid);
  const age = getAge(user.birthYear);
  const lastSeenMs = resolveLastSeenMs(user.lastSeen, presenceTs);
  const online = isUserOnline(lastSeenMs, presenceNow);
  const name = resolveDisplayName({
    displayName: user.displayName,
    email: user.email,
  });
  const verified = user.isVerified || (user.level ?? 0) >= 10;
  const photo = resolveDiscoverCardPhoto(user as unknown as Record<string, unknown>, user.uid);
  const cardH = Math.round(width / CARD_ASPECT);

  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  const cardScale = useSharedValue(1);
  const heartScale = useSharedValue(1);
  const dotScale = useSharedValue(0.9);

  useEffect(() => {
    dotScale.value = withRepeat(
      withTiming(1.2, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const dotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  useEffect(() => {
    if (!currentUid || currentUid === user.uid) return;
    checkFollowing(user.uid).then(setLiked).catch(() => {});
  }, [user.uid, currentUid]);

  const onHeart = async (e: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    if (!currentUid || currentUid === user.uid || busy || liked) return;

    heartScale.value = withSequence(
      withTiming(1.35, { duration: 100, easing: Easing.out(Easing.quad) }),
      withSpring(1),
    );

    setBusy(true);
    setLiked(true);
    try {
      await followUser(user.uid);
      await sendLikeWelcomeChatMessage(
        user.uid,
        name,
        photo,
        t('home.likeWelcomeMessage'),
      );
      setLiked(true);
    } catch {
      const stillFollowing = await checkFollowing(user.uid).catch(() => false);
      setLiked(stillFollowing);
    } finally {
      setBusy(false);
    }
  };

  const renderOnlineStatus = () => {
    if (online) {
      return (
        <View style={styles.onlinePill}>
          <Animated.View
            style={[styles.onlineDot, { backgroundColor: '#36E07A' }, dotAnimatedStyle]}
          />
          <Text style={styles.onlineText}>{t('common.online')}</Text>
        </View>
      );
    }
    const diffMin = Math.round((presenceNow - lastSeenMs) / 60000);
    if (diffMin < 60 && diffMin >= 0) {
      return (
        <View style={[styles.onlinePill, styles.onlinePillOffline]}>
          <View style={[styles.onlineDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.onlineText}>
            {t('home.activeMinAgo', { count: diffMin, defaultValue: `Active ${diffMin}m ago` })}
          </Text>
        </View>
      );
    }
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24 && diffHours >= 0) {
      return (
        <View style={[styles.onlinePill, styles.onlinePillOffline]}>
          <View style={[styles.onlineDot, { backgroundColor: '#9A9AA5' }]} />
          <Text style={styles.onlineText}>
            {t('home.activeHoursAgo', { count: diffHours, defaultValue: `Active ${diffHours}h ago` })}
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.onlinePill, styles.onlinePillOffline]}>
        <View style={[styles.onlineDot, { backgroundColor: '#9A9AA5' }]} />
        <Text style={styles.onlineText}>{t('common.offline')}</Text>
      </View>
    );
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        cardScale.value = withTiming(0.97, { duration: 100 });
      }}
      onPressOut={() => {
        cardScale.value = withSpring(1);
      }}
      style={{ width, height: cardH }}
    >
      <Animated.View entering={FadeInUp.duration(380)} style={[styles.card, !dark && styles.cardLight, cardAnimatedStyle, { width: '100%', height: '100%' }]}>
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={photo} transition={150} />
        ) : (
          <View style={styles.initialWrap}>
            <Text style={styles.initial}>{(name || '?').trim().charAt(0)}</Text>
          </View>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(8,3,4,0.62)', 'rgba(8,3,4,0.94)']}
          locations={[0, 0.45, 1]}
          style={styles.legibility}
        />

        {renderOnlineStatus()}

        <Pressable
          onPress={onHeart}
          disabled={busy || liked}
          style={({ pressed }) => [
            {
              position: 'absolute',
              top: 10,
              end: 10,
              width: 30,
              height: 30,
              zIndex: 10,
            },
            pressed && { opacity: 0.88 },
          ]}
        >
          <Animated.View style={heartAnimatedStyle}>
            <LinearGradient
              colors={liked ? [...HEART_GRAD] : ['rgba(14, 7, 9, 0.72)', 'rgba(14, 7, 9, 0.6)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.heartBtn,
                liked && styles.heartBtnLiked,
                {
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  position: 'relative',
                  top: 0,
                  end: 0,
                  borderWidth: liked ? 0 : 1.2,
                  borderColor: 'rgba(255, 255, 255, 0.45)',
                },
              ]}
            >
              {liked ? (
                <UserCheck size={14} color="#fff" strokeWidth={2.5} />
              ) : (
                <UserPlus size={15} color="#fff" strokeWidth={2.6} />
              )}
            </LinearGradient>
          </Animated.View>
        </Pressable>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {verified ? <BadgeCheck size={17} color="#fff" fill="#E11414" strokeWidth={1.9} /> : null}
          </View>
          <View style={styles.metaRow}>
            {age > 0 ? <Text style={styles.metaText}>{age}</Text> : null}
            {age > 0 ? <Text style={styles.metaDot}>•</Text> : null}
            <RealCountryFlag countryCode={user.country} size={13} shape="circle" />
            <Text style={styles.location} numberOfLines={1}>
              {countryLabel(user.country)}
            </Text>
          </View>
          {distanceKm != null && (
            <View style={styles.distanceRow}>
              <MapPin size={11} color="#FF5C5C" strokeWidth={2.5} />
              <Text style={styles.distanceText}>{formatDistance(distanceKm)}</Text>
            </View>
          )}
          {user.bio ? (
            <Text style={styles.bio} numberOfLines={2}>
              {user.bio}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: lu.colors.nightCard,
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 60, 0.28)',
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 24,
    elevation: 14,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(225, 20, 20, 0.16)',
    shadowColor: '#9A1414',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6,
  },
  initialWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '800',
    fontFamily: lu.fonts.display,
  },
  legibility: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    height: '70%',
  },
  onlinePill: {
    position: 'absolute',
    top: 10,
    start: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(12, 6, 8, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 99,
  },
  onlinePillOffline: {
    backgroundColor: 'rgba(12, 6, 8, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
  },
  heartBtn: {
    position: 'absolute',
    top: 8,
    end: 8,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtnLiked: {
    shadowColor: lu.colors.pink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
  },
  info: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    flexShrink: 1,
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  metaText: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
  metaDot: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  location: {
    flex: 1,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
  bio: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11.5,
    marginTop: 5,
    lineHeight: 16,
    fontFamily: lu.fonts.body,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    backgroundColor: 'rgba(255, 45, 45, 0.2)',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  distanceText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
  },
});
