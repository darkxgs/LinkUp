/**
 * LinkUp App — SVIP Center
 * تصميم داكن مطابق للمنافس — كل المحتوى من لوحة التحكم
 */

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Dimensions,
  I18nManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { DecorImage } from '@/components/ui/DecorImage';
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Gift,
  Star,
  Trophy,
  Info,
  Lock,
} from 'lucide-react-native';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import {
  levelsForMode,
  privilegesForLevelTab,
  levelDefFor,
  countUnlockedForLevel,
  maintainVipLevel,
  progressInLevel,
  progressTowardThreshold,
  pointsToMaintain,
  effectiveMonthPoints,
  formatVipExpiryDate,
  resolveLevelBadgeUrl,
  type VipPrivilegeDef,
} from '@/services/firebase/vipSystem';
import { PrivilegeVectorIcon } from '@/components/icons/PrivilegeVectorIcon';
import { VipPrivilegeModal } from '@/components/vip/VipPrivilegeModal';
import { SVIP_DESIGN, resolveSvipLevelTheme } from '@/components/vip/svipDesign';
import { vipLevelEmblem } from '@/components/vip/vipDesign';
import { subscribeToStoreItems, localizeStoreItem } from '@/services/firebase/storeConfig';
import { purchaseStoreItem, type StoreItem } from '@/services/firebase/shop';
import { useLightStatusBarOnFocus } from '@/hooks/useLightStatusBarOnFocus';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GRID_COLS = 3;
const GRID_GAP = 10;
const GRID_H_PAD = 16;
const CARD_WIDTH = Math.floor(
  (SCREEN_WIDTH - GRID_H_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS,
);
const isRtl = I18nManager.isRTL;

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('en-US');
}

export default function VipHubScreen() {
  // شاشة داكنة الخلفية/الرأس — أيقونات شريط الحالة فاتحة أثناء التركيز فقط
  useLightStatusBarOnFocus();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { vipSystem } = useConfig();

  const isAr = i18n.language?.startsWith('ar');
  const lang = isAr ? 'ar' : 'en';

  const [viewLevel, setViewLevel] = useState<number | null>(null);
  const [selectedPrivilege, setSelectedPrivilege] = useState<VipPrivilegeDef | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [maintaining, setMaintaining] = useState(false);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);

  useEffect(() => {
    return subscribeToStoreItems(setStoreItems);
  }, []);

  const userLevel = user?.vipLevel ?? 0;
  const vipPoints = user?.vipPoints ?? 0;
  const vipPointsMonth = effectiveMonthPoints(user?.vipPointsMonth ?? 0, user?.vipMonthKey);
  const monthKey = user?.vipMonthKey;

  const modeLevels = useMemo(
    () => levelsForMode('svip', vipSystem.levels).filter((l) => l.enabled !== false),
    [vipSystem.levels],
  );

  const displayLevel = viewLevel ?? Math.max(1, userLevel >= 1 ? userLevel : 1);
  const displayDef = levelDefFor(displayLevel, vipSystem.levels);
  const theme = useMemo(() => resolveSvipLevelTheme(displayDef), [displayDef]);
  const isReached = userLevel >= displayLevel;

  const levelPrivileges = useMemo(
    () => privilegesForLevelTab(displayLevel, displayDef, vipSystem.privileges),
    [displayLevel, displayDef, vipSystem.privileges],
  );

  const levelStoreItems = useMemo(() => {
    const ids = displayDef?.storeItemIds ?? [];
    if (!ids.length) return [];
    return ids
      .map((id) => storeItems.find((s) => s.id === id))
      .filter((s): s is StoreItem => s != null)
      .map((item) => localizeStoreItem(item, lang));
  }, [displayDef?.storeItemIds, storeItems, lang]);

  const unlockedCount = countUnlockedForLevel(userLevel, levelPrivileges);
  const totalPrivileges = levelPrivileges.length + levelStoreItems.length;

  const showMaintain = userLevel > 0 && userLevel === displayLevel;
  const maintainInfo = pointsToMaintain(userLevel, vipPointsMonth, vipSystem.levels, monthKey);
  const monthProgress = progressInLevel(vipPointsMonth, userLevel, vipSystem.levels);
  const thresholdProgress = progressTowardThreshold(vipPoints, displayLevel, vipSystem.levels);
  const expiryStr = formatVipExpiryDate(user?.vipExpiresAt ?? null);
  const needsMoreForLevel = displayLevel > userLevel;

  const screenTitle = isAr
    ? (vipSystem.screenTitleAr ?? 'SVIP')
    : (vipSystem.screenTitleEn ?? 'SVIP');
  const privilegesLabel = isAr
    ? (vipSystem.privilegesSectionAr ?? 'امتيازات')
    : (vipSystem.privilegesSectionEn ?? 'Privileges');

  const heroSubtitle = isAr
    ? (displayDef?.heroSubtitleAr ?? (isReached ? 'لقد وصلت لهذا المستوى' : 'ارتقِ لمستوى أعلى'))
    : (displayDef?.heroSubtitleEn ?? (isReached ? 'You reached this level' : 'Upgrade to unlock'));

  const quickActions = useMemo(
    () => (vipSystem.quickActions ?? []).filter((a) => a.enabled !== false),
    [vipSystem.quickActions],
  );

  const badgeSource = useMemo(() => {
    const uri = resolveLevelBadgeUrl(displayDef, true);
    if (uri) return { uri };
    return vipLevelEmblem(displayLevel);
  }, [displayDef, displayLevel]);

  const handleMaintain = useCallback(async () => {
    if (!user?.uid) return;
    setMaintaining(true);
    try {
      await maintainVipLevel(user.uid);
      await refreshUser();
      Alert.alert(t('vipHub.maintainSuccess', 'نجاح'), t('vipHub.maintainSuccessDesc', 'تم الحفاظ على المستوى'));
    } catch (e: unknown) {
      Alert.alert(t('common.error', 'خطأ'), (e as Error).message);
    } finally {
      setMaintaining(false);
    }
  }, [user?.uid, refreshUser, t]);

  const openPrivilege = (p: VipPrivilegeDef) => {
    setSelectedPrivilege(p);
    setModalVisible(true);
  };

  // منع الشراء المزدوج: النافذة كانت قابلة لإعادة الفتح أثناء تنفيذ الشراء
  const buyingRef = useRef(false);

  const handleBuyStoreItem = useCallback(
    (item: StoreItem) => {
      if (buyingRef.current) return;
      if (userLevel < displayLevel) {
        Alert.alert(
          t('common.error', 'خطأ'),
          isAr ? `يتطلب ${displayDef?.label ?? ''}` : `Requires ${displayDef?.label ?? ''}`,
        );
        return;
      }
      Alert.alert(
        item.name,
        // السعر الدقيق في التأكيد — formatCompact كان يقرّب (15,500 → 16K)
        `${item.price.toLocaleString('en-US')} ${item.currency === 'pearls' ? 'لؤلؤ' : 'كوين'}`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('store.buy', 'شراء'),
            onPress: async () => {
              if (buyingRef.current) return;
              buyingRef.current = true;
              try {
                await purchaseStoreItem(item);
                await refreshUser();
                Alert.alert(t('common.success', 'نجاح'), t('store.purchaseSuccess', 'تم الشراء'));
              } catch (e: unknown) {
                Alert.alert(t('common.error', 'خطأ'), (e as Error).message);
              } finally {
                buyingRef.current = false;
              }
            },
          },
        ],
      );
    },
    [userLevel, displayLevel, displayDef?.label, isAr, refreshUser, t],
  );

  const quickIcon = (id: string) => {
    if (id === 'tasks') return Star;
    if (id === 'honor') return Trophy;
    return Gift;
  };

  return (
    <View style={styles.fill}>
      <LinearGradient colors={[...theme.bg]} style={StyleSheet.absoluteFill} />

      {displayDef?.backgroundImageUrl ? (
        <Image
          source={{ uri: displayDef.backgroundImageUrl }}
          style={styles.heroBgImage}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : null}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', SVIP_DESIGN.screenBg]}
        style={styles.heroBgOverlay}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.push('/vip/rules')} style={styles.headBtn} hitSlop={10}>
          <HelpCircle size={22} color={SVIP_DESIGN.ink} strokeWidth={2} />
        </Pressable>
        <Text weight="bold" style={styles.headerTitle}>{screenTitle}</Text>
        <Pressable onPress={() => router.back()} style={styles.headBtn} hitSlop={10}>
          {isAr ? (
            <ChevronRight size={24} color={SVIP_DESIGN.ink} strokeWidth={2.5} />
          ) : (
            <ChevronLeft size={24} color={SVIP_DESIGN.ink} strokeWidth={2.5} />
          )}
        </Pressable>
      </View>

      {/* Level tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.levelTabs}
        style={{ maxHeight: 44, marginBottom: 8 }}
      >
        {modeLevels.map((lv) => {
          const active = displayLevel === lv.level;
          return (
            <Pressable key={lv.level} onPress={() => setViewLevel(lv.level)} style={styles.levelTab}>
              <Text
                weight="bold"
                numberOfLines={1}
                style={[styles.levelTabText, active && { color: SVIP_DESIGN.tabActive }]}
              >
                {lv.label}
              </Text>
              {active ? <View style={styles.levelDot} /> : <View style={styles.levelDotPlaceholder} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroRow}>
          <View style={styles.badgeCol}>
            {typeof badgeSource === 'object' && 'uri' in badgeSource ? (
              <DecorImage
                source={badgeSource}
                width={100}
                height={108}
                recyclingKey={badgeSource.uri}
              />
            ) : (
              <Image source={badgeSource} style={styles.levelBadge} contentFit="contain" cachePolicy="memory-disk" />
            )}
            <LinearGradient colors={['#FFD86F', '#B8860B']} style={styles.badgePlate}>
              <Text weight="bold" style={styles.badgePlateText}>{displayDef?.label ?? `SVIP${displayLevel}`}</Text>
            </LinearGradient>
            <Text style={styles.currentLevelLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {showMaintain
                ? (isAr ? 'المستوى الحالي' : 'Current Level')
                : isReached
                  ? (isAr ? 'مفتوح' : 'Unlocked')
                  : (isAr ? 'مُقفل' : 'Locked')}
            </Text>
          </View>

          <View style={styles.heroInfo}>
            <Text
              weight="bold"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[styles.userLevelText, { color: theme.accent }]}
            >
              {displayDef?.label ?? `SVIP${displayLevel}`}
            </Text>

            <Pressable style={styles.historyRow} onPress={() => router.push('/wallet/recharge')}>
              {user?.profile.avatar ? (
                <Image
                  source={{ uri: user.profile.avatar }}
                  style={styles.miniAvatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.miniAvatar, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
              )}
              <Text style={styles.historyText} numberOfLines={1}>
                {isAr ? 'شحن >' : 'Recharge >'}
              </Text>
            </Pressable>

            {showMaintain ? (
              <>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${monthProgress.pct}%` }]} />
                </View>
                <Text style={styles.progressNumbers}>
                  {formatCompact(monthProgress.current)}/{formatCompact(monthProgress.total)}
                </Text>
                {maintainInfo.remaining > 0 ? (
                  <Text style={styles.maintainHint} numberOfLines={2}>
                    {isAr
                      ? `تحتاج ${formatCompact(maintainInfo.remaining)} نقطة للإحتفاظ بـ ${displayDef?.label ?? ''}`
                      : `Need ${formatCompact(maintainInfo.remaining)} pts to maintain ${displayDef?.label ?? ''}`}
                  </Text>
                ) : null}
                {user?.vipExpiresAt ? (
                  <Text style={styles.expiryText}>
                    {isAr ? `تاريخ إنتهاء الصلاحية: ${expiryStr}` : `Expires: ${expiryStr}`}
                  </Text>
                ) : null}
              </>
            ) : needsMoreForLevel ? (
              <>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${thresholdProgress.pct}%` }]} />
                </View>
                <Text style={styles.progressNumbers}>
                  {formatCompact(thresholdProgress.current)}/{formatCompact(thresholdProgress.total)}
                </Text>
                <Text style={styles.maintainHint} numberOfLines={2}>
                  {isAr
                    ? `تحتاج ${formatCompact(thresholdProgress.remaining)} نقطة للوصول إلى ${displayDef?.label ?? ''}`
                    : `Need ${formatCompact(thresholdProgress.remaining)} pts for ${displayDef?.label ?? ''}`}
                </Text>
              </>
            ) : (
              <Text style={styles.heroSubtitle} numberOfLines={2}>{heroSubtitle}</Text>
            )}

            {isReached && !showMaintain ? (
              <View style={styles.openTag}>
                <Text style={styles.openTagText}>{isAr ? 'مفتوح' : 'Unlocked'}</Text>
              </View>
            ) : null}

            {showMaintain ? (
              <Pressable onPress={handleMaintain} disabled={maintaining} style={styles.maintainBtnWrap}>
                <LinearGradient colors={[...SVIP_DESIGN.maintainBtn]} style={styles.maintainBtn}>
                  <Text weight="bold" style={styles.maintainBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                    {maintaining ? '...' : (isAr ? 'إحتفظ بالمستوى' : 'Maintain Level')}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : needsMoreForLevel ? (
              <Pressable onPress={() => router.push('/wallet/recharge')} style={styles.maintainBtnWrap}>
                <LinearGradient colors={[...SVIP_DESIGN.maintainBtn]} style={styles.maintainBtn}>
                  <Text weight="bold" style={styles.maintainBtnText} numberOfLines={1}>
                    {isAr ? 'اشحن للترقية' : 'Recharge to upgrade'}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          {quickActions.map((action) => {
            const Icon = quickIcon(action.id);
            const label = isAr ? action.labelAr : action.labelEn;
            return (
              <Pressable
                key={action.id}
                style={styles.quickPill}
                onPress={() => action.route && router.push(action.route as never)}
              >
                <Icon size={15} color={SVIP_DESIGN.gold} strokeWidth={2} />
                <Text weight="bold" style={styles.quickPillText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Privileges bar */}
        <View style={styles.privBarWrap}>
          <LinearGradient colors={[...SVIP_DESIGN.goldBar]} style={styles.privBar}>
            <View style={styles.privBarGem} />
            <Text weight="bold" style={styles.privBarText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {privilegesLabel} {unlockedCount} / {totalPrivileges || levelPrivileges.length}
            </Text>
            <Info size={14} color={SVIP_DESIGN.gold} />
          </LinearGradient>
        </View>

        {/* Grid: privileges + store items */}
        <View style={styles.grid}>
          {levelPrivileges.map((p) => {
            const unlocked = userLevel >= p.unlockLevel;
            const tagLabel = unlocked ? (isAr ? 'مفتوح' : 'Open') : `SVIP${p.unlockLevel}`;
            const title = p.title || t(p.titleKey);

            return (
              <Pressable
                key={p.id}
                onPress={() => openPrivilege(p)}
                style={[styles.gridCard, { width: CARD_WIDTH }]}
              >
                <View style={[styles.gridTag, !unlocked && styles.gridTagLocked]}>
                  <Text style={styles.gridTagText} numberOfLines={1}>{tagLabel}</Text>
                </View>
                <View style={[styles.gridIconWrap, !unlocked && { opacity: 0.45 }]}>
                  {p.imageUrl ? (
                    <Image source={{ uri: p.imageUrl }} style={styles.gridIcon} contentFit="contain" />
                  ) : (
                    <PrivilegeVectorIcon name={p.assetKey} size={28} color={theme.accent} />
                  )}
                </View>
                <View style={styles.gridNameWrap}>
                  <Text
                    align="center"
                    numberOfLines={4}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                    weight="bold"
                    style={styles.gridName}
                  >
                    {title}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          {levelStoreItems.map((item) => {
            const unlocked = userLevel >= displayLevel;
            return (
              <Pressable
                key={`store-${item.id}`}
                onPress={() => handleBuyStoreItem(item)}
                style={[styles.gridCard, { width: CARD_WIDTH }]}
              >
                <View style={[styles.gridTag, !unlocked && styles.gridTagLocked]}>
                  {unlocked ? (
                    <Text style={styles.gridTagText} numberOfLines={1}>{formatCompact(item.price)}</Text>
                  ) : (
                    <Lock size={10} color="#FFF" />
                  )}
                </View>
                <View style={[styles.gridIconWrap, !unlocked && { opacity: 0.45 }]}>
                  {item.imageUrl || item.animationUrl ? (
                    <Image
                      source={{ uri: item.animationUrl || item.imageUrl }}
                      style={styles.gridIcon}
                      contentFit="contain"
                    />
                  ) : (
                    <Gift size={26} color={theme.accent} />
                  )}
                </View>
                <View style={styles.gridNameWrap}>
                  <Text
                    align="center"
                    numberOfLines={4}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                    weight="bold"
                    style={styles.gridName}
                  >
                    {item.name}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <VipPrivilegeModal
        visible={modalVisible}
        privilege={selectedPrivilege}
        userLevel={userLevel}
        onClose={() => {
          setModalVisible(false);
          setSelectedPrivilege(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: SVIP_DESIGN.screenBg },
  heroBgImage: { ...StyleSheet.absoluteFillObject, opacity: 0.45 },
  heroBgOverlay: { ...StyleSheet.absoluteFillObject },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 2,
  },
  headBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, color: SVIP_DESIGN.ink },
  levelTabs: { paddingHorizontal: GRID_H_PAD, gap: 16, alignItems: 'center' },
  levelTab: { alignItems: 'center', paddingHorizontal: 4, minWidth: 52 },
  levelTabText: { fontSize: 13, color: SVIP_DESIGN.tabInactive, lineHeight: 18 },
  levelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SVIP_DESIGN.tabActive,
    marginTop: 6,
  },
  levelDotPlaceholder: { height: 6, marginTop: 6 },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GRID_H_PAD,
    paddingTop: 8,
    gap: 12,
    minHeight: 168,
  },
  badgeCol: { alignItems: 'center', width: 108, flexShrink: 0 },
  levelBadge: { width: 100, height: 108 },
  badgePlate: {
    marginTop: -14,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  badgePlateText: { fontSize: 11, color: '#FFF', lineHeight: 15 },
  currentLevelLabel: {
    fontSize: 10,
    color: SVIP_DESIGN.inkMuted,
    marginTop: 8,
    textAlign: 'center',
    width: '100%',
    letterSpacing: 0.3,
  },
  heroInfo: { flex: 1, minWidth: 0, paddingTop: 4, paddingEnd: 4 },
  userLevelText: { fontSize: 24, lineHeight: 32, letterSpacing: 0.5 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, maxWidth: '100%' },
  miniAvatar: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  historyText: { fontSize: 11, color: SVIP_DESIGN.inkMuted, lineHeight: 16, flexShrink: 1 },
  heroSubtitle: { fontSize: 12, color: SVIP_DESIGN.inkMuted, marginTop: 6, lineHeight: 18, flexShrink: 1 },
  openTag: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  openTagText: { fontSize: 10, color: SVIP_DESIGN.inkMuted },
  maintainBtnWrap: { marginTop: 12, alignSelf: 'stretch', maxWidth: '100%', borderRadius: 22, overflow: 'hidden' },
  maintainBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 22, minHeight: 42, justifyContent: 'center' },
  maintainBtnText: { fontSize: 13, color: '#FFF', lineHeight: 18, textAlign: 'center' },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: SVIP_DESIGN.gold,
  },
  progressNumbers: {
    fontSize: 11,
    color: SVIP_DESIGN.inkMuted,
    marginTop: 6,
    textAlign: 'right',
  },
  maintainHint: {
    fontSize: 11,
    color: SVIP_DESIGN.inkMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  expiryText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 4,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: GRID_H_PAD,
    marginTop: 14,
  },
  quickPill: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 22,
    backgroundColor: SVIP_DESIGN.pillBg,
    borderWidth: 1,
    borderColor: SVIP_DESIGN.pillBorder,
  },
  quickPillText: {
    fontSize: 10,
    color: SVIP_DESIGN.ink,
    lineHeight: 14,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
  privBarWrap: { marginHorizontal: GRID_H_PAD, marginTop: 16, marginBottom: 14 },
  privBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(245,200,66,0.35)',
  },
  privBarGem: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: SVIP_DESIGN.progressGem,
    transform: [{ rotate: '45deg' }],
  },
  privBarText: { flex: 1, fontSize: 12, color: SVIP_DESIGN.gold, lineHeight: 17, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginHorizontal: GRID_H_PAD,
    paddingBottom: 8,
  },
  gridCard: {
    backgroundColor: SVIP_DESIGN.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SVIP_DESIGN.cardBorder,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    position: 'relative',
    minHeight: 152,
  },
  gridTag: {
    position: 'absolute',
    top: 0,
    ...(isRtl
      ? { right: 0, borderTopRightRadius: 14, borderBottomLeftRadius: 10 }
      : { left: 0, borderTopLeftRadius: 14, borderBottomRightRadius: 10 }),
    backgroundColor: SVIP_DESIGN.unlockedTag,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 2,
    minWidth: 26,
    alignItems: 'center',
  },
  gridTagLocked: { backgroundColor: SVIP_DESIGN.lockedTag },
  gridTagText: { fontSize: 8, color: '#FFF', fontWeight: '700', lineHeight: 11 },
  gridIconWrap: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    marginTop: 4,
  },
  gridIcon: { width: 42, height: 42 },
  gridNameWrap: {
    width: '100%',
    minHeight: 56,
    justifyContent: 'flex-start',
    paddingHorizontal: 1,
  },
  gridName: {
    fontSize: 10,
    lineHeight: 14,
    color: SVIP_DESIGN.ink,
    width: '100%',
  },
});
