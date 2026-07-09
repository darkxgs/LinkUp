/**
 * LinkUp — جدار الألقاب (لقبي)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Plus, Lock, HelpCircle, Pencil, X } from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { TitleBanner } from '@/components/titles/TitleBanner';
import { TITLES_DESIGN } from '@/components/titles/titlesDesign';
import { lu } from '@/theme/lu-brand';
import {
  readUserTitles,
  countOwnedTitles,
  isTitleOwned,
  isSlotUnlocked,
  slotLockLabel,
  syncEligibleTitles,
  cleanupExpiredTitles,
  equipTitle,
  unequipTitle,
  purchaseTitle,
  userMeetsObtainRequirement,
  type TitleDef,
  type TitleSlotConfig,
} from '@/services/firebase/titleSystem';
import { readAristocracyState, isAristocracyActive } from '@/services/firebase/aristocracySystem';
import { resolveUserWealthLevel } from '@/utils/userBalance';

const SLOT_GAP = 8;

export default function TitleWallScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { user, refreshUser } = useAuth();
  const { titles: config } = useConfig();

  const isAr = i18n.language?.startsWith('ar');
  const [loading, setLoading] = useState(true);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const slotSize = (W - 32 - SLOT_GAP * 2) / 3;

  const state = useMemo(() => readUserTitles({ userTitles: user?.userTitles }), [user?.userTitles]);
  const vipLevel = user?.vipLevel ?? 0;
  const wealthLevel = resolveUserWealthLevel(user);
  const aristo = readAristocracyState({
    aristocracy: user?.aristocracy,
    aristocracyLevel: user?.aristocracyLevel,
  });
  const aristocracyLevel = isAristocracyActive(aristo) ? aristo.level : 0;
  const ownedCount = countOwnedTitles(state);

  const wallTitle = isAr ? config.wallTitleAr : config.wallTitleEn;
  const slots = useMemo(
    () => [...config.slots].sort((a, b) => a.slotIndex - b.slotIndex).slice(0, config.maxSlots),
    [config.slots, config.maxSlots],
  );

  const catalog = useMemo(
    () => [...config.titles].filter((t) => t.enabled).sort((a, b) => a.order - b.order),
    [config.titles],
  );

  const equippedIds = useMemo(
    () => new Set(state.equipped.filter(Boolean) as string[]),
    [state.equipped],
  );

  const availableToEquip = useMemo(
    () => state.owned.filter((o) => !equippedIds.has(o.titleId)),
    [state.owned, equippedIds],
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      await cleanupExpiredTitles();
      await syncEligibleTitles();
      await refreshUser?.();
      setLoading(false);
    })();
  }, []);

  const titleLabel = (td: TitleDef) => (isAr ? td.nameAr : td.nameEn);

  const handleSlotPress = useCallback(
    async (slot: TitleSlotConfig) => {
      const idx = slot.slotIndex;
      const unlocked = isSlotUnlocked(slot, vipLevel, wealthLevel);
      if (!unlocked) {
        Alert.alert(t('titles.slotLocked'), slotLockLabel(slot, isAr));
        return;
      }

      const equippedId = state.equipped[idx];
      if (equippedId) {
        Alert.alert(titleLabel(getTitle(equippedId)!), t('titles.slotActions'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('titles.unequip'),
            onPress: async () => {
              setBusy(true);
              try {
                await unequipTitle(idx);
                await refreshUser?.();
              } catch (e: unknown) {
                Alert.alert(t('common.error'), e instanceof Error ? e.message : '');
              } finally {
                setBusy(false);
              }
            },
          },
          {
            text: t('titles.change'),
            onPress: () => setPickerSlot(idx),
          },
        ]);
        return;
      }

      if (availableToEquip.length === 0) {
        Alert.alert(t('titles.noTitles'), t('titles.obtainFirst'));
        return;
      }
      setPickerSlot(idx);
    },
    [state, vipLevel, wealthLevel, availableToEquip, isAr, refreshUser, t],
  );

  function getTitle(id: string): TitleDef | undefined {
    return catalog.find((t) => t.id === id);
  }

  const handleCatalogPress = useCallback(
    (title: TitleDef) => {
      const owned = isTitleOwned(state, title.id);
      const label = titleLabel(title);
      const desc = isAr ? title.descAr : title.descEn;

      if (owned) return;

      if (title.obtainType === 'purchase') {
        Alert.alert(label, `${desc}\n\n${t('titles.price', { coins: title.priceCoins.toLocaleString('en-US') })}`, [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('store.purchase'),
            onPress: async () => {
              setBusy(true);
              try {
                await purchaseTitle(title.id);
                await refreshUser?.();
                Alert.alert(t('common.success'), t('titles.obtained'));
              } catch (e: unknown) {
                Alert.alert(t('common.error'), e instanceof Error ? e.message : '');
              } finally {
                setBusy(false);
              }
            },
          },
        ]);
        return;
      }

      const eligible = userMeetsObtainRequirement(
        title,
        vipLevel,
        wealthLevel,
        aristocracyLevel,
      );

      Alert.alert(
        label,
        eligible ? t('titles.syncing') : `${desc}\n\n${t('titles.notEligible')}`,
        eligible
          ? [
              {
                text: t('common.ok'),
                onPress: async () => {
                  await syncEligibleTitles();
                  await refreshUser?.();
                },
              },
            ]
          : [{ text: t('common.ok') }],
      );
    },
    [state, vipLevel, wealthLevel, aristocracyLevel, isAr, refreshUser, t],
  );

  const handlePick = async (titleId: string) => {
    if (pickerSlot == null) return;
    setBusy(true);
    try {
      await equipTitle(pickerSlot, titleId);
      await refreshUser?.();
      setPickerSlot(null);
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : '');
    } finally {
      setBusy(false);
    }
  };

  if (!config.enabled) {
    return (
      <View style={styles.fill}>
        <Text style={styles.disabled}>{t('titles.disabled')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Image
        source={require('../../assets/images/Title_background.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 255, 255, 0.06)' }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {/* Left Side Actions (in LTR: Help/Pencil, in RTL: Back Button) */}
        <View style={styles.headerLeftPos}>
          {isAr ? (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <ChevronLeft size={22} color="#ffffff" strokeWidth={2.2} />
            </Pressable>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable onPress={() => router.push('/titles/about' as any)} hitSlop={8}>
                <HelpCircle size={22} color="#ffffff" strokeWidth={1.8} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => Alert.alert(t('titles.edit'), t('titles.editSoon'))}>
                <Pencil size={20} color="#ffffff" strokeWidth={1.8} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Centered Title */}
        <Text style={[styles.headerTitle, { fontFamily: lu.fonts.bodyBold }]}>
          {wallTitle}
        </Text>

        {/* Right Side Actions (in LTR: Back Button, in RTL: Help/Pencil) */}
        <View style={styles.headerRightPos}>
          {isAr ? (
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14 }}>
              <Pressable onPress={() => router.push('/titles/about' as any)} hitSlop={8}>
                <HelpCircle size={22} color="#ffffff" strokeWidth={1.8} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => Alert.alert(t('titles.edit'), t('titles.editSoon'))}>
                <Pencil size={20} color="#ffffff" strokeWidth={1.8} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <ChevronLeft size={22} color="#ffffff" strokeWidth={2.2} />
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={TITLES_DESIGN.gold} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Section */}
          <View style={styles.profile}>
            {/* Glow Ring Wrapper */}
            <View style={styles.avatarGlowContainer}>
              <LinearGradient
                colors={['#FFD700', '#FF3340', '#B00E0E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              >
                {user?.profile?.avatar ? (
                  <Image source={{ uri: user.profile.avatar }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={150} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPh]} />
                )}
              </LinearGradient>
            </View>
            
            <Text style={[styles.userName, { fontFamily: lu.fonts.bodyBold }]}>
              {user?.profile?.displayName ?? t('rooms.userFallback')}
            </Text>

            {/* Glassmorphism Stats Card */}
            <View style={styles.statsCard}>
              <View style={[styles.statBadgeRow, { flexDirection: 'row' }]}>
                <Text style={styles.statBadgeIcon}>🏆</Text>
                <Text style={styles.statBadgeText}>
                  {isAr ? `${ownedCount} لقب مملوك` : `${ownedCount} Owned Title(s)`}
                </Text>
              </View>
              <View style={styles.statBadgeDivider} />
              <View style={[styles.statBadgeRow, { flexDirection: 'row' }]}>
                <Text style={styles.statBadgeIcon}>⭐</Text>
                <Text style={styles.statBadgeText}>
                  {isAr ? `${catalog.length - ownedCount} ألقاب متبقية` : `${catalog.length - ownedCount} Remaining`}
                </Text>
              </View>
            </View>
          </View>

          {/* 3x3 Slots Grid */}
          <View style={styles.grid}>
            {slots.map((slot) => {
              const idx = slot.slotIndex;
              const unlocked = isSlotUnlocked(slot, vipLevel, wealthLevel);
              const equippedId = state.equipped[idx];
              const equipped = equippedId ? getTitle(equippedId) : null;

              // Determine slot theme color based on unlock requirements
              let themeColor = '#C61414'; // Default Wealth (cyan/blue)
              let themeLabel = '';
              let subLabel = '';
              
              if (slot.unlockType === 'vip') {
                const req = slot.unlockValue;
                if (req <= 5) {
                  themeColor = '#A1A1AA'; // Silver
                } else if (req <= 7) {
                  themeColor = '#E11414'; // Purple
                } else {
                  themeColor = '#F59E0B'; // Gold
                }
                themeLabel = `VIP ${req}`;
                subLabel = isAr ? 'فتح عند شراء VIP' : 'Unlock at VIP';
              } else if (slot.unlockType === 'wealth') {
                const req = slot.unlockValue;
                themeColor = '#C61414'; // Wealth cyan
                themeLabel = isAr ? `ثروة ${req}` : `Wealth ${req}`;
                subLabel = isAr ? `مستوى ${req}` : `Level ${req}`;
              }

              return (
                <Pressable
                  key={idx}
                  onPress={() => handleSlotPress(slot)}
                  style={[
                    styles.slot,
                    {
                      width: slotSize,
                      height: slotSize * 0.9,
                      borderColor: unlocked ? (equipped ? 'rgba(255,255,255,0.1)' : 'rgba(225, 20, 20, 0.45)') : themeColor,
                      borderStyle: unlocked && !equipped ? 'dashed' : 'solid',
                    },
                    !unlocked && styles.slotLocked,
                  ]}
                >
                  {!unlocked ? (
                    <View style={styles.lockContainer}>
                      <View style={[styles.lockIconBox, { borderColor: themeColor + '25', backgroundColor: themeColor + '10' }]}>
                        <Lock size={12} color={themeColor} strokeWidth={2.5} />
                      </View>
                      <Text style={[styles.lockLabel, { color: themeColor, fontFamily: lu.fonts.bodyBold }]} numberOfLines={1}>
                        🔒 {themeLabel}
                      </Text>
                      <Text style={[styles.lockSubLabel, { color: 'rgba(255,255,255,0.35)' }]} numberOfLines={1}>
                        {subLabel}
                      </Text>
                    </View>
                  ) : equipped ? (
                    <TitleBanner
                      title={equipped}
                      label={titleLabel(equipped)}
                      width={slotSize - 12}
                      height={slotSize * 0.44}
                    />
                  ) : (
                    <View style={styles.emptySlotIndicator}>
                      <View style={styles.emptySlotIconBox}>
                        <Plus size={16} color="#E11414" strokeWidth={2.5} />
                      </View>
                      <Text style={[styles.emptySlotText, { fontFamily: lu.fonts.bodyBold }]}>
                        {isAr ? 'إضافة لقب' : 'Add Title'}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Manage Titles Button */}
          <View style={styles.manageBtnContainer}>
            <Pressable
              style={styles.manageBtn}
              onPress={() => Alert.alert(t('titles.edit'), t('titles.editSoon'))}
            >
              <Text style={[styles.manageBtnText, { fontFamily: lu.fonts.bodyBold }]}>
                ✏️ {isAr ? 'إدارة الألقاب' : 'Manage Titles'}
              </Text>
            </Pressable>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* All Titles Catalog Card */}
          <View style={styles.catalogCard}>
            <Text
              style={[
                styles.catalogSectionTitle,
                {
                  fontFamily: lu.fonts.bodyBold,
                  textAlign: isAr ? 'right' : 'left',
                }
              ]}
            >
              {isAr ? 'الألقاب المتاحة' : 'Available Titles'}
            </Text>

            <View style={styles.catalogGrid}>
              {catalog.map((title) => {
                const owned = isTitleOwned(state, title.id);
                const equipped = equippedIds.has(title.id);
                const cardWidth = (W - 76) / 2;
                const bannerWidth = cardWidth - 24;
                
                return (
                  <Pressable
                    key={title.id}
                    onPress={() => handleCatalogPress(title)}
                    style={({ pressed }) => [
                      styles.catalogCardItem,
                      !owned && styles.catalogCardLocked,
                      pressed && { opacity: 0.85 }
                    ]}
                  >
                    <View style={styles.catalogCardHeader}>
                      <Text style={styles.catalogCardIcon}>{title.obtainType === 'vip' ? '🏆' : '⭐'}</Text>
                      <Text style={[styles.catalogCardName, { fontFamily: lu.fonts.bodyBold }]} numberOfLines={2}>
                        {titleLabel(title)}
                      </Text>
                    </View>

                    <View style={styles.catalogCardBanner}>
                      <TitleBanner
                        title={title}
                        label={titleLabel(title)}
                        width={bannerWidth}
                        height={38}
                        dimmed={!owned}
                      />
                    </View>

                    <Text style={[styles.catalogCardDesc, { fontFamily: lu.fonts.body }]} numberOfLines={1}>
                      {isAr ? title.descAr : title.descEn}
                    </Text>

                    {/* Status badge pill */}
                    <View
                      style={[
                        styles.statusBadge,
                        equipped
                          ? styles.statusEquipped
                          : owned
                            ? styles.statusOwned
                            : styles.statusNotObtained
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          {
                            fontFamily: lu.fonts.bodyBold,
                            color: equipped ? '#4ADE80' : owned ? '#EC3E3E' : 'rgba(255,255,255,0.35)'
                          }
                        ]}
                      >
                        {equipped
                          ? t('titles.equipped')
                          : owned
                            ? t('titles.owned')
                            : t('titles.notObtained')}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Title Picker Modal */}
      <Modal visible={pickerSlot != null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View
              style={[
                styles.modalHead,
                { flexDirection: 'row' },
              ]}
            >
              <Text style={[styles.modalTitle, { fontFamily: lu.fonts.bodyBold }]}>
                {t('titles.pickTitle')}
              </Text>
              <Pressable onPress={() => setPickerSlot(null)} hitSlop={10}>
                <X size={22} color="#ffffff" strokeWidth={2} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {availableToEquip.map((o) => {
                const td = getTitle(o.titleId);
                if (!td) return null;
                return (
                  <Pressable
                    key={o.titleId}
                    style={({ pressed }) => [
                      styles.pickRow,
                      pressed && { backgroundColor: 'rgba(255,255,255,0.05)' }
                    ]}
                    onPress={() => handlePick(o.titleId)}
                    disabled={busy}
                  >
                    <TitleBanner title={td} label={titleLabel(td)} width={160} height={40} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  disabled: { textAlign: 'center', marginTop: 60, color: TITLES_DESIGN.muted },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
    position: 'relative',
    width: '100%',
  },
  headerLeftPos: {
    position: 'absolute',
    start: 16,
    bottom: 10,
    zIndex: 15,
  },
  headerRightPos: {
    position: 'absolute',
    end: 16,
    bottom: 10,
    zIndex: 15,
  },
  headerTitle: { fontSize: 18, color: '#ffffff', textAlign: 'center' },

  profile: { alignItems: 'center', paddingVertical: 24 },
  avatarGlowContainer: {
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
    borderRadius: 50,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    padding: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 89, height: 89, borderRadius: 44.5, borderWidth: 1.5, borderColor: '#ffffff' },
  avatarPh: { backgroundColor: 'rgba(255,255,255,0.15)' },
  userName: { color: '#ffffff', fontSize: 18, marginTop: 12 },
  statsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 16,
    alignItems: 'center',
    gap: 8,
    width: 220,
  },
  statBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    justifyContent: 'center',
  },
  statBadgeIcon: {
    fontSize: 15,
  },
  statBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  statBadgeDivider: {
    width: '80%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: SLOT_GAP,
    justifyContent: 'center',
    marginBottom: 20,
  },
  slot: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  slotLocked: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  lockContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  lockIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  lockLabel: { fontSize: 11, textAlign: 'center', fontWeight: 'bold' },
  lockSubLabel: { fontSize: 9.5, textAlign: 'center', marginTop: 2 },
  emptySlotIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptySlotIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(225, 20, 20, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.25)',
  },
  emptySlotText: {
    fontSize: 11,
    color: '#E11414',
  },

  manageBtnContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  manageBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  manageBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 24,
    marginVertical: 24,
  },

  catalogCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 18,
    marginHorizontal: 16,
    ...lu.shadows.card,
    shadowOpacity: 0.05,
    elevation: 2,
  },
  catalogSectionTitle: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  catalogCardItem: {
    width: '47%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  catalogCardLocked: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  catalogCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    alignSelf: 'flex-start',
    width: '100%',
  },
  catalogCardIcon: {
    fontSize: 14,
  },
  catalogCardName: {
    fontSize: 13,
    lineHeight: 20,
    color: '#ffffff',
    flexShrink: 1,
  },
  catalogCardBanner: {
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
  },
  catalogCardDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 10,
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  statusEquipped: {
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderColor: 'rgba(74, 222, 128, 0.25)',
  },
  statusOwned: {
    backgroundColor: 'rgba(236, 62, 62, 0.12)',
    borderColor: 'rgba(236, 62, 62, 0.25)',
  },
  statusNotObtained: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusText: {
    fontSize: 10,
    textTransform: 'uppercase',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1A0A0C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    paddingBottom: 36,
  },
  modalHead: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  modalTitle: { color: '#ffffff', fontSize: 16 },
  pickRow: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 4,
  },
});

