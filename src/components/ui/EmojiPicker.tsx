/**
 * EmojiPicker — لوحة رموز/إيموجي
 *
 * mode=reactions: شبكة صور من لوحة التحكم + تبويبات تصنيف بالأسفل (مثل تطبيقات الغرف)
 * mode=emoji: إيموجي النظام للمحادثات
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  FlatList,
  Text as RNText,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { LayoutGrid, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from './Text';
import {
  EMOJI_CATEGORIES,
  QUICK_EMOJIS,
  ROOM_QUICK_EMOJIS,
  ROOM_DEFAULT_EMOJI_TAB_ID,
} from '@/data/emojiData';
import { type RoomReactionPack, type RoomReactionItem } from '@/services/firebase/roomReactionsConfig';
import {
  ROOM_SOUND_EFFECTS,
  type SoundEffectId,
} from '@/constants/roomSoundEffectsCatalog';
import { roomReactionItemToSendValue } from '@/utils/roomReactionValue';
import { lu } from '@/theme/lu-brand';

const ALL_REACTION_PACKS_ID = '__all__';
/** تبويب الأصوات (الطبلة) — أسفل يمين لوحة الإيموجي في الروم */
const SOUNDS_TAB_ID = '__sounds__';
const REACTION_GRID_COLS = 5;
const SOUND_COOLDOWN_MS = 700;

type ReactionGridItem = RoomReactionItem & { gridKey: string };

function PackTabIcon({
  pack,
  size = 28,
  inactive,
}: {
  pack: RoomReactionPack;
  size?: number;
  inactive?: boolean;
}) {
  if (pack.iconUrl) {
    return (
      <Image
        source={{ uri: pack.iconUrl }}
        style={{ width: size, height: size, opacity: inactive ? 0.55 : 1 }}
        contentFit="contain"
        transition={120}
      />
    );
  }
  return (
    <RNText style={{ fontSize: size * 0.72, opacity: inactive ? 0.55 : 1 }}>
      {pack.icon}
    </RNText>
  );
}

interface Props {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  height?: number;
  variant?: 'light' | 'dark';
  /** emoji = محادثات | reactions = غرفة (صور لوحة التحكم فقط) */
  mode?: 'emoji' | 'reactions';
  customQuickEmojis?: string[];
  customTitle?: string;
  reactionPacks?: RoomReactionPack[];
  /** يعرض تبويب الإيموجي الافتراضي (Unicode) في الغرفة */
  showDefaultEmojis?: boolean;
  /** يمنع النقر المتكرر أثناء الإرسال */
  selectDisabled?: boolean;
  /** عند تمريرها يظهر تبويب الطبلة 🥁 (المؤثرات الصوتية) أسفل اللوحة */
  onPlaySoundEffect?: (effectId: SoundEffectId) => void;
}

/** شبكة المؤثرات الصوتية داخل تبويب الطبلة */
function RoomSoundEffectsPanel({
  onPlay,
  height,
}: {
  onPlay: (effectId: SoundEffectId) => void;
  height: number;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const [busyId, setBusyId] = useState<string | null>(null);
  const lastRef = React.useRef(0);

  const handlePress = (effectId: SoundEffectId) => {
    const now = Date.now();
    if (now - lastRef.current < SOUND_COOLDOWN_MS) return;
    lastRef.current = now;
    setBusyId(effectId);
    try {
      onPlay(effectId);
    } finally {
      setTimeout(() => setBusyId(null), SOUND_COOLDOWN_MS);
    }
  };

  return (
    <View style={{ flex: 1, maxHeight: height - 110 }}>
      <Text
        variant="caption"
        color="#9CA3AF"
        weight="bold"
        style={reactionStyles.soundsHint}
      >
        {lang === 'ar' ? 'اضغط مؤثراً ليسمعه الجميع في الروم 🥁' : 'Tap a sound — everyone in the room hears it 🥁'}
      </Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={reactionStyles.soundsGrid}>
        {ROOM_SOUND_EFFECTS.map((effect) => {
          const { Icon } = effect;
          const busy = busyId === effect.id;
          return (
            <Pressable
              key={effect.id}
              disabled={!!busyId}
              onPress={() => handlePress(effect.id)}
              style={({ pressed }) => [
                reactionStyles.soundItem,
                pressed && !busyId && reactionStyles.stickerCellPressed,
              ]}
            >
              <View
                style={[
                  reactionStyles.soundIconBox,
                  {
                    backgroundColor: `${effect.color}18`,
                    borderColor: busy ? effect.color : `${effect.color}44`,
                  },
                ]}
              >
                <Icon size={22} color={effect.color} strokeWidth={2.5} />
              </View>
              <Text
                variant="caption"
                color="#374151"
                weight="semibold"
                numberOfLines={1}
                style={reactionStyles.soundLabel}
              >
                {t(effect.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function RoomDefaultEmojiPanel({
  onSelect,
  height,
  selectDisabled = false,
}: {
  onSelect: (value: string) => void;
  height: number;
  selectDisabled?: boolean;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const [activeCat, setActiveCat] = useState<string>(EMOJI_CATEGORIES[0]!.id);
  const currentCategory =
    EMOJI_CATEGORIES.find((c) => c.id === activeCat) ?? EMOJI_CATEGORIES[0]!;

  const listHeader = (
    <View style={reactionStyles.defaultQuickRow}>
      <Text variant="caption" color="#9CA3AF" weight="bold" style={reactionStyles.defaultSectionLabel}>
        {lang === 'ar' ? 'الأكثر استخداماً' : 'Most used'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={reactionStyles.defaultQuickInner}>
          {ROOM_QUICK_EMOJIS.map((emoji, i) => (
            <Pressable
              key={`room-quick-${i}`}
              disabled={selectDisabled}
              onPress={() => {
                if (!selectDisabled) onSelect(emoji);
              }}
              style={({ pressed }) => [
                reactionStyles.defaultQuickCell,
                selectDisabled && reactionStyles.stickerCellDisabled,
                pressed && !selectDisabled && reactionStyles.stickerCellPressed,
              ]}
            >
              <RNText style={reactionStyles.defaultEmojiText}>{emoji}</RNText>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, maxHeight: height - 110 }}>
      <FlatList
        data={currentCategory.emojis}
        key={activeCat}
        keyExtractor={(item, i) => `${activeCat}-${i}`}
        numColumns={8}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={reactionStyles.defaultGrid}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <Pressable
            disabled={selectDisabled}
            onPress={() => {
              if (!selectDisabled) onSelect(item);
            }}
            style={({ pressed }) => [
              reactionStyles.defaultEmojiCell,
              selectDisabled && reactionStyles.stickerCellDisabled,
              pressed && !selectDisabled && reactionStyles.defaultEmojiCellPressed,
            ]}
          >
            <RNText style={reactionStyles.defaultEmojiText}>{item}</RNText>
          </Pressable>
        )}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={reactionStyles.defaultCatTabs}
        contentContainerStyle={reactionStyles.defaultCatTabsInner}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {EMOJI_CATEGORIES.map((cat) => {
          const selected = cat.id === activeCat;
          return (
            <Pressable
              key={cat.id}
              onPress={() => setActiveCat(cat.id)}
              style={[
                reactionStyles.defaultCatTab,
                selected && reactionStyles.defaultCatTabActive,
              ]}
            >
              <RNText style={reactionStyles.defaultCatIcon}>{cat.icon}</RNText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function RoomReactionsPicker({
  onSelect,
  onClose,
  height = 360,
  reactionPacks,
  showDefaultEmojis = true,
  selectDisabled = false,
  onPlaySoundEffect,
}: {
  onSelect: (value: string) => void;
  onClose?: () => void;
  height?: number;
  reactionPacks: RoomReactionPack[];
  showDefaultEmojis?: boolean;
  selectDisabled?: boolean;
  onPlaySoundEffect?: (effectId: SoundEffectId) => void;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const { width: screenWidth } = useWindowDimensions();
  const initialTab = showDefaultEmojis
    ? ROOM_DEFAULT_EMOJI_TAB_ID
    : ALL_REACTION_PACKS_ID;
  const [activeReactionPack, setActiveReactionPack] = useState<string>(initialTab);

  useEffect(() => {
    if (showDefaultEmojis) return;
    if (activeReactionPack === ROOM_DEFAULT_EMOJI_TAB_ID) {
      setActiveReactionPack(ALL_REACTION_PACKS_ID);
    }
  }, [showDefaultEmojis, activeReactionPack]);

  useEffect(() => {
    if (!reactionPacks.length) return;
    if (
      activeReactionPack === ALL_REACTION_PACKS_ID ||
      activeReactionPack === ROOM_DEFAULT_EMOJI_TAB_ID ||
      // تبويب الطبلة ليس من حزم الملصقات — بدون هذا الاستثناء كانت قائمة
      // المؤثرات تظهر ثم تختفي فوراً (يُعاد التعيين لتبويب الإيموجي)
      activeReactionPack === SOUNDS_TAB_ID
    ) {
      return;
    }
    if (!reactionPacks.some((pack) => pack.id === activeReactionPack)) {
      setActiveReactionPack(showDefaultEmojis ? ROOM_DEFAULT_EMOJI_TAB_ID : ALL_REACTION_PACKS_ID);
    }
  }, [reactionPacks, activeReactionPack, showDefaultEmojis]);

  const isDefaultEmojiTab = showDefaultEmojis && activeReactionPack === ROOM_DEFAULT_EMOJI_TAB_ID;
  const isSoundsTab = !!onPlaySoundEffect && activeReactionPack === SOUNDS_TAB_ID;

  const currentReactionPack = useMemo(
    () => reactionPacks.find((p) => p.id === activeReactionPack),
    [reactionPacks, activeReactionPack],
  );

  const reactionItems = useMemo((): ReactionGridItem[] => {
    if (activeReactionPack === ALL_REACTION_PACKS_ID) {
      return reactionPacks.flatMap((pack) =>
        (pack.items ?? []).map((item) => ({
          ...item,
          gridKey: `${pack.id}_${item.id}`,
        })),
      );
    }
    return (currentReactionPack?.items ?? []).map((item) => ({
      ...item,
      gridKey: item.id,
    }));
  }, [reactionPacks, activeReactionPack, currentReactionPack]);

  const horizontalPad = 12;
  const cellGap = 6;
  const cellSize =
    (screenWidth - horizontalPad * 2 - cellGap * (REACTION_GRID_COLS - 1)) / REACTION_GRID_COLS;

  const title = isSoundsTab
    ? (lang === 'ar' ? 'المؤثرات الصوتية' : 'Sound effects')
    : (lang === 'ar' ? 'الرموز التعبيرية' : 'Stickers');
  const showStickerTabs = reactionPacks.length > 0;
  const showBottomTabs = showDefaultEmojis || showStickerTabs || !!onPlaySoundEffect;

  return (
    <View style={[reactionStyles.container, { height, backgroundColor: '#FFFFFF' }]}>
      <View style={reactionStyles.header}>
        <Text variant="caption" weight="bold" color="#1F2937">
          {title}
        </Text>
        {onClose ? (
          <Pressable onPress={onClose} hitSlop={10} style={reactionStyles.closeBtn}>
            <X size={16} color="#6B7280" />
          </Pressable>
        ) : null}
      </View>

      {isSoundsTab ? (
        <RoomSoundEffectsPanel onPlay={onPlaySoundEffect!} height={height} />
      ) : isDefaultEmojiTab ? (
        <RoomDefaultEmojiPanel
          onSelect={onSelect}
          height={height}
          selectDisabled={selectDisabled}
        />
      ) : reactionPacks.length === 0 ? (
        <View style={reactionStyles.emptyWrap}>
          <Text variant="caption" color="#9CA3AF" style={{ textAlign: 'center' }}>
            {lang === 'ar' ? 'لا توجد ملصقات — استخدم الإيموجي الافتراضي' : 'No stickers — use default emojis'}
          </Text>
        </View>
      ) : reactionItems.length === 0 ? (
        <View style={reactionStyles.emptyWrap}>
          <Text variant="caption" color="#9CA3AF" style={{ textAlign: 'center' }}>
            {lang === 'ar' ? 'لا توجد صور في هذا التصنيف' : 'No images in this category'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={reactionItems}
          key={activeReactionPack}
          keyExtractor={(item) => item.gridKey}
          numColumns={REACTION_GRID_COLS}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: horizontalPad,
            paddingTop: 8,
            paddingBottom: 12,
          }}
          columnWrapperStyle={{ gap: cellGap, marginBottom: cellGap }}
          renderItem={({ item }) => (
            <Pressable
              disabled={selectDisabled}
              onPress={() => {
                if (selectDisabled) return;
                onSelect(roomReactionItemToSendValue(item));
              }}
              style={({ pressed }) => [
                reactionStyles.stickerCell,
                { width: cellSize, height: cellSize },
                selectDisabled && reactionStyles.stickerCellDisabled,
                pressed && !selectDisabled && reactionStyles.stickerCellPressed,
              ]}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={reactionStyles.stickerImg}
                contentFit="contain"
                transition={120}
              />
            </Pressable>
          )}
        />
      )}

      {showBottomTabs ? (
        <View style={[reactionStyles.bottomTabs, reactionStyles.bottomTabsRow]}>
          {/* تبويب الطبلة 🥁 مثبّت أول الصف — أي أقصى اليمين في الواجهة العربية */}
          {onPlaySoundEffect ? (
            <Pressable
              onPress={() => setActiveReactionPack(SOUNDS_TAB_ID)}
              style={[
                reactionStyles.bottomTab,
                reactionStyles.soundsTab,
                activeReactionPack === SOUNDS_TAB_ID && reactionStyles.bottomTabActive,
              ]}
            >
              <RNText style={reactionStyles.defaultTabIcon}>🥁</RNText>
            </Pressable>
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={reactionStyles.bottomTabsInner}
            style={{ flex: 1 }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {showDefaultEmojis ? (
              <Pressable
                onPress={() => setActiveReactionPack(ROOM_DEFAULT_EMOJI_TAB_ID)}
                style={[
                  reactionStyles.bottomTab,
                  activeReactionPack === ROOM_DEFAULT_EMOJI_TAB_ID && reactionStyles.bottomTabActive,
                ]}
              >
                <RNText style={reactionStyles.defaultTabIcon}>😀</RNText>
              </Pressable>
            ) : null}

            {showStickerTabs ? (
              <>
                <Pressable
                  onPress={() => setActiveReactionPack(ALL_REACTION_PACKS_ID)}
                  style={[
                    reactionStyles.bottomTab,
                    activeReactionPack === ALL_REACTION_PACKS_ID && reactionStyles.bottomTabActive,
                  ]}
                >
                  <LayoutGrid
                    size={22}
                    color={activeReactionPack === ALL_REACTION_PACKS_ID ? '#374151' : '#9CA3AF'}
                  />
                </Pressable>

                {reactionPacks.map((pack) => {
                  const selected = pack.id === activeReactionPack;
                  return (
                    <Pressable
                      key={pack.id}
                      onPress={() => setActiveReactionPack(pack.id)}
                      style={[reactionStyles.bottomTab, selected && reactionStyles.bottomTabActive]}
                    >
                      <PackTabIcon pack={pack} size={30} inactive={!selected} />
                    </Pressable>
                  );
                })}
              </>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function EmojiGridPicker({
  onSelect,
  onClose,
  height = 280,
  variant = 'light',
  customQuickEmojis = [],
  customTitle = 'إيموجي الخاصة فيك',
}: Omit<Props, 'mode' | 'reactionPacks'>) {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const [activeCat, setActiveCat] = useState<string>(EMOJI_CATEGORIES[0]!.id);

  const isDark = variant === 'dark';
  const bg = isDark ? '#3A1316' : '#fff';
  const subtleBg = isDark ? 'rgba(255,255,255,0.08)' : '#F9FAFB';

  const currentCategory =
    EMOJI_CATEGORIES.find((c) => c.id === activeCat) ?? EMOJI_CATEGORIES[0]!;

  const listHeader = (
    <>
      {customQuickEmojis.length > 0 ? (
        <View style={styles.quickRow}>
          <Text
            variant="caption"
            color={isDark ? 'rgba(255,255,255,0.6)' : '#E11414'}
            weight="bold"
            style={styles.sectionLabel}
          >
            {customTitle}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.quickRowInner}>
              {customQuickEmojis.map((e, i) => (
                <Pressable
                  key={`custom-${i}`}
                  onPress={() => onSelect(e)}
                  style={[styles.quickEmoji, styles.customEmoji, { backgroundColor: subtleBg }]}
                >
                  <RNText style={styles.emojiText}>{e}</RNText>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.quickRow}>
        <Text
          variant="caption"
          color={isDark ? 'rgba(255,255,255,0.5)' : '#9CA3AF'}
          weight="bold"
          style={styles.sectionLabel}
        >
          {lang === 'ar' ? 'الأكثر استخداماً' : 'Most used'}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.quickRowInner}>
            {QUICK_EMOJIS.map((e, i) => (
              <Pressable
                key={`quick-${i}`}
                onPress={() => onSelect(e)}
                style={[styles.quickEmoji, { backgroundColor: subtleBg }]}
              >
                <RNText style={styles.emojiText}>{e}</RNText>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </>
  );

  return (
    <View style={[styles.container, { height, backgroundColor: bg }]}>
      <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6' }]}>
        <Text variant="caption" weight="bold" color={isDark ? '#fff' : lu.colors.ink}>
          {lang === 'ar' ? 'الرموز التعبيرية' : 'Emojis'}
        </Text>
        {onClose ? (
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#F3F4F6' }]}
          >
            <X size={16} color={isDark ? '#fff' : lu.colors.ink2} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={currentCategory.emojis}
        key={activeCat}
        keyExtractor={(item, i) => `${activeCat}-${i}`}
        numColumns={8}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.grid}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item)}
            style={({ pressed }) => [
              styles.emojiCell,
              pressed && { backgroundColor: subtleBg, transform: [{ scale: 1.2 }] },
            ]}
          >
            <RNText style={styles.emojiText}>{item}</RNText>
          </Pressable>
        )}
      />

      <View style={[styles.tabs, { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6' }]}>
        {EMOJI_CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => setActiveCat(cat.id)}
            style={styles.catTab}
          >
            {activeCat === cat.id ? (
              <LinearGradient
                colors={[lu.colors.pink, lu.colors.purple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.catTabActive}
              >
                <RNText style={styles.catIcon}>{cat.icon}</RNText>
              </LinearGradient>
            ) : (
              <View style={styles.catTabInactive}>
                <RNText style={[styles.catIcon, { opacity: 0.5 }]}>{cat.icon}</RNText>
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function EmojiPicker({
  mode = 'emoji',
  reactionPacks = [],
  showDefaultEmojis = true,
  selectDisabled,
  ...rest
}: Props) {
  if (mode === 'reactions') {
    return (
      <RoomReactionsPicker
        {...rest}
        reactionPacks={reactionPacks}
        showDefaultEmojis={showDefaultEmojis}
        selectDisabled={selectDisabled}
      />
    );
  }

  const { onPlaySoundEffect: _sfx, ...gridRest } = rest;
  return (
    <EmojiGridPicker {...gridRest} />
  );
}

const reactionStyles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stickerCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerCellPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.85,
  },
  stickerCellDisabled: {
    opacity: 0.45,
  },
  stickerImg: {
    width: '92%',
    height: '92%',
  },
  bottomTabs: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
    paddingVertical: 8,
  },
  bottomTabsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  bottomTab: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabActive: {
    backgroundColor: '#E5E7EB',
  },
  bottomTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  soundsTab: {
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#F3D9A4',
    backgroundColor: '#FFF8E7',
  },
  soundsHint: {
    textAlign: 'center',
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  soundsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  soundItem: {
    width: 74,
    alignItems: 'center',
  },
  soundIconBox: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundLabel: {
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
  },
  defaultTabIcon: {
    fontSize: 26,
  },
  defaultQuickRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  defaultSectionLabel: {
    marginBottom: 8,
  },
  defaultQuickInner: {
    flexDirection: 'row',
    gap: 4,
    paddingBottom: 4,
  },
  defaultQuickCell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  defaultGrid: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  defaultEmojiCell: {
    flex: 1,
    // ارتفاع ثابت أصغر بدل aspectRatio (كان يجعل الصف بطول عرض الشاشة/8) —
    // صفوف أقصر فتظهر إيموجيهات أكثر في مساحة أقل ولا تغطّي المقاعد.
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 1,
    borderRadius: 8,
    maxWidth: `${100 / 8}%`,
  },
  defaultEmojiCellPressed: {
    backgroundColor: '#F3F4F6',
    transform: [{ scale: 1.15 }],
  },
  defaultEmojiText: {
    fontSize: 22,
  },
  defaultCatTabs: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    maxHeight: 52,
  },
  defaultCatTabsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  defaultCatTab: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultCatTabActive: {
    backgroundColor: '#E5E7EB',
  },
  defaultCatIcon: {
    fontSize: 20,
  },
});

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    marginBottom: 8,
  },
  quickRow: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  quickRowInner: {
    flexDirection: 'row',
    gap: 4,
  },
  quickEmoji: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customEmoji: {
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20,0.35)',
  },
  grid: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  emojiCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 1,
    borderRadius: 8,
    maxWidth: `${100 / 8}%`,
  },
  emojiText: {
    fontSize: 26,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderTopWidth: 1,
  },
  catTab: {
    flex: 1,
    alignItems: 'center',
  },
  catTabActive: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTabInactive: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catIcon: {
    fontSize: 20,
  },
});
