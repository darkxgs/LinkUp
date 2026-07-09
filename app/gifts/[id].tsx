/**
 * LinkUp App — Gift Send Screen
 * شاشة إرسال هدية لمستخدم - مع خصم العملات الفعلي من Firebase
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as LucideIcons from 'lucide-react-native';
import {
  Gift as GiftIcon,
  Coins,
  ChevronLeft,
  Sparkles,
  Crown,
  Send,
  Check,
} from 'lucide-react-native';

import { Text, Card, BackButton, RealCountryFlag } from '@/components/ui';
import { GiftVisual } from '@/components/ui/GiftVisual';
import { useAuth } from '@/hooks/useAuth';
import { getUser, UserDoc } from '@/services/firebase/users';
import {
  GIFTS_CATALOG,
  Gift as GiftType,
  buyAndSendGift,
} from '@/services/firebase/shop';
import {
  addRelationshipPoints,
  RELATIONSHIP_LEVELS,
} from '@/services/firebase/social';
import { useConfig } from '@/contexts/ConfigContext';
import { colors, radius, spacing, shadows } from '@/theme';
import { lu } from '@/theme/lu-brand';

export default function GiftSendScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: recipientUid } = useLocalSearchParams<{ id: string }>();
  const { user, updateUserData } = useAuth();
  const { gifts: GIFTS } = useConfig();

  const [recipient, setRecipient] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGift, setSelectedGift] = useState<GiftType | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!recipientUid) return;
      try {
        const data = await getUser(recipientUid);
        setRecipient(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [recipientUid]);

  const handleSend = async () => {
    if (!selectedGift || !recipient || !user) return;

    if (user.stats.coins < selectedGift.price) {
      Alert.alert(
        t('gifts.insufficientCoins'),
        `تحتاج ${(selectedGift.price - user.stats.coins).toLocaleString()} عملة إضافية. هل تريد الشحن؟`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('wallet.recharge'),
            onPress: () => router.push('/wallet/recharge' as any),
          },
        ],
      );
      return;
    }

    setSending(true);
    try {
      await buyAndSendGift(
        selectedGift,
        recipient.uid,
        recipient.displayName,
      );

      // إضافة Intimacy Points للعلاقة (= قيمة الهدية)
      let levelUpInfo: { newLevel: number; previousLevel: number; levelUp: boolean } | null = null;
      try {
        const result = await addRelationshipPoints(
          recipient.uid,
          recipient.displayName,
          recipient.avatar,
          selectedGift.price,
          'gift',
        );
        if (result.levelUp) {
          levelUpInfo = result;
        }
      } catch (e) {
        console.warn('relationship points:', e);
      }

      // رسالة ترقية إذا حدثت
      if (levelUpInfo) {
        const newLevelData = RELATIONSHIP_LEVELS.find((l) => l.level === levelUpInfo!.newLevel);
        Alert.alert(
          t('chat.levelUpgrade'),
          `وصلتما للمستوى ${levelUpInfo.newLevel} - ${newLevelData?.title}\n\nأرسلت ${selectedGift.name} إلى ${recipient.displayName}`,
          [
            { text: t('gifts.text74733'), onPress: () => router.replace(`/relationships?userId=${recipient.uid}` as any) },
            { text: t('common.ok'), onPress: () => router.back() },
          ],
        );
      } else {
        Alert.alert(
          t('gifts.text92285'),
          `تم إرسال ${selectedGift.name} إلى ${recipient.displayName}\nخُصم ${selectedGift.price.toLocaleString()} عملة من رصيدك`,
          [
            { text: t('common.ok'), onPress: () => router.back() },
          ],
        );
      }
    } catch (e: any) {
      Alert.alert(t('chat.sendFailed'), e.message ?? t('common.errorOccurred'));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  if (!recipient) {
    return (
      <View style={styles.loadingContainer}>
        <Text variant="body" color={colors.text.secondary}>
          {t('errors.userNotFound')}
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text variant="body" color={colors.brand.primary}>{t('profile.back')}</Text>
        </Pressable>
      </View>
    );
  }

  const myBalance = user?.stats.coins ?? 0;
  const canAfford = selectedGift ? myBalance >= selectedGift.price : false;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[lu.colors.pink, '#C40E1E', '#7A0A0A']}
        style={styles.headerBg}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <BackButton color={colors.white} bg="rgba(0,0,0,0.3)" />
          <View style={styles.titleRow}>
            <GiftIcon size={20} color={lu.colors.gold} strokeWidth={2.5} />
            <Text variant="h3" weight="bold" color={colors.white}>
              {t('gifts.sendGift')}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Recipient */}
        <View style={styles.recipientCard}>
          <Image
            source={{ uri: recipient.avatar }}
            style={styles.recipientAvatar}
            contentFit="cover"
          />
          <View style={{ flex: 1 }}>
            <View style={styles.recipientNameRow}>
              <Text variant="body" weight="bold" color={colors.white}>
                إلى: {recipient.displayName}
              </Text>
              <RealCountryFlag countryCode={recipient.country} size={16} />
              {recipient.isVIP && (
                <View style={styles.vipBadge}>
                  <Crown size={9} color={colors.white} fill={colors.white} strokeWidth={0} />
                </View>
              )}
            </View>
            <Text variant="caption" color="rgba(255,255,255,0.85)">
              المستوى {recipient.level} • {recipient.followers} متابع
            </Text>
          </View>
        </View>

        {/* Balance */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceLeft}>
            <Coins size={20} color={lu.colors.gold} strokeWidth={2.5} />
            <Text variant="bodySmall" color="rgba(255,255,255,0.85)">
              {t('gifts.text2802')}
            </Text>
            <Text variant="h4" weight="bold" color={colors.white}>
              {myBalance.toLocaleString()}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/wallet/recharge' as any)}
            style={styles.rechargeBtnSmall}
          >
            <Text variant="caption" color="#7A0A0A" weight="bold">
              + شحن
            </Text>
          </Pressable>
        </View>

        {/* White section */}
        <View style={styles.whiteSection}>
          <Text variant="label" color={colors.text.secondary} style={styles.sectionLabel}>
            {t('gifts.text43208')}
          </Text>

          <View style={styles.giftsGrid}>
            {GIFTS.map((gift) => {
              const isSelected = selectedGift?.id === gift.id;
              const isAffordable = myBalance >= gift.price;
              return (
                <Pressable
                  key={gift.id}
                  onPress={() => setSelectedGift(gift)}
                  style={[
                    styles.giftCard,
                    isSelected && styles.giftCardSelected,
                    !isAffordable && styles.giftCardDisabled,
                  ]}
                >
                  {isSelected && (
                    <View style={styles.selectedCheck}>
                      <Check size={14} color={colors.white} strokeWidth={3} />
                    </View>
                  )}

                  <View style={[styles.giftIconBg, { backgroundColor: `${gift.iconColor}15` }]}>
                    <GiftVisual gift={gift} size={36} />
                  </View>

                  <Text variant="caption" weight="bold" numberOfLines={1} align="center" style={{ fontSize: 11 }}>
                    {gift.name}
                  </Text>

                  <View style={styles.priceTag}>
                    <Coins size={10} color={lu.colors.gold2} strokeWidth={2.5} />
                    <Text variant="caption" weight="bold" color={lu.colors.gold2} style={{ fontSize: 10 }}>
                      {gift.price.toLocaleString()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Info */}
          <View style={styles.infoCard}>
            <Sparkles size={16} color={lu.colors.purple} strokeWidth={2.5} />
            <Text variant="caption" color={colors.text.secondary} style={{ flex: 1, lineHeight: 18 }}>
              عند إرسال الهدية، يحصل {recipient.displayName} على نسبة من قيمتها ككوينز في رصيده.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        {selectedGift ? (
          <Pressable
            onPress={handleSend}
            disabled={!canAfford || sending}
            style={[
              styles.sendBtn,
              (!canAfford || sending) && styles.sendBtnDisabled,
            ]}
          >
            <LinearGradient
              colors={canAfford ? [lu.colors.pink, '#C40E1E'] : ['#9CA3AF', '#6B7280']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {sending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Send size={18} color={colors.white} strokeWidth={2.5} />
                <Text variant="button" color={colors.white} weight="bold">
                  {canAfford
                    ? `إرسال ${selectedGift.name} (${selectedGift.price.toLocaleString()} عملة)`
                    : t('gifts.insufficientCoins')}
                </Text>
              </>
            )}
          </Pressable>
        ) : (
          <View style={styles.selectHint}>
            <Text variant="caption" color={colors.text.secondary} align="center">
              {t('gifts.text77157')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCFAFA' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCFAFA',
  },
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  scrollContent: {},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Recipient
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.base,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  recipientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: lu.colors.gold,
    backgroundColor: '#FBEAEA',
  },
  recipientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  vipBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: lu.colors.gold2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Balance
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.base,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  balanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rechargeBtnSmall: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    backgroundColor: lu.colors.gold,
    borderRadius: radius.full,
  },

  // White section
  whiteSection: {
    backgroundColor: '#FCFAFA',
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.base,
    minHeight: 500,
  },
  sectionLabel: {
    marginBottom: spacing.md,
  },

  // Gifts grid
  giftsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  giftCard: {
    width: '31%',
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
  giftCardSelected: {
    borderColor: lu.colors.pink,
    backgroundColor: '#FFE6E9',
  },
  giftCardDisabled: {
    opacity: 0.5,
  },
  selectedCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: lu.colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  giftIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#FEF3C7',
    borderRadius: radius.full,
  },

  // Info
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    padding: spacing.base,
    borderTopWidth: 0.5,
    borderTopColor: '#FBEAEA',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radius.full,
    overflow: 'hidden',
    ...shadows.md,
  },
  sendBtnDisabled: {
    opacity: 0.7,
  },
  selectHint: {
    padding: spacing.md,
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
  },
});
