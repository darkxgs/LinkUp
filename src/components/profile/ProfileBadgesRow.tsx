/**
 * صف أوسمة المستوى في البروفايل — لقب، علاقة، ثروة، VIP/SVIP
 * أوسمة موحّدة الشكل بأيقونات متجهية (vector) وألوان الهوية — احترافية ومتوافقة مع الاتجاهات
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  View,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Infinity as InfinityIcon, Gem, Crown } from 'lucide-react-native';
import { DecorImage } from '@/components/ui/DecorImage';

import { Text } from '@/components/ui';
import { TravelerTitleBadge } from '@/components/profile/TravelerTitleBadge';
import { VerifiedHostBadge } from '@/components/profile/VerifiedHostBadge';
import { lu } from '@/theme/lu-brand';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { levelDefFor, hasVipPrivilege, resolveVipPrivilegeAsset, getEffectiveVipLevel } from '@/services/firebase/vipSystem';
import { resolveAristocracyBadgeUrl } from '@/services/firebase/aristocracySystem';
import {
  resolveAgencyPrinceBadgeForUser,
} from '@/services/firebase/agencyPrinceBadge';
import {
  calculateLevel,
  getMyRelationships,
} from '@/services/firebase/social';
import { resolveUserWealthLevel } from '@/utils/userBalance';

/** ارتفاع موحّد لكل الشارات (نص + صور) */
export const PROFILE_BADGE_H = 30;
export const PROFILE_IMAGE_BADGE_W = 68;
export const PROFILE_WIDE_IMAGE_BADGE_W = 80;

type ImageBadgeProps = {
  uri: string;
  onPress?: () => void;
  wide?: boolean;
};

export function ProfileImageBadge({ uri, onPress, wide }: ImageBadgeProps) {
  const w = wide ? PROFILE_WIDE_IMAGE_BADGE_W : PROFILE_IMAGE_BADGE_W;
  const inner = (
    <DecorImage
      source={{ uri }}
      width={w}
      height={PROFILE_BADGE_H}
      recyclingKey={uri}
    />
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.imageBadge, { height: PROFILE_BADGE_H, width: w }, pressed && { opacity: 0.88 }]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={[styles.imageBadge, { height: PROFILE_BADGE_H, width: w }]}>{inner}</View>;
}

type Props = {
  horizontalPad?: number;
  style?: StyleProp<ViewStyle>;
};

type StatBadgeProps = {
  colors: readonly [string, string, ...string[]];
  value: string;
  icon: React.ReactNode;
  onPress: () => void;
  ltr?: boolean;
  dark?: boolean;
};

function StatBadge({ colors, value, icon, onPress, ltr, dark }: StatBadgeProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.badge, pressed && { opacity: 0.9 }]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text
        weight="bold"
        style={[styles.badgeNum, dark && styles.badgeNumDark, ltr && styles.ltr]}
        numberOfLines={1}
      >
        {value}
      </Text>
      {icon}
    </Pressable>
  );
}

export function ProfileBadgesRow({ horizontalPad = 20, style }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { vipSystem, aristocracy, agencyPrince } = useConfig();
  const [relLevel, setRelLevel] = useState(0);
  const [relTitle, setRelTitle] = useState<string | null>(null);

  const wealthLevel = resolveUserWealthLevel(user);
  // المستوى الفعّال يشمل SVIP الممنوح من الأرستقراطية النشطة (شارة الهوية امتياز SVIP)
  const vipLevel = getEffectiveVipLevel(user);
  const isVipBadgeUnlocked = hasVipPrivilege(user, 'vipBadge', vipSystem.privileges);
  const vipDef = vipLevel > 0 ? levelDefFor(vipLevel, vipSystem.levels) : undefined;
  
  const vipBadgePriv = resolveVipPrivilegeAsset(vipLevel, 'vipBadge', vipSystem);
  const vipBadgeUrl = vipBadgePriv?.imageUrl;
  let vipLabel = vipDef?.label ?? (vipLevel > 0 ? `SVIP${vipLevel}` : '');
  if (vipLabel.toUpperCase().startsWith('VIP')) {
    vipLabel = vipLabel.replace(/VIP/i, 'SVIP');
  }

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const rels = await getMyRelationships();
        if (cancelled || rels.length === 0) return;
        let best = 0;
        let bestTitle: string | null = null;
        for (const rel of rels) {
          const info = calculateLevel(rel.intimacyPoints);
          if (info.level > best) {
            best = info.level;
            bestTitle = info.currentLevelInfo.title;
          }
        }
        setRelLevel(best);
        setRelTitle(bestTitle);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const princeBadgeUrl = resolveAgencyPrinceBadgeForUser(
    user?.uid,
    agencyPrince,
    user?.agencyPrince,
  );

  const aristocracyBadgeUrl = resolveAristocracyBadgeUrl(
    user as unknown as Record<string, unknown> | undefined,
    aristocracy,
  );

  const titleText = relTitle ?? t('profile.badgeDefaultTitle');
  const hasAny = titleText || relLevel > 0 || wealthLevel > 0 || isVipBadgeUnlocked
    || !!princeBadgeUrl || !!aristocracyBadgeUrl || (user?.isVerified && user?.profile?.gender === 'female');
  if (!hasAny) return null;

  return (
    <View style={[styles.row, { paddingHorizontal: horizontalPad }, style]}>
      {user?.isVerified && user?.profile?.gender === 'female' ? (
        <VerifiedHostBadge />
      ) : null}

      {princeBadgeUrl ? (
        <ProfileImageBadge
          uri={princeBadgeUrl}
          wide
          onPress={() => router.push('/agency/prince' as any)}
        />
      ) : null}

      {titleText ? (
        <TravelerTitleBadge
          title={titleText}
          size="sm"
          onPress={() => router.push('/collection' as any)}
        />
      ) : null}

      {relLevel > 0 ? (
        <StatBadge
          colors={['#FF6670', '#E11414', '#C40E1E']}
          value={String(relLevel)}
          icon={<InfinityIcon size={12} color="#fff" strokeWidth={2.6} />}
          onPress={() => router.push('/relationships' as any)}
        />
      ) : null}

      {wealthLevel > 0 ? (
        <StatBadge
          colors={['#F16D6D', '#EB3030', '#D61E1E']}
          value={String(wealthLevel)}
          icon={<Gem size={12} color="#fff" strokeWidth={2.2} />}
          onPress={() => router.push('/wealth-level' as any)}
        />
      ) : null}

      {isVipBadgeUnlocked ? (
        vipBadgeUrl ? (
          <ProfileImageBadge uri={vipBadgeUrl} onPress={() => router.push('/vip' as any)} />
        ) : (
          <StatBadge
            colors={['#FFD86F', '#F5B721', '#E0930B']}
            value={vipLabel}
            icon={<Crown size={12} color="#7A4E00" fill="#7A4E00" strokeWidth={1.4} />}
            onPress={() => router.push('/vip' as any)}
            ltr
            dark
          />
        )
      ) : null}

      {aristocracyBadgeUrl ? (
        <ProfileImageBadge
          uri={aristocracyBadgeUrl}
          onPress={() => router.push('/vip/aristocracy' as any)}
        />
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignContent: 'center',
    justifyContent: 'center',
    gap: 5,
    rowGap: 5,
    paddingVertical: 8,
    width: '100%',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: PROFILE_BADGE_H,
    minWidth: 44,
    paddingHorizontal: 9,
    borderRadius: 99,
    overflow: 'hidden',
    ...lu.shadows.card,
  },
  badgeNum: {
    fontSize: 11.5,
    color: '#FFFFFF',
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
  },
  badgeNumDark: {
    color: '#7A4E00',
  },
  ltr: {
    writingDirection: 'ltr',
  },
  imageBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
