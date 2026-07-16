/**
 * LinkUp — Store (المتجر)
 * إطارات: config/roomFrames | باقي الأصناف: config/store (لوحة التحكم)
 */

import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as LucideIcons from 'lucide-react-native';
import {
  Coins,
  Sparkles,
  Crown,
  Plus,
  X,
  Check,
  Star,
  Package,
  ShoppingBag,
  Gem,
  Frame,
  Send,
  MessageCircle,
  HelpCircle,
  CircleOff,
} from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore, type User } from '@/stores/authStore';
import { purchaseStoreItem, purchaseAndSendStoreItem, getUserInventory, type StoreItem } from '@/services/firebase/shop';
import { getFollowing } from '@/services/firebase/follow';
import { getUser } from '@/services/firebase/users';
import { resolveUserIdentifier } from '@/services/userIdentifier';
import {
  subscribeToRoomFrames,
  getOwnedFrames,
  purchaseFrame,
  purchaseAndSendFrame,
  equipUserFrame,
  clearEquippedUserFrame,
  type RoomFrame,
} from '@/services/firebase/roomDecor';
import { getActiveEquippedFrameId } from '@/services/firebase/userFrames';
import { roomFrameToStoreItem, type StoreDisplayItem } from '@/services/firebase/storeFrames';
import {
  subscribeToStoreCategories,
  subscribeToStoreItems,
  localizeStoreItem,
  storeItemMediaUrl,
  storeItemThumbUrl,
  buildAppStoreTabs,
  filterStoreItemsForTab,
  STORE_TAB_FRAME_ID,
  type StoreCategoryConfig,
} from '@/services/firebase/storeConfig';
import { lu } from '@/theme/lu-brand';
import { shadows } from '@/theme';
import { COIN_CURRENCY_ICON } from '@/constants/brandAssets';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { GestureResponderEvent } from 'react-native';

function AnimatedPressable({
  children,
  onPress,
  style,
  scaleTo = 0.95,
  duration = 80,
  disabled = false,
  onLongPress,
  hitSlop,
}: {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  style?: any;
  scaleTo?: number;
  duration?: number;
  disabled?: boolean;
  onLongPress?: () => void;
  hitSlop?: any;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (!disabled) scale.value = withTiming(scaleTo, { duration });
      }}
      onPressOut={() => {
        if (!disabled) scale.value = withSpring(1.0);
      }}
      style={style}
      disabled={disabled}
      onLongPress={onLongPress}
      hitSlop={hitSlop}
    >
      <Animated.View style={[{ flex: style?.flex }, animStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

type StoreCategory = 'all' | 'frame' | string;

const H_PAD = 14;
const GRID_GAP = 12;

// ⚡ بليرهاش بلون وردي فاتح موحّد — placeholder خفيف حتى لا تظهر بطاقات بيضاء أثناء التحميل
const STORE_THUMB_BLURHASH = '00S5@g';

// ⚡ تحميل مسبق (غير معطِّل ومؤجَّل) لمصغّرات المتجر إلى كاش القرص بعد وصولها من لوحة
//    التحكم — نفس نمط الهدايا في ConfigContext حتى لا يتوقف أول رسم للتبويب على تنزيلات
//    الشبكة، ومؤجَّل حتى لا يزاحم صور التبويب المرئي نفسه على I/O/الشبكة.
const prefetchedStoreThumbUrls = new Set<string>();
function prefetchStoreThumbs(
  items: Pick<StoreItem, 'imageUrl' | 'animationUrl'>[],
): void {
  const urls: string[] = [];
  for (const item of items) {
    const url = storeItemThumbUrl(item);
    if (!url || !url.startsWith('http') || prefetchedStoreThumbUrls.has(url)) continue;
    prefetchedStoreThumbUrls.add(url);
    urls.push(url);
  }
  if (!urls.length) return;
  Image.prefetch(urls, { cachePolicy: 'memory-disk' })
    .then((ok) => {
      // فشل أحد التنزيلات (شبكة ضعيفة/مقطوعة) — أزل الدفعة من طقم الإزالة حتى
      // تُعاد المحاولة عند وصول snapshot تالٍ في نفس الجلسة
      if (!ok) for (const u of urls) prefetchedStoreThumbUrls.delete(u);
    })
    .catch(() => {
      for (const u of urls) prefetchedStoreThumbUrls.delete(u);
    });
}

// ⚡ تحديث الحالة المحلية فقط بعد نجاح ترانزاكشن الشراء — بلا أي كتابة Firestore إضافية.
//    الترانزاكشن خصمت الرصيد على الخادم ذرّياً (increment داخل runTransaction)، وكتابة
//    رصيدٍ مطلقٍ محسوبٍ من الحالة المحلية (عبر updateUserData) كانت تسابق onSnapshot
//    فتمسح خصم شراءٍ متزامنٍ آخر على الشبكات البطيئة (نزاهة رصيد العملات).
//    مستمع onSnapshot على users/{uid} في authStore يزامن الرصيد الحقيقي تلقائياً.
//    (نفس نمط patchLocalSocialStats في services/firebase/follow.ts)
function patchLocalUserAfterPurchase(
  buildStats: (stats: User['stats']) => Partial<User['stats']>,
  extra?: Partial<Pick<User, 'equippedFrameId'>>,
): void {
  const current = useAuthStore.getState().user;
  if (!current) return;
  useAuthStore.setState({
    user: {
      ...current,
      ...extra,
      stats: { ...current.stats, ...buildStats(current.stats) },
    },
  });
}

const TAB_ICONS: Record<string, React.ComponentType<any>> = {
  entrance: Sparkles,
  frame: Frame,
  bubble: MessageCircle,
  featured: Crown,
};

export default function StoreScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { user, updateUserData, refreshUser } = useAuth();

  const [activeCategory, setActiveCategory] = useState<StoreCategory>('entrance');
  const [previewItem, setPreviewItem] = useState<StoreDisplayItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<StoreDisplayItem | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [roomFrames, setRoomFrames] = useState<RoomFrame[]>([]);
  const [framesLoading, setFramesLoading] = useState(true);
  const [ownedFrameIds, setOwnedFrameIds] = useState<string[]>([]);
  const [storeCategories, setStoreCategories] = useState<StoreCategoryConfig[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [storeLoading, setStoreLoading] = useState(true);
  const [sendItem, setSendItem] = useState<StoreDisplayItem | null>(null);
  const [sendRecipients, setSendRecipients] = useState<{ uid: string; name: string; avatar?: string }[]>([]);
  const [sendLoading, setSendLoading] = useState(false);
  const [sending, setSending] = useState(false);
  // إرسال بالـID (سيناريو المالك): تبويب ثانٍ في ورقة الإرسال — نفس نمط GiftRecipientPickerModal
  const [sendMode, setSendMode] = useState<'friends' | 'id'>('friends');
  const [sendIdInput, setSendIdInput] = useState('');
  const [sendIdResolving, setSendIdResolving] = useState(false);
  const [sendIdPreview, setSendIdPreview] = useState<{ uid: string; name: string; avatar?: string } | null>(null);
  const [sendIdError, setSendIdError] = useState('');
  const [frameBusy, setFrameBusy] = useState(false);

  const equippedFrameId = useMemo(() => {
    if (!user) return null;
    return getActiveEquippedFrameId({
      equippedFrameId: user.equippedFrameId,
      frameInventory: user.frameInventory,
    } as Record<string, unknown>);
  }, [user?.equippedFrameId, user?.frameInventory, user]);

  const equippedFrameName = useMemo(() => {
    if (!equippedFrameId) return null;
    return roomFrames.find((f) => f.id === equippedFrameId)?.name ?? null;
  }, [equippedFrameId, roomFrames]);

  const cols = screenW >= 520 ? 3 : 2;
  const cardWidth = (screenW - H_PAD * 2 - GRID_GAP * (cols - 1)) / cols;

  // العناصر المشتراة (دخولية/فقاعة/…) — كانت «شراء» تبقى ظاهرة بعد الشراء لأن
  // isOwned كانت تفحص الإطارات فقط
  const [ownedItemIds, setOwnedItemIds] = useState<Set<string>>(new Set());

  const refreshOwned = useCallback(() => {
    getOwnedFrames().then(setOwnedFrameIds);
    if (user?.uid) {
      getUserInventory(user.uid)
        .then((inv) => {
          const now = Date.now();
          setOwnedItemIds(
            new Set(
              inv
                .filter((i) => !i.expiresAt || i.expiresAt > now)
                .map((i) => i.itemId),
            ),
          );
        })
        .catch(() => {});
    }
  }, [user?.uid]);

  useEffect(() => {
    const unsubFrames = subscribeToRoomFrames((frames) => {
      setRoomFrames(frames);
      setFramesLoading(false);
    });
    const unsubCats = subscribeToStoreCategories(setStoreCategories);
    const unsubItems = subscribeToStoreItems((items) => {
      setStoreItems(items);
      setStoreLoading(false);
    });
    refreshOwned();
    return () => {
      unsubFrames();
      unsubCats();
      unsubItems();
    };
  }, [refreshOwned]);

  // ⚡ أجّل التحميل المسبق لمصغّرات كل التبويبات بعد استقرار أول رسم حتى لا يزاحم
  //    تنزيل صور التبويب المرئي على I/O/الشبكة (نفس نمط الهدايا في ConfigContext)
  useEffect(() => {
    if (!roomFrames.length && !storeItems.length) return;
    const t = setTimeout(() => {
      prefetchStoreThumbs(roomFrames);
      prefetchStoreThumbs(storeItems);
    }, 2000);
    return () => clearTimeout(t);
  }, [roomFrames, storeItems]);

  const lang = i18n.language?.startsWith('ar') ? 'ar' : 'en';

  const categoryTabs = useMemo(
    () =>
      buildAppStoreTabs(storeCategories, lang).map((tab) => ({
        ...tab,
        Icon: TAB_ICONS[tab.id] ?? Crown,
      })),
    [storeCategories, lang],
  );

  const catalogItems = useMemo(
    (): StoreDisplayItem[] =>
      storeItems.map((item) => ({
        ...localizeStoreItem(item, lang),
        isRoomFrame: false,
      })),
    [storeItems, lang],
  );

  const adminFrameItems = useMemo(
    () =>
      roomFrames.map((f, i) => {
        const item = roomFrameToStoreItem(f, i);
        return {
          ...item,
          description: f.durationDays
            ? t('store.frameDescDays', { days: f.durationDays })
            : t('store.frameDesc'),
        };
      }),
    [roomFrames, t],
  );

  const filteredItems = useMemo((): StoreDisplayItem[] => {
    if (activeCategory === STORE_TAB_FRAME_ID) return adminFrameItems;
    return filterStoreItemsForTab(activeCategory, catalogItems, []).map((i) => ({
      ...i,
      isRoomFrame: false,
    }));
  }, [activeCategory, adminFrameItems, catalogItems]);

  const isOwned = (item: StoreDisplayItem) =>
    item.isRoomFrame === true
      ? ownedFrameIds.includes(item.id)
      : ownedItemIds.has(item.id);

  const openSendPicker = useCallback(async (item: StoreDisplayItem) => {
    if (!user?.uid) return;
    setSendItem(item);
    setSendRecipients([]);
    setSendMode('friends');
    setSendIdInput('');
    setSendIdPreview(null);
    setSendIdError('');
    setSendLoading(true);
    try {
      const followingIds = await getFollowing(user.uid, 50);
      const profiles = await Promise.all(
        followingIds.map(async (uid) => {
          const profile = await getUser(uid);
          if (!profile) return null;
          return {
            uid: profile.uid,
            name: profile.displayName || 'مستخدم',
            avatar: profile.avatar,
          };
        }),
      );
      setSendRecipients(profiles.filter((p): p is NonNullable<typeof p> => p != null));
    } finally {
      setSendLoading(false);
    }
  }, [user?.uid]);

  // تحقّق من الـID المُدخل (UID كامل أو رقم حساب عام) وأظهر معاينة المستلم قبل الإرسال
  const handleResolveSendId = useCallback(async () => {
    const raw = sendIdInput.trim();
    if (!raw || sendIdResolving) return;
    setSendIdResolving(true);
    setSendIdError('');
    setSendIdPreview(null);
    try {
      const uid = await resolveUserIdentifier(raw);
      if (!uid) {
        setSendIdError(t('gifts.recipientNotFound'));
        return;
      }
      if (uid === user?.uid) {
        setSendIdError(t('gifts.cannotSendToSelf'));
        return;
      }
      const profile = await getUser(uid);
      if (!profile) {
        setSendIdError(t('gifts.recipientNotFound'));
        return;
      }
      setSendIdPreview({
        uid: profile.uid,
        name: profile.displayName || 'مستخدم',
        avatar: profile.avatar,
      });
    } catch {
      setSendIdError(t('gifts.recipientNotFound'));
    } finally {
      setSendIdResolving(false);
    }
  }, [sendIdInput, sendIdResolving, user?.uid, t]);

  const handleCardBuy = useCallback((item: StoreDisplayItem) => setSelectedItem(item), []);
  const handleCardSend = useCallback((item: StoreDisplayItem) => { void openSendPicker(item); }, [openSendPicker]);
  const handleCardPreview = useCallback((item: StoreDisplayItem) => setPreviewItem(item), []);

  const handleSendToUser = async (toUid: string, toName: string) => {
    if (!sendItem || !user) return;

    const balance =
      sendItem.currency === 'coins' ? user.stats.coins : user.stats.pearls;

    if (balance < sendItem.price) {
      Alert.alert(
        t('gifts.insufficientCoins'),
        t('store.needMoreBalance', {
          amount: (sendItem.price - balance).toLocaleString('en-US'),
          currency:
            sendItem.currency === 'coins' ? t('lottery.text14819') : t('wallet.text23633'),
        }),
      );
      return;
    }

    setSending(true);
    try {
      if (sendItem.isRoomFrame) {
        const frameMeta = roomFrames.find((f) => f.id === sendItem.id);
        const { balance } = await purchaseAndSendFrame(
          sendItem.id,
          sendItem.price,
          frameMeta?.durationDays ?? 0,
          toUid,
          toName,
          sendItem.name,
        );
        // ⚡ الخصم تم على الخادم (Cloud Function) والرصيد المُعاد مشتق منه — تحديث محلي
        //    فقط بلا كتابة Firestore مطلقة تسابق onSnapshot أو تمسح خصماً متزامناً
        patchLocalUserAfterPurchase(() => ({ coins: balance }));
      } else {
        const result = await purchaseAndSendStoreItem(sendItem, toUid, toName);
        patchLocalUserAfterPurchase(() => ({ [result.currency]: result.balance }));
      }
      setSendItem(null);
      Alert.alert(t('common.success'), t('store.sendSuccess', { name: sendItem.name, user: toName }));
    } catch (e: any) {
      Alert.alert(t('store.sendFailed'), e.message ?? t('common.errorOccurred'));
    } finally {
      setSending(false);
    }
  };

  const handleFrameAction = useCallback(
    async (item: StoreDisplayItem) => {
      if (!item.isRoomFrame || !user) return;
      const isItemEquipped = equippedFrameId === item.id;

      if (isItemEquipped) {
        Alert.alert(t('store.frameUnequip'), t('store.frameUnequipConfirm'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('store.frameUnequip'),
            style: 'destructive',
            onPress: async () => {
              setFrameBusy(true);
              try {
                await clearEquippedUserFrame();
                await updateUserData({ equippedFrameId: '' });
                await refreshUser?.();
              } catch (e: unknown) {
                Alert.alert(
                  t('common.error'),
                  e instanceof Error ? e.message : t('common.errorOccurred'),
                );
              } finally {
                setFrameBusy(false);
              }
            },
          },
        ]);
        return;
      }

      setFrameBusy(true);
      try {
        await equipUserFrame(item.id);
        await updateUserData({ equippedFrameId: item.id });
        await refreshUser?.();
      } catch (e: unknown) {
        Alert.alert(
          t('common.error'),
          e instanceof Error ? e.message : t('common.errorOccurred'),
        );
      } finally {
        setFrameBusy(false);
      }
    },
    [user, equippedFrameId, t, updateUserData, refreshUser],
  );

  const handlePurchase = async () => {
    if (!selectedItem || !user) return;

    if (isOwned(selectedItem)) {
      if (selectedItem.isRoomFrame) {
        setSelectedItem(null);
        await handleFrameAction(selectedItem);
        return;
      }
      Alert.alert(t('store.purchased'), t('store.frameOwnedHint'));
      return;
    }

    const balance =
      selectedItem.currency === 'coins' ? user.stats.coins : user.stats.pearls;

    if (balance < selectedItem.price) {
      Alert.alert(
        t('gifts.insufficientCoins'),
        t('store.needMoreBalance', {
          amount: (selectedItem.price - balance).toLocaleString('en-US'),
          currency:
            selectedItem.currency === 'coins' ? t('lottery.text14819') : t('wallet.text23633'),
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          ...(selectedItem.currency === 'coins'
            ? [{ text: t('wallet.recharge'), onPress: () => router.push('/wallet/recharge' as any) }]
            : []),
        ],
      );
      return;
    }

    setPurchasing(true);
    try {
      if (selectedItem.isRoomFrame) {
        const frameMeta = roomFrames.find((f) => f.id === selectedItem.id);
        const { balance: coinsAfter, equippedFrameId } = await purchaseFrame(
          selectedItem.id,
          selectedItem.price,
          frameMeta?.durationDays ?? 0,
        );
        setOwnedFrameIds((prev) =>
          prev.includes(selectedItem.id) ? prev : [...prev, selectedItem.id],
        );
        // ⚡ نجاح الشراء يظهر فوراً بعد الترانزاكشن — الخصم والتلبيس ثُبّتا على الخادم
        //    داخل purchaseFrame، فنكتفي بتحديث الحالة المحلية (coinsAfter مشتق من
        //    الترانزاكشن) بلا كتابة Firestore مطلقة تسابق onSnapshot
        patchLocalUserAfterPurchase(() => ({ coins: coinsAfter }), { equippedFrameId });
        Alert.alert(t('store.purchaseSuccess'), t('store.framePurchaseHint', { name: selectedItem.name }), [
          { text: t('common.ok'), onPress: () => setSelectedItem(null) },
        ]);
      } else {
        await purchaseStoreItem(selectedItem);
        // انعكاس فوري: الزر يتحول «تم الشراء» بدون انتظار إعادة جلب المخزون
        setOwnedItemIds((prev) => new Set(prev).add(selectedItem.id));
        // ⚡ خصم محلي فقط لإظهار الرصيد الجديد فوراً — purchaseStoreItem خصم على الخادم
        //    ذرّياً داخل الترانزاكشن، وأي كتابة Firestore مطلقة هنا كانت تسابق onSnapshot
        //    فتفسد رصيد شراءٍ متزامنٍ آخر
        patchLocalUserAfterPurchase((stats) => ({
          [selectedItem.currency]: Math.max(
            0,
            (stats[selectedItem.currency] ?? 0) - selectedItem.price,
          ),
        }));
        Alert.alert(
          t('store.purchaseSuccess'),
          t('store.addedToInventory') +
            (selectedItem.validityDays
              ? `\n${t('store.validFor', { count: selectedItem.validityDays })}`
              : ''),
          [
            {
              text: t('store.viewInventory'),
              onPress: () => {
                setSelectedItem(null);
                router.push('/store/inventory' as any);
              },
            },
            { text: t('common.ok'), onPress: () => setSelectedItem(null) },
          ],
        );
      }
    } catch (e: any) {
      Alert.alert(t('store.purchaseFailed'), e.message ?? t('common.errorOccurred'));
    } finally {
      setPurchasing(false);
    }
  };

  const showFramesLoading = activeCategory === 'frame' && framesLoading;
  const showStoreLoading = activeCategory !== 'frame' && activeCategory !== 'all' && storeLoading;
  const showEmpty =
    !showFramesLoading &&
    !showStoreLoading &&
    filteredItems.length === 0 &&
    (activeCategory !== 'frame' || !framesLoading);

  return (
    <LinearGradient colors={['#FEE2E2', '#FEF2F2']} style={styles.fill}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <AnimatedPressable
          onPress={() => router.back()}
          style={styles.headBtn}
          scaleTo={0.9}
        >
          <ChevronLeft size={22} color={lu.colors.ink} />
        </AnimatedPressable>
        <Text weight="bold" style={styles.headTitle}>
          {t('store.title')}
        </Text>
        <AnimatedPressable
          onPress={() => router.push('/store/inventory' as any)}
          style={styles.headBtn}
          scaleTo={0.9}
        >
          <Package size={20} color={lu.colors.ink} />
        </AnimatedPressable>
      </View>

      <View style={styles.balanceRow}>
        <LinearGradient
          colors={['#FFD86F', '#FF9A2E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balancePill}
        >
          <Image source={COIN_CURRENCY_ICON} style={{ width: 16, height: 16 }} contentFit="contain" />
          <Text weight="bold" style={styles.balanceText}>
            {(user?.stats?.coins ?? 0).toLocaleString('en-US')}
          </Text>
        </LinearGradient>
        <LinearGradient
          colors={['#FBD5D5', '#F0A0A0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balancePill}
        >
          <Image source={require('../../assets/masa.webp')} style={{ width: 16, height: 16 }} contentFit="contain" />
          <Text weight="bold" style={styles.balanceText}>
            {(user?.stats?.pearls ?? 0).toLocaleString('en-US')}
          </Text>
        </LinearGradient>
        <View style={{ flex: 1 }} />
        <AnimatedPressable
          onPress={() => router.push('/wallet/recharge' as any)}
          scaleTo={0.96}
        >
          <View style={styles.rechargeBtn}>
            <Plus size={14} color="#fff" strokeWidth={3} />
            <Text weight="bold" style={styles.rechargeText}>
              {t('wallet.recharge')}
            </Text>
          </View>
        </AnimatedPressable>
      </View>

      <View style={styles.catsRow}>
        {categoryTabs.map((c) => {
          const active = activeCategory === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setActiveCategory(c.id)}
              style={[styles.catTab, active && styles.catTabActive]}
            >
              <Text
                weight="bold"
                style={[
                  styles.catTabText,
                  active ? styles.catTabTextActive : styles.catTabTextInactive
                ]}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeCategory === STORE_TAB_FRAME_ID && equippedFrameId && equippedFrameName ? (
        <View style={styles.frameBanner}>
          <View style={styles.frameBannerInfo}>
            <Frame size={16} color={lu.colors.purple} strokeWidth={2.2} />
            <Text weight="semibold" style={styles.frameBannerText} numberOfLines={1}>
              {t('store.frameActiveBanner', { name: equippedFrameName })}
            </Text>
          </View>
          <Pressable
            style={styles.frameBannerBtn}
            disabled={frameBusy}
            onPress={() => {
              const item = adminFrameItems.find((f) => f.id === equippedFrameId);
              if (item) void handleFrameAction(item);
            }}
          >
            {frameBusy ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <>
                <CircleOff size={14} color="#EF4444" strokeWidth={2.2} />
                <Text weight="bold" style={styles.frameBannerBtnText}>
                  {t('store.frameUnequip')}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: H_PAD,
          paddingBottom: insets.bottom + 28,
          flexGrow: showEmpty ? 1 : undefined,
        }}
      >
        {showFramesLoading || showStoreLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={lu.colors.purple} />
            <Text style={styles.loadingText}>
              {showFramesLoading ? t('store.loadingFrames') : t('common.loading')}
            </Text>
          </View>
        ) : showEmpty ? (
          <View style={styles.centerBox}>
            <Frame size={48} color={lu.colors.line} strokeWidth={1.5} />
            <Text weight="bold" style={styles.emptyTitle}>
              {activeCategory === 'frame' ? t('store.noFramesYet') : t('store.text93494')}
            </Text>
            <Text style={styles.emptySub}>
              {activeCategory === 'frame' ? t('store.noFramesHint') : t('store.text54103')}
            </Text>
          </View>
        ) : (
          <View style={[styles.grid, { gap: GRID_GAP }]}>
            {filteredItems.map((item) => (
              <StoreCard
                key={`${item.isRoomFrame ? 'rf' : 'cat'}-${item.id}`}
                item={item}
                width={cardWidth}
                owned={isOwned(item)}
                equipped={item.isRoomFrame === true && equippedFrameId === item.id}
                frameBusy={frameBusy}
                onFrameAction={handleFrameAction}
                onBuy={handleCardBuy}
                onSend={handleCardSend}
                onPress={handleCardPreview}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={!!selectedItem}
        transparent
        animationType="fade"
        onRequestClose={() => !purchasing && setSelectedItem(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !purchasing && setSelectedItem(null)}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            {selectedItem && (
              <PurchaseSheet
                item={selectedItem}
                user={user}
                owned={isOwned(selectedItem)}
                equipped={selectedItem.isRoomFrame === true && equippedFrameId === selectedItem.id}
                userCoins={user?.stats?.coins ?? 0}
                userPearls={user?.stats?.pearls ?? 0}
                purchasing={purchasing}
                frameBusy={frameBusy}
                onClose={() => setSelectedItem(null)}
                onConfirm={handlePurchase}
                onFrameAction={() => void handleFrameAction(selectedItem)}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!sendItem}
        transparent
        animationType="fade"
        onRequestClose={() => !sending && setSendItem(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !sending && setSendItem(null)}
        >
          <Pressable style={styles.sendSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text weight="bold" style={styles.sendSheetTitle}>
              {t('store.selectRecipientToSend')}
            </Text>
            {sendItem ? (
              <Text style={styles.sendSheetSub}>
                {sendItem.name} · {sendItem.price.toLocaleString('en-US')}
              </Text>
            ) : null}

            {/* تبويبا الإرسال: أصدقاء | بالـID — نفس نمط إرسال الهدايا العادي */}
            <View style={styles.sendModeTabs}>
              {(['friends', 'id'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  style={[styles.sendModeTab, sendMode === mode && styles.sendModeTabActive]}
                  onPress={() => setSendMode(mode)}
                  disabled={sending}
                >
                  <Text
                    weight="bold"
                    style={[styles.sendModeTabText, sendMode === mode && styles.sendModeTabTextActive]}
                  >
                    {mode === 'friends' ? t('gifts.recipientFriends') : t('gifts.recipientById')}
                  </Text>
                </Pressable>
              ))}
            </View>

            {sendMode === 'id' ? (
              <View>
                <View style={styles.sendIdRow}>
                  <TextInput
                    style={styles.sendIdInput}
                    value={sendIdInput}
                    onChangeText={(v) => {
                      setSendIdInput(v);
                      setSendIdPreview(null);
                      setSendIdError('');
                    }}
                    placeholder={t('gifts.idInputPlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!sending && !sendIdResolving}
                    onSubmitEditing={() => void handleResolveSendId()}
                    returnKeyType="search"
                  />
                  <Pressable
                    style={[styles.sendIdCheckBtn, (!sendIdInput.trim() || sendIdResolving) && { opacity: 0.5 }]}
                    disabled={!sendIdInput.trim() || sendIdResolving || sending}
                    onPress={() => void handleResolveSendId()}
                  >
                    {sendIdResolving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text weight="bold" style={{ color: '#fff', fontSize: 13 }}>
                        {t('common.search', 'بحث')}
                      </Text>
                    )}
                  </Pressable>
                </View>
                {sendIdError ? <Text style={styles.sendIdError}>{sendIdError}</Text> : null}
                {sendIdPreview ? (
                  <Pressable
                    style={styles.sendRow}
                    disabled={sending}
                    onPress={() => void handleSendToUser(sendIdPreview.uid, sendIdPreview.name)}
                  >
                    {sendIdPreview.avatar ? (
                      <Image source={{ uri: sendIdPreview.avatar }} style={styles.sendAvatar} contentFit="cover" cachePolicy="memory-disk" />
                    ) : (
                      <View style={[styles.sendAvatar, styles.sendAvatarPlaceholder]}>
                        <Text weight="bold" style={styles.sendAvatarLetter}>
                          {sendIdPreview.name.charAt(0)}
                        </Text>
                      </View>
                    )}
                    <Text weight="bold" style={styles.sendName}>{sendIdPreview.name}</Text>
                    <Send size={16} color={lu.colors.purple} />
                  </Pressable>
                ) : null}
              </View>
            ) : sendLoading ? (
              <ActivityIndicator color={lu.colors.purple} style={{ marginVertical: 24 }} />
            ) : sendRecipients.length === 0 ? (
              <Text style={styles.sendEmpty}>{t('store.noFollowingToSend')}</Text>
            ) : (
              <ScrollView style={styles.sendList} showsVerticalScrollIndicator={false}>
                {sendRecipients.map((recipient) => (
                  <Pressable
                    key={recipient.uid}
                    style={styles.sendRow}
                    disabled={sending}
                    onPress={() => void handleSendToUser(recipient.uid, recipient.name)}
                  >
                    {recipient.avatar ? (
                      <Image source={{ uri: recipient.avatar }} style={styles.sendAvatar} contentFit="cover" cachePolicy="memory-disk" />
                    ) : (
                      <View style={[styles.sendAvatar, styles.sendAvatarPlaceholder]}>
                        <Text weight="bold" style={styles.sendAvatarLetter}>
                          {recipient.name.charAt(0)}
                        </Text>
                      </View>
                    )}
                    <Text weight="bold" style={styles.sendName}>{recipient.name}</Text>
                    <Send size={16} color={lu.colors.purple} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {sending ? <ActivityIndicator color={lu.colors.purple} style={{ marginTop: 12 }} /> : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!previewItem}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewItem(null)}
      >
        <PreviewOverlay item={previewItem} onClose={() => setPreviewItem(null)} user={user} />
      </Modal>
    </LinearGradient>
  );
}

const StoreCard = memo(function StoreCard({
  item,
  width,
  owned,
  equipped,
  frameBusy,
  onFrameAction,
  onBuy,
  onSend,
  onPress,
}: {
  item: StoreDisplayItem;
  width: number;
  owned: boolean;
  equipped?: boolean;
  frameBusy?: boolean;
  onFrameAction?: (item: StoreDisplayItem) => void;
  onBuy: (item: StoreDisplayItem) => void;
  onSend: (item: StoreDisplayItem) => void;
  onPress: (item: StoreDisplayItem) => void;
}) {
  const { t } = useTranslation();
  const IconComp = (LucideIcons as any)[item.iconName] ?? Star;
  // ⚡ مصغّرة البطاقة = الصورة الثابتة الخفيفة (وليس الأنيميشن الثقيل) — الأنيميشن للمعاينة/الشراء فقط
  const mediaUrl = storeItemThumbUrl(item);
  // fallback عند فشل تحميل صورة المتجر (روابط الكتالوج الثابتة معطّلة/غير
  // عامة → 403/404 للجميع) — نعرض أيقونة العنصر الملوّنة بدل المربع الرمادي
  const [thumbFailed, setThumbFailed] = React.useState(false);
  React.useEffect(() => setThumbFailed(false), [mediaUrl]);
  const isRoomFrame = item.isRoomFrame === true;
  const showFrameActions = owned && isRoomFrame;

  return (
    <View style={[styles.card, { width }]}>
      <Pressable onPress={() => onPress(item)}>
        <View style={[styles.cardHero, { backgroundColor: '#FCFAFA' }]}>
          {mediaUrl && !thumbFailed ? (
            <View style={styles.cardImageWrap}>
              <Image
                source={{ uri: mediaUrl }}
                style={styles.cardFrameImg}
                contentFit="contain"
                cachePolicy="memory-disk"
                placeholder={{ blurhash: STORE_THUMB_BLURHASH }}
                transition={150}
                recyclingKey={mediaUrl}
                onError={() => setThumbFailed(true)}
              />
            </View>
          ) : (
            <View style={styles.cardHeroCircle}>
              <IconComp size={32} color={item.iconColor || lu.colors.purple} strokeWidth={2.4} />
            </View>
          )}

          {item.validityDays ? (
            <View style={styles.validityBadge}>
              <Text style={styles.validityText}>
                {item.validityDays} {t('store.daysShort', { defaultValue: 'يوم' })}
              </Text>
            </View>
          ) : null}

          {item.isLimited && (
            <View style={[styles.tagBadge, { backgroundColor: '#EF4444' }]}>
              <Text style={styles.tagText}>{t('store.limited')}</Text>
            </View>
          )}
          {item.isNew && !item.isLimited && (
            <View style={[styles.tagBadge, { backgroundColor: lu.colors.mint }]}>
              <Text style={styles.tagText}>{t('store.new')}</Text>
            </View>
          )}
          {equipped ? (
            <View style={[styles.tagBadge, styles.equippedBadge]}>
              <Text style={styles.tagText}>{t('store.frameEquipped')}</Text>
            </View>
          ) : owned ? (
            <View style={[styles.tagBadge, styles.ownedBadge]}>
              <Text style={styles.tagText}>{t('store.purchased')}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardBody}>
          <Text weight="bold" style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.priceWrap}>
            {equipped ? (
              <Text weight="bold" style={styles.equippedLabel}>
                {t('store.frameEquipped')}
              </Text>
            ) : owned ? (
              <Text weight="bold" style={styles.ownedLabel}>
                {t('store.purchased')}
              </Text>
            ) : (
              <>
                {item.currency === 'coins' ? (
                  <Image source={COIN_CURRENCY_ICON} style={{ width: 14, height: 14 }} contentFit="contain" />
                ) : (
                  <Image source={require('../../assets/masa.webp')} style={{ width: 14, height: 14 }} contentFit="contain" />
                )}
                <Text
                  weight="bold"
                  style={{
                    fontSize: 12.5,
                    color: item.currency === 'coins' ? lu.colors.gold2 : '#F0A0A0',
                  }}
                >
                  {item.price.toLocaleString('en-US')}
                </Text>
              </>
            )}
          </View>
        </View>
      </Pressable>

      <View style={styles.cardActions}>
        {/* زر الإهداء يبقى ظاهراً حتى بعد الشراء — الإهداء يشتري نسخة جديدة ويرسلها للصديق */}
        <Pressable style={styles.sendBtn} onPress={() => onSend(item)}>
          <Text weight="bold" style={styles.sendBtnText}>
            {owned ? t('wallet.quickGift') : t('store.send')}
          </Text>
        </Pressable>
        {showFrameActions ? (
          <Pressable
            style={[styles.frameActionBtn, equipped && styles.frameUnequipBtn]}
            onPress={() => onFrameAction?.(item)}
            disabled={frameBusy}
          >
            {frameBusy ? (
              <ActivityIndicator size="small" color={equipped ? '#EF4444' : lu.colors.purple} />
            ) : equipped ? (
              <>
                <CircleOff size={14} color="#EF4444" strokeWidth={2.2} />
                <Text weight="bold" style={styles.frameUnequipText}>
                  {t('store.frameUnequip')}
                </Text>
              </>
            ) : (
              <LinearGradient
                colors={lu.gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.frameEquipGradient}
              >
                <Check size={14} color="#fff" strokeWidth={2.5} />
                <Text weight="bold" style={styles.buyBtnText}>
                  {t('store.frameEquip')}
                </Text>
              </LinearGradient>
            )}
          </Pressable>
        ) : (
          <Pressable style={styles.buyBtnWrap} onPress={() => onBuy(item)} disabled={owned}>
            <LinearGradient
              colors={owned ? ['#9CA3AF', '#6B7280'] : lu.gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buyBtn}
            >
              <Text weight="bold" style={styles.buyBtnText}>
                {owned ? '✓' : t('store.purchase')}
              </Text>
            </LinearGradient>
          </Pressable>
        )}
      </View>
    </View>
  );
});

function PurchaseSheet({
  item,
  user,
  owned,
  equipped,
  userCoins,
  userPearls,
  purchasing,
  frameBusy,
  onClose,
  onConfirm,
  onFrameAction,
}: {
  item: StoreDisplayItem;
  user: User | null;
  owned: boolean;
  equipped?: boolean;
  userCoins: number;
  userPearls: number;
  purchasing: boolean;
  frameBusy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onFrameAction?: () => void;
}) {
  const { t } = useTranslation();
  const IconComp = (LucideIcons as any)[item.iconName] ?? Star;
  const balance = item.currency === 'coins' ? userCoins : userPearls;
  const canAfford = balance >= item.price;
  const mediaUrl = storeItemMediaUrl(item);
  const isRoomFrame = item.isRoomFrame === true;
  const showFrameOwnedActions = owned && isRoomFrame;

  return (
    <>
      <View style={styles.sheetHandle} />
      <View style={styles.sheetHeader}>
        <AnimatedPressable
          onPress={onClose}
          style={styles.sheetCloseBtn}
          disabled={purchasing}
          scaleTo={0.9}
        >
          <X size={18} color={lu.colors.ink2} strokeWidth={2.4} />
        </AnimatedPressable>
        <Text weight="bold" style={styles.sheetTitle}>
          {t('store.purchaseConfirm')}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <LinearGradient
        colors={item.bgColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.sheetHero}
      >
        {item.type === 'frame' && mediaUrl ? (
          <FrameWithAvatar frameUrl={mediaUrl} user={user} size={160} />
        ) : mediaUrl ? (
          <Image
            source={{ uri: mediaUrl }}
            style={styles.sheetFrameImg}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <View style={styles.sheetHeroCircle}>
            <IconComp size={48} color="#fff" fill="#fff" strokeWidth={0} />
          </View>
        )}
      </LinearGradient>

      <View style={styles.sheetBody}>
        <Text weight="bold" style={styles.sheetItemName}>
          {item.name}
        </Text>
        <Text style={styles.sheetDesc}>{item.description}</Text>

        {item.validityDays ? (
          <View style={styles.validityRow}>
            <Sparkles size={13} color={lu.colors.purple} strokeWidth={2.4} />
            <Text style={styles.validityRowText}>
              {t('store.validFor', { count: item.validityDays })}
            </Text>
          </View>
        ) : null}

        <View style={styles.sheetInfoCard}>
          <View style={styles.sheetInfoRow}>
            <Text style={styles.sheetInfoLabel}>{t('store.price')}</Text>
            <View style={styles.priceWrap}>
              {item.currency === 'coins' ? (
                <Image source={COIN_CURRENCY_ICON} style={{ width: 16, height: 16 }} contentFit="contain" />
              ) : (
                <Image source={require('../../assets/masa.webp')} style={{ width: 16, height: 16 }} contentFit="contain" />
              )}
              <Text weight="bold" style={{ fontSize: 14, color: lu.colors.ink }}>
                {item.price.toLocaleString('en-US')}
              </Text>
            </View>
          </View>
          <View style={styles.sheetInfoDivider} />
          <View style={styles.sheetInfoRow}>
            <Text style={styles.sheetInfoLabel}>{t('store.yourBalance')}</Text>
            <Text weight="bold" style={{ fontSize: 14, color: canAfford ? lu.colors.mint : '#EF4444' }}>
              {balance.toLocaleString('en-US')}{' '}
              {item.currency === 'coins' ? t('lottery.text14819') : t('wallet.text23633')}
            </Text>
          </View>
        </View>

        <AnimatedPressable
          onPress={
            showFrameOwnedActions
              ? onFrameAction
              : owned
                ? onClose
                : onConfirm
          }
          disabled={
            purchasing ||
            frameBusy ||
            (!showFrameOwnedActions && !owned && !canAfford)
          }
          style={[
            styles.sheetCtaWrap,
            !showFrameOwnedActions && !owned && !canAfford && { opacity: 0.55 },
          ]}
          scaleTo={0.96}
        >
          <View style={styles.sheetCta}>
            <LinearGradient
              colors={
                showFrameOwnedActions && equipped
                  ? ['#FCA5A5', '#EF4444']
                  : showFrameOwnedActions
                    ? lu.gradients.brand
                    : owned
                      ? ['#9CA3AF', '#6B7280']
                      : lu.gradients.brand
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {purchasing || frameBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                {showFrameOwnedActions && equipped ? (
                  <CircleOff size={18} color="#fff" strokeWidth={2.5} />
                ) : (
                  <Check size={18} color="#fff" strokeWidth={2.5} />
                )}
                <Text weight="bold" style={styles.sheetCtaText}>
                  {showFrameOwnedActions
                    ? equipped
                      ? t('store.frameUnequip')
                      : t('store.frameEquip')
                    : owned
                      ? t('store.purchased')
                      : canAfford
                        ? t('store.purchaseConfirm')
                        : t('gifts.insufficientCoins')}
                </Text>
              </>
            )}
          </View>
        </AnimatedPressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    paddingBottom: 8,
  },
  headBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(242, 63, 63, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    ...lu.shadows.card,
  },
  headTitle: { fontSize: 18, color: lu.colors.ink },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: H_PAD,
    paddingBottom: 12,
    flexWrap: 'wrap',
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  balanceText: { color: '#fff', fontSize: 13 },
  rechargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: lu.colors.purple,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    shadowColor: lu.colors.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  rechargeText: { color: '#fff', fontSize: 12.5 },
  catsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 238, 238, 0.8)',
    padding: 5,
    borderRadius: 99,
    marginHorizontal: H_PAD,
    marginBottom: 20,
  },
  catTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 99,
  },
  catTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  catTabText: {
    fontSize: 14,
  },
  catTabTextActive: {
    color: lu.colors.ink,
  },
  catTabTextInactive: {
    color: '#9CA3AF',
  },
  catTabUnderline: { display: 'none' },
  catPill: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 58,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(242, 63, 63, 0.08)',
    gap: 4,
  },
  catPillActive: { borderColor: 'transparent' },
  catLabel: { fontSize: 11, color: lu.colors.ink2 },
  catLabelActive: { color: '#fff' },
  catCount: {
    marginTop: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: lu.colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  catCountActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  catCountText: { fontSize: 9, fontWeight: '800', color: lu.colors.ink2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 238, 238, 1)',
    shadowColor: lu.colors.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  cardHero: {
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#FEF2F2',
  },
  cardImageWrap: {
    width: '88%',
    height: '88%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFrameImg: { width: '100%', height: '100%' },
  cardHeroCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  validityBadge: {
    position: 'absolute',
    top: 8,
    insetInlineStart: 8,
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(242, 63, 63, 0.15)',
  },
  validityText: { color: lu.colors.purple, fontSize: 10, fontWeight: '800' },
  tagBadge: {
    position: 'absolute',
    top: 8,
    insetInlineEnd: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: lu.colors.pink,
  },
  ownedBadge: { backgroundColor: lu.colors.mint, insetInlineEnd: 8, top: 8 },
  equippedBadge: { backgroundColor: lu.colors.purple, insetInlineStart: 8, top: 8 },
  tagText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  cardBody: { padding: 12, minHeight: 76 },
  cardName: { fontSize: 14, color: lu.colors.ink, lineHeight: 20, minHeight: 40 },
  priceWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  ownedLabel: { fontSize: 12.5, color: lu.colors.mint },
  equippedLabel: { fontSize: 12.5, color: lu.colors.purple },
  frameBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginHorizontal: H_PAD,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(242, 63, 63, 0.14)',
    ...lu.shadows.card,
  },
  frameBannerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  frameBannerText: { flex: 1, fontSize: 13, color: lu.colors.ink },
  frameBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  frameBannerBtnText: { fontSize: 12, color: '#EF4444' },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  sendBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: lu.colors.purple,
    backgroundColor: '#fff',
  },
  sendBtnText: { color: lu.colors.purple, fontSize: 12 },
  buyBtnWrap: { flex: 1 },
  buyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    alignItems: 'center',
  },
  buyBtnCompact: { flex: 1 },
  buyBtnText: { color: '#fff', fontSize: 11 },
  frameActionBtn: {
    flex: 1,
    borderRadius: 99,
    overflow: 'hidden',
  },
  frameEquipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  frameUnequipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  frameUnequipText: { color: '#EF4444', fontSize: 12 },
  sendSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  sendSheetTitle: { fontSize: 16, color: lu.colors.ink, textAlign: 'center', marginTop: 8 },
  sendSheetSub: { fontSize: 13, color: lu.colors.ink2, textAlign: 'center', marginTop: 4 },
  sendEmpty: { fontSize: 13, color: lu.colors.ink2, textAlign: 'center', marginVertical: 24 },
  sendList: { marginTop: 12, maxHeight: 320 },
  // تبويبا «أصدقاء | بالـID» في ورقة الإرسال
  sendModeTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(242,63,63,0.06)',
    borderRadius: 10,
    padding: 3,
    marginTop: 12,
    gap: 4,
  },
  sendModeTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendModeTabActive: { backgroundColor: lu.colors.purple },
  sendModeTabText: { fontSize: 12.5, color: lu.colors.ink2 },
  sendModeTabTextActive: { color: '#fff' },
  sendIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  sendIdInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(242,63,63,0.2)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: lu.colors.ink,
    textAlign: 'right',
  },
  sendIdCheckBtn: {
    backgroundColor: lu.colors.purple,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIdError: {
    fontSize: 12,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 8,
  },
  sendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242, 63, 63, 0.08)',
  },
  sendAvatar: { width: 40, height: 40, borderRadius: 20 },
  sendAvatarPlaceholder: {
    backgroundColor: lu.colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendAvatarLetter: { color: lu.colors.purple, fontSize: 16 },
  sendName: { flex: 1, fontSize: 14, color: lu.colors.ink },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  loadingText: { fontSize: 13, color: lu.colors.ink2, marginTop: 8 },
  emptyTitle: { fontSize: 16, color: lu.colors.ink, textAlign: 'center' },
  emptySub: { fontSize: 13, color: lu.colors.ink2, textAlign: 'center', lineHeight: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 10, 12,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 28,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: 'rgba(242, 63, 63, 0.08)',
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: lu.colors.line,
    alignSelf: 'center',
    marginTop: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(242, 63, 63, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(242, 63, 63, 0.12)',
  },
  sheetTitle: { fontSize: 17, color: lu.colors.ink, flex: 1, textAlign: 'center' },
  sheetHero: {
    marginHorizontal: 18,
    marginTop: 12,
    height: 180,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetFrameImg: { width: '75%', height: '75%' },
  sheetHeroCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  sheetBody: { paddingHorizontal: 22, paddingTop: 18 },
  sheetItemName: { fontSize: 18, color: lu.colors.ink, textAlign: 'center' },
  sheetDesc: {
    fontSize: 12.5,
    color: lu.colors.ink2,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 19,
  },
  validityRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: lu.colors.bg2,
  },
  validityRowText: { fontSize: 12, color: lu.colors.purple, fontWeight: '700' },
  sheetInfoCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(242, 63, 63, 0.06)',
  },
  sheetInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetInfoLabel: { fontSize: 12, color: lu.colors.ink2 },
  sheetInfoDivider: {
    height: 1,
    backgroundColor: 'rgba(242, 63, 63, 0.06)',
    marginVertical: 10,
  },
  sheetCtaWrap: {
    marginTop: 16,
  },
  sheetCta: {
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...lu.shadows.grad,
  },
  sheetCtaText: { color: '#fff', fontSize: 15 },

  // Previews
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(25, 10, 10, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 48,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  previewContent: {
    width: '100%',
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFooter: {
    position: 'absolute',
    bottom: 64,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  previewTitle: {
    fontSize: 22,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  previewDesc: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  previewPriceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  previewPriceText: {
    fontSize: 16,
    color: '#fff',
  },

  // Frame Preview Styles
  framePreviewContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  framePreviewGlow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255, 106, 57, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255, 106, 57, 0.3)',
  },
  framePreviewAvatarWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  framePreviewAvatar: {
    width: '100%',
    height: '100%',
  },
  framePreviewFrameImg: {
    width: 180,
    height: 180,
  },

  // Entrance Preview Styles
  entrancePreviewContainer: {
    width: '100%',
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  entranceGraphicWrap: {
    width: 240,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entranceGraphicImg: {
    width: '100%',
    height: '100%',
  },
  entranceNameplate: {
    position: 'absolute',
    bottom: 10,
    borderRadius: 99,
    overflow: 'hidden',
    ...shadows.md,
  },
  nameplateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    gap: 8,
  },
  nameplateAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  nameplateText: {
    color: '#fff',
    fontSize: 12,
  },

  // Bubble Preview Styles
  bubblePreviewContainer: {
    width: '90%',
    height: 220,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    gap: 16,
    justifyContent: 'center',
  },
  bubbleMockRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  bubbleMockAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  bubbleMockMsgLeft: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  bubbleMockTextLeft: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },
  bubbleMockRowRight: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  bubbleMockAvatarRight: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  bubbleWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 150,
    minHeight: 44,
  },
  bubbleBgImg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  bubbleTextContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleMockMsgRight: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
  },
  bubbleMockTextRight: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },

  // Default Preview Styles
  defaultPreviewContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultPreviewImg: {
    width: '100%',
    height: '100%',
  },
  defaultPreviewCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ==================== PREVIEW MODULES ====================

function resolveUserAvatar(user: User | null | undefined): string | undefined {
  const url = user?.profile?.avatar?.trim() || user?.profile?.photos?.[0]?.trim();
  return url || undefined;
}

function resolveUserDisplayName(user: User | null | undefined, fallback: string): string {
  return user?.profile?.displayName?.trim() || fallback;
}

function FrameWithAvatar({
  frameUrl,
  user,
  size = 200,
  animated = false,
}: {
  frameUrl: string;
  user: User | null | undefined;
  size?: number;
  animated?: boolean;
}) {
  const avatarSize = Math.round(size * 0.58);
  const frameSize = Math.round(size * 0.92);
  const avatarUrl = resolveUserAvatar(user);
  const displayName = resolveUserDisplayName(user, '?');
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!animated) return;
    scale.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 900 }), withTiming(1.0, { duration: 900 })),
      -1,
      true,
    );
  }, [animated, frameUrl]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const frameLayer = (
    <Image
      source={{ uri: frameUrl }}
      style={{ width: frameSize, height: frameSize }}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={150}
    />
  );

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <Text weight="bold" style={{ fontSize: avatarSize * 0.38, color: '#fff' }}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        pointerEvents="none"
      >
        {animated ? <Animated.View style={animatedStyle}>{frameLayer}</Animated.View> : frameLayer}
      </View>
    </View>
  );
}

function PreviewOverlay({
  item,
  onClose,
  user,
}: {
  item: StoreDisplayItem | null;
  onClose: () => void;
  user: User | null;
}) {
  const { t } = useTranslation();
  if (!item) return null;

  const userAvatar = resolveUserAvatar(user);
  const userName = resolveUserDisplayName(user, t('rooms.userFallback', { defaultValue: 'مستخدم' }));

  return (
    <View style={styles.previewBackdrop}>
      <Pressable style={styles.previewCloseBtn} onPress={onClose}>
        <X size={24} color="#fff" strokeWidth={2.5} />
      </Pressable>

      <View style={styles.previewContent}>
        {item.type === 'frame' && (
          <FramePreview item={item} user={user} />
        )}
        {item.type === 'entrance' && (
          <EntrancePreview item={item} name={userName} avatar={userAvatar} />
        )}
        {item.type === 'bubble' && (
          <BubblePreview item={item} name={userName} avatar={userAvatar} />
        )}
        {item.type !== 'frame' && item.type !== 'entrance' && item.type !== 'bubble' && (
          <DefaultPreview item={item} />
        )}
      </View>

      <View style={styles.previewFooter}>
        <Text weight="bold" style={styles.previewTitle}>
          {item.name}
        </Text>
        <Text style={styles.previewDesc}>{item.description}</Text>
        <View style={styles.previewPriceWrap}>
          {item.currency === 'coins' ? (
            <Image source={COIN_CURRENCY_ICON} style={{ width: 18, height: 18 }} contentFit="contain" />
          ) : (
            <Image source={require('../../assets/masa.webp')} style={{ width: 18, height: 18 }} contentFit="contain" />
          )}
          <Text weight="bold" style={styles.previewPriceText}>
            {item.price.toLocaleString('en-US')}
          </Text>
        </View>
      </View>
    </View>
  );
}

function FramePreview({ item, user }: { item: StoreDisplayItem; user: User | null }) {
  const mediaUrl = storeItemMediaUrl(item);
  if (!mediaUrl) return null;
  return <FrameWithAvatar frameUrl={mediaUrl} user={user} size={200} animated />;
}

function EntrancePreview({
  item,
  name,
  avatar,
}: {
  item: StoreDisplayItem;
  name: string;
  avatar?: string;
}) {
  const scale = useSharedValue(0.1);
  const opacity = useSharedValue(0);
  const nameplateScale = useSharedValue(0);
  const floatY = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    const runAnim = () => {
      // Reset variables
      scale.value = 0.1;
      opacity.value = 0;
      nameplateScale.value = 0;
      floatY.value = 0;
      pulseScale.value = 1;

      // 1. Fade in and zoom in big in the center
      opacity.value = withTiming(1, { duration: 400 });
      scale.value = withTiming(1.8, { duration: 750 }, () => {
        // 2. Bounce and spring back to normal size
        scale.value = withSpring(1.0, { damping: 11 }, () => {
          // 3. Reveal nameplate with a spring
          nameplateScale.value = withSpring(1);

          // 4. Start float & pulse loops
          floatY.value = withRepeat(
            withSequence(
              withTiming(-12, { duration: 1500 }),
              withTiming(12, { duration: 1500 })
            ),
            -1,
            true
          );
          
          pulseScale.value = withRepeat(
            withSequence(
              withTiming(1.06, { duration: 1500 }),
              withTiming(0.98, { duration: 1500 })
            ),
            -1,
            true
          );
        });
      });
    };

    // تشغيل الأنيميشن مرة واحدة فقط (loops الطفو/النبض تستمر داخلياً)
    runAnim();
  }, [item.id]);

  const animatedGraphicStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * pulseScale.value },
      { translateY: floatY.value }
    ],
    opacity: opacity.value,
  }));

  const animatedNameplateStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nameplateScale.value }],
    opacity: nameplateScale.value,
  }));

  const mediaUrl = storeItemMediaUrl(item);

  return (
    <View style={styles.entrancePreviewContainer}>
      {mediaUrl && (
        <Animated.View style={[styles.entranceGraphicWrap, animatedGraphicStyle]}>
          <Image source={{ uri: mediaUrl }} style={styles.entranceGraphicImg} contentFit="contain" cachePolicy="memory-disk" />
        </Animated.View>
      )}

      <Animated.View style={[styles.entranceNameplate, animatedNameplateStyle]}>
        <LinearGradient
          colors={['rgba(255, 215, 0, 0.95)', 'rgba(255, 126, 0, 0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.nameplateGradient}
        >
          {avatar ? (
          <Image source={{ uri: avatar }} style={styles.nameplateAvatar} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.nameplateAvatar, { backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }]}>
            <Text weight="bold" style={{ color: '#fff', fontSize: 10 }}>{name.charAt(0)}</Text>
          </View>
        )}
          <Text weight="bold" style={styles.nameplateText}>
            {name}
          </Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

function BubblePreview({
  item,
  name,
  avatar,
}: {
  item: StoreDisplayItem;
  name: string;
  avatar?: string;
}) {
  const msg1Opacity = useSharedValue(0);
  const msg1TranslateY = useSharedValue(20);
  const msg2Opacity = useSharedValue(0);
  const msg2TranslateY = useSharedValue(20);

  useEffect(() => {
    msg1Opacity.value = 0;
    msg1TranslateY.value = 20;
    msg2Opacity.value = 0;
    msg2TranslateY.value = 20;

    msg1Opacity.value = withTiming(1, { duration: 500 });
    msg1TranslateY.value = withTiming(0, { duration: 500 });

    msg2Opacity.value = withDelay(1000, withTiming(1, { duration: 500 }));
    msg2TranslateY.value = withDelay(1000, withTiming(0, { duration: 500 }));
  }, [item.id]);

  const msg1Style = useAnimatedStyle(() => ({
    opacity: msg1Opacity.value,
    transform: [{ translateY: msg1TranslateY.value }],
  }));

  const msg2Style = useAnimatedStyle(() => ({
    opacity: msg2Opacity.value,
    transform: [{ translateY: msg2TranslateY.value }],
  }));

  const bubbleUrl = storeItemMediaUrl(item);

  return (
    <View style={styles.bubblePreviewContainer}>
      <Animated.View style={[styles.bubbleMockRow, msg1Style]}>
        <View style={styles.bubbleMockAvatar} />
        <View style={styles.bubbleMockMsgLeft}>
          <Text style={styles.bubbleMockTextLeft}>مرحباً! كيف تبدو فقاعة الدردشة الجديدة الخاصة بك؟</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.bubbleMockRowRight, msg2Style]}>
        {bubbleUrl ? (
          <View style={styles.bubbleWrapper}>
            <Image source={{ uri: bubbleUrl }} style={styles.bubbleBgImg} contentFit="fill" cachePolicy="memory-disk" />
            <View style={styles.bubbleTextContainer}>
              <Text weight="bold" style={styles.bubbleMockTextRight}>
                تبدو مذهلة جداً وذات جودة عالية!
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.bubbleMockMsgRight, { backgroundColor: item.bgColors[1] }]}>
            <Text weight="bold" style={styles.bubbleMockTextRight}>
              تبدو مذهلة جداً وذات جودة عالية!
            </Text>
          </View>
        )}
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.bubbleMockAvatarRight} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.bubbleMockAvatarRight, styles.bubbleMockAvatar]} />
        )}
      </Animated.View>
    </View>
  );
}

function DefaultPreview({ item }: { item: StoreDisplayItem }) {
  const IconComp = (LucideIcons as any)[item.iconName] ?? Star;
  const mediaUrl = storeItemMediaUrl(item);
  return (
    <View style={styles.defaultPreviewContainer}>
      {mediaUrl ? (
        <Image source={{ uri: mediaUrl }} style={styles.defaultPreviewImg} contentFit="contain" cachePolicy="memory-disk" transition={150} />
      ) : (
        <View style={[styles.defaultPreviewCircle, { backgroundColor: item.bgColors[1] }]}>
          <IconComp size={64} color="#fff" />
        </View>
      )}
    </View>
  );
}
