/**
 * RoomToolsSheet — قائمة أدوات الروم (ألعاب / نشاط / تفاعل / أساسية)
 * Premium Dark Glassmorphism Redesign
 */
import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  I18nManager,
  type GestureResponderEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Swords,
  Vote,
  Gift,
  Megaphone,
  Bell,
  Share2,
  Music,
  Mic,
  Film,
  Eraser,
  Settings as SettingsIcon,
  X,
  Crown,
  Sparkles,
  Check,
  Hash,
  type LucideIcon,
} from 'lucide-react-native';

import { Text } from '@/components/ui';
import { RocketIcon } from '@/components/ui/GameIcons';
import { ROOM_FREE_GAMES } from '@/constants/roomFreeGames';
import { lu } from '@/theme/lu-brand';
import { colors, spacing } from '@/theme';

export type RoomToolAction =
  | 'free-game'
  | 'activity'
  | 'pk'
  | 'poll'
  | 'throne'
  | 'rocket'
  | 'lucky-bag'
  | 'broadcast'
  | 'notice'
  | 'share'
  | 'music'
  | 'video'
  | 'settings'
  | 'clean-chat'
  | 'quality'
  | 'clean-screen'
  | 'effects'
  | 'sound'
  | 'reset-mic-support';

type ActivityItem = { id: string; nameKey: string; img: string; isNew?: boolean };
type IconTool = {
  id: string;
  action: RoomToolAction;
  nameKey: string;
  Icon?: LucideIcon;
  CustomIcon?: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  hasCheck?: boolean;
  hasNew?: boolean;
};

const RocketToolIcon = ({ size = 22, color = '#ED4444' }: { size?: number; color?: string }) => (
  <RocketIcon size={size} color={color} secondaryColor="#F06A6A" />
);

const ACTIVITY_CENTER: ActivityItem[] = [
  { id: 'gold-miner', nameKey: 'roomTools.activity.goldMiner', img: 'https://picsum.photos/seed/gm/100/100', isNew: true },
  { id: 'vip', nameKey: 'roomTools.activity.vip', img: 'https://picsum.photos/seed/vip/100/100' },
  { id: 'svip', nameKey: 'roomTools.activity.svipStore', img: 'https://picsum.photos/seed/svip/100/100' },
  { id: 'aristocracy', nameKey: 'roomTools.activity.aristocracy', img: 'https://picsum.photos/seed/ar/100/100' },
  { id: 'gift-wall', nameKey: 'roomTools.activity.giftWall', img: 'https://picsum.photos/seed/gw/100/100' },
];

const INTERACTIVE_TOOLS: IconTool[] = [
  { id: 'throne', action: 'throne', nameKey: 'roomTools.interactive.throne', Icon: Crown, color: '#F59E0B' },
  { id: 'rocket', action: 'rocket', nameKey: 'roomTools.interactive.rocket', CustomIcon: RocketToolIcon, color: '#ED4444' },
  { id: 'pk', action: 'pk', nameKey: 'roomTools.interactive.pk', Icon: Swords, color: '#F43F5E' },
  { id: 'poll', action: 'poll', nameKey: 'roomTools.interactive.poll', Icon: Vote, color: '#E11414' },
  { id: 'reset-mic-support', action: 'reset-mic-support', nameKey: 'roomTools.interactive.tarqeem', Icon: Hash, color: '#34D399' },
  { id: 'lucky-bag', action: 'lucky-bag', nameKey: 'roomTools.interactive.luckyBag', Icon: Gift, color: '#FCD34D' },
  { id: 'broadcast', action: 'broadcast', nameKey: 'roomTools.interactive.broadcast', Icon: Megaphone, color: '#FBBF24' },
  { id: 'notice', action: 'notice', nameKey: 'roomTools.interactive.notice', Icon: Bell, color: '#FB923C' },
  { id: 'share', action: 'share', nameKey: 'roomTools.interactive.share', Icon: Share2, color: '#EC4444' },
  { id: 'music', action: 'music', nameKey: 'roomTools.interactive.music', Icon: Music, color: '#E11414' },
  { id: 'video', action: 'video', nameKey: 'roomTools.interactive.video', Icon: Film, color: '#F06A6A' },
];

const BASIC_TOOLS: IconTool[] = [
  { id: 'sound', action: 'sound', nameKey: 'roomTools.basic.sound', Icon: Mic, color: '#E81717' },
  { id: 'settings', action: 'settings', nameKey: 'roomTools.basic.settings', Icon: SettingsIcon, color: '#FCA5A5' },
  { id: 'clean-chat', action: 'clean-chat', nameKey: 'roomTools.basic.cleanChat', Icon: Eraser, color: '#EC4444' },
  { id: 'clean-screen', action: 'clean-screen', nameKey: 'roomTools.basic.cleanScreen', Icon: X, color: '#9CA3AF' },
  { id: 'effects', action: 'effects', nameKey: 'roomTools.basic.effects', Icon: Sparkles, color: '#FECACA' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onAction: (action: RoomToolAction, payload?: { activityId?: string; gameId?: string }) => void;
  musicBusy?: boolean;
  showSettings?: boolean;
  showThrone?: boolean;
  showVideo?: boolean;
  showMusic?: boolean;
  showShare?: boolean;
  showResetMicSupport?: boolean;
  /** إخفاء أداة تثبيت الإعلان — غرف الوكالة تستخدم رسالة ترحيب ثابتة */
  showPinNotice?: boolean;
  simpleScreenActive?: boolean;
  effectsActive?: boolean;
};

export function RoomToolsSheet({
  visible,
  onClose,
  onAction,
  musicBusy,
  showSettings,
  showThrone,
  showVideo = true,
  showMusic = true,
  showShare = true,
  showResetMicSupport = false,
  showPinNotice = true,
  simpleScreenActive,
  effectsActive,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const runAction = (
    action: RoomToolAction,
    payload?: { activityId?: string; gameId?: string },
    event?: GestureResponderEvent,
  ) => {
    event?.stopPropagation?.();
    onAction(action, payload);
    // أغلق بعد تنفيذ الإجراء لتجنّب تسريب اللمسة للشاشة (خصوصاً المقاعد خلف المودال).
    setTimeout(onClose, 0);
  };

  const basicTools = showSettings
    ? BASIC_TOOLS
    : BASIC_TOOLS.filter((tool) => tool.action !== 'settings');

  const interactiveTools = (showThrone ? INTERACTIVE_TOOLS : INTERACTIVE_TOOLS.filter((tool) => tool.action !== 'throne'))
    .filter((tool) => {
      if (tool.action === 'video') return showVideo;
      if (tool.action === 'music') return showMusic;
      if (tool.action === 'share') return showShare;
      if (tool.action === 'reset-mic-support') return showResetMicSupport;
      if (tool.action === 'notice') return showPinNotice;
      return true;
    });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.base }]}>
          {/* Glass background */}
          <LinearGradient
            colors={['rgba(52, 15, 15, 0.95)', 'rgba(25, 6, 6, 0.98)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.glassHighlight} />

          <View style={styles.handleWrap}>
            <View style={styles.handleGlow} />
            <View style={styles.handle} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            bounces={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >

            <Text variant="h4" weight="bold" color={colors.white} style={styles.sectionTitle}>
              {t('roomTools.sections.freeGames')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
              nestedScrollEnabled
            >
              {ROOM_FREE_GAMES.map((game) => (
                <Pressable
                  key={game.id}
                  onPress={(e) => {
                    if (!game.ready) return;
                    runAction('free-game', { gameId: game.id }, e);
                  }}
                  style={[styles.gameItem, !game.ready && { opacity: 0.45 }]}
                >
                  <View style={[styles.gameImageWrap, { borderColor: game.color + '55' }]}>
                    <LinearGradient
                      colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.45)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <Image
                      source={{ uri: game.imageUrl }}
                      style={styles.gameImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      recyclingKey={game.id}
                      transition={200}
                    />
                    <View style={styles.imageOverlayBorder} />
                    {!game.ready ? (
                      <View style={styles.newBadgeGlow}>
                        <Text variant="caption" color={colors.white} weight="bold" style={{ fontSize: 9 }}>
                          {t('roomTools.soon')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="caption" color="rgba(255,255,255,0.8)" weight="semibold" numberOfLines={1} style={styles.gameLabel}>
                    {game.emoji} {t(game.nameKey)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text variant="h4" weight="bold" color={colors.white} style={styles.sectionTitle}>
              {t('roomTools.sections.activityCenter')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
              nestedScrollEnabled
            >
              {ACTIVITY_CENTER.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={(e) => runAction('activity', { activityId: a.id }, e)}
                  style={styles.gameItem}
                >
                  <View style={styles.gameImageWrap}>
                    <LinearGradient
                      colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.02)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <Image source={{ uri: a.img }} style={styles.gameImage} contentFit="cover" cachePolicy="memory-disk" recyclingKey={a.id || a.img} transition={150} />
                    <View style={styles.imageOverlayBorder} />
                    {a.isNew ? (
                      <View style={styles.newBadgeGlow}>
                        <Text variant="caption" color={colors.white} weight="bold" style={{ fontSize: 9 }}>
                          {t('roomTools.new')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="caption" color="rgba(255,255,255,0.8)" weight="semibold" numberOfLines={1} style={styles.gameLabel}>
                    {t(a.nameKey)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text variant="h4" weight="bold" color={colors.white} style={styles.sectionTitle}>
              {t('roomTools.sections.interactiveTools')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
              nestedScrollEnabled
            >
              {interactiveTools.map((tool) => {
                const ToolIcon = tool.Icon;
                return (
                  <Pressable
                    key={tool.id}
                    disabled={tool.action === 'music' && musicBusy}
                    onPress={(e) => runAction(tool.action, undefined, e)}
                    style={[styles.gameItem, tool.action === 'music' && musicBusy && { opacity: 0.5 }]}
                  >
                    <View style={[styles.iconBgNew, { shadowColor: tool.color }]}>
                      <LinearGradient
                        colors={[`${tool.color}33`, `${tool.color}05`]}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={[styles.iconBorderInner, { borderColor: `${tool.color}55` }]} />
                      {tool.CustomIcon ? (
                        <tool.CustomIcon size={26} color={tool.color} />
                      ) : ToolIcon ? (
                        <ToolIcon size={26} color={tool.color} strokeWidth={2} />
                      ) : null}
                    </View>
                    <Text variant="caption" color="rgba(255,255,255,0.85)" style={styles.gameLabel} numberOfLines={2}>
                      {t(tool.nameKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text variant="h4" weight="bold" color={colors.white} style={styles.sectionTitle}>
              {t('roomTools.sections.basicTools')}
            </Text>
            <View style={styles.grid}>
              {basicTools.map((tool) => {
                const showCheck =
                  (tool.action === 'effects' && effectsActive) ||
                  (tool.action === 'clean-screen' && simpleScreenActive);
                const ToolIcon = tool.Icon;
                return (
                  <Pressable
                    key={tool.id}
                    onPress={(e) => runAction(tool.action, undefined, e)}
                    style={styles.gridItem}
                  >
                    <View style={[styles.iconBgNew, { shadowColor: tool.color, position: 'relative' }]}>
                      <LinearGradient
                        colors={[`${tool.color}22`, `${tool.color}02`]}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={[styles.iconBorderInner, { borderColor: `${tool.color}44` }]} />

                      {ToolIcon ? (
                        <ToolIcon size={26} color={tool.color} strokeWidth={2} />
                      ) : null}

                      {showCheck ? (
                        <View style={styles.checkDotGlow}>
                          <LinearGradient colors={['#34D399', '#059669']} style={StyleSheet.absoluteFill} />
                          <Check size={12} color={colors.white} strokeWidth={3} />
                        </View>
                      ) : null}
                      {tool.hasNew ? (
                        <View style={styles.redDotGlow}>
                          <View style={styles.redDotInner} />
                        </View>
                      ) : null}
                    </View>
                    <Text variant="caption" color="rgba(255,255,255,0.85)" style={styles.gridLabel} numberOfLines={2}>
                      {t(tool.nameKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopStartRadius: 36,
    borderTopEndRadius: 36,
    paddingTop: spacing.sm,
    maxHeight: '82%',
    overflow: 'hidden',
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  handleWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: 8,
    position: 'relative',
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  handleGlow: {
    position: 'absolute',
    width: 60,
    height: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    top: -5,
    filter: 'blur(4px)',
  },
  sectionTitle: {
    paddingHorizontal: spacing.base,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(255,255,255,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  hScroll: {
    paddingHorizontal: spacing.base,
    gap: 16,
    paddingBottom: 8,
  },
  gameItem: {
    width: 76,
    alignItems: 'center',
  },
  gameImageWrap: {
    width: 66,
    height: 66,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  gameImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  emojiGameIcon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOverlayBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  newBadgeGlow: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 18,
    shadowColor: '#EF4444',
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  gameLabel: {
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.base,
    gap: 12,
  },
  gridItem: {
    width: '21%',
    minWidth: 68,
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBgNew: {
    width: 66,
    height: 66,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  iconBorderInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  gridLabel: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '500',
  },
  checkDotGlow: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#10B981',
    shadowColor: '#34D399',
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  redDotGlow: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  redDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 1,
    shadowRadius: 6,
  },
});
