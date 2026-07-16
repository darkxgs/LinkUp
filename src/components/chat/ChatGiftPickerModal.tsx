/**
 * موديل اختيار الهدايا في المحادثة — هوية LinkUp (lavender / purple)
 */
import React, { useMemo, useState, useEffect, useCallback, memo } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, ChevronDown, Volume2, Crown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';

import { Text, GiftVisual, CurrencyIcon } from '@/components/ui';
import { LuCoinIcon } from '@/components/icons/LuDesignIcons';
import { TAB_DESIGN } from '@/components/navigation/TabBarNavigationSvg';
import type { Gift } from '@/services/firebase/shop';
import { giftHasSound, isAnimatedGiftType, giftHasGifAnimation } from '@/components/ui/giftUtils';
import { preloadGiftSound } from '@/utils/playRoomSound';
import { getGiftCategoryLabel } from '@/utils/giftCategories';
import type { GiftCategoryConfig } from '@/services/firebase/shop';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';
import { getDefaultAvatar, type ProfileGender } from '@/constants/defaultAvatars';

const QTY_OPTIONS = [1, 5, 10, 20, 50, 99];

/** خلية هدية واحدة — memo + صورة واحدة + كاش قرص لأداء أخف وأسرع على الإنترنت الضعيف */
type GiftCellProps = {
  gift: Gift;
  selected: boolean;
  colW: number;
  onSelect: (gift: Gift) => void;
};

const GiftCell = memo(
  function GiftCell({ gift, selected, colW, onSelect }: GiftCellProps) {
    const hasSound = giftHasSound(gift);
    const isVipExclusive = (gift.requiredVipLevel ?? 0) > 0;
    const thumbSize = colW * 0.52;
    const animate = selected && isAnimatedGiftType(gift) && giftHasGifAnimation(gift);

    return (
      <Pressable
        onPress={() => onSelect(gift)}
        style={[styles.giftCell, { width: colW }, selected && styles.giftCellSelected]}
      >
        {hasSound && (
          <View style={styles.soundBadge}>
            <Volume2 size={9} color="#D97706" strokeWidth={2.5} />
          </View>
        )}
        {isVipExclusive ? (
          <View style={styles.vipBadge}>
            <Crown size={9} color="#B45309" strokeWidth={2.5} />
          </View>
        ) : null}
        <View style={[styles.giftThumb, { backgroundColor: `${gift.iconColor}18` }]}>
          <GiftVisual
            gift={gift}
            size={thumbSize}
            mediaOrder={animate ? 'animation-first' : 'image-first'}
            animateGif={animate}
            cachePolicy="memory-disk"
          />
        </View>
        <RNText style={styles.giftName} numberOfLines={1}>{gift.name}</RNText>
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

export type GiftPickerRecipient = {
  uid: string;
  name: string;
  avatar?: string;
  gender?: ProfileGender;
  /** رقم المقعد أو تسمية (0 = مضيف) */
  seatLabel?: string | number;
  /** هل هذا المستخدم نفسه */
  isMe?: boolean;
};

type Props = {
  visible: boolean;
  gifts: Gift[];
  categories: GiftCategoryConfig[];
  balance: number;
  sending?: boolean;
  /** وضع الروم: سلايدر اختيار المستلم */
  recipients?: GiftPickerRecipient[];
  /** مستلم مُحدَّد مسبقاً (من مقعد أو زر الهدايا) */
  initialRecipientUid?: string | null;
  titleKey?: string;
  onClose: () => void;
  onSend: (gift: Gift, quantity: number, recipientUid?: string) => void | Promise<void>;
  onRecharge?: () => void;
};

export function ChatGiftPickerModal({
  visible,
  gifts,
  categories,
  balance,
  sending = false,
  recipients,
  initialRecipientUid,
  titleKey = 'chat.sendGift',
  onClose,
  onSend,
  onRecharge,
}: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const colW = (screenW - spacing.base * 2 - 12 * 3) / 4;

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showQty, setShowQty] = useState(false);
  const [selectedRecipientUid, setSelectedRecipientUid] = useState<string | null>(null);

  const lang = i18n.language;
  const roomMode = Boolean(recipients?.length);
  const needsRecipient = roomMode;

  useEffect(() => {
    if (!visible) return;
    setActiveCategory('all');
    setSelectedGift(null);
    setQuantity(1);
    setShowQty(false);
    setSelectedRecipientUid(
      initialRecipientUid && recipients?.some((r) => r.uid === initialRecipientUid)
        ? initialRecipientUid
        : recipients?.[0]?.uid ?? null,
    );
  }, [visible, recipients, initialRecipientUid]);

  useEffect(() => {
    if (!visible) return;
    if (!selectedGift || !giftHasSound(selectedGift)) return;
    void preloadGiftSound(selectedGift.soundUrl!.trim());
  }, [visible, selectedGift?.id, selectedGift?.soundUrl]);

  const hasVipGifts = useMemo(() => gifts.some((g) => (g.requiredVipLevel ?? 0) > 0), [gifts]);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return gifts;
    if (activeCategory === '__vip__') return gifts.filter((g) => (g.requiredVipLevel ?? 0) > 0);
    return gifts.filter((g) => g.category === activeCategory);
  }, [gifts, activeCategory]);

  const totalPrice = selectedGift ? selectedGift.price * quantity : 0;
  const canAfford = balance >= totalPrice;

  const handleSend = () => {
    if (!selectedGift || !canAfford || sending) return;
    if (needsRecipient && !selectedRecipientUid) return;
    void onSend(selectedGift, quantity, selectedRecipientUid ?? undefined);
  };

  const resetOnClose = () => {
    setShowQty(false);
    onClose();
  };

  const onSelectGift = useCallback((gift: Gift) => setSelectedGift(gift), []);
  const renderGiftItem = useCallback(
    ({ item }: { item: Gift }) => (
      <GiftCell
        gift={item}
        selected={selectedGift?.id === item.id}
        colW={colW}
        onSelect={onSelectGift}
      />
    ),
    [selectedGift?.id, colW, onSelectGift],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={resetOnClose}>
      <Pressable style={styles.overlay} onPress={() => !sending && resetOnClose()}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.sm, maxHeight: roomMode ? '78%' : '72%' }]}
          onPress={(e) => e.stopPropagation()}
        >
          <LinearGradient
            colors={['#FEE2E2', '#FEF2F2', '#FFFFFF']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text variant="h4" weight="bold" color={lu.colors.ink}>
              {t(titleKey)}
            </Text>
            <Pressable onPress={resetOnClose} hitSlop={12} disabled={sending}>
              <X size={22} color={lu.colors.ink2} strokeWidth={2.5} />
            </Pressable>
          </View>

          {roomMode && (
            <View style={styles.recipientSection}>
              <Text variant="caption" color={lu.colors.muted} style={styles.recipientHint}>
                {t('room.selectRecipient')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recipientRow}
              >
                {recipients!.map((r) => {
                  const active = selectedRecipientUid === r.uid;
                  return (
                    <Pressable
                      key={r.uid}
                      onPress={() => setSelectedRecipientUid(r.uid)}
                      style={styles.recipientItem}
                    >
                      <View style={[styles.recipientAvatarWrap, active && styles.recipientAvatarActive]}>
                        {active && (
                          <LinearGradient
                            colors={[...TAB_DESIGN.activeGrad]}
                            style={StyleSheet.absoluteFill}
                          />
                        )}
                        <Image
                          source={{
                            uri:
                              r.avatar?.trim() ||
                              getDefaultAvatar(r.gender ?? 'male', r.uid),
                          }}
                          style={styles.recipientAvatar}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          recyclingKey={r.uid}
                          transition={150}
                        />
                        {r.seatLabel !== undefined && (
                          <View style={styles.seatBadge}>
                            <RNText style={styles.seatBadgeText}>{r.seatLabel}</RNText>
                          </View>
                        )}
                      </View>
                      <RNText
                        style={[styles.recipientName, active && styles.recipientNameActive]}
                        numberOfLines={1}
                      >
                        {r.name}
                      </RNText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* تصنيفات — من لوحة التحكم */}
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
                <LinearGradient colors={[...TAB_DESIGN.activeGrad]} style={StyleSheet.absoluteFill} />
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
                    <LinearGradient colors={[...TAB_DESIGN.activeGrad]} style={StyleSheet.absoluteFill} />
                  ) : null}
                  <RNText style={[styles.catText, active && styles.catTextActive]} numberOfLines={1}>
                    {getGiftCategoryLabel(c, lang)}
                  </RNText>
                </Pressable>
              );
            })}
          </ScrollView>

          {categories.length === 0 && (
            <Text variant="caption" color={lu.colors.muted} style={{ paddingHorizontal: spacing.base, marginBottom: 8 }}>
              {t('chat.giftCategoriesEmpty')}
            </Text>
          )}

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
              <Text variant="bodySmall" color={lu.colors.muted} align="center" style={{ padding: 24 }}>
                {t('chat.noGiftsInCategory')}
              </Text>
            }
            renderItem={renderGiftItem}
          />

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.balanceChip} onPress={onRecharge}>
              <LuCoinIcon size={18} color={lu.colors.gold2} />
              <Text variant="bodySmall" weight="bold" color={lu.colors.ink}>
                {balance.toLocaleString('en-US')}
              </Text>
              <ChevronDown size={14} color={lu.colors.muted} style={{ transform: [{ rotate: '-90deg' }] }} />
            </Pressable>

            <Pressable
              style={styles.qtyChip}
              onPress={() => setShowQty((v) => !v)}
              disabled={!selectedGift}
            >
              <RNText style={styles.qtyText}>{quantity}</RNText>
              <ChevronDown size={14} color={lu.colors.ink2} />
            </Pressable>

            <Pressable
              onPress={handleSend}
              disabled={!selectedGift || !canAfford || sending || (needsRecipient && !selectedRecipientUid)}
              style={[styles.sendBtn, (!selectedGift || !canAfford || (needsRecipient && !selectedRecipientUid)) && styles.sendBtnDisabled]}
            >
              <LinearGradient
                colors={canAfford && selectedGift ? ['#FECACA', TAB_DESIGN.purple] : ['#D1D5DB', '#9CA3AF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <RNText style={styles.sendText}>
                  {selectedGift
                    ? t('chat.sendGiftBtn', { price: totalPrice.toLocaleString('en-US') })
                    : t('chat.selectGiftFirst')}
                </RNText>
              )}
            </Pressable>
          </View>

          {showQty && selectedGift && (
            <View style={styles.qtyMenu}>
              {QTY_OPTIONS.map((q) => (
                <Pressable
                  key={q}
                  style={[styles.qtyOption, quantity === q && styles.qtyOptionActive]}
                  onPress={() => { setQuantity(q); setShowQty(false); }}
                >
                  <RNText style={[styles.qtyOptionText, quantity === q && styles.qtyOptionTextActive]}>
                    ×{q}
                  </RNText>
                </Pressable>
              ))}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(61, 15, 15, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    overflow: 'hidden',
    paddingTop: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(225, 20, 20, 0.25)',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  recipientSection: {
    paddingBottom: spacing.sm,
  },
  recipientHint: {
    paddingHorizontal: spacing.base,
    marginBottom: 6,
  },
  recipientRow: {
    paddingHorizontal: spacing.base,
    gap: 12,
    alignItems: 'flex-end',
  },
  recipientItem: {
    alignItems: 'center',
    width: 64,
  },
  recipientAvatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  recipientAvatarActive: {
    shadowColor: TAB_DESIGN.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  recipientAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: lu.colors.bg,
  },
  seatBadge: {
    position: 'absolute',
    bottom: -2,
    alignSelf: 'center',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: TAB_DESIGN.purple,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  seatBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  recipientName: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '600',
    color: lu.colors.muted,
    textAlign: 'center',
    width: 64,
  },
  recipientNameActive: {
    color: TAB_DESIGN.purple,
    fontWeight: '800',
  },
  catRow: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.12)',
    overflow: 'hidden',
    minHeight: 36,
    justifyContent: 'center',
  },
  catPillActive: {
    borderColor: TAB_DESIGN.purple,
  },
  catText: {
    fontSize: 12,
    fontWeight: '700',
    color: lu.colors.ink2,
  },
  catTextActive: {
    color: '#fff',
  },
  gridContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  gridRow: {
    gap: 12,
    marginBottom: 12,
  },
  giftCell: {
    alignItems: 'center',
    padding: 6,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  giftCellSelected: {
    borderColor: TAB_DESIGN.purple,
    backgroundColor: '#FEE2E2',
  },
  soundBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    zIndex: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  thumbGifOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftName: {
    fontSize: 10,
    fontWeight: '700',
    color: lu.colors.ink,
    textAlign: 'center',
    width: '100%',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  priceText: {
    fontSize: 9,
    fontWeight: '800',
    color: lu.colors.gold2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(225, 20, 20, 0.12)',
  },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.1)',
  },
  qtyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.1)',
    minWidth: 52,
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '800',
    color: lu.colors.ink,
  },
  sendBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.85,
  },
  sendText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  qtyMenu: {
    position: 'absolute',
    bottom: 56,
    right: spacing.base + 60,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    maxWidth: 200,
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  qtyOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  qtyOptionActive: {
    backgroundColor: '#FEE2E2',
  },
  qtyOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: lu.colors.ink2,
  },
  qtyOptionTextActive: {
    color: TAB_DESIGN.purple,
    fontWeight: '800',
  },
});
