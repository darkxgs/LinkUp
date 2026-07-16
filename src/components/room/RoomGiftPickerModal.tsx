/**
 * موديل إرسال الهدايا في الروم — تصميم immersive بهوية LinkUp
 * صف المستلمين + الكل + شبكة الهدايا + شريط الإرسال
 */
import React, { useMemo, useState, useEffect, useCallback, memo, useRef } from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Text as RNText,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, ChevronDown, Volume2, Gift, Crown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import { Text, GiftVisual, CurrencyIcon } from '@/components/ui';
import { LuCoinIcon, LuGiftIcon } from '@/components/icons/LuDesignIcons';
import { TAB_DESIGN } from '@/components/navigation/TabBarNavigationSvg';
import type { Gift as GiftType } from '@/services/firebase/shop';
import { giftHasSound, isAnimatedGiftType, giftHasGifAnimation } from '@/components/ui/giftUtils';
import { preloadGiftSound } from '@/utils/playRoomSound';
import { getGiftCategoryLabel } from '@/utils/giftCategories';
import type { GiftCategoryConfig } from '@/services/firebase/shop';
import type { GiftPickerRecipient } from '@/components/chat/ChatGiftPickerModal';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';

const QTY_OPTIONS = [1, 5, 10, 20, 50, 99];
const COMBO_DURATION_SEC = 5;
// نبضة العدّاد ~2.5Hz بدل 10Hz — يكفي لعرض بيل تنازلي دون إعادة رسم شبكة الهدايا 10 مرات/ث
const COMBO_TICK_MS = 400;
const COMBO_RING_R = 30;
const COMBO_RING_C = 2 * Math.PI * COMBO_RING_R;

/**
 * خلية هدية واحدة — مُغلّفة بـ memo حتى لا يُعاد رسم كامل الشبكة عند اختيار هدية،
 * وتعرض صورة واحدة فقط (خفيفة). الأنيميشن يُشغَّل فقط للهدية المختارة، مع كاش القرص
 * لتفادي إعادة التنزيل على الإنترنت الضعيف.
 */
type GiftCellProps = {
  gift: GiftType;
  selected: boolean;
  colW: number;
  onSelect: (gift: GiftType) => void;
};

const GiftCell = memo(
  function GiftCell({ gift, selected, colW, onSelect }: GiftCellProps) {
    const hasSound = giftHasSound(gift);
    const isVipExclusive = (gift.requiredVipLevel ?? 0) > 0;
    const thumbSize = colW * 0.5;
    const animate = selected && isAnimatedGiftType(gift) && giftHasGifAnimation(gift);

    return (
      <Pressable
        onPress={() => onSelect(gift)}
        style={[styles.giftCell, { width: colW }, selected && styles.giftCellSelected]}
      >
        {hasSound ? (
          <View style={styles.soundBadge}>
            <Volume2 size={9} color="#D97706" strokeWidth={2.5} />
          </View>
        ) : null}
        {isVipExclusive ? (
          <View style={styles.vipBadge}>
            <Crown size={9} color="#B45309" strokeWidth={2.5} />
          </View>
        ) : null}
        <View style={[styles.giftThumb, { backgroundColor: `${gift.iconColor}22` }]}>
          <GiftVisual
            gift={gift}
            size={thumbSize}
            mediaOrder={animate ? 'animation-first' : 'image-first'}
            animateGif={animate}
            cachePolicy="memory-disk"
          />
        </View>
        <RNText style={styles.giftName} numberOfLines={1}>
          {gift.name}
        </RNText>
        <View style={styles.priceRow}>
          <CurrencyIcon type="coin" size={10} />
          <RNText style={styles.priceText}>{gift.price.toLocaleString('en-US')}</RNText>
        </View>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.gift.id === next.gift.id &&
    prev.selected === next.selected &&
    prev.colW === next.colW &&
    prev.onSelect === next.onSelect,
);

export type GiftSendOptions = {
  isCombo?: boolean;
};

type Props = {
  visible: boolean;
  gifts: GiftType[];
  categories: GiftCategoryConfig[];
  balance: number;
  sending?: boolean;
  recipients: GiftPickerRecipient[];
  initialRecipientUid?: string | null;
  onClose: () => void;
  onSend: (
    gift: GiftType,
    quantity: number,
    recipientUids: string[],
    opts?: GiftSendOptions,
  ) => void | Promise<void>;
  onComboEnd?: () => void;
  onRecharge?: () => void;
};

export function RoomGiftPickerModal({
  visible,
  gifts,
  categories,
  balance,
  sending = false,
  recipients,
  initialRecipientUid,
  onClose,
  onSend,
  onComboEnd,
  onRecharge,
}: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const colW = (screenW - spacing.base * 2 - 10 * 3) / 4;
  const lang = i18n.language;

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedGift, setSelectedGift] = useState<GiftType | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showQty, setShowQty] = useState(false);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  // خصم تفاؤلي للرصيد المعروض — يُصفَّر عند وصول الرصيد الحقيقي من الأعلى
  const [spentLocally, setSpentLocally] = useState(0);
  // هل لمس المستخدم قائمة المستلمين يدوياً؟ (يمنع الاختيار التلقائي المتأخر)
  const userTouchedRecipientsRef = useRef(false);

  const [comboGiftId, setComboGiftId] = useState<string | null>(null);
  const [comboCount, setComboCount] = useState<number>(0);
  const [comboTimeLeft, setComboTimeLeft] = useState<number>(COMBO_DURATION_SEC);
  const comboTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  // طابع نهاية الكومبو — نشتق الوقت المتبقي من الفرق الزمني حتى تبقى الـ5 ثوانٍ دقيقة رغم خشونة النبضة
  const comboEndAtRef = useRef(0);
  const comboGlow = useRef(new Animated.Value(0)).current;
  const comboScale = useRef(new Animated.Value(1)).current;
  /** يمنع ضغطات مزدوجة دون الاعتماد على prop `sending` (كان يعطّل الزر على أجهزة بطيئة) */
  const comboTapLockUntilRef = useRef(0);

  const pulseComboGlow = useCallback(() => {
    comboGlow.setValue(0);
    comboScale.setValue(1);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(comboGlow, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(comboGlow, {
          toValue: 0,
          duration: 380,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(comboScale, {
          toValue: 1.14,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(comboScale, {
          toValue: 1,
          friction: 5,
          tension: 220,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [comboGlow, comboScale]);

  const comboActive =
    Boolean(comboGiftId && selectedGift && comboGiftId === selectedGift.id && comboTimeLeft > 0);

  const clearComboTimer = useCallback(() => {
    if (comboTimerRef.current) {
      clearInterval(comboTimerRef.current);
      comboTimerRef.current = null;
    }
  }, []);

  const resetCombo = useCallback(() => {
    clearComboTimer();
    setComboGiftId(null);
    setComboCount(0);
    setComboTimeLeft(COMBO_DURATION_SEC);
    onComboEnd?.();
  }, [clearComboTimer, onComboEnd]);

  const startComboTimer = useCallback(() => {
    clearComboTimer();
    comboEndAtRef.current = Date.now() + COMBO_DURATION_SEC * 1000;
    setComboTimeLeft(COMBO_DURATION_SEC);
    comboTimerRef.current = setInterval(() => {
      // الوقت المتبقي من الفرق الزمني الحقيقي — يصل 0 بدقة عند انقضاء المدة
      setComboTimeLeft(Math.max(0, (comboEndAtRef.current - Date.now()) / 1000));
    }, COMBO_TICK_MS);
  }, [clearComboTimer]);

  useEffect(() => {
    if (comboTimeLeft > 0 || !comboGiftId) return;
    clearComboTimer();
    setComboGiftId(null);
    setComboCount(0);
    onComboEnd?.();
  }, [comboTimeLeft, comboGiftId, clearComboTimer, onComboEnd]);

  useEffect(() => {
    return () => {
      if (comboTimerRef.current) {
        clearInterval(comboTimerRef.current);
      }
    };
  }, []);

  const recipientIds = useMemo(() => recipients.map((r) => r.uid), [recipients]);
  const recipientIdsKey = recipientIds.join(',');
  const allSelected =
    recipientIds.length > 0 && recipientIds.every((id) => selectedUids.has(id));

  const prevVisibleRef = React.useRef(false);
  useEffect(() => {
    if (!visible) {
      prevVisibleRef.current = false;
      resetCombo();
      return;
    }
    const wasHidden = !prevVisibleRef.current;
    prevVisibleRef.current = true;
    if (!wasHidden) return;

    setActiveCategory('all');
    setSelectedGift(null);
    setQuantity(1);
    setShowQty(false);
    setSpentLocally(0);
    userTouchedRecipientsRef.current = false;
    // الاختيار مربوط بالـ uid حصراً: لا نختار «أول شخص» تلقائياً —
    // كان الاختيار الافتراضي الموضعي يرسل الهدية لغير المقصود عند تبدّل الحضور
    const initial = new Set<string>();
    if (
      initialRecipientUid &&
      recipients.some((r) => r.uid === initialRecipientUid)
    ) {
      initial.add(initialRecipientUid);
    }
    setSelectedUids(initial);
  }, [visible, recipientIdsKey, initialRecipientUid, recipients, resetCombo]);

  useEffect(() => {
    if (selectedGift?.id !== comboGiftId) {
      resetCombo();
    }
  }, [selectedGift?.id, comboGiftId, resetCombo]);

  useEffect(() => {
    if (!visible || selectedUids.size === 0) return;
    const validSet = new Set(recipientIds);
    const cleaned = new Set<string>();
    let changed = false;
    for (const uid of selectedUids) {
      if (validSet.has(uid)) {
        cleaned.add(uid);
      } else {
        changed = true;
      }
    }
    if (changed) setSelectedUids(cleaned);
  }, [visible, recipientIdsKey]);

  // إذا فُتحت النافذة على شخص لم يظهر بعد في قائمة الحضور (تأخر التحميل)،
  // نختاره بالـ uid فور ظهوره — ما دام المستخدم لم يختر أحداً بنفسه
  useEffect(() => {
    if (!visible || !initialRecipientUid) return;
    if (userTouchedRecipientsRef.current || selectedUids.size > 0) return;
    if (recipientIds.includes(initialRecipientUid)) {
      setSelectedUids(new Set([initialRecipientUid]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialRecipientUid, recipientIdsKey]);

  // وصل رصيد جديد من الأعلى (refreshUser بعد الشراء) — نصفّر الخصم التفاؤلي
  useEffect(() => {
    setSpentLocally(0);
  }, [balance]);

  useEffect(() => {
    if (!visible || !selectedGift || !giftHasSound(selectedGift)) return;
    void preloadGiftSound(selectedGift.soundUrl!.trim());
  }, [visible, selectedGift?.id, selectedGift?.soundUrl]);

  const hasVipGifts = useMemo(() => gifts.some((g) => (g.requiredVipLevel ?? 0) > 0), [gifts]);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return gifts;
    if (activeCategory === '__vip__') return gifts.filter((g) => (g.requiredVipLevel ?? 0) > 0);
    return gifts.filter((g) => g.category === activeCategory);
  }, [gifts, activeCategory]);

  const recipientCount = selectedUids.size;
  const totalPrice = selectedGift ? selectedGift.price * quantity * recipientCount : 0;
  const displayedBalance = Math.max(0, balance - spentLocally);
  const canAfford = displayedBalance >= totalPrice;
  const canSend =
    selectedGift &&
    canAfford &&
    recipientCount > 0 &&
    !sending;

  // أسماء المستلمين المختارين — تظهر على زر الإرسال حتى يتأكد المرسل من الهدف
  const selectedNamesLabel = useMemo(() => {
    if (selectedUids.size === 0) return '';
    if (allSelected && recipients.length > 1) return t('common.all');
    const names = recipients
      .filter((r) => selectedUids.has(r.uid))
      .map((r) => (r.isMe ? t('leaderboard.you') : r.name));
    const shown = names.slice(0, 2).join('، ');
    return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
  }, [selectedUids, recipients, allSelected, t]);

  const toggleRecipient = (uid: string) => {
    userTouchedRecipientsRef.current = true;
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        if (next.size > 1) next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  const toggleAll = () => {
    userTouchedRecipientsRef.current = true;
    if (allSelected) {
      if (recipients[0]) setSelectedUids(new Set([recipients[0].uid]));
      return;
    }
    setSelectedUids(new Set(recipientIds));
  };

  const handleComboSend = () => {
    if (!selectedGift || recipientCount === 0 || !comboActive) return;
    const now = Date.now();
    // قفل لمس قصير (~120ms) بدل disabled={sending} — على أجهزة ضعيفة كان
    // sending=true يجمّد زر الكومبو بالكامل فيفوت النافذة الزمنية
    if (now < comboTapLockUntilRef.current) return;
    comboTapLockUntilRef.current = now + 120;

    const singleBatchPrice = selectedGift.price * quantity * recipientCount;
    if (displayedBalance < singleBatchPrice) {
      resetCombo();
      onRecharge?.();
      return;
    }
    pulseComboGlow();
    setComboCount((prev) => prev + quantity);
    startComboTimer();
    // خصم فوري من الرصيد المعروض — يتراجع لو فشل الإرسال فعلياً
    setSpentLocally((prev) => prev + singleBatchPrice);
    void Promise.resolve(
      onSend(selectedGift, quantity, [...selectedUids], { isCombo: true }),
    ).catch(() => setSpentLocally((prev) => Math.max(0, prev - singleBatchPrice)));
  };

  const handleSend = async () => {
    if (!canSend || !selectedGift) return;
    setComboGiftId(selectedGift.id);
    setComboCount(quantity);
    startComboTimer();
    // خصم فوري من الرصيد المعروض — كان الرصيد يبقى كما هو حتى إغلاق النافذة
    setSpentLocally((prev) => prev + totalPrice);
    try {
      await onSend(selectedGift, quantity, [...selectedUids], { isCombo: false });
    } catch (e) {
      console.warn('Combo initial send failed:', e);
      setSpentLocally((prev) => Math.max(0, prev - totalPrice));
      resetCombo();
    }
  };

  const onSelectGift = useCallback((gift: GiftType) => setSelectedGift(gift), []);
  const renderGiftItem = useCallback(
    ({ item }: { item: GiftType }) => (
      <GiftCell
        gift={item}
        selected={selectedGift?.id === item.id}
        colW={colW}
        onSelect={onSelectGift}
      />
    ),
    [selectedGift?.id, colW, onSelectGift],
  );

  const resetOnClose = () => {
    setShowQty(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={resetOnClose}>
      <Pressable style={styles.overlay} onPress={() => !sending && resetOnClose()}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + 8, maxHeight: '82%' }]}
          onPress={(e) => e.stopPropagation()}
        >
          <LinearGradient
            colors={[lu.colors.room0, lu.colors.room1, lu.colors.room2]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.handle} />

          {/* بانر علوي */}
          <LinearGradient
            colors={['#E11414', '#E02B2B', '#E11414']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.banner}
          >
            <View style={styles.bannerIconWrap}>
              <LuGiftIcon size={22} color="#fff" filled />
            </View>
            <View style={{ flex: 1 }}>
              <RNText style={styles.bannerTitle}>{t('room.giftBannerTitle')}</RNText>
              <RNText style={styles.bannerSub}>{t('room.giftBannerSub')}</RNText>
            </View>
            <Pressable onPress={resetOnClose} hitSlop={12} disabled={sending}>
              <X size={20} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
            </Pressable>
          </LinearGradient>

          {/* صف المستلمين */}
          <View style={styles.recipientBlock}>
            {recipients.length === 0 ? (
              <Text variant="caption" color="rgba(255,255,255,0.55)" style={{ paddingHorizontal: spacing.base }}>
                {t('room.noGiftRecipients')}
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recipientRow}
              >
                {recipients.map((r) => {
                  const active = selectedUids.has(r.uid);
                  return (
                    <Pressable
                      key={r.uid}
                      onPress={() => toggleRecipient(r.uid)}
                      style={styles.recipientItem}
                    >
                      <View style={styles.recipientAvatarWrap}>
                        <Image
                          source={{ uri: r.avatar || 'https://i.pravatar.cc/100' }}
                          style={[styles.recipientAvatar, !active && styles.recipientAvatarInactive]}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          recyclingKey={r.uid}
                          transition={150}
                        />
                        {active ? (
                          <View style={styles.recipientCheck}>
                            <RNText style={styles.recipientCheckIcon}>✓</RNText>
                          </View>
                        ) : null}
                        {r.seatLabel !== undefined ? (
                          <View style={styles.seatBadge}>
                            <RNText style={styles.seatBadgeText}>{r.seatLabel}</RNText>
                          </View>
                        ) : null}
                      </View>
                      <RNText
                        style={[styles.recipientName, active && styles.recipientNameActive]}
                        numberOfLines={1}
                      >
                        {r.isMe ? t('leaderboard.you') : r.name}
                      </RNText>
                    </Pressable>
                  );
                })}

                <Pressable onPress={toggleAll} style={styles.recipientItem}>
                  <View style={[styles.allBtn, allSelected && styles.allBtnActive]}>
                    {allSelected ? (
                      <LinearGradient
                        colors={[lu.colors.mint, TAB_DESIGN.purple]}
                        style={StyleSheet.absoluteFill}
                      />
                    ) : null}
                    <RNText style={[styles.allBtnText, allSelected && styles.allBtnTextActive]}>
                      {t('common.all')}
                    </RNText>
                  </View>
                  <RNText style={[styles.recipientName, allSelected && styles.recipientNameActive]}>
                    {t('room.sendToAll')}
                  </RNText>
                </Pressable>
              </ScrollView>
            )}
          </View>

          {/* التصنيفات */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
          >
            <Pressable
              onPress={() => setActiveCategory('all')}
              style={[styles.catPill, activeCategory === 'all' && styles.catPillActive]}
            >
              {activeCategory === 'all' ? (
                <LinearGradient colors={[lu.colors.pink, TAB_DESIGN.purple]} style={StyleSheet.absoluteFill} />
              ) : null}
              <RNText style={[styles.catText, activeCategory === 'all' && styles.catTextActive]}>
                {t('common.all')}
              </RNText>
            </Pressable>
            {hasVipGifts ? (
              <Pressable
                onPress={() => setActiveCategory('__vip__')}
                style={[styles.catPill, activeCategory === '__vip__' && styles.catPillActive]}
              >
                {activeCategory === '__vip__' ? (
                  <LinearGradient colors={['#F59E0B', '#B45309']} style={StyleSheet.absoluteFill} />
                ) : null}
                <Crown size={12} color={activeCategory === '__vip__' ? '#fff' : '#F59E0B'} strokeWidth={2.5} style={{ marginRight: 3 }} />
                <RNText style={[styles.catText, activeCategory === '__vip__' && styles.catTextActive]} numberOfLines={1}>
                  VIP
                </RNText>
              </Pressable>
            ) : null}
            {categories.map((c) => {
              const active = activeCategory === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setActiveCategory(c.id)}
                  style={[styles.catPill, active && styles.catPillActive]}
                >
                  {active ? (
                    <LinearGradient colors={[lu.colors.pink, TAB_DESIGN.purple]} style={StyleSheet.absoluteFill} />
                  ) : null}
                  <RNText style={[styles.catText, active && styles.catTextActive]} numberOfLines={1}>
                    {getGiftCategoryLabel(c, lang)}
                  </RNText>
                </Pressable>
              );
            })}
            <View style={styles.catGiftIcon}>
              <Gift size={16} color="rgba(255,255,255,0.5)" strokeWidth={2} />
            </View>
          </ScrollView>

          <FlatList
            data={filtered}
            keyExtractor={(g) => g.id}
            numColumns={4}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
            extraData={selectedGift?.id}
            initialNumToRender={16}
            maxToRenderPerBatch={12}
            updateCellsBatchingPeriod={50}
            windowSize={5}
            removeClippedSubviews
            ListEmptyComponent={
              <Text variant="bodySmall" color="rgba(255,255,255,0.45)" align="center" style={{ padding: 24 }}>
                {t('chat.noGiftsInCategory')}
              </Text>
            }
            renderItem={renderGiftItem}
          />

          <View style={styles.footer}>
            <Pressable style={styles.balanceChip} onPress={onRecharge}>
              <LuCoinIcon size={18} color={lu.colors.gold} />
              <RNText style={styles.balanceText}>{displayedBalance.toLocaleString('en-US')}</RNText>
              <ChevronDown size={14} color="rgba(255,255,255,0.45)" style={{ transform: [{ rotate: '-90deg' }] }} />
            </Pressable>

            <Pressable
              style={styles.qtyChip}
              onPress={() => setShowQty((v) => !v)}
              disabled={!selectedGift}
            >
              <RNText style={styles.qtyText}>{quantity}</RNText>
              <ChevronDown size={14} color="rgba(255,255,255,0.6)" />
            </Pressable>

            {comboActive ? (
              <View style={styles.comboContainer}>
                <RNText style={styles.comboCountText}>x {comboCount}</RNText>
                {/* منطقة لمس ثابتة — لا تُحرَّك بالـ transform (كان يكسّر اللمس على أندرويد) */}
                <View style={styles.comboHitBox} collapsable={false}>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.comboGlowRing,
                      {
                        opacity: comboGlow.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 1],
                        }),
                        transform: [
                          { scale: comboScale },
                          {
                            scale: comboGlow.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.85, 1.35],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                  {/* onPressIn: لحظة اللمس — لا يعتمد على انتهاء الأنيميشن/إعادة الرسم */}
                  <Pressable
                    onPressIn={handleComboSend}
                    hitSlop={28}
                    pressRetentionOffset={40}
                    android_disableSound
                    style={styles.comboCircleBtn}
                  >
                    <LinearGradient
                      colors={['#FF4D8D', '#E11414', '#C026D3']}
                      start={{ x: 0.15, y: 0 }}
                      end={{ x: 0.85, y: 1 }}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                    <View style={styles.comboRingLayer} pointerEvents="none">
                      <Svg width={72} height={72} viewBox="0 0 72 72">
                        <Defs>
                          <SvgLinearGradient id="comboRingGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                            <Stop offset="0%" stopColor="#FBBF24" />
                            <Stop offset="45%" stopColor="#F472B6" />
                            <Stop offset="100%" stopColor="#A855F7" />
                          </SvgLinearGradient>
                        </Defs>
                        <Circle
                          cx="36"
                          cy="36"
                          r={COMBO_RING_R}
                          stroke="rgba(255,255,255,0.18)"
                          strokeWidth="4"
                          fill="transparent"
                        />
                        <Circle
                          cx="36"
                          cy="36"
                          r={COMBO_RING_R}
                          stroke="url(#comboRingGrad)"
                          strokeWidth="4.5"
                          fill="transparent"
                          strokeDasharray={COMBO_RING_C}
                          strokeDashoffset={COMBO_RING_C * (1 - comboTimeLeft / COMBO_DURATION_SEC)}
                          strokeLinecap="round"
                          transform="rotate(-90 36 36)"
                        />
                      </Svg>
                    </View>
                    <RNText style={styles.comboTimeText}>{comboTimeLeft.toFixed(1)}s</RNText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              >
                <LinearGradient
                  colors={canSend ? [lu.colors.gold2, lu.colors.pink] : ['#4B5563', '#374151']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <RNText style={styles.sendText} numberOfLines={1}>
                    {!selectedGift
                      ? t('chat.selectGiftFirst')
                      : recipientCount === 0
                        ? t('room.selectRecipientFirst', 'اختر المستلم')
                        : t('room.sendGiftToName', {
                            name: selectedNamesLabel,
                            price: totalPrice.toLocaleString('en-US'),
                          })}
                  </RNText>
                )}
              </Pressable>
            )}
          </View>

          {showQty && selectedGift ? (
            <View style={styles.qtyMenu}>
              {QTY_OPTIONS.map((q) => (
                <Pressable
                  key={q}
                  style={[styles.qtyOption, quantity === q && styles.qtyOptionActive]}
                  onPress={() => {
                    setQuantity(q);
                    setShowQty(false);
                  }}
                >
                  <RNText style={[styles.qtyOptionText, quantity === q && styles.qtyOptionTextActive]}>
                    ×{q}
                  </RNText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: spacing.base,
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
  },
  bannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  bannerSub: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    marginTop: 2,
    fontFamily: lu.fonts.body,
  },
  recipientBlock: {
    marginBottom: 10,
  },
  recipientRow: {
    paddingHorizontal: spacing.base,
    gap: 14,
    alignItems: 'flex-end',
  },
  recipientItem: {
    alignItems: 'center',
    width: 58,
  },
  recipientAvatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    position: 'relative',
  },
  recipientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  recipientAvatarInactive: {
    opacity: 0.45,
  },
  recipientCheck: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: lu.colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: lu.colors.room0,
  },
  recipientCheckIcon: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    includeFontPadding: false,
  },
  seatBadge: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: TAB_DESIGN.purple,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: '#fff',
  },
  seatBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#fff',
  },
  recipientName: {
    marginTop: 5,
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    width: 58,
  },
  recipientNameActive: {
    color: lu.colors.mint,
    fontWeight: '800',
  },
  allBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  allBtnActive: {
    borderColor: lu.colors.mint,
  },
  allBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
  },
  allBtnTextActive: {
    color: '#fff',
  },
  catRow: {
    paddingHorizontal: spacing.base,
    paddingBottom: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    minHeight: 34,
    justifyContent: 'center',
  },
  catPillActive: {
    borderColor: lu.colors.pink,
  },
  catText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
  },
  catTextActive: {
    color: '#fff',
  },
  catGiftIcon: {
    marginLeft: 4,
    opacity: 0.7,
  },
  gridContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: 8,
  },
  gridRow: {
    gap: 10,
    marginBottom: 10,
  },
  giftCell: {
    alignItems: 'center',
    padding: 5,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  giftCellSelected: {
    borderColor: lu.colors.gold2,
    backgroundColor: 'rgba(255,154,46,0.12)',
  },
  soundBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    zIndex: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipBadge: {
    position: 'absolute',
    top: 3,
    left: 3,
    zIndex: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbGifOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftName: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    width: '100%',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  priceText: {
    fontSize: 9,
    fontWeight: '800',
    color: lu.colors.gold,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.base,
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  balanceText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    fontFamily: lu.fonts.bodyHeavy,
  },
  qtyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minWidth: 48,
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  sendBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.75,
  },
  sendText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  qtyMenu: {
    position: 'absolute',
    bottom: 56,
    right: spacing.base + 56,
    backgroundColor: lu.colors.room1,
    borderRadius: radius.md,
    padding: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    maxWidth: 200,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  qtyOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  qtyOptionActive: {
    backgroundColor: 'rgba(225, 20, 20,0.25)',
  },
  qtyOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  qtyOptionTextActive: {
    color: lu.colors.pink,
    fontWeight: '800',
  },
  comboContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    paddingEnd: 2,
    minHeight: 72,
    gap: 10,
  },
  comboCountText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    fontStyle: 'italic',
    fontFamily: lu.fonts.bodyHeavy,
    letterSpacing: 0.5,
    textShadowColor: '#D946EF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
    includeFontPadding: false,
  },
  comboHitBox: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
  },
  comboCircleBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  comboGlowRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    top: -18,
    alignSelf: 'center',
    backgroundColor: 'rgba(236, 72, 153, 0.45)',
    shadowColor: '#F472B6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 14,
  },
  comboRingLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboTimeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    includeFontPadding: false,
  },
});
