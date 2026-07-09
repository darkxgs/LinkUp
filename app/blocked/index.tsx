/**
 * LinkUp App — قائمة المحظورين (Firestore)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ban, UserX, Shield, Info, Search } from 'lucide-react-native';

import { Text, Card, BackButton, RealCountryFlag } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import {
  subscribeBlockedEntries,
  enrichBlockedUsers,
  unblockUser,
  type BlockedUserView,
} from '@/services/firebase/blocks';
import { colors, radius, spacing, shadows } from '@/theme';

function formatBlockedDate(ts: number, locale: string): string {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleDateString();
  }
}

export default function BlockedScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [blocked, setBlocked] = useState<BlockedUserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!user) {
      setBlocked([]);
      setLoading(false);
      return;
    }

    let enrichGen = 0;
    const unsub = subscribeBlockedEntries((entries) => {
      const gen = ++enrichGen;
      void enrichBlockedUsers(entries).then((list) => {
        if (gen === enrichGen) {
          setBlocked(list);
          setLoading(false);
        }
      });
    });

    return unsub;
  }, [user?.uid]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return blocked;
    return blocked.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q),
    );
  }, [blocked, search]);

  const handleUnblock = (item: BlockedUserView) => {
    Alert.alert(
      t('chat.unblockUser'),
      t('blocked.unblockConfirm', { name: item.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chat.unblockUser'),
          onPress: async () => {
            try {
              await unblockUser(item.uid);
              Alert.alert(
                t('roomSettings.text14103'),
                t('blocked.unblockSuccess', { name: item.name }),
              );
            } catch {
              Alert.alert(t('common.error'), t('blocked.unblockFailed'));
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FECACA', '#F89A9A']}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        <View style={styles.headerRow}>
          <BackButton />
          <View style={styles.titleRow}>
            <Ban size={20} color="#EF4444" strokeWidth={2.5} />
            <Text variant="h2" weight="bold">{t('blocked.text76001')}</Text>
          </View>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setShowSearch((v) => !v)}
          >
            <Search size={20} color="#1A0A0C" strokeWidth={2.5} />
          </Pressable>
        </View>
        {showSearch && (
          <TextInput
            style={styles.searchInput}
            placeholder={t('common.search')}
            placeholderTextColor={colors.text.tertiary}
            value={search}
            onChangeText={setSearch}
          />
        )}
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <View style={styles.infoIconBg}>
            <Shield size={20} color="#E11414" strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodySmall" weight="semibold" color="#8A0E0E">
              {t('blocked.text26573')}
            </Text>
            <Text variant="caption" color="#E11414">
              {t('blocked.text73716')}
            </Text>
          </View>
        </View>

        <View style={styles.countRow}>
          <Text variant="bodySmall" weight="semibold">
            {t('blocked.countPeople', { count: blocked.length })}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#E11414"
            style={{ marginTop: spacing['3xl'] }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState hasAny={blocked.length > 0} />
        ) : (
          filtered.map((item) => (
            <Card key={item.uid} variant="elevated" style={styles.userCard}>
              <Pressable
                onPress={() => router.push(`/profile/${item.uid}` as any)}
                style={styles.userRow}
              >
                <View style={styles.avatarWrapper}>
                  {item.avatar ? (
                    <Image
                      source={{ uri: item.avatar }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text variant="h4" weight="bold" color={colors.text.tertiary}>
                        {item.name.charAt(0)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.blockedOverlay}>
                    <Ban size={20} color={colors.white} strokeWidth={3} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text variant="body" weight="semibold">{item.name}</Text>
                    <RealCountryFlag countryCode={item.country} size={14} />
                  </View>
                  <Text variant="caption" color={colors.text.secondary}>
                    {t('blocked.blockedSince', {
                      date: formatBlockedDate(item.blockedAt, i18n.language),
                    })}
                  </Text>
                  {item.reason ? (
                    <View style={styles.reasonChip}>
                      <Info size={10} color="#EF4444" />
                      <Text
                        variant="caption"
                        color="#EF4444"
                        weight="medium"
                        style={{ fontSize: 11 }}
                      >
                        {item.reason}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleUnblock(item);
                  }}
                  style={styles.unblockBtn}
                >
                  <Text variant="caption" color="#E11414" weight="bold">
                    {t('chat.unblockUser')}
                  </Text>
                </Pressable>
              </Pressable>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <UserX size={56} color="#E11414" strokeWidth={1.5} />
      </View>
      <Text variant="h3" weight="semibold" align="center" style={{ marginTop: spacing.lg }}>
        {hasAny ? t('blocked.noSearchResults') : t('blocked.text65764')}
      </Text>
      <Text
        variant="body"
        color={colors.text.secondary}
        align="center"
        style={{ marginTop: spacing.sm }}
      >
        {hasAny ? t('blocked.tryOtherSearch') : t('blocked.text84572')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCFAFA' },
  header: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  searchInput: {
    marginTop: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text.primary,
    ...shadows.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  infoCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.base,
    backgroundColor: '#FEE2E2',
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  infoIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(225, 20, 20, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countRow: { marginBottom: spacing.sm },
  userCard: { padding: spacing.base, marginBottom: spacing.sm },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarWrapper: { position: 'relative' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FBEAEA',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(239, 68, 68, 0.6)',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#FEE2E2',
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  unblockBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: radius.full,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
  },
  emptyIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
