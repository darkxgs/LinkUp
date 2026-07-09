/**
 * Gifts Catalog — LinkUp brand
 * يدعم RTL (عربي) و LTR (إنجليزي) عبر خصائص start/end واتجاه النظام
 */

import { useTranslation } from 'react-i18next';
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { GiftVisual } from '@/components/ui/GiftVisual';
import { Gift, Crown, Sparkles, X, Plus } from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { lu } from '@/theme/lu-brand';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { type Gift as GiftType } from '@/services/firebase/shop';
import { getGiftCategoryLabel } from '@/utils/giftCategories';
import { COIN_CURRENCY_ICON } from '@/constants/brandAssets';
import { GiftRecipientPickerModal } from '@/components/gifts/GiftRecipientPickerModal';

const COLS = 2;
const COLUMN_GAP = 10;

type RarityKey = 'common' | 'rare' | 'epic' | 'legendary';

export default function GiftsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { user } = useAuth();
  const isSmall = W < 360;
  const horizontalPad = isSmall ? 12 : 14;
  const cardWidth = Math.floor((W - horizontalPad * 2 - COLUMN_GAP * (COLS - 1)) / COLS);

  const { gifts: liveGifts, giftCategories } = useConfig();
  const lang = i18n.language;

  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedGift, setSelectedGift] = useState<GiftType | null>(null);
  const [giftToSend, setGiftToSend] = useState<GiftType | null>(null);

  const rarityStyle = useMemo(
    () =>
      ({
        common: {
          bg: lu.colors.bg,
          color: lu.colors.ink2,
          label: t('gifts.rarity.common'),
          border: lu.colors.line,
        },
        rare: {
          bg: lu.colors.blueSoft,
          color: lu.colors.blue,
          label: t('gifts.rarity.rare'),
          border: lu.colors.blue1,
        },
        epic: {
          bg: lu.colors.card2,
          color: lu.colors.purple,
          label: t('gifts.rarity.epic'),
          border: lu.colors.purple,
        },
        legendary: {
          bg: lu.colors.goldSoft,
          color: lu.colors.gold2,
          label: t('gifts.rarity.legendary'),
          border: lu.colors.gold,
        },
      }) satisfies Record<RarityKey, { bg: string; color: string; label: string; border: string }>,
    [t, i18n.language],
  );

  const filteredGifts = useMemo(
    () =>
      activeCategory === 'all'
        ? liveGifts
        : liveGifts.filter((g) => g.category === activeCategory),
    [liveGifts, activeCategory],
  );

  const renderCategoryPill = (id: string, label: string, active: boolean) => (
    <Pressable
      key={id}
      onPress={() => setActiveCategory(id)}
      style={styles.catPillWrap}
    >
      {active ? (
        <LinearGradient
          colors={lu.gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.catPillActive}
        >
          {id === 'all' ? (
            <Sparkles size={14} color="#fff" strokeWidth={2.4} />
          ) : (
            <Gift size={14} color="#fff" strokeWidth={2.4} />
          )}
          <Text style={styles.catTextActive} numberOfLines={1}>
            {label}
          </Text>
        </LinearGradient>
      ) : (
        <View style={styles.catPillInactive}>
          {id === 'all' ? (
            <Sparkles size={14} color={lu.colors.muted} strokeWidth={2.4} />
          ) : (
            <Gift size={14} color={lu.colors.muted} strokeWidth={2.4} />
          )}
          <Text style={styles.catTextInactive} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );

  const renderGiftCard = useCallback(({ item: g }: { item: GiftType }) => {
    const r = rarityStyle[g.rarity as RarityKey] ?? rarityStyle.common;
    return (
      <Pressable
        onPress={() => setSelectedGift(g)}
        style={({ pressed }) => [
          styles.giftCard,
          { width: cardWidth, borderColor: r.border, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        {g.isLimited ? (
          <View style={styles.limitedBadge}>
            <Text style={styles.limitedText}>{t('gifts.limited')}</Text>
          </View>
        ) : null}
        <View style={[styles.giftIconWrap, { backgroundColor: `${g.iconColor}15` }]}>
          <GiftVisual gift={g} size={42} />
        </View>
        <Text style={styles.giftName} numberOfLines={1}>
          {g.name}
        </Text>
        <View style={[styles.rarityChip, { backgroundColor: r.bg }]}>
          <Text style={[styles.rarityText, { color: r.color }]}>{r.label}</Text>
        </View>
        <View style={styles.priceRow}>
          <Image source={COIN_CURRENCY_ICON} style={{ width: 14, height: 14 }} contentFit="contain" />
          <Text style={styles.priceText}>{g.price.toLocaleString('en-US')}</Text>
        </View>
      </Pressable>
    );
  }, [rarityStyle, cardWidth, t]);

  return (
    <LinearGradient
      colors={lu.gradients.pageHome}
      locations={[0, 0.25]}
      style={styles.screen}
    >
      {/* قسم علوي ثابت — يمنع تمدد ScrollView الأفقي ويُزيل الفراغ */}
      <View style={styles.topSection}>
        <View style={[styles.header, { paddingTop: insets.top + 10, paddingHorizontal: horizontalPad }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <ChevronLeft size={22} color={lu.colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('gifts.title')}</Text>
          <Pressable
            onPress={() => router.push('/store/inventory' as any)}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Gift size={20} color={lu.colors.purple} />
          </Pressable>
        </View>

        <View style={[styles.balanceRow, { paddingHorizontal: horizontalPad }]}>
          <LinearGradient colors={['#FFD86F', '#FF9A2E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balancePill}>
            <Image source={COIN_CURRENCY_ICON} style={{ width: 18, height: 18 }} contentFit="contain" />
            <Text style={styles.balanceText}>
              {(user?.stats?.coins ?? 0).toLocaleString('en-US')}
            </Text>
          </LinearGradient>
          <Pressable
            onPress={() => router.push('/wallet/recharge' as any)}
            style={({ pressed }) => [styles.rechargeBtn, pressed && styles.pressed]}
          >
            <Plus size={14} color="#fff" strokeWidth={3} />
            <Text style={styles.rechargeText}>{t('wallet.recharge')}</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catsScroll}
          contentContainerStyle={[styles.catsRow, { paddingHorizontal: horizontalPad }]}
        >
          {renderCategoryPill('all', t('gifts.categories.all'), activeCategory === 'all')}
          {giftCategories.map((c) =>
            renderCategoryPill(c.id, getGiftCategoryLabel(c, lang), activeCategory === c.id),
          )}
        </ScrollView>
      </View>

      <FlatList
        style={styles.list}
        data={filteredGifts}
        keyExtractor={(g) => g.id}
        numColumns={COLS}
        renderItem={renderGiftCard}
        columnWrapperStyle={filteredGifts.length > 0 ? styles.gridRow : undefined}
        contentContainerStyle={[
          styles.gridContent,
          {
            paddingHorizontal: horizontalPad,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={COLS * 4}
        maxToRenderPerBatch={COLS * 3}
        windowSize={5}
        removeClippedSubviews
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Gift size={40} color={lu.colors.muted} strokeWidth={1.5} />
            <Text style={styles.emptyText}>{t('gifts.noGifts')}</Text>
          </View>
        }
      />

      <Modal
        visible={!!selectedGift}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedGift(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedGift(null)}>
          <Pressable
            style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedGift ? (() => {
              const r = rarityStyle[selectedGift.rarity as RarityKey] ?? rarityStyle.common;
              return (
                <>
                  <View style={styles.modalHandle} />
                  <Pressable onPress={() => setSelectedGift(null)} style={styles.modalClose}>
                    <X size={20} color={lu.colors.muted} />
                  </Pressable>
                  <View style={[styles.modalIconWrap, { backgroundColor: `${selectedGift.iconColor}15` }]}>
                    <GiftVisual
                      gift={selectedGift}
                      size={72}
                      preferAnimation={Boolean(selectedGift.animationUrl?.trim())}
                    />
                  </View>
                  <Text style={styles.modalName}>{selectedGift.name}</Text>
                  <View style={[styles.rarityChip, { backgroundColor: r.bg, marginTop: 6 }]}>
                    <Text style={[styles.rarityText, { color: r.color }]}>{r.label}</Text>
                  </View>
                  {selectedGift.description ? (
                    <Text style={styles.modalDesc}>{selectedGift.description}</Text>
                  ) : null}
                  <View style={styles.modalPriceRow}>
                    <Image source={COIN_CURRENCY_ICON} style={{ width: 22, height: 22 }} contentFit="contain" />
                    <Text style={styles.modalPrice}>
                      {selectedGift.price.toLocaleString('en-US')} {t('gifts.coinUnit')}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setGiftToSend(selectedGift);
                      setSelectedGift(null);
                    }}
                    style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
                  >
                    <LinearGradient
                      colors={lu.gradients.pink}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.modalSendBtn}
                    >
                      <Gift size={20} color="#fff" />
                      <Text style={styles.modalSendText}>{t('gifts.sendGift')}</Text>
                    </LinearGradient>
                  </Pressable>
                </>
              );
            })() : null}
          </Pressable>
        </Pressable>
      </Modal>

      <GiftRecipientPickerModal
        visible={!!giftToSend}
        gift={giftToSend}
        onClose={() => setGiftToSend(null)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pressed: { opacity: 0.7 },

  topSection: {
    flexShrink: 0,
    flexGrow: 0,
  },
  list: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...lu.shadows.card,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
    lineHeight: 26,
    includeFontPadding: false,
  },

  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },

  catsScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    flexShrink: 1,
    maxWidth: '72%',
    shadowColor: lu.colors.gold2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    lineHeight: 21,
    includeFontPadding: false,
  },
  rechargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: lu.colors.purple,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    flexShrink: 0,
    shadowColor: lu.colors.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  rechargeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    lineHeight: 18,
    includeFontPadding: false,
  },

  catsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    gap: 10,
  },
  catPillWrap: {
    flexShrink: 0,
  },
  catPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 42,
    borderRadius: 99,
    shadowColor: lu.colors.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  catTextActive: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  catPillInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 42,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 238, 238, 1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  catTextInactive: {
    color: lu.colors.ink2,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  gridContent: {
    paddingTop: 10,
  },
  gridRow: {
    gap: COLUMN_GAP,
    marginBottom: COLUMN_GAP,
  },
  giftCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    shadowColor: lu.colors.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  limitedBadge: {
    position: 'absolute',
    top: 8,
    end: 8,
    backgroundColor: lu.colors.live,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  limitedText: {
    color: '#fff',
    fontSize: 9,
    lineHeight: 15,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
  },
  giftIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  giftName: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '800',
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
    textAlign: 'center',
    width: '100%',
  },
  rarityChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    minHeight: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rarityText: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  priceText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
    color: lu.colors.gold2,
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
  },

  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: lu.colors.ink2,
    fontFamily: lu.fonts.body,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: lu.colors.line,
    marginBottom: 16,
  },
  modalClose: {
    position: 'absolute',
    top: 18,
    end: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: lu.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  modalName: {
    fontSize: 22,
    fontWeight: '800',
    color: lu.colors.ink,
    marginTop: 16,
    fontFamily: lu.fonts.bodyHeavy,
    lineHeight: 30,
    includeFontPadding: false,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 14,
    color: lu.colors.ink2,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 16,
    lineHeight: 22,
    fontFamily: lu.fonts.body,
  },
  modalPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    backgroundColor: '#FFF8DC',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 99,
  },
  modalPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: lu.colors.gold2,
    fontFamily: lu.fonts.bodyHeavy,
    lineHeight: 30,
    includeFontPadding: false,
  },
  modalSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    paddingHorizontal: 80,
    borderRadius: 27,
    marginTop: 20,
    ...lu.shadows.grad,
  },
  modalSendText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
    lineHeight: 24,
    includeFontPadding: false,
  },
});
