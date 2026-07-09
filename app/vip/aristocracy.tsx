/**
 * LinkUp App — Aristocracy Screen
 * تصميم مطابق للمنافس — كل المحتوى من لوحة التحكم
 */

import React, { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Dimensions,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ChevronLeft, ChevronRight, MoreHorizontal, Info } from 'lucide-react-native';
import i18n from '@/localization/i18n';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { WALLET_ASSETS } from '@/components/wallet/walletDesign';
import { useLightStatusBarOnFocus } from '@/hooks/useLightStatusBarOnFocus';
import {
  readAristocracyState,
  isAristocracyActive,
  resolvePurchasePrice,
  purchaseAristocracy,
  type AristocracyPrivilege,
} from '@/services/firebase/aristocracySystem';
import {
  resolveVipPrivilegeAsset,
  levelDefFor,
  type VipPrivilegeAsset,
} from '@/services/firebase/vipSystem';
import {
  ARISTOCRACY_ASSETS,
  resolveAristocracyLevelTheme,
  type AristocracyAssetKey,
} from '@/components/vip/aristocracyDesign1';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const PREVIEW_GAP = 10;
const PREVIEW_W = Math.floor((SCREEN_WIDTH - H_PAD * 2 - PREVIEW_GAP) / 2);
const ICON_COLS = 3;
const ICON_GAP = 10;
const ICON_SIZE = Math.floor((SCREEN_WIDTH - H_PAD * 2 - ICON_GAP * (ICON_COLS - 1)) / ICON_COLS);
const GIFT_COLS = 4;
const GIFT_GAP = 8;
const GIFT_CELL = Math.floor((SCREEN_WIDTH - H_PAD * 2 - GIFT_GAP * (GIFT_COLS - 1)) / GIFT_COLS);
const isRtl = I18nManager.isRTL;

function formatCoins(n: number): string {
  return n.toLocaleString('en-US');
}

/** فيديو امتياز صغير يعمل تلقائياً بصمت وتكرار (مثل دخولية الفيديو) */
function PrivilegeVideo({ uri, size }: { uri: string; size: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ width: size, height: size }}
      contentFit="contain"
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
  );
}

function PrivilegeImage({
  privilege,
  size,
  accent: _accent,
}: {
  privilege: AristocracyPrivilege;
  size: number;
  accent: string;
}) {
  if (privilege.imageUrl) {
    return (
      <Image
        source={{ uri: privilege.imageUrl }}
        style={{ width: size, height: size }}
        contentFit="contain"
        cachePolicy="memory-disk"
      />
    );
  }
  const video = privilege.videoUrl || privilege.videoUrlMp4;
  if (video) {
    return <PrivilegeVideo uri={video} size={size} />;
  }
  const asset = ARISTOCRACY_ASSETS[privilege.assetKey as AristocracyAssetKey] ?? ARISTOCRACY_ASSETS.emblem;
  return <Image source={asset} style={{ width: size, height: size }} contentFit="contain" />;
}

export default function AristocracyScreen() {
  // شاشة داكنة الخلفية/الرأس — أيقونات شريط الحالة فاتحة أثناء التركيز فقط
  useLightStatusBarOnFocus();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { aristocracy: config, gifts: giftsCatalog, vipSystem } = useConfig();

  const isAr = i18n.language?.startsWith('ar');

  const levels = useMemo(
    () => [...config.levels].filter((l) => l.enabled).sort((a, b) => b.level - a.level),
    [config.levels],
  );

  const defaultIdx = Math.max(0, levels.findIndex((l) => l.id === 'aristocrat'));
  const [selectedIdx, setSelectedIdx] = useState(defaultIdx >= 0 ? defaultIdx : 0);
  const [purchasing, setPurchasing] = useState(false);

  const tier = levels[selectedIdx] ?? levels[0]!;

  const state = useMemo(
    () =>
      readAristocracyState({
        aristocracy: user?.aristocracy,
        aristocracyLevel: user?.aristocracyLevel,
        aristocracyExpiresAt: user?.aristocracyExpiresAt,
      }),
    [user],
  );

  const myCoins = user?.stats?.coins ?? 0;
  const active = isAristocracyActive(state);
  const isMyLevel = active && state.level === tier.level;

  const priceInfo = useMemo(() => {
    try {
      return resolvePurchasePrice(tier, state, config);
    } catch {
      return { price: tier.activationCoins, mode: 'activation' as const, labelAr: 'تفعيل', labelEn: 'Activate' };
    }
  }, [tier, state, config]);

  const canAfford = myCoins >= priceInfo.price;
  const levelName = isAr ? tier.nameAr : tier.nameEn;
  const theme = useMemo(() => resolveAristocracyLevelTheme(tier), [tier]);
  const accent = theme.accent;

  const allPrivileges = useMemo(
    () => [...tier.privileges].filter((p) => p.enabled !== false).sort((a, b) => a.order - b.order),
    [tier.privileges],
  );

  const previewPrivileges = useMemo(
    () => allPrivileges.filter((p) => p.layout === 'wide' || p.layout === 'half'),
    [allPrivileges],
  );

  const baseShowPrivileges = useMemo(() => {
    const icons = allPrivileges.filter((p) => p.layout === 'icon');
    if (icons.length) return icons;
    return allPrivileges.filter((p) => p.layout !== 'wide' && p.layout !== 'half');
  }, [allPrivileges]);

  // امتيازات SVIP الممنوحة لهذا الباكج — تُعرض ضمن «إمتيازات العرض» بنفس وسائط SVIP
  const grantedSvipLevel = tier.grantedVipLevel ?? 0;
  const svipLabel = useMemo(() => {
    if (!grantedSvipLevel) return '';
    return levelDefFor(grantedSvipLevel, vipSystem.levels)?.label ?? `SVIP${grantedSvipLevel}`;
  }, [grantedSvipLevel, vipSystem.levels]);

  const grantedSvipPrivileges = useMemo<AristocracyPrivilege[]>(() => {
    if (!grantedSvipLevel) return [];
    // الأصول البصرية التي يحصل عليها المستخدم من مستوى SVIP (شارة، دخولية، إطار، فقاعة، بطاقة)
    const wanted: { key: VipPrivilegeAsset; ar: string; en: string }[] = [
      { key: 'vipBadge', ar: 'علامة VIP', en: 'VIP Badge' },
      { key: 'vipEntry', ar: 'دخولية VIP', en: 'VIP Entrance' },
      { key: 'entryEffect', ar: 'تأثير الدخول', en: 'Entry Effect' },
      { key: 'photoFrame', ar: 'إطار الصورة', en: 'Photo Frame' },
      { key: 'chatBubble', ar: 'فقاعة الكتابة', en: 'Chat Bubble' },
      { key: 'profileCard', ar: 'بطاقة الملف', en: 'Profile Card' },
    ];
    const out: AristocracyPrivilege[] = [];
    wanted.forEach((w, idx) => {
      const resolved = resolveVipPrivilegeAsset(grantedSvipLevel, w.key, vipSystem);
      const media = resolved?.imageUrl || resolved?.videoUrl || resolved?.videoUrlMp4;
      if (!resolved || !media) return;
      out.push({
        id: `svip-${w.key}`,
        titleAr: resolved.title?.trim() || w.ar,
        titleEn: resolved.title?.trim() || w.en,
        descAr: resolved.desc ?? '',
        descEn: resolved.desc ?? '',
        assetKey: w.key,
        layout: 'icon',
        order: idx,
        imageUrl: resolved.imageUrl,
        videoUrl: resolved.videoUrl,
        videoUrlMp4: resolved.videoUrlMp4,
        enabled: true,
      });
    });
    return out;
  }, [grantedSvipLevel, vipSystem]);

  const grantedSvipIds = useMemo(
    () => new Set(grantedSvipPrivileges.map((p) => p.id)),
    [grantedSvipPrivileges],
  );

  // امتيازات SVIP الممنوحة تظهر أولاً، ثم امتيازات العرض المخصّصة للباكج
  const showPrivileges = useMemo(
    () => [...grantedSvipPrivileges, ...baseShowPrivileges],
    [grantedSvipPrivileges, baseShowPrivileges],
  );

  const exclusiveGifts = useMemo(() => {
    const ids = tier.exclusiveGiftIds ?? [];
    if (!ids.length) return [];
    return ids
      .map((id) => giftsCatalog.find((g) => g.id === id))
      .filter((g): g is NonNullable<typeof g> => Boolean(g));
  }, [tier.exclusiveGiftIds, giftsCatalog]);

  const showSectionTitle = isAr
    ? (config.showPrivilegesSectionAr ?? 'إمتيازات العرض')
    : (config.showPrivilegesSectionEn ?? 'Display Privileges');

  const identityRulesLabel = isAr
    ? (config.identityRulesAr ?? 'قيود الهوية')
    : (config.identityRulesEn ?? 'Identity restrictions');

  const statusText = tier.comingSoon
    ? t('aristocracy.comingSoonLabel', 'قريباً')
    : isMyLevel
      ? t('aristocracy.activeUntil', {
          date: new Date(state.expiresAt!).toLocaleDateString(isAr ? 'ar' : 'en-US'),
        })
      : t('aristocracy.notActive', 'غير مفعل');

  const activateLabel = isAr
    ? (priceInfo.labelAr ?? 'تفعيل')
    : ((priceInfo as { labelEn?: string }).labelEn ?? 'Activate');

  const handlePurchase = useCallback(() => {
    if (tier.comingSoon || purchasing) {
      if (tier.comingSoon) {
        Alert.alert(t('aristocracy.comingSoonTitle'), t('aristocracy.comingSoonMsg'));
      }
      return;
    }
    if (!canAfford) {
      Alert.alert(
        t('vip.insufficientTitle', 'رصيد غير كافٍ'),
        t('vip.insufficientBalance', { needed: priceInfo.price, have: myCoins }),
      );
      return;
    }
    Alert.alert(
      t('vip.text89760', 'تأكيد الشراء'),
      `${activateLabel} "${levelName}" — ${formatCoins(priceInfo.price)} ${isAr ? 'عملة' : 'coins'} / ${tier.validityDays} ${isAr ? 'يوم' : 'days'}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            setPurchasing(true);
            try {
              await purchaseAristocracy(tier.id);
              await refreshUser?.();
              Alert.alert(t('common.success'), isAr ? `تم تفعيل ${levelName}` : `${levelName} activated`);
            } catch (e: unknown) {
              Alert.alert(t('common.error'), (e as Error).message);
            } finally {
              setPurchasing(false);
            }
          },
        },
      ],
    );
  }, [tier, purchasing, canAfford, priceInfo, myCoins, levelName, activateLabel, isAr, refreshUser, t]);

  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  return (
    <View style={styles.fill}>
      <LinearGradient colors={[...theme.bg]} style={StyleSheet.absoluteFill} />

      {tier.backgroundImageUrl ? (
        <Image
          source={{ uri: tier.backgroundImageUrl }}
          style={styles.bgImage}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : null}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)', theme.bg[2] ?? '#0A0405']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.push('/vip/aristocracy-rules' as never)} style={styles.headBtn} hitSlop={10}>
          <MoreHorizontal size={22} color="#FFF" strokeWidth={2} />
        </Pressable>
        <Text weight="bold" style={styles.headerTitle}>
          {isAr ? config.titleAr : config.titleEn}
        </Text>
        <Pressable onPress={() => router.back()} style={styles.headBtn} hitSlop={10}>
          <BackIcon size={24} color="#FFF" strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* Level tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.levelTabsScroll}
        contentContainerStyle={styles.levelTabs}
      >
        {levels.map((lv, idx) => {
          const activeTab = selectedIdx === idx;
          const name = isAr ? lv.nameAr : lv.nameEn;
          return (
            <Pressable key={lv.id} onPress={() => setSelectedIdx(idx)} style={styles.levelTab}>
              <Text
                weight={activeTab ? 'bold' : 'medium'}
                align="center"
                style={[styles.levelTabText, activeTab && styles.levelTabTextActive]}
                numberOfLines={2}
              >
                {name}
              </Text>
              {activeTab ? (
                <View style={styles.tabIndicatorWrap}>
                  <View style={[styles.levelDot, { backgroundColor: accent }]} />
                  <LinearGradient
                    colors={[`${accent}CC`, `${accent}44`, 'transparent']}
                    style={[styles.tabArc, { borderColor: `${accent}66` }]}
                  />
                </View>
              ) : (
                <View style={styles.tabIndicatorPlaceholder} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.statusLine} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
        {statusText}
      </Text>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 160, paddingHorizontal: H_PAD }}
        showsVerticalScrollIndicator={false}
      >
        {/* Preview privilege cards (2 col) */}
        {!tier.comingSoon && previewPrivileges.length > 0 && (
          <View style={styles.previewGrid}>
            {previewPrivileges.map((p) => {
              const title = isAr ? p.titleAr : p.titleEn;
              return (
                <View
                  key={p.id}
                  style={[
                    styles.previewCard,
                    { width: PREVIEW_W, borderColor: `${accent}44` },
                  ]}
                >
                  <View style={styles.previewImageWrap}>
                    <PrivilegeImage privilege={p} size={PREVIEW_W - 36} accent={accent} />
                  </View>
                  <Text
                    weight="bold"
                    align="center"
                    numberOfLines={3}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                    style={styles.previewTitle}
                  >
                    {title}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Exclusive gift shop — 4 columns */}
        {!tier.comingSoon && exclusiveGifts.length > 0 && (
          <View style={styles.giftsSection}>
            <Text weight="bold" style={styles.sectionLabel}>
              {isAr ? 'متجر الهدايا الحصرية' : 'Exclusive gift shop'}
            </Text>
            <View style={styles.giftGrid}>
              {exclusiveGifts.map((g) => (
                <View key={g.id} style={[styles.giftCell, { width: GIFT_CELL, borderColor: `${accent}44` }]}>
                  <Image
                    source={g.imageUrl || g.animationUrl ? { uri: g.imageUrl || g.animationUrl } : WALLET_ASSETS.coin}
                    style={styles.giftImg}
                    contentFit="contain"
                  />
                  <Text
                    variant="caption"
                    align="center"
                    numberOfLines={3}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={styles.giftName}
                  >
                    {g.name}
                  </Text>
                  <Text variant="caption" align="center" style={styles.giftPrice}>
                    {formatCoins(g.price)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Show privileges divider + emblem */}
        {!tier.comingSoon && showPrivileges.length > 0 && (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Image
                source={tier.imageUrl ? { uri: tier.imageUrl } : ARISTOCRACY_ASSETS.emblem}
                style={styles.dividerEmblem}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
              <View style={styles.dividerLine} />
            </View>
            <Text weight="bold" align="center" style={styles.dividerText}>{showSectionTitle}</Text>

            <View style={styles.iconGrid}>
              {showPrivileges.map((p) => {
                const title = isAr ? p.titleAr : p.titleEn;
                const isSvip = grantedSvipIds.has(p.id);
                return (
                  <View key={p.id} style={[styles.iconCell, { width: ICON_SIZE }]}>
                    <LinearGradient
                      colors={[`${accent}44`, `${accent}18`, 'rgba(20,8,10,0.92)']}
                      style={styles.iconCircle}
                    >
                      <PrivilegeImage privilege={p} size={34} accent={accent} />
                      {isSvip && svipLabel ? (
                        <View style={[styles.svipTag, { backgroundColor: accent }]}>
                          <Text style={styles.svipTagText}>{svipLabel}</Text>
                        </View>
                      ) : null}
                    </LinearGradient>
                    <Text
                      align="center"
                      numberOfLines={4}
                      adjustsFontSizeToFit
                      minimumFontScale={0.68}
                      weight="semibold"
                      style={styles.iconLabel}
                    >
                      {title}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {tier.comingSoon && (
          <View style={styles.soonBox}>
            <Text style={styles.soonText}>{t('aristocracy.waitForUs', 'ترقّبونا قريباً')}</Text>
          </View>
        )}

        <Pressable style={styles.myLink} onPress={() => router.push('/vip/aristocracy-my' as never)}>
          <Text style={styles.myLinkText}>{t('aristocracy.myAristocracy')} ›</Text>
        </Pressable>
      </ScrollView>

      {/* Bottom bar */}
      {!tier.comingSoon && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
          <LinearGradient colors={[`${accent}55`, `${accent}22`, 'rgba(16,6,8,0.95)']} style={styles.priceBar}>
            <Image source={WALLET_ASSETS.coin} style={styles.coinSm} contentFit="contain" />
            <Text weight="bold" style={styles.priceBarText}>
              {formatCoins(priceInfo.price)} / {tier.validityDays} {isAr ? 'أيام' : 'days'}
            </Text>
          </LinearGradient>

          <Pressable
            style={styles.identityRow}
            onPress={() => router.push('/vip/aristocracy-rules' as never)}
          >
            <Info size={14} color="rgba(255,255,255,0.55)" />
            <Text style={styles.identityText}>{identityRulesLabel}</Text>
          </Pressable>

          <View style={styles.footerBtns}>
            <Pressable
              style={styles.sendBtn}
              onPress={() =>
                Alert.alert(
                  t('aristocracy.sendTitle', 'إرسال الأرستقراطية'),
                  t('aristocracy.sendSoon', 'ميزة الإرسال ستتوفر قريباً'),
                )
              }
            >
              <Text weight="bold" style={styles.sendBtnText}>
                {t('aristocracy.send', 'أرسل')}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.activateBtn, (!canAfford || purchasing) && { opacity: 0.65 }]}
              onPress={handlePurchase}
              disabled={purchasing}
            >
              {purchasing ? (
                <ActivityIndicator color="#1A0A0C" />
              ) : (
                <Text weight="bold" style={styles.activateBtnText}>{activateLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0A0405' },
  bgImage: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    paddingBottom: 8,
    zIndex: 2,
  },
  headBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, color: '#FFF' },
  levelTabsScroll: { flexGrow: 0, maxHeight: 72 },
  levelTabs: {
    paddingHorizontal: H_PAD,
    gap: 18,
    alignItems: 'flex-start',
    paddingTop: 6,
    paddingBottom: 6,
  },
  levelTab: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 76,
    maxWidth: 120,
    paddingHorizontal: 6,
    minHeight: 58,
  },
  levelTabText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 20,
    textAlign: 'center',
    minHeight: 40,
    width: '100%',
  },
  levelTabTextActive: { color: '#FFF', fontSize: 16, lineHeight: 22 },
  tabIndicatorWrap: { alignItems: 'center', marginTop: 4, width: '100%', height: 22 },
  levelDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 4 },
  tabArc: {
    width: 52,
    height: 12,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    opacity: 0.9,
  },
  tabIndicatorPlaceholder: { height: 22, marginTop: 4 },
  statusLine: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginBottom: 14,
    paddingHorizontal: H_PAD,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PREVIEW_GAP,
    marginBottom: 16,
  },
  previewCard: {
    backgroundColor: 'rgba(20,8,10,0.88)',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 148,
  },
  previewImageWrap: {
    width: '100%',
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  previewTitle: { fontSize: 12, color: '#FFF', lineHeight: 17, width: '100%', minHeight: 36, paddingHorizontal: 2 },
  giftsSection: { marginBottom: 18 },
  sectionLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 10 },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GIFT_GAP },
  giftCell: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(20,8,10,0.85)',
    alignItems: 'center',
    minHeight: 96,
  },
  giftImg: { width: 42, height: 42 },
  giftName: { fontSize: 9, color: '#FFF', marginTop: 4, lineHeight: 13, minHeight: 26, width: '100%' },
  giftPrice: { fontSize: 9, color: '#FFE082', marginTop: 2 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  dividerEmblem: { width: 56, height: 56 },
  dividerText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 14 },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ICON_GAP,
    justifyContent: 'flex-start',
    marginBottom: 20,
  },
  iconCell: { alignItems: 'center', marginBottom: 6, minHeight: 96 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(252,165,165,0.28)',
    marginBottom: 6,
  },
  svipTag: {
    position: 'absolute',
    bottom: -3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 7,
  },
  svipTagText: { fontSize: 8, fontWeight: '800', color: '#1A0A0C' },
  iconLabel: { fontSize: 10, color: 'rgba(255,255,255,0.9)', lineHeight: 14, minHeight: 44, width: '100%', paddingHorizontal: 1 },
  soonBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  soonText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  myLink: { alignItems: 'center', paddingVertical: 8 },
  myLinkText: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: H_PAD,
    paddingTop: 10,
    backgroundColor: 'rgba(10,4,5,0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  priceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(252,165,165,0.3)',
  },
  coinSm: { width: 18, height: 18 },
  priceBarText: { fontSize: 14, color: '#FFE082' },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  identityText: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  footerBtns: { flexDirection: 'row', gap: 10 },
  sendBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(252,165,165,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,10,12,0.6)',
  },
  sendBtnText: { color: '#FFF', fontSize: 15 },
  activateBtn: {
    flex: 1.2,
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5D0A8',
  },
  activateBtnText: { color: '#1A0A0C', fontSize: 15 },
});
