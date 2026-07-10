/**
 * LinkUp App — Gift Collection Screen
 * شاشة مجموعة الهدايا
 *
 * - dark gradient bg مع stars decoration
 * - user mini header (اسم + LV)
 * - stats (هدايا/ألبومات/نجوم)
 * - 3 collections carousel
 * - grid 3-col بـ RARITY badges (UR/SSR/SR/R)
 * - locked items grayscale + lock icon
 *
 * الوظائف:
 * - يقرأ inventory من Firebase عبر getUserInventory
 * - يعرض الـ gifts المملوكة + locked عناصر افتراضية
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { MoreHorizontal, SlidersHorizontal, Lock, Gift as GiftIcon, Sparkles } from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';
import i18n from '@/localization/i18n';

import { Text } from '@/components/ui';
import { GiftVisual } from '@/components/ui/GiftVisual';
import { useAuth } from '@/hooks/useAuth';
import { lu } from '@/theme/lu-brand';
import { getUserInventory, InventoryItem } from '@/services/firebase/shop';
import { getGiftWall } from '@/services/firebase/giftWall';
import { useConfig } from '@/contexts/ConfigContext';
import { resolveUserWealthLevel } from '@/utils/userBalance';

// ===== RARITY system =====
type RarityKey = 'UR' | 'SSR' | 'SR' | 'R';

const RARITY: Record<RarityKey, { color: string; label: string; gradient: [string, string] }> = {
  UR: { color: lu.colors.pink, label: 'UR', gradient: [lu.colors.pink, lu.colors.magenta] },
  SSR: { color: lu.colors.purple, label: 'SSR', gradient: [lu.colors.purple, lu.colors.purpleDark] },
  SR: { color: lu.colors.blue1, label: 'SR', gradient: [lu.colors.blue, lu.colors.purpleDark] },
  R: { color: lu.colors.mint, label: 'R', gradient: [lu.colors.mint, lu.colors.blue] },
};

// تحويل rarity من Gift catalog → RarityKey
const giftRarityToKey = (r: string): RarityKey => {
  switch (r) {
    case 'legendary':
      return 'UR';
    case 'epic':
      return 'SSR';
    case 'rare':
      return 'SR';
    default:
      return 'R';
  }
};

// ألبومات افتراضية — تُستخدم فقط إذا لم تكن هناك تصنيفات هدايا من لوحة التحكم
const FALLBACK_COLLECTIONS = [
  { id: '__all__', name: i18n.t('collection.text41577'), Icon: Sparkles, gradient: [lu.colors.purple, lu.colors.pink] as [string, string] },
  { id: 'classic', name: i18n.t('collection.text82710'), Icon: GiftIcon, gradient: [lu.colors.pink, lu.colors.magenta] as [string, string] },
  { id: 'golden', name: i18n.t('collection.text24687'), Icon: Sparkles, gradient: [lu.colors.gold, lu.colors.gold2] as [string, string] },
];

const COLLECTION_GRADIENTS: [string, string][] = [
  [lu.colors.purple, lu.colors.pink],
  [lu.colors.pink, lu.colors.magenta],
  [lu.colors.gold, lu.colors.gold2],
  [lu.colors.blue, lu.colors.purpleDark],
  [lu.colors.mint, lu.colors.blue],
];

// ===== StarsBackground component (memoized لتجنب re-render) =====
const StarsBackground = React.memo(() => {
  const stars = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => ({
        top: `${(i * 53) % 88}%`,
        right: `${(i * 37) % 96}%`,
        opacity: (i % 3) * 0.25 + 0.2,
      })),
    [],
  );

  return (
    <>
      {stars.map((s, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: s.top as any,
            right: s.right as any,
            width: 2,
            height: 2,
            borderRadius: 2,
            backgroundColor: '#fff',
            opacity: s.opacity,
          }}
        />
      ))}
    </>
  );
});

// ===== GiftCell (memoized) — يمنع إعادة بناء كل الخلايا عند تغيّر activeCollection =====
type GiftCellItem = {
  id: string;
  name: string;
  iconName: string;
  iconColor: string;
  imageUrl?: string;
  animationUrl?: string;
  visualType?: 'icon' | 'image';
  isAnimated?: boolean;
  rarity: RarityKey;
  owned: boolean;
};

const GiftCell = React.memo(function GiftCell({
  item: it,
  width,
}: {
  item: GiftCellItem;
  width: number;
}) {
  const r = RARITY[it.rarity];
  return (
    <View
      style={[
        styles.itemCard,
        {
          width,
          borderColor: `${r.color}44`,
          ...(it.owned
            ? { shadowColor: r.color, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }
            : {}),
        },
      ]}
    >
      <View style={[styles.itemIconWrap, { opacity: it.owned ? 1 : 0.35 }]}>
        <GiftVisual
          gift={{
            iconName: it.iconName,
            iconColor: it.iconColor,
            imageUrl: it.imageUrl,
            animationUrl: it.animationUrl,
            visualType: it.visualType,
            isAnimated: it.isAnimated,
          }}
          size={52}
          cachePolicy="memory-disk"
        />
      </View>
      <Text
        color="#fff"
        weight="bold"
        align="center"
        numberOfLines={1}
        style={{ fontSize: 11.5, lineHeight: 16, marginTop: 4, opacity: it.owned ? 1 : 0.55, includeFontPadding: false }}
      >
        {it.name}
      </Text>
      {/* Rarity badge */}
      <View style={{ marginTop: 6, alignItems: 'center' }}>
        <LinearGradient
          colors={r.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.rarityBadge}
        >
          <Text
            color="#fff"
            style={{ fontSize: 10, lineHeight: 13, fontFamily: lu.fonts.displayHeavy, includeFontPadding: false }}
          >
            {r.label}
          </Text>
        </LinearGradient>
      </View>
      {/* Lock icon */}
      {!it.owned && (
        <View style={styles.lockIcon}>
          <Lock size={12} color="rgba(255,255,255,0.5)" strokeWidth={2.5} />
        </View>
      )}
    </View>
  );
});

export default function CollectionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { gifts: GIFTS_CATALOG, giftCategories } = useConfig();
  const { width: W } = useWindowDimensions();
  const isSmall = W < 360;
  const itemWidth = (W - 32 - 22) / 3; // 16 padding * 2 + 11 gap * 2

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [receivedGiftIds, setReceivedGiftIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeCollection, setActiveCollection] = useState(0);
  const [ownFilter, setOwnFilter] = useState<'all' | 'owned' | 'locked'>('all');
  const [reloadKey, setReloadKey] = useState(0);

  // جلب inventory (المشتراة) + الهدايا المستلمة من الأعضاء — كلاهما «مملوك»
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [inv, wall] = await Promise.all([
          getUserInventory(user.uid),
          getGiftWall(user.uid, user.uid, GIFTS_CATALOG).catch(() => []),
        ]);
        if (cancelled) return;
        setInventory(inv);
        setReceivedGiftIds(new Set(wall.map((w) => w.giftId).filter(Boolean)));
      } catch (e) {
        console.warn('collection load failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, GIFTS_CATALOG, reloadKey]);

  // ===== الألبومات من تصنيفات لوحة التحكم (config/gifts.categories) =====
  const isAr = i18n.language?.startsWith('ar');
  const collections = useMemo(() => {
    const cats = (giftCategories ?? [])
      .filter((c) => c.enabled !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!cats.length) return FALLBACK_COLLECTIONS;
    return cats.map((c, i) => ({
      id: c.id,
      name: c.labels?.[isAr ? 'ar' : 'en'] ?? c.labels?.ar ?? c.id,
      Icon: i % 2 === 0 ? Sparkles : GiftIcon,
      gradient: COLLECTION_GRADIENTS[i % COLLECTION_GRADIENTS.length]!,
    }));
  }, [giftCategories, isAr]);
  const usingRealCategories = collections !== FALLBACK_COLLECTIONS;

  useEffect(() => {
    if (activeCollection >= collections.length) setActiveCollection(0);
  }, [collections.length, activeCollection]);

  // ===== العناصر مع حالة الـ owned (مشتراة أو مستلمة) =====
  const ownedGiftIds = useMemo(() => {
    const s = new Set<string>();
    inventory.filter((i) => i.itemType === 'gift').forEach((i) => s.add(i.itemId));
    return s;
  }, [inventory]);

  const allItems = useMemo(() => {
    return GIFTS_CATALOG.map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      iconName: g.iconName,
      iconColor: g.iconColor,
      imageUrl: g.imageUrl,
      animationUrl: g.animationUrl,
      visualType: g.visualType,
      isAnimated: g.isAnimated,
      rarity: giftRarityToKey(g.rarity),
      owned: ownedGiftIds.has(g.id) || receivedGiftIds.has(g.id),
    }));
  }, [GIFTS_CATALOG, ownedGiftIds, receivedGiftIds]);

  // عناصر الألبوم النشط (التبويبات تصنّف فعلاً حسب تصنيف الهدية)
  const categoryItems = useMemo(() => {
    const activeId = collections[activeCollection]?.id;
    if (!usingRealCategories || !activeId || activeId === '__all__') return allItems;
    return allItems.filter((it) => it.category === activeId);
  }, [allItems, collections, activeCollection, usingRealCategories]);

  // فلتر الملكية (زر «تصفية»)
  const items = useMemo(() => {
    if (ownFilter === 'owned') return categoryItems.filter((it) => it.owned);
    if (ownFilter === 'locked') return categoryItems.filter((it) => !it.owned);
    return categoryItems;
  }, [categoryItems, ownFilter]);

  // الإحصائيات — من كامل الكتالوج (لا تتأثر بالتبويب/الفلتر)
  const stats = useMemo(() => {
    const totalOwned = allItems.filter((i) => i.owned).length;
    const totalAll = allItems.length;
    const stars = totalOwned * 28; // 28 نجمة لكل هدية
    const maxStars = totalAll * 28;
    // ألبوم مكتمل = كل هداياه مملوكة
    const albumsDone = collections.filter((c) => {
      const list =
        !usingRealCategories || c.id === '__all__'
          ? allItems
          : allItems.filter((i) => i.category === c.id);
      return list.length > 0 && list.every((i) => i.owned);
    }).length;
    return {
      gifts: `${totalOwned}/${totalAll}`,
      albums: `${albumsDone}/${collections.length}`,
      stars: `${stars}/${maxStars}`,
    };
  }, [allItems, collections, usingRealCategories]);

  const level = resolveUserWealthLevel(user);

  const handleCollectionPress = useCallback((index: number) => {
    setActiveCollection(index);
  }, []);

  const filterLabel =
    ownFilter === 'owned'
      ? t('collection.filterOwned', 'المملوكة')
      : ownFilter === 'locked'
        ? t('collection.filterLocked', 'غير المملوكة')
        : t('rooms.filter');

  const openFilterMenu = useCallback(() => {
    Alert.alert(t('rooms.filter', 'تصفية'), t('collection.filterHint', 'اختر ما يُعرض في الشبكة'), [
      { text: t('collection.filterAll', 'الكل'), onPress: () => setOwnFilter('all') },
      { text: t('collection.filterOwned', 'المملوكة فقط'), onPress: () => setOwnFilter('owned') },
      { text: t('collection.filterLocked', 'غير المملوكة'), onPress: () => setOwnFilter('locked') },
    ]);
  }, [t]);

  const openMoreMenu = useCallback(() => {
    Alert.alert(
      t('collection.text93031', 'مجموعة الهدايا'),
      t(
        'collection.aboutBody',
        'كل هدية تشتريها من المتجر أو تستلمها من الأعضاء تُضاف لمجموعتك تلقائياً. أكمل الألبومات لجمع النجوم!',
      ),
      [
        { text: t('common.refresh', 'تحديث'), onPress: () => setReloadKey((k) => k + 1) },
        { text: t('common.close', 'إغلاق'), style: 'cancel' },
      ],
    );
  }, [t]);

  return (
    <View style={styles.container}>
      {/* Dark radial gradient background */}
      <LinearGradient
        colors={[lu.colors.room2, lu.colors.room1, lu.colors.room0]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Stars decoration */}
      <StarsBackground />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
            <ChevronLeft size={24} color="#fff" strokeWidth={2.5} />
          </Pressable>
          <Text
            color="#fff"
            style={{
              fontFamily: lu.fonts.displayHeavy,
              fontSize: 19,
              lineHeight: 26,
              includeFontPadding: false,
            }}
          >
            {t('collection.text93031')}
          </Text>
          <Pressable onPress={openMoreMenu} style={styles.iconBtn} hitSlop={10}>
            <MoreHorizontal size={22} color="#fff" strokeWidth={2.5} />
          </Pressable>
        </View>

        {/* User mini header */}
        <View style={styles.userMiniRow}>
          {user?.profile.avatar ? (
            <Image source={{ uri: user.profile.avatar }} style={styles.userAvatar} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.userAvatar, { backgroundColor: lu.colors.purple }]}>
              <Text
                color="#fff"
                style={{ fontFamily: lu.fonts.displayHeavy, fontSize: 18, lineHeight: 22, includeFontPadding: false }}
              >
                {(user?.profile.displayName ?? 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text
            weight="bold"
            color="#fff"
            style={{ fontSize: 16, fontFamily: lu.fonts.bodyHeavy, lineHeight: 22, includeFontPadding: false }}
            numberOfLines={1}
          >
            {user?.profile.displayName ?? t('rooms.userFallback')}
          </Text>
          <View style={styles.lvBadge}>
            <Text
              color="#fff"
              style={{ fontSize: 10, fontFamily: lu.fonts.bodyHeavy, lineHeight: 14, includeFontPadding: false }}
            >
              LV{level}
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { value: stats.gifts, label: t('agency.text45247') },
            { value: stats.albums, label: t('collection.text41988') },
            { value: stats.stars, label: t('collection.text35793') },
          ].map((s, i) => (
            <View key={i} style={styles.statItem}>
              <Text
                color="#fff"
                style={{
                  fontFamily: lu.fonts.displayHeavy,
                  fontSize: isSmall ? 14 : 16,
                  lineHeight: isSmall ? 18 : 22,
                  includeFontPadding: false,
                }}
              >
                {s.value}
              </Text>
              <Text color="rgba(255,255,255,0.7)" style={{ fontSize: 11.5, marginTop: 2, lineHeight: 16 }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Collections carousel */}
        <View style={styles.collectionsRow}>
          {collections.map((c, i) => {
            const isActive = activeCollection === i;
            const Icon = c.Icon;
            const size = isActive ? 70 : 58;
            return (
              <Pressable
                key={c.id}
                onPress={() => handleCollectionPress(i)}
                style={[
                  styles.collectionItem,
                  {
                    opacity: isActive ? 1 : 0.6,
                    transform: [{ scale: isActive ? 1.06 : 1 }],
                  },
                ]}
              >
                <LinearGradient
                  colors={c.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.collectionIcon,
                    {
                      width: size,
                      height: size,
                      borderRadius: 18,
                      borderWidth: isActive ? 2 : 0,
                      borderColor: 'rgba(255,255,255,0.6)',
                      ...(isActive ? lu.shadows.grad : {}),
                    },
                  ]}
                >
                  <Icon size={isActive ? 32 : 26} color="#fff" strokeWidth={2} />
                </LinearGradient>
                <Text
                  color="#fff"
                  weight="bold"
                  style={{ fontSize: 11, marginTop: 8, lineHeight: 16, includeFontPadding: false }}
                  numberOfLines={1}
                >
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text
          color="rgba(255,255,255,0.7)"
          align="center"
          style={{ fontSize: 12.5, marginTop: 4, marginBottom: 16, lineHeight: 17 }}
        >
          {collections[activeCollection]?.name} · {categoryItems.filter((i) => i.owned).length}/{categoryItems.length}
        </Text>

        {/* Filter chip */}
        <View style={styles.filterRow}>
          <Pressable onPress={openFilterMenu} style={styles.filterChip}>
            <SlidersHorizontal size={13} color="#fff" strokeWidth={2.4} />
            <Text color="#fff" weight="bold" style={{ fontSize: 12, lineHeight: 16 }}>
              {filterLabel}
            </Text>
          </Pressable>
        </View>

        {/* Items grid */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#fff" />
            <Text color="rgba(255,255,255,0.7)" style={{ marginTop: 10, fontSize: 13 }}>
              {t('collection.text16461')}
            </Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.loadingBox}>
            <GiftIcon size={48} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
            <Text color="rgba(255,255,255,0.7)" style={{ marginTop: 12, fontSize: 13 }}>
              {t('collection.text43590')}
            </Text>
          </View>
        ) : (
          <View style={styles.itemsGrid}>
            {items.map((it) => (
              <GiftCell key={it.id} item={it} width={itemWidth} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: lu.colors.room0 },
  scrollContent: { paddingBottom: 30 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // User mini
  userMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 8,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: lu.colors.purple,
  },
  lvBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: lu.colors.blue,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  statItem: {
    alignItems: 'center',
  },

  // Collections carousel
  collectionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 6,
  },
  collectionItem: {
    alignItems: 'center',
  },
  collectionIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filter
  filterRow: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    alignItems: 'flex-start',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 99,
  },

  // Items grid
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 11,
    paddingHorizontal: 16,
  },
  itemCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    elevation: 4,
    position: 'relative',
  },
  itemIconWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  rarityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 2.5,
    borderRadius: 9,
  },
  lockIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});
