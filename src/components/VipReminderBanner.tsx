/**
 * بانر تذكير SVIP — آخر 5 أيام قبل انتهاء الباقة أو عند نقص نقاط الحفاظ
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Crown, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import {
  computeVipReminderState,
  processVipReminderNotifications,
} from '@/services/firebase/vipNotifications';

const DISMISS_PREFIX = '@vip_banner_dismiss_';

export function VipReminderBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { vipSystem } = useConfig();
  const [dismissed, setDismissed] = useState(true);
  const translateY = useRef(new Animated.Value(-160)).current;
  const processedRef = useRef(false);

  const state = useMemo(() => {
    if (!user?.uid) return null;
    return computeVipReminderState(
      {
        vipLevel: user.vipLevel,
        vipPointsMonth: user.vipPointsMonth,
        vipMonthKey: user.vipMonthKey,
        vipExpiresAt: user.vipExpiresAt,
      },
      vipSystem,
    );
  }, [user, vipSystem]);

  useEffect(() => {
    if (!user?.uid || !state?.show) {
      setDismissed(true);
      return;
    }
    const key = `${DISMISS_PREFIX}${new Date().toISOString().slice(0, 10)}`;
    AsyncStorage.getItem(key).then((v) => setDismissed(v === '1')).catch(() => setDismissed(false));
  }, [user?.uid, state?.show]);

  useEffect(() => {
    if (!user?.uid || processedRef.current) return;
    processedRef.current = true;
    void processVipReminderNotifications(user.uid);
  }, [user?.uid]);

  useEffect(() => {
    const visible = state?.show && !dismissed;
    Animated.spring(translateY, {
      toValue: visible ? 0 : -160,
      damping: 18,
      useNativeDriver: true,
    }).start();
  }, [state?.show, dismissed, translateY]);

  if (!state?.show || dismissed) return null;

  const message =
    state.kind === 'expiry' && state.daysLeft != null
      ? t('vipNotify.bannerExpiry', {
          days: state.daysLeft,
          level: state.levelLabel,
        })
      : t('vipNotify.bannerMaintain', {
          count: state.remaining,
          level: state.levelLabel,
          downgrade: state.downgradeLabel,
        });

  const dismiss = async () => {
    const key = `${DISMISS_PREFIX}${new Date().toISOString().slice(0, 10)}`;
    await AsyncStorage.setItem(key, '1');
    setDismissed(true);
  };

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + (Platform.OS === 'android' ? 6 : 0),
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable onPress={() => router.push('/wallet/recharge' as any)} style={styles.press}>
        <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.card}>
          <Crown size={20} color="#fff" strokeWidth={2.2} />
          <Text style={styles.text} numberOfLines={3}>{message}</Text>
          <Pressable onPress={(e) => { e.stopPropagation(); void dismiss(); }} hitSlop={12}>
            <X size={18} color="rgba(255,255,255,0.9)" />
          </Pressable>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
    paddingHorizontal: 12,
  },
  press: { width: '100%' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  text: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
});
