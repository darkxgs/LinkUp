/**
 * BroadcastBanner — يعرض آخر إشعار جماعي غير مقروء من inbox المستخدم
 * (يُنشأ لكل مستهدف عبر adminSendBroadcast)
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Gift, AlertTriangle, Info, X, Megaphone } from 'lucide-react-native';

import {
  subscribeToUnreadBroadcast,
  markAsRead,
  recordBroadcastView,
  parseNotificationDisplay,
  type Notification,
} from '@/services/firebase/notifications';
import { useAuth } from '@/hooks/useAuth';

type BroadcastType = 'info' | 'promo' | 'reward' | 'warning';

const TYPE_CONFIG: Record<
  BroadcastType,
  { Icon: typeof Info; colors: readonly [string, string] }
> = {
  info: { Icon: Info, colors: ['#ED4444', '#D81D1D'] },
  promo: { Icon: Megaphone, colors: ['#E11414', '#7A0A0A'] },
  reward: { Icon: Gift, colors: ['#10B981', '#047857'] },
  warning: { Icon: AlertTriangle, colors: ['#EF4444', '#991B1B'] },
};

export function BroadcastBanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [notif, setNotif] = useState<Notification | null>(null);
  const translateY = useRef(new Animated.Value(-200)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewRecordedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.uid) {
      setNotif(null);
      return;
    }
    const unsub = subscribeToUnreadBroadcast(setNotif);
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    const broadcastId = notif?.data?.broadcastId as string | undefined;
    if (broadcastId && !viewRecordedRef.current.has(broadcastId)) {
      viewRecordedRef.current.add(broadcastId);
      void recordBroadcastView(broadcastId);
    }
  }, [notif?.id, notif?.data?.broadcastId]);

  useEffect(() => {
    if (!notif) {
      Animated.timing(translateY, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.spring(translateY, {
      toValue: 0,
      damping: 18,
      useNativeDriver: true,
    }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => dismiss(), 8000);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [notif?.id]);

  const dismiss = async () => {
    if (notif && !notif.isRead) {
      await markAsRead(notif.id, {
        broadcastId: notif.data?.broadcastId as string | undefined,
      });
    }
    setNotif(null);
  };

  const openInbox = async () => {
    if (notif && !notif.isRead) {
      await markAsRead(notif.id, {
        broadcastId: notif.data?.broadcastId as string | undefined,
      });
    }
    setNotif(null);
    router.push('/notifications' as any);
  };

  if (!notif) return null;

  const display = parseNotificationDisplay(notif);
  const bType = (notif.data?.broadcastType as BroadcastType) ?? 'info';
  const cfg = TYPE_CONFIG[bType] ?? TYPE_CONFIG.info;
  const Icon = cfg.Icon;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={openInbox}
        style={({ pressed }) => [styles.banner, pressed && { opacity: 0.95 }]}
      >
        <LinearGradient
          colors={cfg.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.iconWrap}>
          <Icon size={22} color="#fff" strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fromLabel}>إدارة LinkUp</Text>
          <Text style={styles.title} numberOfLines={1}>
            {display.title}
          </Text>
          {display.body ? (
            <Text style={styles.body} numberOfLines={2}>
              {display.body}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            void dismiss();
          }}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <X size={18} color="rgba(255,255,255,0.9)" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 90,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 60,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
    }),
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fromLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 1,
  },
  title: {
    color: '#fff',
    fontSize: 14.5,
    fontWeight: '800',
  },
  body: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12.5,
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
