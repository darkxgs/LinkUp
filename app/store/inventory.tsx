/**
 * LinkUp App — Inventory Screen
 * المخزون - مشترياتي من المتجر + إطارات الملف الشخصي
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as LucideIcons from 'lucide-react-native';
import {
  Package,
  ShoppingBag,
  Check,
  Crown,
  Star,
  Sparkles,
  Clock,
  MessageCircle,
} from 'lucide-react-native';

import { Text, BackButton } from '@/components/ui';
import {
  getUserInventory,
  subscribeToUserInventory,
  toggleInventoryItemEquip,
  InventoryItem,
} from '@/services/firebase/shop';
import { useAppLanguage } from '@/localization/useAppLanguage';
import { useAuthStore } from '@/stores/authStore';
import { colors, radius, spacing, shadows } from '@/theme';

type TabType = 'all' | 'frame' | 'badge' | 'bubble' | 'entrance' | 'effect' | 'theme' | 'vip';

export default function InventoryScreen() {
  const { t, lang, isRTL } = useAppLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [toggling, setToggling] = useState<string | null>(null);

  const tabs = useMemo(
    () =>
      [
        { id: 'all' as const, label: t('store.categories.all'), Icon: Package },
        { id: 'frame' as const, label: t('store.categories.frame'), Icon: Crown },
        {
          id: 'entrance' as const,
          label: t('store.categories.entrance'),
          Icon: Sparkles,
        },
        {
          id: 'bubble' as const,
          label: t('store.categories.bubble'),
          Icon: MessageCircle,
        },
        { id: 'badge' as const, label: t('store.categories.badge'), Icon: Star },
        { id: 'effect' as const, label: t('store.categories.effects'), Icon: Sparkles },
        { id: 'theme' as const, label: t('store.categories.theme'), Icon: Package },
        { id: 'vip' as const, label: 'VIP', Icon: Crown },
      ],
    [t],
  );

  const cardWidth = useMemo(() => {
    const cols = 3;
    const gap = spacing.sm;
    return (screenW - spacing.base * 2 - gap * (cols - 1)) / cols;
  }, [screenW]);

  const timeRemaining = useCallback(
    (expiresAt: number): string => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) return t('store.expired');
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days > 0) return t('store.daysRemaining', { count: days });
      const hours = Math.floor(diff / (1000 * 60 * 60));
      return t('store.hoursRemaining', { count: hours });
    },
    [t],
  );

  const uid = useAuthStore((s) => s.user?.uid) ?? '';

  const loadInventory = useCallback(async () => {
    if (!uid) return;
    try {
      const data = await getUserInventory(uid, lang);
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [lang, uid]);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToUserInventory(uid, (data) => {
      setItems(data);
      setLoading(false);
    }, lang);
    return unsub;
  }, [lang, uid]);

  useFocusEffect(
    useCallback(() => {
      void loadInventory();
    }, [loadInventory]),
  );

  const filtered =
    activeTab === 'all' ? items : items.filter((i) => i.itemType === activeTab);

  const handleToggleEquip = async (item: InventoryItem) => {
    setToggling(item.id);
    try {
      await toggleInventoryItemEquip(item);
    } catch (e: any) {
      Alert.alert(t('roomSettings.text32386'), e?.message ?? t('common.error'));
    } finally {
      setToggling(null);
    }
  };

  const typeLabel = (type: InventoryItem['itemType']) => {
    switch (type) {
      case 'frame':
        return t('store.categories.frame');
      case 'badge':
        return t('store.categories.badge');
      case 'bubble':
        return t('store.categories.bubble');
      case 'entrance':
        return t('store.categories.entrance');
      case 'effect':
        return t('store.categories.effects');
      case 'theme':
        return t('store.categories.theme');
      case 'vip':
        return 'VIP';
      default:
        return t('call.gift');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FECACA', '#F89A9A']}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        <View style={[styles.headerRow, isRTL && styles.rowRtl]}>
          <BackButton />
          <View style={[styles.titleRow, isRTL && styles.rowRtl]}>
            <Package size={20} color="#E11414" strokeWidth={2.5} />
            <Text variant="h2" weight="bold">{t('store.inventory')}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/store' as any)}
            style={styles.iconBtn}
          >
            <ShoppingBag size={20} color="#E11414" strokeWidth={2.5} />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text variant="h3" weight="bold">{items.length}</Text>
            <Text variant="caption" color={colors.text.secondary} align="center">
              {t('store.text37439')}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text variant="h3" weight="bold" color="#10B981">
              {items.filter((i) => i.isEquipped).length}
            </Text>
            <Text variant="caption" color={colors.text.secondary} align="center">
              {t('store.text98590')}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text variant="h3" weight="bold" color="#F59E0B">
              {items.filter((i) => i.expiresAt && i.expiresAt > Date.now()).length}
            </Text>
            <Text variant="caption" color={colors.text.secondary} align="center">
              {t('store.text24534')}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.tabsScroll,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const count =
            tab.id === 'all' ? items.length : items.filter((i) => i.itemType === tab.id).length;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tab, isActive && styles.tabActive, isRTL && styles.rowRtl]}
            >
              <tab.Icon size={14} color={isActive ? colors.white : '#E11414'} strokeWidth={2.5} />
              <Text
                variant="bodySmall"
                weight={isActive ? 'bold' : 'medium'}
                color={isActive ? colors.white : '#5C5C64'}
                numberOfLines={1}
              >
                {tab.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Package size={48} color="#E11414" strokeWidth={1.5} />
            </View>
            <Text variant="h4" weight="semibold" align="center" style={{ marginTop: spacing.lg }}>
              {t('store.text93494')}
            </Text>
            <Text variant="bodySmall" color={colors.text.secondary} align="center" style={{ marginTop: 4 }}>
              {t('store.text54103')}
            </Text>
            <Pressable
              onPress={() => router.push('/store' as any)}
              style={[styles.emptyBtn, isRTL && styles.rowRtl]}
            >
              <LinearGradient
                colors={['#FCA5A5', '#E11414']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <ShoppingBag size={18} color={colors.white} strokeWidth={2.5} />
              <Text variant="button" color={colors.white} weight="bold">
                {t('store.text15950')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.itemsGrid, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {filtered.map((item) => {
              const IconComp = (LucideIcons as any)[item.iconName] ?? Package;
              const isExpired = item.expiresAt != null && item.expiresAt < Date.now();
              return (
                <Pressable
                  key={item.id}
                  onPress={() => !isExpired && handleToggleEquip(item)}
                  disabled={!!toggling || isExpired}
                  style={[
                    styles.itemCard,
                    { width: cardWidth },
                    item.isEquipped && styles.itemCardEquipped,
                    isExpired && styles.itemCardExpired,
                  ]}
                >
                  {item.isEquipped && (
                    <View style={[styles.equippedBadge, isRTL ? styles.badgeLeft : styles.badgeRight]}>
                      <Check size={12} color={colors.white} strokeWidth={3} />
                      <Text variant="caption" color={colors.white} weight="bold" style={{ fontSize: 9 }}>
                        {t('store.text98590')}
                      </Text>
                    </View>
                  )}

                  {isExpired && (
                    <View style={[styles.expiredOverlay, isRTL ? styles.badgeLeft : styles.badgeRight]}>
                      <Text variant="caption" color={colors.white} weight="bold">
                        {t('store.text12590')}
                      </Text>
                    </View>
                  )}

                  <View style={[styles.itemIcon, { backgroundColor: `${item.iconColor}20` }]}>
                    {item.imageUrl ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.itemImage}
                        contentFit="contain"
                        recyclingKey={item.id}
                      />
                    ) : (
                      <IconComp size={40} color={item.iconColor} strokeWidth={2} />
                    )}
                  </View>

                  <Text
                    variant="bodySmall"
                    weight="bold"
                    numberOfLines={2}
                    align="center"
                    style={{ fontSize: 12 }}
                  >
                    {item.itemName}
                  </Text>

                  <Text variant="caption" color={colors.text.tertiary} align="center" style={{ fontSize: 10 }}>
                    {typeLabel(item.itemType)}
                  </Text>

                  {item.expiresAt != null && !isExpired && (
                    <View style={[styles.timeChip, isRTL && styles.rowRtl]}>
                      <Clock size={9} color="#F59E0B" />
                      <Text variant="caption" color="#F59E0B" weight="bold" style={{ fontSize: 10 }}>
                        {timeRemaining(item.expiresAt)}
                      </Text>
                    </View>
                  )}

                  {toggling === item.id && (
                    <View style={styles.togglingOverlay}>
                      <ActivityIndicator size="small" color="#E11414" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCFAFA' },
  header: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    ...shadows.sm,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#FBEAEA',
  },

  tabsScroll: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: radius.full,
    maxWidth: 180,
  },
  tabActive: {
    backgroundColor: '#E11414',
  },

  scrollContent: {
    paddingHorizontal: spacing.base,
  },

  itemsGrid: {
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-start',
  },
  itemCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    ...shadows.sm,
  },
  itemCardEquipped: {
    borderColor: '#10B981',
    backgroundColor: '#D1FAE5',
  },
  itemCardExpired: {
    opacity: 0.5,
  },
  equippedBadge: {
    position: 'absolute',
    top: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: '#10B981',
    borderRadius: 4,
    zIndex: 1,
  },
  badgeRight: { right: 4 },
  badgeLeft: { left: 4 },
  expiredOverlay: {
    position: 'absolute',
    top: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#EF4444',
    borderRadius: 4,
    zIndex: 1,
  },
  itemIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: 56,
    height: 56,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#FEF3C7',
    borderRadius: radius.xs,
    marginTop: 2,
  },
  togglingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },

  empty: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
  },
  emptyIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: spacing.lg,
    ...shadows.md,
  },
});
