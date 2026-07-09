/**
 * بطاقة VIP/SVIP في البروفايل — تصميم منظّم: شارة مستوى، شريط تقدّم، امتيازات بأيقونات متجهية، وزر الحفاظ على المستوى
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { DecorImage } from '@/components/ui/DecorImage';
import {
  Clock,
  Crown,
  Rocket,
  MessageCircle,
  DoorOpen,
  Medal,
  Armchair,
  Frame,
  IdCard,
  Sparkles,
  ChevronLeft,
} from 'lucide-react-native';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import {
  levelDefFor,
  maintainVipLevel,
  formatVipExpiryDate,
  pointsToMaintain,
  unlockedPrivilegesForUser,
  countUnlockedPrivileges,
  resolveLevelBadgeUrl,
  resolveVipPrivilegeAsset,
  type VipPrivilegeDef,
} from '@/services/firebase/vipSystem';
import { VipPrivilegeModal } from '@/components/vip/VipPrivilegeModal';

type Props = {
  horizontalPad?: number;
  style?: StyleProp<ViewStyle>;
};

const PREVIEW_ICONS = 4;
const GOLD_INK = '#7A4E00';
const GOLD_DEEP = '#B8740A';

function formatCompact(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, n) : 0;
  if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}T`;
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${(v / 1_000).toFixed(0)}K`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString('en-US');
}

/** أيقونة متجهية نظيفة لكل امتياز بدل صور اللعبة */
function privilegeIcon(assetKey: string, size = 18, color = GOLD_DEEP) {
  const props = { size, color, strokeWidth: 2 as const };
  switch (assetKey) {
    case 'vipBadge': return <Crown {...props} />;
    case 'vipSeat': return <Armchair {...props} />;
    case 'entryEffect': return <Rocket {...props} />;
    case 'chatBubble': return <MessageCircle {...props} />;
    case 'profileCard': return <IdCard {...props} />;
    case 'vipEntry': return <DoorOpen {...props} />;
    case 'photoFrame': return <Frame {...props} />;
    case 'honorMedal': return <Medal {...props} />;
    default: return <Sparkles {...props} />;
  }
}

export function ProfileVipStatusCard({ horizontalPad = 20, style }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { vipSystem } = useConfig();
  const [maintaining, setMaintaining] = useState(false);
  const [selectedPrivilege, setSelectedPrivilege] = useState<VipPrivilegeDef | null>(null);

  const vipLevel = user?.vipLevel ?? 0;
  const levelDef = levelDefFor(vipLevel, vipSystem.levels);
  const nextDef = levelDefFor(vipLevel + 1, vipSystem.levels);

  const maintain = useMemo(
    () => pointsToMaintain(
      vipLevel,
      user?.vipPointsMonth ?? 0,
      vipSystem.levels,
      user?.vipMonthKey,
    ),
    [vipLevel, user?.vipPointsMonth, user?.vipMonthKey, vipSystem.levels],
  );

  const unlocked = useMemo(
    () => unlockedPrivilegesForUser(vipLevel, vipSystem.privileges).map((p) => {
      const resolved = resolveVipPrivilegeAsset(vipLevel, p.assetKey, vipSystem);
      return resolved || p;
    }),
    [vipLevel, vipSystem],
  );

  const totalPrivileges = vipSystem.privileges.length;
  const unlockedCount = countUnlockedPrivileges(vipLevel, vipSystem.privileges);
  const previewPrivileges = unlocked.slice(0, PREVIEW_ICONS);
  const extraCount = Math.max(0, unlocked.length - PREVIEW_ICONS);

  const expiryLabel = formatVipExpiryDate(user?.vipExpiresAt);
  const isSvip = vipLevel >= 1;
  const levelBadgeUrl = resolveLevelBadgeUrl(levelDef, false);

  const current = user?.vipPointsMonth ?? 0;
  const required = maintain.required || 0;
  const progress = required > 0 ? Math.min(1, Math.max(0, current / required)) : 1;

  const handleMaintain = useCallback(async () => {
    if (!user?.uid) return;
    if (!maintain.canMaintain) {
      Alert.alert(
        t('profile.vipMaintainNeedTitle'),
        t('vipHub.maintainNeed', {
          count: formatCompact(maintain.remaining) as any,
          level: levelDef?.label ?? '',
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('vipHub.getPoints'), onPress: () => router.push('/wallet/recharge' as any) },
        ],
      );
      return;
    }
    setMaintaining(true);
    try {
      await maintainVipLevel(user.uid);
      await refreshUser();
      Alert.alert(t('vipHub.maintainSuccess'), t('vipHub.maintainSuccessDesc'));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
    } finally {
      setMaintaining(false);
    }
  }, [user?.uid, maintain, levelDef?.label, refreshUser, router, t]);

  if (vipLevel < 1 || !levelDef) return null;

  return (
    <>
      <Pressable
        onPress={() => router.push('/vip' as any)}
        style={({ pressed }) => [
          styles.wrap,
          { marginHorizontal: horizontalPad },
          pressed && { opacity: 0.96 },
          style,
        ]}
      >
        <LinearGradient
          colors={['#FFFBF0', '#FFF3D6', '#FFE7AE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* الرأس: شارة المستوى + المستوى التالي */}
          <View style={styles.header}>
            <View style={styles.levelGroup}>
              <View style={styles.crest}>
                {levelBadgeUrl ? (
                  <DecorImage
                    source={{ uri: levelBadgeUrl }}
                    width={44}
                    height={44}
                    recyclingKey={levelBadgeUrl}
                  />
                ) : (
                  <Crown size={20} color="#fff" fill="#fff" strokeWidth={1.3} />
                )}
              </View>
              <View style={styles.levelTexts}>
                <Text weight="bold" style={styles.levelLabel} numberOfLines={1}>
                  {levelDef.label}
                </Text>
                <View style={styles.dateRow}>
                  <Clock size={11} color="#9A7B2F" strokeWidth={2.2} />
                  <Text style={styles.dateText} numberOfLines={1}>{expiryLabel}</Text>
                </View>
              </View>
            </View>

            {nextDef ? (
              <Pressable
                onPress={(e) => { e.stopPropagation(); router.push('/vip' as any); }}
                style={styles.nextChip}
              >
                <Text style={styles.nextChipText} numberOfLines={1}>
                  {t('profile.vipNextLevel', { label: nextDef.label })}
                </Text>
                <ChevronLeft size={13} color={GOLD_DEEP} strokeWidth={2.4} />
              </Pressable>
            ) : (
              <View style={styles.nextChip}>
                <Text style={styles.nextChipText} numberOfLines={1}>
                  {t('profile.vipMaxLevel')}
                </Text>
              </View>
            )}
          </View>

          {/* شريط تقدّم نقاط الشهر */}
          <View style={styles.progressBlock}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressCaption} numberOfLines={1}>
                {t('profile.vipMonthPoints', {
                  current: formatCompact(current),
                  required: formatCompact(required),
                })}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={['#FFCF45', '#F59E0B', '#E0820A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]}
              />
            </View>
            <Text style={styles.needText} numberOfLines={2}>
              {t('vipHub.maintainNeed', {
                count: formatCompact(maintain.remaining) as any,
                level: levelDef.label,
              })}
            </Text>
          </View>

          {/* الامتيازات */}
          <View style={styles.privHeader}>
            <Sparkles size={13} color={GOLD_DEEP} strokeWidth={2.2} />
            <Text style={styles.privHeaderText} numberOfLines={1}>
              {t('profile.vipPrivilegesSummary', {
                unlocked: unlockedCount,
                total: totalPrivileges,
                tier: isSvip ? 'SVIP' : 'VIP',
              })}
            </Text>
          </View>
          <View style={styles.privRow}>
            {previewPrivileges.map((p) => (
              <Pressable
                key={p.id}
                onPress={(e) => { e.stopPropagation(); setSelectedPrivilege(p); }}
                style={styles.privTile}
              >
                {p.imageUrl ? (
                  <DecorImage source={{ uri: p.imageUrl }} width={24} height={24} recyclingKey={p.imageUrl} />
                ) : (
                  privilegeIcon(p.assetKey, 18)
                )}
              </Pressable>
            ))}
            {extraCount > 0 ? (
              <Pressable
                onPress={(e) => { e.stopPropagation(); router.push('/vip' as any); }}
                style={[styles.privTile, styles.privMore]}
              >
                <Text style={styles.privMoreText}>+{extraCount}</Text>
              </Pressable>
            ) : null}
          </View>

          {/* زر الحفاظ على المستوى */}
          <Pressable
            onPress={(e) => { e.stopPropagation(); void handleMaintain(); }}
            disabled={maintaining}
            style={({ pressed }) => [styles.maintainBtn, pressed && { opacity: 0.92 }]}
          >
            <LinearGradient
              colors={['#FF3340', '#B00E0E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Crown size={15} color="#fff" fill="#fff" strokeWidth={1.4} />
            <Text
              weight="bold"
              style={styles.maintainText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {maintaining ? '...' : t('profile.vipMaintain')}
            </Text>
          </Pressable>
        </LinearGradient>
      </Pressable>

      <VipPrivilegeModal
        visible={!!selectedPrivilege}
        privilege={selectedPrivilege}
        userLevel={vipLevel}
        onClose={() => setSelectedPrivilege(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    marginBottom: 4,
  },
  card: {
    borderRadius: 24,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    ...lu.shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  levelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  crest: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0930B',
    ...lu.shadows.card,
  },
  levelTexts: {
    gap: 3,
    flexShrink: 1,
  },
  levelLabel: {
    fontSize: 19,
    color: '#9A6B05',
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
    writingDirection: 'ltr',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#9A7B2F',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
    writingDirection: 'ltr',
  },
  nextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.5)',
    paddingStart: 12,
    paddingEnd: 8,
    paddingVertical: 6,
    maxWidth: 150,
  },
  nextChipText: {
    fontSize: 11,
    color: GOLD_DEEP,
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
    flexShrink: 1,
  },
  progressBlock: {
    marginTop: 14,
    gap: 7,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressCaption: {
    fontSize: 12,
    color: '#8A6312',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
  progressTrack: {
    height: 9,
    borderRadius: 99,
    backgroundColor: 'rgba(184, 134, 11, 0.16)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    minWidth: 9,
  },
  needText: {
    fontSize: 11.5,
    color: '#9A7B2F',
    fontFamily: lu.fonts.body,
    lineHeight: 17,
    includeFontPadding: false,
  },
  privHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    marginBottom: 8,
  },
  privHeaderText: {
    fontSize: 11.5,
    color: '#8A6312',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
    flexShrink: 1,
  },
  privRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  privMore: {
    backgroundColor: 'rgba(224, 147, 11, 0.14)',
  },
  privMoreText: {
    fontSize: 13,
    color: GOLD_DEEP,
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
    writingDirection: 'ltr',
  },
  maintainBtn: {
    marginTop: 16,
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    ...lu.shadows.card,
  },
  maintainText: {
    fontSize: 14,
    color: '#FFFFFF',
    includeFontPadding: false,
    textAlign: 'center',
  },
});
