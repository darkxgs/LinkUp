/**
 * مركز الوكالة — للجميع: انضم / ابحث / إدارة (Elegant Dark Skyline Design)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Search,
  UserPlus,
  Briefcase,
  Mail,
  Crown,
  FileText,
  LogOut,
} from 'lucide-react-native';

import { Text, useAlert } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { ChevronLeft } from '@/components/ui/RtlIcons';
import { useAuth } from '@/hooks/useAuth';
import { isAgencyAgent } from '@/services/firebase/hostTasks';
import { getCachedMyAgency, leaveMyAgency, subscribeToMyAgency } from '@/services/agencyService';
import { spacing } from '@/theme';

// صورة مدينة دبي ليلاً تناسب التصميم
const CITY_SKYLINE_URL = 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1000&auto=format&fit=crop';

export default function AgencyHubScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { showAlert, showActionSheet } = useAlert();
  const [ownsAgency, setOwnsAgency] = useState(() => !!getCachedMyAgency());
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setOwnsAgency(false);
      return;
    }
    return subscribeToMyAgency((agency) => setOwnsAgency(!!agency));
  }, [user?.uid]);

  const isAgent = isAgencyAgent(user) || ownsAgency;
  const isHost = !!user?.agencyId && !isAgent;
  const isAr = i18n.language?.startsWith('ar') === true;
  const textAlign = isAr ? 'right' : 'left';
  const rowDir = 'row';

  const handleLeaveAgency = () => {
    showActionSheet({
      title: isAr ? 'مغادرة الوكالة' : 'Leave agency',
      message: isAr
        ? 'هل تريد مغادرة وكالتك؟ لن تتمكن من العودة دون دعوة جديدة.'
        : 'Leave your agency? You will need a new invite to rejoin.',
      buttons: [
        {
          text: isAr ? 'مغادرة' : 'Leave',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (leaving) return;
              setLeaving(true);
              try {
                await leaveMyAgency();
                await refreshUser?.();
                showAlert({
                  type: 'success',
                  title: t('common.done'),
                  message: isAr ? 'غادرت الوكالة بنجاح' : 'You left the agency',
                });
              } catch (e: any) {
                showAlert({
                  type: 'error',
                  title: t('common.error'),
                  message: e?.message ?? (isAr ? 'تعذرت المغادرة' : 'Could not leave'),
                });
              } finally {
                setLeaving(false);
              }
            })();
          },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ],
    });
  };

  const mainActions = useMemo(() => [
    {
      key: 'join',
      title: t('agencyHub.joinTitle'),
      subtitle: t('agencyHub.joinSubtitle'),
      icon: UserPlus,
      circleColor: 'rgba(225, 20, 20, 0.15)', // Purple glow
      iconColor: '#FCA5A5',
      onPress: () => router.push('/agency/join' as any),
    },
    {
      key: 'search',
      title: t('agencyHub.searchTitle'),
      subtitle: t('agencyHub.searchSubtitle'),
      icon: Search,
      circleColor: 'rgba(225, 20, 20, 0.15)', // Blue glow
      iconColor: '#FCA5A5',
      onPress: () => router.push('/agency/search' as any),
    },
  ], [t, router]);

  const extraActions = useMemo(() => [
    isAgent
      ? {
          key: 'center',
          title: t('profile.agencyCenter'),
          subtitle: t('agencyHub.manageSubtitle'),
          icon: Briefcase,
          circleColor: 'rgba(212, 175, 55, 0.15)', // Gold glow
          iconColor: '#FDE047',
          onPress: () => router.push('/agency/center' as any),
        }
      : null,
    isHost
      ? {
          key: 'invites',
          title: t('profile.agencyInvites'),
          subtitle: t('agencyHub.invitesSubtitle'),
          icon: Mail,
          circleColor: 'rgba(225, 20, 20, 0.15)', // Pink glow
          iconColor: '#FCA5A5',
          onPress: () => router.push('/agency/my-invites' as any),
        }
      : null,
    isHost
      ? {
          key: 'leave',
          title: isAr ? 'مغادرة الوكالة' : 'Leave agency',
          subtitle: isAr ? 'إنهاء عضويتك في الوكالة الحالية' : 'End your membership in the current agency',
          icon: LogOut,
          circleColor: 'rgba(239, 68, 68, 0.18)',
          iconColor: '#FCA5A5',
          onPress: handleLeaveAgency,
        }
      : null,
    !isAgent
      ? {
          key: 'open',
          title: t('agencyApply.openRequest'),
          subtitle: t('agencyHub.openAgencySubtitle'),
          icon: Crown,
          circleColor: 'rgba(212, 175, 55, 0.15)', // Gold glow
          iconColor: '#FDE047',
          onPress: () => router.push('/agency/apply' as any),
        }
      : null,
  ].filter(Boolean) as typeof mainActions, [isAgent, isHost, isAr, t, router, leaving]);

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

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Area */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm, flexDirection: rowDir }]}>
          {/* Back Button */}
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <BackChevron color="rgba(255,255,255,0.7)" size={22} />
          </Pressable>

          {/* Titles */}
          <View style={styles.headerTitles}>
            <Text variant="h1" weight="bold" color="#fff" align={textAlign} style={styles.mainTitle}>
              {isAr ? 'الوكالة' : 'Agency'}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.6)" align={textAlign} style={styles.subTitle}>
              {isAr
                ? 'إدارة متكاملة لدعم الوكالات\nوالوكلاء لتحقيق المزيد من النجاح.'
                : 'Integrated management to support\nagencies and agents to achieve more.'}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Intro Card with Floating Icon */}
          <View style={styles.introCardWrapper}>
            <View style={styles.introCard}>
              <Text variant="bodySmall" color="rgba(255,255,255,0.7)" align="center" style={styles.introText}>
                {isAr
                  ? 'انضم لوكالة قريبة منك أو ابحث بالمعرف\nلتصل لفريق الدعم المناسب.'
                  : 'Join a nearby agency or search by ID\nto reach the right support team.'}
              </Text>
            </View>
            {/* Floating Gold Icon */}
            <View style={styles.floatingIcon}>
              <FileText color="#D4AF37" size={26} strokeWidth={1.5} />
            </View>
          </View>

          {/* Main Actions */}
          <View style={styles.actionsList}>
            {mainActions.map((action) => {
              const Icon = action.icon;
              return (
                <Pressable key={action.key} onPress={action.onPress} style={[styles.actionCard, { flexDirection: rowDir }]}>
                  {/* Directional Chevron */}
                  <ChevronLeft size={20} color="rgba(255,255,255,0.3)" />

                  {/* Middle Texts */}
                  <View style={styles.actionCardTexts}>
                    <Text variant="h4" weight="bold" color="#fff" align={textAlign}>
                      {action.title}
                    </Text>
                    <Text variant="caption" color="rgba(255,255,255,0.5)" align={textAlign} style={{ marginTop: 4 }}>
                      {action.subtitle}
                    </Text>
                  </View>

                  {/* Glowing Icon */}
                  <View style={[styles.iconCircle, { backgroundColor: action.circleColor }]}>
                    <Icon size={26} color={action.iconColor} strokeWidth={1.5} />
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Extra Options Section */}
          {extraActions.length > 0 ? (
            <>
              <Text variant="bodySmall" weight="bold" color="#D4AF37" align={textAlign} style={styles.sectionTitle}>
                {isAr ? 'خيارات إضافية' : 'Extra options'}
              </Text>

              <View style={styles.actionsList}>
                {extraActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Pressable key={action.key} onPress={action.onPress} style={[styles.actionCard, { flexDirection: rowDir }]}>
                      <ChevronLeft size={20} color="rgba(255,255,255,0.3)" />
                      <View style={styles.actionCardTexts}>
                        <Text variant="h4" weight="bold" color="#fff" align={textAlign}>
                          {action.title}
                        </Text>
                        <Text variant="caption" color="rgba(255,255,255,0.5)" align={textAlign} style={{ marginTop: 4 }}>
                          {action.subtitle}
                        </Text>
                      </View>
                      <View style={[styles.iconCircle, { backgroundColor: action.circleColor }]}>
                        <Icon size={26} color={action.iconColor} strokeWidth={1.5} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#140A0C' },
  header: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingTop: 20,
    marginBottom: 80,
    zIndex: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D4AF37',
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
  subTitle: {
    lineHeight: 20,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  introCardWrapper: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  introCard: {
    width: '100%',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)', // Gold outline
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginTop: 30, // Make room for floating icon
  },
  introText: {
    lineHeight: 22,
    marginTop: 10, // To give space below the overlapping icon
  },
  floatingIcon: {
    position: 'absolute',
    top: -5, // Float above the card
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#140A0C',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsList: {
    gap: spacing.md,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  actionCardTexts: {
    flex: 1,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    paddingHorizontal: 8,
  },
});
