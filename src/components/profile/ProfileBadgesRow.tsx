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
  I18nManager,
  Image as RNImage,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Infinity as InfinityIcon, Gem, Crown } from 'lucide-react-native';
import { DecorImage } from '@/components/ui/DecorImage';

import { Text } from '@/components/ui';
import { TravelerTitleBadge } from '@/components/profile/TravelerTitleBadge';
import { VerifiedHostBadge } from '@/components/profile/VerifiedHostBadge';
import { lu } from '@/theme/lu-brand';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { levelDefFor, hasVipPrivilege, resolveVipPrivilegeAsset, getEffectiveVipLevel, isUserVipActive } from '@/services/firebase/vipSystem';
import { resolveAristocracyBadgeUrl } from '@/services/firebase/aristocracySystem';
import {
  resolveAgencyPrinceBadgeForUser,
} from '@/services/firebase/agencyPrinceBadge';
import {
  calculateLevel,
  getMyRelationships,
} from '@/services/firebase/social';
import { resolveUserWealthLevel } from '@/utils/userBalance';

/** وسوم SVIP لكل مستوى — أصول العميل كما هي */
const SVIP_LEVEL_TAGS: Record<number, number> = {
  1: require('../../../assets/images/svip/tag1.webp'),
  2: require('../../../assets/images/svip/tag2.webp'),
  3: require('../../../assets/images/svip/tag3.webp'),
  4: require('../../../assets/images/svip/tag4.webp'),
  5: require('../../../assets/images/svip/tag5.webp'),
  6: require('../../../assets/images/svip/tag6.webp'),
  7: require('../../../assets/images/svip/tag7.webp'),
  8: require('../../../assets/images/svip/tag8.webp'),
  9: require('../../../assets/images/svip/tag9.webp'),
  10: require('../../../assets/images/svip/tag10.webp'),
  11: require('../../../assets/images/svip/tag11.webp'),
  12: require('../../../assets/images/svip/tag12.webp'),
};

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
  /** سمة داكنة — أقراص زجاجية نبيذية موحّدة بدل التدرجات */
  night?: boolean;
  /** أقراص النص فقط — بدون وسوم SVIP/الأرستقراطية المصوّرة */
  hideTags?: boolean;
  /** الوسوم المصوّرة فقط — بدون أقراص النص */
  tagsOnly?: boolean;
};

type StatBadgeProps = {
  colors: readonly [string, string, ...string[]];
  value: string;
  icon: React.ReactNode;
  onPress: () => void;
  ltr?: boolean;
  dark?: boolean;
  night?: boolean;
};

function StatBadge({ value, icon, onPress, ltr, night }: StatBadgeProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.badge, night ? styles.badgeNight : styles.badgeLight, pressed && { opacity: 0.9 }]}
    >
      <Text
        weight="bold"
        style={[styles.badgeNum, !night && styles.badgeNumLight, ltr && styles.ltr]}
        numberOfLines={1}
      >
        {value}
      </Text>
      {icon}
    </Pressable>
  );
}

export function ProfileBadgesRow({ horizontalPad = 20, style, night, hideTags, tagsOnly }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { vipSystem, aristocracy, agencyPrince } = useConfig();
  const [relLevel, setRelLevel] = useState(0);
  const [relTitle, setRelTitle] = useState<string | null>(null);

  const wealthLevel = resolveUserWealthLevel(user);
  // المستوى الفعّال يشمل SVIP الممنوح من الأرستقراطية النشطة (شارة الهوية امتياز SVIP)
  const vipLevel = isUserVipActive(user) ? getEffectiveVipLevel(user) : 0;
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

  // عنوان العلاقة مخزّن بالعربية في الخدمة — الترجمة بمفتاح المستوى عند العرض.
  const titleText = relLevel > 0
    ? t(`relationshipLevels.${relLevel}`, { defaultValue: relTitle ?? '' })
    : t('profile.badgeDefaultTitle');
  const hasAny = tagsOnly
    ? !!SVIP_LEVEL_TAGS[vipLevel] || isVipBadgeUnlocked || !!aristocracyBadgeUrl
    : titleText || relLevel > 0 || wealthLevel > 0 || isVipBadgeUnlocked
      || !!princeBadgeUrl || !!aristocracyBadgeUrl || (user?.isVerified && user?.profile?.gender === 'female');
  if (!hasAny) return null;

  // عرض وسم SVIP من أبعاد الأصل الفعلية — لا فراغ زائد بعد الرسم
  const svipTagSrc = SVIP_LEVEL_TAGS[vipLevel];
  const svipTagDims = svipTagSrc ? RNImage.resolveAssetSource(svipTagSrc) : null;
  const svipTagW = svipTagDims && svipTagDims.height > 0
    ? Math.min(130, Math.round((42 * svipTagDims.width) / svipTagDims.height))
    : 92;

  return (
    <View style={[styles.row, { paddingHorizontal: horizontalPad }, style]}>
      {!tagsOnly && user?.isVerified && user?.profile?.gender === 'female' ? (
        <VerifiedHostBadge />
      ) : null}

      {!tagsOnly && princeBadgeUrl ? (
        <ProfileImageBadge
          uri={princeBadgeUrl}
          wide
          onPress={() => router.push('/agency/prince' as any)}
        />
      ) : null}

      {!tagsOnly && titleText ? (
        <TravelerTitleBadge
          title={titleText}
          size="sm"
          night={night}
          onPress={() => router.push('/collection' as any)}
        />
      ) : null}

      {!tagsOnly && relLevel > 0 ? (
        <StatBadge
          colors={['#FF6670', '#E11414', '#C40E1E']}
          value={String(relLevel)}
          icon={<InfinityIcon size={12} color={night ? '#fff' : '#E11414'} strokeWidth={2.6} />}
          onPress={() => router.push('/relationships' as any)}
          night={night}
        />
      ) : null}

      {!tagsOnly && wealthLevel > 0 ? (
        <StatBadge
          colors={['#F16D6D', '#EB3030', '#D61E1E']}
          value={String(wealthLevel)}
          icon={<Gem size={12} color={night ? '#FF5C6C' : '#E11414'} strokeWidth={2.2} />}
          onPress={() => router.push('/wealth-level' as any)}
          night={night}
        />
      ) : null}

      {!tagsOnly && !hideTags ? <View style={styles.lineBreak} /> : null}

      {!hideTags && svipTagSrc ? (
        <Pressable
          onPress={() => router.push('/vip' as any)}
          style={({ pressed }) => [styles.imageBadge, { width: svipTagW, height: 42 }, pressed && { opacity: 0.88 }]}
        >
          <DecorImage
            source={svipTagSrc}
            width={svipTagW}
            height={42}
            allowDownscaling
            contentPosition={I18nManager.isRTL ? 'right center' : 'left center'}
          />
        </Pressable>
      ) : !hideTags && isVipBadgeUnlocked ? (
        vipBadgeUrl ? (
          <ProfileImageBadge uri={vipBadgeUrl} onPress={() => router.push('/vip' as any)} />
        ) : (
          <StatBadge
            colors={['#FFD86F', '#F5B721', '#E0930B']}
            value={vipLabel}
            icon={<Crown size={12} color={night ? '#F5BE37' : '#7A4E00'} fill={night ? '#F5BE37' : '#7A4E00'} strokeWidth={1.4} />}
            onPress={() => router.push('/vip' as any)}
            ltr
            dark
            night={night}
          />
        )
      ) : null}

      {!hideTags && aristocracyBadgeUrl ? (
        <Pressable
          onPress={() => router.push('/vip/aristocracy' as any)}
          style={({ pressed }) => [styles.imageBadge, { width: 92, height: 42 }, pressed && { opacity: 0.88 }]}
        >
          <DecorImage
            source={{ uri: aristocracyBadgeUrl }}
            width={92}
            height={42}
            allowDownscaling
            recyclingKey={aristocracyBadgeUrl}
            contentPosition={I18nManager.isRTL ? 'right center' : 'left center'}
          />
        </Pressable>
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
    gap: 4,
    rowGap: 8,
    paddingVertical: 8,
    width: '100%',
  },
  lineBreak: {
    width: '100%',
    height: 0,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: PROFILE_BADGE_H,
    minWidth: 40,
    paddingHorizontal: 7,
    borderRadius: 99,
    overflow: 'hidden',
    ...lu.shadows.card,
  },
  badgeNight: {
    backgroundColor: 'rgba(255,60,75,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,105,0.28)',
    shadowOpacity: 0,
    elevation: 0,
  },
  badgeLight: {
    backgroundColor: 'rgba(225,20,20,0.07)',
    borderWidth: 1,
    borderColor: '#F0BABA',
    shadowOpacity: 0,
    elevation: 0,
  },
  badgeNumLight: {
    color: '#B00E0E',
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
