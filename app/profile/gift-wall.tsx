/**
 * LinkUp — جدار الهدايا (هدايا مستلمة حقيقية)
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react-native';
import { ChevronLeft } from '@/components/ui/RtlIcons';

import { Text } from '@/components/ui';
import { GiftVisual } from '@/components/ui/GiftVisual';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { lu } from '@/theme/lu-brand';
import { getGiftWall, countGiftWallItems, type GiftWallItem } from '@/services/firebase/giftWall';
import { getUser } from '@/services/firebase/users';
import { getPrivacySettings } from '@/services/firebase/privacySettings';
import { shouldHideGiftWall } from '@/utils/privacyDisplay';
import { resolveDisplayName } from '@/utils/displayName';

export default function GiftWallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const { user: me } = useAuth();
  const { gifts } = useConfig();

  const targetUid = userId ?? me?.uid ?? '';
  const isSelf = targetUid === me?.uid;
  const [items, setItems] = useState<GiftWallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [ownerName, setOwnerName] = useState('');

  useEffect(() => {
    if (!targetUid) return;
    setLoading(true);
    Promise.all([
      getGiftWall(targetUid, me?.uid, gifts),
      getUser(targetUid),
      getPrivacySettings(targetUid),
    ])
      .then(([wall, profile, privacy]) => {
        setItems(wall);
        setHidden(shouldHideGiftWall(targetUid, me?.uid, privacy));
        setOwnerName(resolveDisplayName({ displayName: profile?.displayName }));
      })
      .finally(() => setLoading(false));
  }, [targetUid, me?.uid, gifts, isSelf]);

  const total = countGiftWallItems(items);

  return (
    <View style={styles.fill}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ChevronLeft size={22} color={lu.colors.ink} />
        </Pressable>
        <Text weight="bold" style={styles.headerTitle}>{t('giftWall.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.sub}>
          {isSelf ? t('giftWall.myWall') : t('giftWall.userWall', { name: ownerName })}
          {' · '}{total} {t('giftWall.gifts')}
        </Text>

        {loading ? (
          <ActivityIndicator color={lu.colors.pink} style={{ marginTop: 40 }} />
        ) : hidden && !isSelf ? (
          <View style={styles.locked}>
            <Lock size={32} color="#9CA3AF" />
            <Text style={styles.lockedText}>{t('giftWall.hidden')}</Text>
          </View>
        ) : items.length === 0 ? (
          <Text style={styles.empty}>{t('giftWall.empty')}</Text>
        ) : (
          <View style={styles.grid}>
            {items.map((item) => (
              <View key={item.giftId} style={styles.card}>
                <GiftVisual
                  gift={{
                    iconName: item.iconName ?? 'Gift',
                    iconColor: item.iconColor ?? lu.colors.pink,
                    imageUrl: item.imageUrl,
                    animationUrl: item.animationUrl,
                  }}
                  size={56}
                  cachePolicy="memory-disk"
                />
                <Text style={styles.giftName} numberOfLines={1}>{item.giftName}</Text>
                <Text style={styles.giftCount}>×{item.count}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#FEE2E2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 17, color: lu.colors.ink },
  scroll: { padding: 16 },
  sub: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  card: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  giftImg: { width: 80, height: 56 },
  giftPlaceholder: {
    width: 80,
    height: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftName: { fontSize: 12, color: lu.colors.ink, marginTop: 8, textAlign: 'center' },
  giftCount: { fontSize: 13, fontWeight: '700', color: lu.colors.pink, marginTop: 4 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
  locked: { alignItems: 'center', marginTop: 48, gap: 12 },
  lockedText: { fontSize: 14, color: '#9CA3AF' },
});
