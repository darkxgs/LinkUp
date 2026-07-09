/**
 * ابحث عن وكالة — دولتك / القريبة / معرّف الوكالة (Luxurious Redesign)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  FlatList,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Search, Building2, Users, MapPin } from 'lucide-react-native';

import { Text, RealCountryFlag, useAlert } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { useAuth } from '@/hooks/useAuth';
import {
  listAgenciesForUser,
  findAgencyByIdentifier,
  filterAgenciesLocal,
} from '@/services/agencySearch';
import type { Agency } from '@/services/agencyService';
import { getCountryByCode } from '@/data/countries';
import { lu } from '@/theme/lu-brand';
import { spacing, radius } from '@/theme';

const { width } = Dimensions.get('window');
const CITY_SKYLINE_URL = 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1000&auto=format&fit=crop';

export default function AgencySearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { user } = useAuth();

  const userCountry = user?.profile?.country ?? user?.country;
  const [query, setQuery] = useState('');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAgencies(await listAgenciesForUser(userCountry));
    } finally {
      setLoading(false);
    }
  }, [userCountry]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayed = useMemo(
    () => filterAgenciesLocal(agencies, query),
    [agencies, query],
  );

  const handleSearchId = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const found = await findAgencyByIdentifier(q);
      if (!found) {
        showAlert({ type: 'error', title: t('common.error'), message: t('agencyHub.agencyNotFound') });
        return;
      }
      router.push({
        pathname: '/agency/join',
        params: {
          code: found.inviteCode ?? '',
          agencyId: found.id,
          agencyName: found.name,
        },
      } as any);
    } finally {
      setSearching(false);
    }
  };

  const openAgency = useCallback((agency: Agency) => {
    router.push({
      pathname: '/agency/join',
      params: {
        code: agency.inviteCode ?? '',
        agencyId: agency.id,
        agencyName: agency.name,
      },
    } as any);
  }, [router]);

  const renderItem = useCallback(
    ({ item }: { item: Agency }) => (
      <AgencyResultRow item={item} userCountry={userCountry} onPress={openAgency} />
    ),
    [userCountry, openAgency],
  );

  return (
    <View style={[styles.root]}>
      {/* City Skyline Background */}
      <ImageBackground
        source={{ uri: CITY_SKYLINE_URL }}
        style={{ width: '100%', height: 350, position: 'absolute', top: 0 }}
        imageStyle={{ opacity: 0.6 }}
      >
        <LinearGradient
          colors={['rgba(20, 10, 12, 0.1)', 'rgba(20, 10, 12, 0.8)', '#140A0C']}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <BlurView intensity={20} tint="light" style={styles.glassBtn}>
            <BackChevron color="#fff" size={22} />
          </BlurView>
        </Pressable>
        <View style={styles.headerTitles}>
          <Text variant="h2" weight="bold" color="#fff" align="right" style={styles.mainTitle}>
            {t('agencyHub.searchTitle')}
          </Text>
        </View>
      </View>

      {/* Search Input Container */}
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <Pressable onPress={() => void handleSearchId()} disabled={searching} style={styles.searchBtn}>
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <LinearGradient colors={['rgba(225, 20, 20, 0.8)', 'rgba(225, 20, 20, 0.8)']} style={StyleSheet.absoluteFill} />
            )}
            {!searching && <Search size={20} color="#fff" />}
          </Pressable>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('agencyHub.searchPh')}
            placeholderTextColor="rgba(255,255,255,0.4)"
            autoCapitalize="none"
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => void handleSearchId()}
            textAlign="right"
          />
        </View>
        
        <View style={styles.filterHint}>
          <Text variant="caption" color="rgba(255,255,255,0.6)" align="right">
            {userCountry
              ? t('agencyHub.regionHint', { country: getCountryByCode(userCountry)?.name ?? userCountry })
              : t('agencyHub.allAgencies')}
          </Text>
          <MapPin size={14} color="#FCA5A5" style={{ marginLeft: 6 }} />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#FCA5A5" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <View style={{ paddingVertical: 50, alignItems: 'center' }}>
              <Building2 size={48} color="rgba(255,255,255,0.1)" style={{ marginBottom: 16 }} />
              <Text variant="body" color="rgba(255,255,255,0.5)" align="center">
                {t('agencyHub.noAgencies')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const AgencyResultRow = React.memo(function AgencyResultRow({
  item,
  userCountry,
  onPress,
}: {
  item: Agency;
  userCountry?: string;
  onPress: (agency: Agency) => void;
}) {
  const { t } = useTranslation();
  const countryName = getCountryByCode(item.country ?? '')?.name ?? item.country ?? '—';
  const isLocal = !!userCountry && item.country?.toUpperCase() === userCountry.toUpperCase();

  return (
    <Pressable onPress={() => onPress(item)} style={styles.card}>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <View style={styles.nameRow}>
          {isLocal ? (
            <View style={styles.localBadge}>
              <Text variant="caption" weight="bold" color="#6EE7B7" style={{ fontSize: 10 }}>
                {t('agencyHub.nearYou')}
              </Text>
            </View>
          ) : null}
          <Text variant="body" weight="bold" color="#fff" numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
            {item.name}
          </Text>
        </View>
        
        <View style={styles.metaRow}>
          <Text variant="caption" color="rgba(255,255,255,0.55)">
            {item.memberCount ?? 0}
          </Text>
          <Users size={12} color="rgba(255,255,255,0.45)" />
          <Text variant="caption" color="rgba(255,255,255,0.55)" numberOfLines={1}>
            {countryName}
          </Text>
          <RealCountryFlag countryCode={item.country ?? ''} size={14} shape="circle" />
        </View>
        <Text variant="caption" color="rgba(255,255,255,0.4)" numberOfLines={1} style={{ marginTop: 6 }}>
          ID: {item.id}
        </Text>
      </View>

      <View style={styles.cardAvatar}>
        {item.ownerAvatar ? (
          <Image
            source={{ uri: item.ownerAvatar }}
            style={styles.avatarImg}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={item.id}
          />
        ) : (
          <Building2 size={24} color="#FCA5A5" />
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#140A0C' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingTop: 20,
    zIndex: 10,
    marginBottom: spacing.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
  },
  glassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTitles: {
    flex: 1,
  },
  mainTitle: {
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  searchContainer: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
    zIndex: 5,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    height: 54,
    paddingLeft: 4,
  },
  searchInput: { 
    flex: 1, 
    color: '#fff', 
    fontSize: 15, 
    paddingHorizontal: 16,
    height: '100%',
  },
  searchBtn: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  filterHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(225, 20, 20,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarImg: { width: '100%', height: '100%' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', width: '100%' },
  localBadge: {
    backgroundColor: 'rgba(54,224,122,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(54,224,122,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, justifyContent: 'flex-end', width: '100%' },
});
