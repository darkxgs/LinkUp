/**
 * LinkUp App — الوكالات (Firebase)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { IMG } from '@/utils/imageConfig';
import {
  Building2,
  Users,
  Crown,
  Coins,
  TrendingUp,
  Star,
  Plus,
  Trophy,
  Shield,
  Briefcase,
  X,
  KeyRound,
  Headphones,
  Settings2,
} from 'lucide-react-native';

import { Text, Card, BackButton, RealCountryFlag } from '@/components/ui';
import { getAgencies, seedDemoAgencies, Agency } from '@/services/firebase/social';
import {
  acceptAgencyInviteByCode,
  subscribeToMyAgency,
  type Agency as MyAgency,
} from '@/services/agencyService';
import { enterAgencyRoomAndNavigate } from '@/utils/navigateToRoom';
import { useAuth } from '@/hooks/useAuth';
import { colors, radius, spacing, shadows } from '@/theme';
import { lu } from '@/theme/lu-brand';

const RANK_BADGE_COLORS: Record<number, [string, string]> = {
  1: ['#FCD34D', '#F59E0B'],
  2: ['#94A3B8', '#64748B'],
  3: ['#CD7F32', '#92400E'],
};

export default function AgenciesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { user, isAuthenticated } = useAuth();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [myAgency, setMyAgency] = useState<MyAgency | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [enteringId, setEnteringId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.uid) {
      setAgencies([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const load = async () => {
      try {
        // ⚡ زرع تجريبي للتطوير فقط — كان يحجب جلب الوكالات بقراءة مهدورة في الإنتاج
        if (__DEV__) await seedDemoAgencies();
        const data = await getAgencies();
        setAgencies(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAuthenticated, user?.uid]);

  useEffect(() => {
    if (!isAuthenticated) {
      setMyAgency(null);
      return;
    }
    const unsub = subscribeToMyAgency(setMyAgency);
    return () => unsub?.();
  }, [isAuthenticated]);

  const totalMembers = agencies.reduce((sum, a) => sum + a.members, 0);
  const totalEarnings = agencies.reduce((sum, a) => sum + a.earnings, 0);

  const isMyAgency = useCallback((agency: Agency) =>
    myAgency?.id === agency.id || (!!user?.uid && agency.ownerUid === user.uid),
  [myAgency?.id, user?.uid]);

  const openAgencyRoom = useCallback(async (agencyId: string) => {
    if (!isAuthenticated) {
      Alert.alert(t('rooms.loginRequired'), t('agencyApply.loginToEnter'));
      return;
    }
    setEnteringId(agencyId);
    try {
      await enterAgencyRoomAndNavigate(router, agencyId);
    } catch (e: any) {
      Alert.alert(t('room.actionFailed'), e?.message ?? t('common.error'));
    } finally {
      setEnteringId(null);
    }
  }, [isAuthenticated, router, t]);

  const goToCenter = useCallback(() => {
    router.push('/agency/center' as any);
  }, [router]);

  const openJoinModal = useCallback(() => {
    setShowJoinModal(true);
  }, []);

  const renderAgency = useCallback(({ item }: { item: Agency }) => (
    <View style={styles.agencyItemWrap}>
      <AgencyCard
        agency={item}
        isMine={isMyAgency(item)}
        entering={enteringId === item.id}
        onEnter={openAgencyRoom}
        onManage={goToCenter}
        onJoin={openJoinModal}
      />
    </View>
  ), [isMyAgency, enteringId, openAgencyRoom, goToCenter, openJoinModal]);

  const handleJoinByCode = async () => {
    const code = joinCode.trim();
    if (!code) return;
    setJoining(true);
    try {
      const result = await acceptAgencyInviteByCode(code);
      setShowJoinModal(false);
      setJoinCode('');

      if (result.needsGenderVerification) {
        Alert.alert(
          t('agency.text451502'),
          t('agency.joinedNeedsVerification', { name: result.agencyName }),
          [
            { text: t('roomSettings.text80678'), onPress: () => router.push('/agency/center' as any) },
            { text: 'توثيق الحساب', onPress: () => router.push('/wallet/kyc' as any) },
          ],
        );
      } else {
        Alert.alert(
          t('agency.text451502'),
          t('agency.joinedAgency', { name: result.agencyName }),
          [{ text: t('roomSettings.text80678'), onPress: () => router.push('/agency/center' as any) }],
        );
      }
    } catch (e: any) {
      Alert.alert(t('room.actionFailed'), e?.message ?? t('agency.text6416'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#E11414', '#B00E0E', '#8A0E0E']}
        style={styles.headerBg}
      />

      <FlatList
        data={loading ? [] : agencies}
        keyExtractor={(a) => a.id}
        renderItem={renderAgency}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + spacing.xl },
        ]}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={loading ? (
          <View style={[styles.empty, styles.whiteSectionFlat]}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
          </View>
        ) : null}
        ListHeaderComponent={
          <>
        <View style={styles.header}>
          <BackButton color={colors.white} bg="rgba(0,0,0,0.3)" />
          <View style={styles.titleRow}>
            <Building2 size={20} color="#FCD34D" strokeWidth={2.5} />
            <Text variant="h3" weight="bold" color={colors.white}>
              {t('agency.text91962')}
            </Text>
          </View>
          <Pressable onPress={() => setShowJoinModal(true)} style={styles.iconBtn}>
            <KeyRound size={20} color={colors.white} strokeWidth={2.5} />
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsBanner}>
          <View style={styles.statItem}>
            <Users size={20} color="#FCD34D" strokeWidth={2.5} />
            <Text variant="h3" weight="bold" color={colors.white}>{agencies.length}</Text>
            <Text variant="caption" color="rgba(255,255,255,0.85)">{t('agency.text5559')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Users size={20} color="#FCD34D" strokeWidth={2.5} />
            <Text variant="h3" weight="bold" color={colors.white}>
              {totalMembers >= 1000 ? `${(totalMembers / 1000).toFixed(1)}ك` : totalMembers}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.85)">{t('agency.text48696')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Coins size={20} color="#FCD34D" strokeWidth={2.5} />
            <Text variant="h3" weight="bold" color={colors.white}>
              {(totalEarnings / 1_000_000).toFixed(0)}م
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.85)">{t('games.text10704')}</Text>
          </View>
        </View>

        {/* White section */}
        <View style={styles.whiteSection}>
          <Text variant="caption" color={colors.text.secondary} style={styles.adminHint}>
            {t('agencyApply.adminOnlyHint')}
          </Text>

          {isAuthenticated && (
            <Pressable
              onPress={() => router.push('/agency/my-invites' as any)}
              style={styles.myInvitesBtn}
            >
              <Text variant="caption" color={lu.colors.purple} weight="bold">
                {t('agency.myInvites')}
              </Text>
            </Pressable>
          )}

          {myAgency && (
            <Pressable
              style={styles.myAgencyCard}
              onPress={() => router.push('/agency/center' as any)}
            >
              <LinearGradient
                colors={lu.gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.myAgencyIcon}>
                <Building2 size={22} color={lu.colors.purple} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="bold" color="#fff">
                  {t('agencyApply.myAgencyTitle')}: {myAgency.name}
                </Text>
                <Text variant="caption" color="rgba(255,255,255,0.9)">
                  {t('agencyApply.myAgencySubtitle')}
                </Text>
              </View>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  router.push('/agency/center' as any);
                }}
                hitSlop={8}
                style={styles.myAgencyManage}
              >
                <Settings2 size={18} color="#fff" strokeWidth={2.2} />
              </Pressable>
            </Pressable>
          )}

          <View style={styles.sectionTitle}>
            <Trophy size={18} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
            <Text variant="h3" weight="bold">
              {t('agency.text8097')}
            </Text>
          </View>
            </View>
          </>
        }
        ListFooterComponent={
          <View style={styles.agencyItemWrap}>
          <Pressable
            style={styles.createAgencyBtn}
            onPress={() => {
              if (myAgency) {
                router.push('/agency/center' as any);
              } else {
                router.push('/agency/apply' as any);
              }
            }}
          >
            <View style={styles.createAgencyIcon}>
              {myAgency ? (
                <Building2 size={26} color="#E11414" strokeWidth={2.5} />
              ) : (
                <Plus size={28} color="#E11414" strokeWidth={2.5} />
              )}
            </View>
            <View style={{ flex: 1, marginStart: spacing.sm }}>
              <Text variant="body" weight="bold">
                {myAgency ? t('agencyApply.myAgencyTitle') : t('agency.text92093')}
              </Text>
              <Text variant="caption" color={colors.text.secondary}>
                {myAgency ? t('agencyApply.myAgencySubtitle') : t('agency.text81514')}
              </Text>
            </View>
          </Pressable>
          </View>
        }
      />

      {/* Modal: الانضمام بكود */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <Pressable style={modalStyles.bg} onPress={() => setShowJoinModal(false)}>
          <Pressable style={modalStyles.card} onPress={(e) => e.stopPropagation()}>
            <View style={{ alignItems: 'flex-end' }}>
              <Pressable onPress={() => setShowJoinModal(false)}>
                <X size={20} color="#9CA3AF" />
              </Pressable>
            </View>

            <View style={modalStyles.iconWrap}>
              <KeyRound size={26} color={lu.colors.pink} />
            </View>

            <Text variant="h3" weight="bold" align="center" style={{ marginTop: 12 }}>
              {t('agency.text77208')}
            </Text>
            <Text variant="caption" color="#6B7280" align="center" style={{ marginTop: 6 }}>
              {t('agency.text82575')}
            </Text>

            <TextInput
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder={t('agency.text81246')}
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              style={modalStyles.input}
            />

            <Pressable
              onPress={handleJoinByCode}
              disabled={!joinCode.trim() || joining}
              style={[modalStyles.submit, (!joinCode.trim() || joining) && { opacity: 0.5 }]}
            >
              <LinearGradient
                colors={[lu.colors.pink, lu.colors.purple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {joining ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text variant="button" color="#fff" weight="bold">
                  {t('rooms.joinNow')}
                </Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

type AgencyCardProps = {
  agency: Agency;
  isMine: boolean;
  entering: boolean;
  onEnter: (agencyId: string) => void;
  onManage: () => void;
  onJoin: () => void;
};

const AgencyCard = React.memo(function AgencyCard({
  agency,
  isMine,
  entering,
  onEnter,
  onManage,
  onJoin,
}: AgencyCardProps) {
  const { t } = useTranslation();
  return (
    <Card variant="elevated" style={styles.agencyCard}>
      <View style={styles.bannerWrapper}>
        <Image
          source={{ uri: agency.banner }}
          style={styles.banner}
          contentFit="cover"
          recyclingKey={agency.id}
          {...IMG}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={StyleSheet.absoluteFill}
        />
        {agency.rank <= 3 && (
          <View style={styles.rankBadgeWrap}>
            <LinearGradient
              colors={RANK_BADGE_COLORS[agency.rank]!}
              style={styles.rankBadge}
            >
              <Crown size={12} color={colors.white} fill={colors.white} strokeWidth={0} />
              <Text variant="caption" color={colors.white} weight="bold">
                #{agency.rank}
              </Text>
            </LinearGradient>
          </View>
        )}
        {agency.isHiring && (
          <View style={styles.hiringBadge}>
            <View style={styles.hiringDot} />
            <Text variant="caption" color={colors.white} weight="bold" style={{ fontSize: 10 }}>
              {t('agency.text62963')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.agencyBody}>
        <View style={styles.agencyTypePill}>
          <Building2 size={12} color="#E11414" strokeWidth={2.2} />
          <Text variant="caption" color="#E11414" weight="bold" style={{ fontSize: 10 }}>
            {t('rooms.badgeAgency')}
          </Text>
        </View>
        <View style={styles.agencyHeader}>
          <Image
            source={{ uri: agency.logo }}
            style={styles.agencyLogo}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={agency.id}
            transition={120}
          />
          <View style={{ flex: 1 }}>
            <View style={styles.agencyNameRow}>
              <Text variant="h4" weight="bold" numberOfLines={1}>
                {agency.name}
              </Text>
              {agency.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Shield size={10} color={colors.white} fill={colors.white} strokeWidth={0} />
                </View>
              )}
            </View>
            <View style={styles.agencyMeta}>
              <Briefcase size={11} color={colors.text.tertiary} />
              <Text variant="caption" color={colors.text.secondary}>
                {agency.ownerName}
              </Text>
              <RealCountryFlag countryCode={agency.country} size={14} />
            </View>
          </View>
          <View style={styles.ratingChip}>
            <Star size={12} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
            <Text variant="caption" weight="bold" color="#F59E0B">
              {agency.rating}
            </Text>
          </View>
        </View>

        <Text variant="caption" color={colors.text.secondary} style={{ marginTop: spacing.sm }} numberOfLines={2}>
          {agency.description}
        </Text>

        <View style={styles.agencyStats}>
          <View style={styles.agencyStat}>
            <Users size={14} color="#E11414" />
            <Text variant="caption" color={colors.text.secondary}>
              {t('agency.centerMembers', { count: agency.members })}
            </Text>
          </View>
          <View style={styles.agencyStat}>
            <Coins size={14} color="#F59E0B" />
            <Text variant="caption" color={colors.text.secondary}>
              {(agency.earnings / 1_000_000).toFixed(1)}م
            </Text>
          </View>
          <View style={styles.agencyStat}>
            <TrendingUp size={14} color="#10B981" />
            <Text variant="caption" color="#10B981" weight="semibold">
              {t('agency.text72129')}
            </Text>
          </View>
        </View>

        {isMine ? (
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => onEnter(agency.id)}
              disabled={entering}
              style={[styles.joinBtn, styles.joinBtnFlex]}
            >
              <LinearGradient
                colors={lu.gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {entering ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Headphones size={16} color={colors.white} strokeWidth={2.5} />
                  <Text variant="bodySmall" color={colors.white} weight="bold">
                    {t('agencyApply.enterListen')}
                  </Text>
                </>
              )}
            </Pressable>
            <Pressable onPress={onManage} style={styles.manageBtn}>
              <Settings2 size={16} color={lu.colors.purple} strokeWidth={2.2} />
              <Text variant="caption" color={lu.colors.purple} weight="bold">
                {t('agencyApply.manageAgency')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={onJoin} style={styles.joinBtn}>
            <LinearGradient
              colors={['#FCA5A5', '#E11414']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <KeyRound size={16} color={colors.white} strokeWidth={2.5} />
            <Text variant="bodySmall" color={colors.white} weight="bold">
              {t('agency.text48836')}
            </Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
});

const modalStyles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFE6E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  input: {
    height: 52,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    letterSpacing: 2,
    marginTop: 20,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
  },
  submit: {
    marginTop: 14,
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCFAFA' },
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
  },
  scrollContent: {},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    marginHorizontal: spacing.base,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  whiteSection: {
    backgroundColor: '#FCFAFA',
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.base,
  },
  adminHint: {
    marginBottom: spacing.sm,
    lineHeight: 18,
    textAlign: 'center',
  },
  myInvitesBtn: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: '#FEE2E2',
    borderRadius: 99,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  empty: { paddingVertical: spacing['4xl'], alignItems: 'center' },
  whiteSectionFlat: { paddingHorizontal: spacing.base },
  agencyItemWrap: { paddingHorizontal: spacing.base },

  agencyCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.base,
  },
  bannerWrapper: { height: 120, position: 'relative' },
  banner: { width: '100%', height: '100%' },
  rankBadgeWrap: { position: 'absolute', top: 12, right: 12 },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  hiringBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#10B981',
    borderRadius: radius.full,
  },
  hiringDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  agencyBody: { padding: spacing.base },
  agencyTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(225, 20, 20,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    marginBottom: 8,
  },
  agencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  agencyLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FBEAEA',
    borderWidth: 2,
    borderColor: colors.white,
    marginTop: -32,
  },
  agencyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E11414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agencyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: radius.full,
  },
  agencyStats: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: '#FBEAEA',
  },
  agencyStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: spacing.sm,
    ...shadows.purpleGlow,
  },
  joinBtnFlex: {
    flex: 1,
    marginTop: 0,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: lu.colors.card2,
    borderWidth: 1,
    borderColor: lu.colors.line,
  },
  myAgencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  myAgencyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myAgencyManage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  createAgencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    backgroundColor: '#FEE2E2',
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: '#E11414',
    borderStyle: 'dashed',
  },
  createAgencyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
