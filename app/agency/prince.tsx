/**
 * أمير الوكلاء — شاشة مستقلة لمديري الوكالات
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/contexts/ConfigContext';
import { AgencyPrinceSection } from '@/components/agency/AgencyPrinceSection';
import { readUserAgencyPrince } from '@/services/firebase/agencyPrinceSystem';
import { subscribeToMyAgency, type Agency } from '@/services/agencyService';
import { spacing } from '@/theme';

const CITY_SKYLINE_URL =
  'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1000&auto=format&fit=crop';

export default function AgencyPrinceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const { agencyPrince } = useConfig();
  const isAr = i18n.language?.startsWith('ar') ?? true;
  const isManager = user?.agencyRole === 'owner' || user?.isAgent === true;
  const userPrince = useMemo(() => readUserAgencyPrince(user?.agencyPrince), [user?.agencyPrince]);
  const [agency, setAgency] = useState<Agency | null>(null);

  const title = isAr ? agencyPrince.titleAr : agencyPrince.titleEn;

  useEffect(() => {
    if (!user?.uid || !isManager) return;
    return subscribeToMyAgency(setAgency);
  }, [user?.uid, isManager]);

  useEffect(() => {
    if (user && !isManager) {
      router.back();
    }
  }, [user, isManager, router]);

  if (!user || !isManager) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#F59E0B" />
      </View>
    );
  }

  if (!agencyPrince.enabled) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headBtn} hitSlop={10}>
            <BackChevron color="#1A0A0C" size={22} />
          </Pressable>
          <Text weight="bold" style={styles.headTitle}>{title}</Text>
          <View style={styles.headBtn} />
        </View>
        <View style={styles.disabledBox}>
          <Text variant="body" color="rgba(26, 10, 12,0.6)" align="center">
            {isAr ? 'البرنامج غير مفعّل حالياً' : 'This program is currently disabled'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ImageBackground
        source={{ uri: CITY_SKYLINE_URL }}
        style={styles.heroBg}
        imageStyle={{ opacity: 0.55 }}
      >
        <LinearGradient
          colors={['rgba(20, 10, 12, 0.15)', 'rgba(20, 10, 12, 0.92)', '#140A0C']}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.headBtnDark} hitSlop={10}>
          <BackChevron color="#fff" size={22} />
        </Pressable>
        <View style={styles.titleRow}>
          <Crown size={20} color="#F59E0B" />
          <Text weight="bold" style={styles.headTitleDark} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.headBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing['2xl'],
        }}
        showsVerticalScrollIndicator={false}
      >
        <AgencyPrinceSection
          config={agencyPrince}
          userPrince={userPrince}
          uid={user.uid}
          agencyName={agency?.name ?? user.agencyName ?? undefined}
          isAr={isAr}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#140A0C' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#140A0C' },
  heroBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 280 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 8,
    zIndex: 2,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  headBtn: { width: 40, height: 40 },
  headBtnDark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headTitle: { fontSize: 17, color: '#1A0A0C' },
  headTitleDark: { fontSize: 17, color: '#FDE68A' },
  disabledBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
