/**
 * تنبيه عدم الاتصال بالإنترنت — يظهر تلقائياً مع زر تحديث
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { WifiOff, RefreshCw, Wifi } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { useNetworkStore } from '@/stores/networkStore';
import { lu } from '@/theme/lu-brand';

type BannerMode = 'hidden' | 'offline' | 'restored';

export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isOffline = useNetworkStore((s) => s.isOffline);
  const checking = useNetworkStore((s) => s.checking);
  const refresh = useNetworkStore((s) => s.refresh);

  const [mode, setMode] = useState<BannerMode>('hidden');
  const [mounted, setMounted] = useState(false);
  const wasOfflineRef = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOffline) {
      wasOfflineRef.current = true;
      setMounted(true);
      setMode('offline');
      return;
    }

    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setMounted(true);
      setMode('restored');
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setMode('hidden'), 2600);
    } else if (mode !== 'hidden') {
      setMode('hidden');
    }

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isOffline, mode]);

  useEffect(() => {
    const visible = mode !== 'hidden';
    if (visible) setMounted(true);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: visible ? 0 : 120,
        damping: 20,
        stiffness: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 220 : 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [mode, opacity, translateY]);

  if (!mounted) return null;

  const restored = mode === 'restored';
  const colors = restored
    ? (['#0F3D2E', '#145A3A'] as const)
    : (['#2A1014', '#4A1218', '#1A0A0D'] as const);
  const Icon = restored ? Wifi : WifiOff;
  const iconColor = restored ? lu.colors.mint : lu.colors.gold;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          paddingBottom: Math.max(insets.bottom, 12),
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.banner}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.iconWrap, restored && styles.iconWrapOk]}>
          <Icon size={20} color={iconColor} strokeWidth={2.4} />
        </View>

        <View style={styles.copy}>
          <Text variant="label" color="#fff" weight="bold" numberOfLines={1}>
            {restored ? t('common.connectionRestored') : t('common.noInternetTitle')}
          </Text>
          {!restored ? (
            <Text variant="caption" color="rgba(255,255,255,0.78)" numberOfLines={2}>
              {t('common.noInternetMessage')}
            </Text>
          ) : null}
        </View>

        {!restored ? (
          <Pressable
            onPress={() => void refresh()}
            disabled={checking}
            style={({ pressed }) => [
              styles.retryBtn,
              pressed && !checking ? { opacity: 0.85 } : null,
              checking ? styles.retryBtnBusy : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('common.refreshConnection')}
          >
            {checking ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <RefreshCw size={15} color="#fff" strokeWidth={2.4} />
                <Text variant="caption" color="#fff" weight="bold">
                  {t('common.refreshConnection')}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    zIndex: 120,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
      },
      android: { elevation: 14 },
    }),
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,197,61,0.12)',
  },
  iconWrapOk: {
    backgroundColor: 'rgba(43,217,168,0.14)',
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(225,20,20,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    minWidth: 88,
    justifyContent: 'center',
  },
  retryBtnBusy: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
});
