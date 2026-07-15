/**
 * LinkUp Tab Bar — شريط سفلي زجاجي بأيقونات ثلاثية الأبعاد وميكروفون مركزي بارز.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  AppState,
} from 'react-native';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withDelay,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

import { useUnreadStore, startUnreadTracking } from '@/stores/unreadStore';
import { useThemeMode } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useAppLanguage } from '@/localization/useAppLanguage';
import { readUserGender } from '@/utils/genderAccess';
import { lu } from '@/theme/lu-brand';

type TabKey = 'index' | 'feed' | 'home' | 'chat' | 'profile';

const BAR_H = 70;
const MIC_D = 66; // قطر دائرة الميكروفون المركزية.
const MIC_RISE = 24; // مقدار بروز الدائرة فوق حافة الشريط.

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
  const { width: W } = useWindowDimensions();
  const { isDark } = useThemeMode();
  const { t } = useAppLanguage();
  const totalUnread = useUnreadStore((s) => s.totalUnread);
  const user = useAuthStore((s) => s.user);
  const avatarUri = user?.profile?.avatar;
  const profileIcon =
    readUserGender(user) === 'female'
      ? require('../../assets/images/tab_profile_female.png')
      : require('../../assets/images/tab_profile_male.png');

  // ⚡ لا نشغّل الحلقات اللانهائية (نبض الميكروفون + أعمدة الموازن) إلا حين يكون
  //    الشريط ظاهراً وفي المقدمة. تحت شاشات الروم/المكالمة/المحادثة يفقد ملّاح
  //    التبويبات التركيز، وفي الخلفية يصبح AppState غير active — فنوقف الرسم عندئذٍ.
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);
  const animate = isFocused && appActive;

  const BAR_W = W - 24;

  const pal = isDark
    ? {
        blurTint: 'dark' as const,
        barGrad: ['rgba(66,18,28,0.94)', 'rgba(30,10,15,0.97)'] as [string, string, ...string[]],
        border: 'rgba(255,70,90,0.45)',
        glow: '#FF2D45',
        sep: 'rgba(255,255,255,0.09)',
        label: 'rgba(255,255,255,0.55)',
        labelActive: '#FF4D5E',
        micBg: '#38111A',
        micRing: '#FF3B55',
      }
    : {
        blurTint: 'light' as const,
        // تدرّج وردي مطابق لخلفية صفحة المطابقة في الوضع الفاتح.
        barGrad: [
          'rgba(250,228,231,0.96)',
          'rgba(251,238,240,0.97)',
          'rgba(248,246,247,0.98)',
        ] as [string, string, ...string[]],
        border: 'rgba(225,20,20,0.22)',
        glow: '#E11414',
        sep: 'rgba(0,0,0,0.08)',
        label: '#8A8F98',
        labelActive: '#E11414',
        micBg: '#FFFFFF',
        micRing: '#FF3B55',
      };

  const items: {
    route: TabKey;
    icon: number;
    label: string;
    center?: boolean;
    badge?: number;
    wide?: boolean;
    avatarUri?: string;
  }[] = [
    { route: 'index', icon: require('../../assets/images/tab_matches.png'), label: t('tabs.matches'), wide: true },
    { route: 'feed', icon: require('../../assets/images/tab_feed.png'), label: t('tabs.discoverTab'), wide: true },
    { route: 'home', icon: require('../../assets/images/tab_home.png'), label: t('tabs.voiceRoom'), center: true },
    { route: 'chat', icon: require('../../assets/images/tab_chats.png'), label: t('tabs.chats'), badge: totalUnread, wide: true },
    { route: 'profile', icon: profileIcon, label: t('tabs.profile'), avatarUri },
  ];

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

  return (
    <View
      pointerEvents="box-none"
      style={[styles.outer, { bottom: Math.max(insets.bottom, 6) + 8 }]}
    >
      <View
        pointerEvents="box-none"
        style={{ width: BAR_W, height: BAR_H + MIC_RISE }}
      >
        <View
          style={[
            styles.bar,
            { borderColor: pal.border, shadowColor: pal.glow },
          ]}
        >
          <BlurView
            intensity={45}
            tint={pal.blurTint}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[...pal.barGrad]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* اتجاه row ينعكس تلقائياً مع RTL — لا حاجة لعكس يدوي. */}
        <View style={[styles.row, { flexDirection: 'row' }]}>
          {items.map((it, i) => (
            <React.Fragment key={it.route}>
              {i > 0 ? (
                <View style={[styles.sep, { backgroundColor: pal.sep }]} />
              ) : null}
              {it.center ? (
                <CenterMicTab
                  icon={it.icon}
                  label={it.label}
                  active={isActive(it.route)}
                  animate={animate}
                  pal={pal}
                  onPress={() => navigateTo(it.route)}
                />
              ) : (
                <TabItem
                  icon={it.icon}
                  label={it.label}
                  active={isActive(it.route)}
                  badge={it.badge}
                  wide={it.wide}
                  avatarUri={it.avatarUri}
                  pal={pal}
                  onPress={() => navigateTo(it.route)}
                />
              )}
            </React.Fragment>
          ))}
        </View>
      </View>
    </View>
  );
};

type Pal = {
  sep: string;
  label: string;
  labelActive: string;
  micBg: string;
  micRing: string;
  glow: string;
};

function TabItem({
  icon,
  label,
  active,
  badge,
  wide,
  avatarUri,
  pal,
  onPress,
}: {
  icon: number;
  label: string;
  active: boolean;
  badge?: number;
  wide?: boolean; // أيقونات أفقية التكوين — تُكبَّر بصرياً دون تغيير التخطيط.
  avatarUri?: string; // صورة المستخدم — تظهر بدل الأيقونة في تبويب الملف الشخصي.
  pal: Pal;
  onPress: () => void;
}) {
  const focus = useSharedValue(active ? 1 : 0);
  const press = useSharedValue(1);
  useEffect(() => {
    focus.value = withSpring(active ? 1 : 0, { damping: 12, stiffness: 160 });
  }, [active]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: press.value * (1 + focus.value * 0.16) },
      { translateY: -focus.value * 3 },
    ],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { press.value = withTiming(0.85, { duration: 90 }); }}
      onPressOut={() => { press.value = withSpring(1, { damping: 9 }); }}
      style={styles.item}
    >
      <Animated.View style={iconStyle}>
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={styles.itemAvatar}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={avatarUri}
          />
        ) : (
          <Image
            source={icon}
            style={[styles.itemIcon, wide && styles.itemIconWide]}
            contentFit="contain"
          />
        )}
        {badge && badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {badge > 99 ? '99+' : String(badge)}
            </Text>
          </View>
        ) : null}
      </Animated.View>
      <Text
        style={[
          styles.itemLabel,
          { color: active ? pal.labelActive : pal.label },
          active && styles.itemLabelActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CenterMicTab({
  icon,
  label,
  active,
  animate,
  pal,
  onPress,
}: {
  icon: number;
  label: string;
  active: boolean;
  animate: boolean; // شغّل حلقة النبض فقط حين يكون الشريط ظاهراً وفي المقدمة.
  pal: Pal;
  onPress: () => void;
}) {
  const pulse = useSharedValue(0);
  const press = useSharedValue(1);
  const focus = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    if (animate) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      // إيقاف الحلقة اللانهائية حين يختفي الشريط أو يذهب التطبيق للخلفية.
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
    }
    return () => cancelAnimation(pulse); // تنظيف عند إلغاء التركيب.
  }, [animate]);
  useEffect(() => {
    focus.value = withSpring(active ? 1 : 0, { damping: 12, stiffness: 160 });
  }, [active]);

  // نحرّك المقياس فقط — shadowOpacity ثابت في الستايل لتفادي إعادة رسم الظل كل إطار.
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value * (1 + pulse.value * 0.04 + focus.value * 0.06) }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.28 + pulse.value * 0.3,
    transform: [{ scale: 1 + pulse.value * 0.12 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { press.value = withTiming(0.9, { duration: 90 }); }}
      onPressOut={() => { press.value = withSpring(1, { damping: 9 }); }}
      style={styles.centerItem}
    >
      <Animated.View
        style={[
          styles.micHalo,
          { borderColor: pal.micRing },
          haloStyle,
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          styles.micCircle,
          {
            backgroundColor: pal.micBg,
            borderColor: pal.micRing,
            shadowColor: pal.glow,
          },
          ringStyle,
        ]}
      >
        <Image source={icon} style={styles.micIcon} contentFit="contain" />
        <View style={styles.eqRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <EqBar key={i} delay={i * 110} animate={animate} />
          ))}
        </View>
      </Animated.View>
      <Text
        style={[
          styles.itemLabel,
          styles.centerLabel,
          { color: active ? pal.labelActive : pal.label },
          active && styles.itemLabelActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// عمود موجة صوتية متحرّكة أسفل أيقونة الرئيسية.
function EqBar({ delay, animate }: { delay: number; animate: boolean }) {
  const v = useSharedValue(0.25);
  useEffect(() => {
    if (animate) {
      v.value = withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration: 430, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        ),
      );
    } else {
      // إيقاف حلقة العمود حين لا يكون الشريط في المقدمة.
      cancelAnimation(v);
      v.value = withTiming(0.25, { duration: 200 });
    }
    return () => cancelAnimation(v); // تنظيف عند إلغاء التركيب.
  }, [animate]);
  const st = useAnimatedStyle(() => ({
    transform: [{ scaleY: 0.3 + v.value * 0.7 }],
  }));
  return <Animated.View style={[styles.eqBar, st]} />;
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    start: 0,
    end: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  bar: {
    position: 'absolute',
    top: MIC_RISE,
    start: 0,
    end: 0,
    height: BAR_H,
    borderRadius: BAR_H / 2,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 14,
  },
  row: {
    position: 'absolute',
    top: MIC_RISE,
    start: 0,
    end: 0,
    height: BAR_H,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  sep: {
    width: 1,
    height: 30,
    borderRadius: 1,
  },
  item: {
    flex: 1,
    height: BAR_H,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  itemIcon: {
    width: 30,
    height: 30,
  },
  itemIconWide: {
    width: 40,
    height: 40,
    marginVertical: -5,
    marginHorizontal: -5,
  },
  itemAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.6,
    borderColor: '#FF5C6C',
  },
  itemLabel: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
    maxWidth: '96%',
  },
  itemLabelActive: {
    fontWeight: '800',
    fontFamily: lu.fonts.bodyHeavy,
  },
  centerItem: {
    flex: 1.15,
    height: BAR_H + MIC_RISE,
    marginTop: -MIC_RISE,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 9,
  },
  micCircle: {
    position: 'absolute',
    top: 0,
    width: MIC_D,
    height: MIC_D,
    borderRadius: MIC_D / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    // ظل ثابت (كان يُحرَّك كل إطار = إعادة رسم الظل مكلفة جداً) — قيمة وسطية للتوهّج.
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 12,
  },
  micHalo: {
    position: 'absolute',
    top: -5,
    width: MIC_D + 10,
    height: MIC_D + 10,
    borderRadius: (MIC_D + 10) / 2,
    borderWidth: 1.5,
  },
  micIcon: {
    width: 32,
    height: 32,
  },
  eqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 10,
    marginTop: 2,
  },
  eqBar: {
    width: 2.5,
    height: 9,
    borderRadius: 2,
    backgroundColor: '#FF5C6C',
  },
  centerLabel: {
    marginTop: 0,
  },
  badge: {
    position: 'absolute',
    top: -4,
    end: -6,
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
