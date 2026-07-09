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
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

import { RealCountryFlag } from '@/components/ui';
import { LuVerifiedIcon } from '@/components/icons/LuDesignIcons';
import { UserPlus, UserCheck, MapPin } from 'lucide-react-native';
import { lu } from '@/theme/lu-brand';
import { UserDoc } from '@/services/firebase/users';
import { followUser, isFollowing as checkFollowing } from '@/services/firebase/follow';
import { sendLikeWelcomeChatMessage } from '@/services/firebase/chat';
import { resolveDisplayName } from '@/utils/displayName';
import { getCountryByCode } from '@/data/countries';
import { isUserOnline, resolveLastSeenMs } from '@/utils/presence';
import { resolveDiscoverCardPhoto } from '@/utils/userAvatar';
import { formatDistance } from '@/services/locationService';

const CARD_ASPECT = 0.82;
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
};

export const ExploreUserCard = React.memo(function ExploreUserCard({
  user,
  width,
  currentUid,
  presenceTs,
  presenceNow,
  distanceKm,
  onPress,
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
      <Animated.View style={[styles.card, cardAnimatedStyle, { width: '100%', height: '100%' }]}>
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
          colors={['transparent', 'rgba(0,0,0,0.78)']}
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
              colors={liked ? [...HEART_GRAD] : ['rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0.12)']}
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
                  borderColor: 'rgba(255, 255, 255, 0.35)',
                },
              ]}
            >
              {liked ? (
                <UserCheck size={14} color="#fff" strokeWidth={2.5} />
              ) : (
                <UserPlus size={14} color="rgba(255, 255, 255, 0.92)" strokeWidth={2.5} />
              )}
            </LinearGradient>
          </Animated.View>
        </Pressable>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {verified ? <LuVerifiedIcon size={15} color="#E92424" /> : null}
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
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    ...lu.shadows.card,
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
    height: '62%',
  },
  onlinePill: {
    position: 'absolute',
    top: 10,
    start: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(54, 224, 122, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(54, 224, 122, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  onlinePillOffline: {
    backgroundColor: 'rgba(10, 4, 5, 0.45)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
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
    fontSize: 16,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  metaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: lu.fonts.bodyBold,
  },
  metaDot: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  location: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: lu.fonts.bodyBold,
    opacity: 0.95,
  },
  bio: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11.5,
    marginTop: 4,
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
