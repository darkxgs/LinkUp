/**
 * LinkUp Tab Bar — Line up App Full File
 * Navigation.svg + Icons (Home, File, Heart, Chat)
 */
import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import {
  LuTabHomeIcon,
  LuTabFeedIcon,
  LuTabChatIcon,
  LuTabRoomsFabIcon,
  LuTabRoomsFabIconOutline,
} from '@/components/icons/LuTabIcons';
import {
  TabBarNavigationSvg,
  TAB_BAR_VIEW_H,
  TAB_BAR_VIEW_W,
  TAB_DESIGN,
  TAB_ICON_Y,
  TAB_SLOT_X,
} from '@/components/navigation/TabBarNavigationSvg';
import { TabHeartMusicFrame } from '@/components/navigation/TabHeartMusicFrame';
import { useAuthStore } from '@/stores/authStore';
import { useUnreadStore, startUnreadTracking } from '@/stores/unreadStore';
import { lu } from '@/theme/lu-brand';

type TabKey = 'index' | 'feed' | 'home' | 'chat' | 'profile';
type TabSlotKey = keyof typeof TAB_SLOT_X;

/** يسار = الاستكشاف (قلب) | الوسط = الغرف (بيت) */
const TAB_BAR_ITEMS: {
  route: TabKey;
  slot: TabSlotKey;
  center?: boolean;
  badge?: boolean;
  avatar?: boolean;
}[] = [
  { route: 'index', slot: 'index' },
  { route: 'feed', slot: 'feed' },
  { route: 'home', slot: 'home', center: true },
  { route: 'chat', slot: 'chat', badge: true },
  { route: 'profile', slot: 'profile', avatar: true },
];

function renderSlotIcon(
  slot: TabSlotKey,
  route: TabKey,
  active: boolean,
  size: number,
) {
  if (slot === 'index') {
    return active ? (
      <LuTabRoomsFabIcon size={size} color="#fff" />
    ) : (
      <LuTabRoomsFabIconOutline size={size} color="#9A9AA5" />
    );
  }
  switch (route) {
    case 'feed':
      return <LuTabFeedIcon size={size} active={active} />;
    case 'chat':
      return <LuTabChatIcon size={size} active={active} />;
    default:
      return null;
  }
}

export default function TabsLayout() {
  // شارة الرسائل غير المقروءة على تبويب الدردشة — اشتراك واحد لكل التطبيق
  useEffect(() => {
    startUnreadTracking();
  }, []);
  return (
    <Tabs
      screenOptions={{ headerShown: false, freezeOnBlur: true, lazy: true }}
      tabBar={(props) => <LinkUpTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="home" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const LinkUpTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const totalUnread = useUnreadStore((s) => s.totalUnread);
  const { width: W } = useWindowDimensions();

  const BAR_W = Math.min(W - 24, TAB_BAR_VIEW_W);
  const BAR_H = (BAR_W / TAB_BAR_VIEW_W) * TAB_BAR_VIEW_H;
  const scale = BAR_W / TAB_BAR_VIEW_W;
  const isSmall = W < 380;

  const PILL = Math.round(46 * scale);
  const ICON = isSmall ? Math.round(22 * scale) : Math.round(24 * scale);
  const CENTER_ICON = Math.round(24 * scale);
  const CENTER_FRAME = PILL + Math.round(10 * scale);
  const AVATAR = Math.round(40 * scale);
  const AVATAR_ACTIVE = Math.round(36 * scale);

  const navigateTo = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return;
    const focused = state.index === state.routes.indexOf(route);
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  const isActive = (name: string) =>
    state.index === state.routes.findIndex((r) => r.name === name);

  const slotPos = (key: TabSlotKey) => ({
    left: (TAB_SLOT_X[key] / TAB_BAR_VIEW_W) * BAR_W,
    top: (TAB_ICON_Y / TAB_BAR_VIEW_H) * BAR_H,
  });

  const centerRouteActive = isActive('home');

  return (
    <View
      pointerEvents="box-none"
      style={[styles.outer, { bottom: Math.max(insets.bottom, 6) + 8 }]}
    >
      <View style={[styles.barShell, { width: BAR_W, height: BAR_H }]}>
        <MaskedView
          style={StyleSheet.absoluteFill}
          maskElement={
            <TabBarNavigationSvg
              width={BAR_W}
              height={BAR_H}
              centerActive={centerRouteActive}
              isMask={true}
            />
          }
        >
          <BlurView
            intensity={65}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
        </MaskedView>

        <TabBarNavigationSvg
          width={BAR_W}
          height={BAR_H}
          centerActive={centerRouteActive}
        />

        {TAB_BAR_ITEMS.map(({ route, slot, center, badge, avatar }) => {
          const active = isActive(route);
          const pos = slotPos(slot);

          if (center) {
            return (
              <Pressable
                key={route}
                onPress={() => navigateTo(route)}
                style={({ pressed }) => [
                  styles.centerHit,
                  {
                    left: pos.left - CENTER_FRAME / 2,
                    top: pos.top - CENTER_FRAME / 2 - Math.round(2 * scale),
                    width: CENTER_FRAME,
                    height: CENTER_FRAME,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <TabHeartMusicFrame size={PILL} active={active}>
                  <LuTabHomeIcon size={CENTER_ICON} active={active} />
                </TabHeartMusicFrame>
              </Pressable>
            );
          }

          return (
            <TabIconBtn
              key={route}
              active={active}
              pill={PILL}
              badge={badge ? totalUnread : undefined}
              noPill={avatar}
              style={{
                left: pos.left - PILL / 2,
                top: pos.top - PILL / 2,
                width: PILL,
                height: PILL,
              }}
              onPress={() => navigateTo(route)}
            >
              {avatar ? (
                <ProfileTabAvatar
                  active={active}
                  uri={user?.profile?.avatar}
                  size={active ? AVATAR_ACTIVE : AVATAR}
                />
              ) : (
                renderSlotIcon(slot, route, active, ICON)
              )}
            </TabIconBtn>
          );
        })}
      </View>
    </View>
  );
};

function TabIconBtn({
  children,
  active,
  onPress,
  badge,
  pill,
  noPill,
  style,
}: {
  children: React.ReactNode;
  active: boolean;
  onPress: () => void;
  badge?: number;
  pill: number;
  noPill?: boolean;
  style: object;
}) {
  const showPill = active && !noPill;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.slot,
        style,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {showPill ? (
        <LinearGradient
          colors={[...TAB_DESIGN.activeGrad]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[
            styles.activePill,
            { width: pill, height: pill, borderRadius: pill / 2 },
          ]}
        >
          {children}
        </LinearGradient>
      ) : (
        <View style={[styles.inactiveSlot, { width: pill, height: pill }]}>
          {children}
        </View>
      )}
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {badge > 99 ? '99+' : String(badge)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ProfileTabAvatar({
  active,
  uri,
  size,
}: {
  active: boolean;
  uri?: string;
  size: number;
}) {
  const img = uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={uri}
    />
  ) : (
    <LinearGradient
      colors={lu.gradients.pink}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  );

  if (!active) return img;

  return (
    <View
      style={{
        padding: 2,
        borderRadius: (size + 8) / 2,
        borderWidth: 2,
        borderColor: '#FF3340',
      }}
    >
      {img}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    start: 0,
    end: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  barShell: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 12,
  },
  slot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerHit: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  activePill: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TAB_DESIGN.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  inactiveSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    end: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: lu.colors.live,
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
});
