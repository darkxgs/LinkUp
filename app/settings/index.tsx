/**
 * LinkUp App — Settings Screen
 */

import React from 'react';
import { View, StyleSheet, ScrollView, Pressable, Switch, Alert, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Bell, Lock, Globe, Eye, ShieldAlert, HelpCircle, FileText, Star, LogOut, Heart, Gift, Megaphone, Phone, Languages, Smartphone, MapPin, Moon } from 'lucide-react-native';
import { ChevronLeft, ChevronRight } from '@/components/ui/RtlIcons';

import { Text, Card } from '@/components/ui';
import { BackChevron } from '@/components/ui/RtlChevron';
import { LanguagePickerSheet } from '@/components/localization/LanguagePickerSheet';
import { resolveUnauthenticatedEntryRoute } from '@/services/onboardingStorage';
import { useAuth } from '@/hooks/useAuth';
import { useAppLanguage } from '@/localization/useAppLanguage';
import { colors, radius, spacing, shadows } from '@/theme';
import {
  subscribeNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '@/services/firebase/notificationSettings';
import { setPushNotificationsEnabled } from '@/services/firebase/pushNotifications';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { firestore } from '@/services/firebase';
import { getDisplayAccountId } from '@/services/userIdentifier';
import { resolveUserDocAvatar } from '@/utils/userAvatar';
import { useThemeMode } from '@/stores/themeStore';

// وضع داكن محلي لهذه الشاشة فقط — يُمرَّر للصفوف عبر Context دون لمس شاشات أخرى
const SettingsDarkContext = React.createContext(false);

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut, user } = useAuth();
  const { t, lang } = useAppLanguage();
  const [showLangSheet, setShowLangSheet] = React.useState(false);
  const { isDark, setMode } = useThemeMode();

  const [notifSettings, setNotifSettings] = React.useState<NotificationSettings | null>(null);
  const [hideOnline, setHideOnline] = React.useState(false);
  const [hideVisitors, setHideVisitors] = React.useState(false);
  const [hideLocation, setHideLocation] = React.useState(false);
  const [profileAvatar, setProfileAvatar] = React.useState('');
  const profileAccountId = React.useMemo(
    () => getDisplayAccountId(user?.publicAccountId, user?.uid ?? ''),
    [user?.publicAccountId, user?.uid],
  );

  const avatarUri = React.useMemo(
    () =>
      profileAvatar
      || resolveUserDocAvatar(
        {
          avatar: user?.profile?.avatar,
          profile: user?.profile,
          photos: user?.profile?.photos,
          gender: user?.profile?.gender,
        },
        user?.uid,
      ),
    [profileAvatar, user?.uid, user?.profile],
  );

  React.useEffect(() => {
    if (!user?.uid) return;
    return subscribeNotificationSettings(user.uid, setNotifSettings);
  }, [user?.uid]);

  React.useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(firestore, 'users', user.uid)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setProfileAvatar(resolveUserDocAvatar(data as Record<string, unknown>, user.uid));
      if (typeof data.privacyHideVisitors === 'boolean') {
        setHideVisitors(data.privacyHideVisitors);
      }
      if (typeof data.privacyHideOnline === 'boolean') {
        setHideOnline(data.privacyHideOnline);
      }
      if (typeof data.privacyHideLocation === 'boolean') {
        setHideLocation(data.privacyHideLocation);
      }
    }).catch(() => {});
  }, [user?.uid]);

  const patchPrivacy = async (patch: { privacyHideVisitors?: boolean; privacyHideOnline?: boolean; privacyHideLocation?: boolean }) => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        ...patch,
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.warn('patchPrivacy:', e);
    }
  };

  const patchNotif = async (patch: Partial<NotificationSettings>) => {
    if (!user?.uid) return;
    setNotifSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    try {
      await updateNotificationSettings(user.uid, patch);
      if (typeof patch.pushEnabled === 'boolean') {
        await setPushNotificationsEnabled(user.uid, patch.pushEnabled);
      }
    } catch {
      // revert on failure
      subscribeNotificationSettings(user.uid, setNotifSettings);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('settings.logout'), t('auth.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          const route = await resolveUnauthenticatedEntryRoute();
          router.replace(route as any);
        },
      },
    ]);
  };

  const handleLanguageChange = () => {
    setShowLangSheet(true);
  };

  // «تقييم التطبيق» — يفتح صفحة التطبيق على Google Play (market:// ثم الويب كاحتياط)
  const handleRateApp = async () => {
    const androidPackage = 'com.linkup.app';
    const webUrl = `https://play.google.com/store/apps/details?id=${androidPackage}`;
    try {
      if (Platform.OS === 'android') {
        await Linking.openURL(`market://details?id=${androidPackage}`);
        return;
      }
      await Linking.openURL(webUrl);
    } catch {
      try {
        await Linking.openURL(webUrl);
      } catch {
        Alert.alert(t('settings.rateApp'), 'قريباً — التقييم يتفعّل بعد نشر التطبيق على المتجر');
      }
    }
  };

  // ألوان مشتقة من الوضع الداكن (محصورة بهذه الشاشة)
  const c = {
    bg: isDark ? '#0E0E12' : '#F7F7F9',
    card: isDark ? '#1C1C22' : '#FFFFFF',
    text: isDark ? '#F5F5F7' : '#15151A',
    text2: isDark ? '#9CA3AF' : '#6B7280',
  };

  return (
    <SettingsDarkContext.Provider value={isDark}>
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <LinearGradient
        colors={['rgba(225, 20, 20, 0.1)', 'rgba(249, 250, 252, 0)']}
        style={styles.headerBg}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + spacing['3xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backButton, isDark && { backgroundColor: '#1C1C22', borderColor: '#2A2A32' }]}
          >
            <BackChevron size={24} color={isDark ? '#F5F5F7' : '#1A0A0C'} strokeWidth={2.5} />
          </Pressable>
          <Text variant="h2" weight="bold" color={c.text} style={{ lineHeight: 36, paddingTop: 4 }}>
            {t('settings.title')}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Account info */}
        <Pressable onPress={() => router.push('/profile/edit' as any)}>
          <View style={[styles.vipCard, { backgroundColor: c.card }]}>
            <View style={styles.accountRow}>
              <View style={styles.accountIconWrapper}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    recyclingKey={avatarUri}
                  />
                ) : (
                  <>
                    <LinearGradient
                      colors={['#FF2D2D', '#B00E0E']}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text variant="h2" weight="bold" color="#FFF" style={{ lineHeight: 32, paddingTop: 4 }}>
                      {user?.profile.displayName?.[0]?.toUpperCase() ?? 'U'}
                    </Text>
                  </>
                )}
              </View>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text variant="h3" weight="bold" color={c.text} style={{ lineHeight: 32 }}>
                  {user?.profile.displayName ?? t('settings.account')}
                </Text>
                <Text variant="body" color={c.text2} style={{ marginTop: 2 }}>
                  ID: {profileAccountId}
                </Text>
              </View>
              <View style={[styles.vipChevronWrap, isDark && { backgroundColor: '#2A2A32' }]}>
                <ChevronRight size={22} color="#9CA3AF" />
              </View>
            </View>
          </View>
        </Pressable>

        {/* Notifications */}
        <SectionTitle>{t('settings.notifications')}</SectionTitle>
        <View style={styles.sectionCard}>
          <ToggleRow
            icon={Smartphone}
            iconColor="#6366F1"
            label={t('settings.notifPushBackground')}
            value={notifSettings?.pushEnabled ?? true}
            onValueChange={(v) => patchNotif({ pushEnabled: v })}
          />
          <Divider />
          <ToggleRow
            icon={Bell}
            iconColor="#E11414"
            label={t('settings.notifMaster')}
            value={notifSettings?.enabled ?? true}
            onValueChange={(v) => patchNotif({ enabled: v })}
          />
          <Divider />
          <ToggleRow
            icon={Bell}
            iconColor="#B00E0E"
            label={t('settings.notifMessages')}
            value={notifSettings?.messages ?? true}
            disabled={notifSettings?.enabled === false}
            onValueChange={(v) => patchNotif({ messages: v })}
          />
          <Divider />
          <ToggleRow
            icon={Phone}
            iconColor="#10B981"
            label={t('settings.notifCalls')}
            value={notifSettings?.calls ?? true}
            disabled={notifSettings?.enabled === false}
            onValueChange={(v) => patchNotif({ calls: v })}
          />
          <Divider />
          <ToggleRow
            icon={Heart}
            iconColor="#FF3340"
            label={t('settings.notifSocial')}
            value={notifSettings?.social ?? true}
            disabled={notifSettings?.enabled === false}
            onValueChange={(v) => patchNotif({ social: v })}
          />
          <Divider />
          <ToggleRow
            icon={Gift}
            iconColor="#F59E0B"
            label={t('settings.notifGifts')}
            value={notifSettings?.gifts ?? true}
            disabled={notifSettings?.enabled === false}
            onValueChange={(v) => patchNotif({ gifts: v })}
          />
          <Divider />
          <ToggleRow
            icon={Megaphone}
            iconColor="#10B981"
            label={t('settings.notifPromotions')}
            value={notifSettings?.promotions ?? true}
            disabled={notifSettings?.enabled === false}
            onValueChange={(v) => patchNotif({ promotions: v })}
          />
        </View>

        {/* Privacy */}
        <SectionTitle>{t('settings.privacy')}</SectionTitle>
        <View style={styles.sectionCard}>
          <ToggleRow
            icon={Eye}
            iconColor="#ED4444"
            label={t('settings.showOnlineStatus')}
            value={!hideOnline}
            onValueChange={(v) => {
              setHideOnline(!v);
              void patchPrivacy({ privacyHideOnline: !v });
            }}
          />
          <Divider />
          <ToggleRow
            icon={ShieldAlert}
            iconColor="#10B981"
            label={t('settings.hideVisitors')}
            value={hideVisitors}
            onValueChange={(v) => {
              setHideVisitors(v);
              void patchPrivacy({ privacyHideVisitors: v });
            }}
          />
          <Divider />
          <ToggleRow
            icon={MapPin}
            iconColor="#3B82F6"
            label={t('settings.hideLocation')}
            value={hideLocation}
            onValueChange={(v) => {
              setHideLocation(v);
              void patchPrivacy({ privacyHideLocation: v });
            }}
          />
          <Divider />
          <NavRow
            icon={Lock}
            iconColor="#EF4444"
            label={t('settings.blockedUsers')}
            onPress={() => router.push('/blocked' as any)}
          />
        </View>

        {/* Preferences */}
        <SectionTitle>{t('settings.preferences')}</SectionTitle>
        <View style={styles.sectionCard}>
          <ToggleRow
            icon={Moon}
            iconColor="#7C3AED"
            label={t('settings.darkMode')}
            value={isDark}
            onValueChange={(v) => setMode(v ? 'dark' : 'light')}
          />
          <Divider />
          <NavRow
            icon={Languages}
            iconColor="#F59E0B"
            label={t('settings.language')}
            value={lang === 'ar' ? t('settings.languageArabic') : t('settings.languageEnglish')}
            onPress={handleLanguageChange}
          />
        </View>

        {/* About & Support */}
        <SectionTitle>{t('settings.help')}</SectionTitle>
        <View style={styles.sectionCard}>
          <NavRow
            icon={HelpCircle}
            iconColor="#E11414"
            label={t('settings.help')}
            onPress={() => router.push('/support' as any)}
          />
          <Divider />
          <NavRow
            icon={FileText}
            iconColor="#ED4444"
            label={t('settings.termsOfService')}
            onPress={() => router.push('/about/terms' as any)}
          />
          <Divider />
          <NavRow
            icon={FileText}
            iconColor="#10B981"
            label={t('settings.privacyPolicy')}
            onPress={() => router.push('/about/privacy' as any)}
          />
          <Divider />
          <NavRow
            icon={FileText}
            iconColor="#B00E0E"
            label={t('settings.about')}
            onPress={() => router.push('/about' as any)}
          />
          <Divider />
          <NavRow
            icon={Star}
            iconColor="#F59E0B"
            label={t('settings.rateApp')}
            onPress={() => void handleRateApp()}
          />
        </View>

        {/* Account */}
        <SectionTitle>{t('settings.account')}</SectionTitle>
        <View style={styles.sectionCard}>
          <NavRow
            icon={Lock}
            iconColor="#E11414"
            label={t('settings.accountSecurity')}
            onPress={() => router.push('/settings/security' as any)}
          />
          <Divider />
          <Pressable style={[styles.row, { backgroundColor: c.card }]} onPress={handleSignOut}>
            <View style={[styles.iconWrapper, { backgroundColor: '#FEF3C7' }]}>
              <LogOut size={20} color="#F59E0B" />
            </View>
            <Text variant="body" color={c.text} style={{ flex: 1, marginStart: spacing.md }}>
              {t('settings.logout')}
            </Text>
            <ChevronRight size={18} color={colors.text.tertiary} />
          </Pressable>
        </View>

        {/* Version */}
        <Text
          variant="caption"
          color={colors.text.tertiary}
          align="center"
          style={{ marginTop: spacing.xl }}
        >
          LinkUp v1.0.0
        </Text>
      </ScrollView>

      <LanguagePickerSheet visible={showLangSheet} onClose={() => setShowLangSheet(false)} />
    </View>
    </SettingsDarkContext.Provider>
  );
}

// ============ Section components ============
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text
    variant="body"
    weight="bold"
    color="#9CA3AF"
    style={{ marginTop: 28, marginBottom: 12, paddingHorizontal: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}
  >
    {children}
  </Text>
);

const ToggleRow: React.FC<{
  icon: any;
  iconColor: string;
  label: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (v: boolean) => void;
}> = ({ icon: Icon, iconColor, label, value, disabled, onValueChange }) => {
  const isDark = React.useContext(SettingsDarkContext);
  return (
  <View style={[styles.row, { backgroundColor: isDark ? '#1C1C22' : '#FFFFFF' }, disabled && { opacity: 0.45 }]}>
    <View style={[styles.iconWrapper, { backgroundColor: `${iconColor}15` }]}>
      <Icon size={22} color={iconColor} strokeWidth={2.5} />
    </View>
    <Text variant="body" weight="semibold" color={isDark ? '#E5E7EB' : '#374151'} style={{ flex: 1, marginStart: 16 }}>
      {label}
    </Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: isDark ? '#3A3A42' : '#E5E7EB', true: '#E11414' }}
      thumbColor="#FFF"
    />
  </View>
  );
};

const NavRow: React.FC<{
  icon: any;
  iconColor: string;
  label: string;
  value?: string;
  onPress?: () => void;
}> = ({ icon: Icon, iconColor, label, value, onPress }) => {
  const isDark = React.useContext(SettingsDarkContext);
  return (
  <Pressable
    style={({ pressed }) => [
      styles.row,
      { backgroundColor: isDark ? '#1C1C22' : '#FFFFFF' },
      pressed && { backgroundColor: isDark ? '#26262E' : '#F9FAFC', transform: [{ scale: 0.98 }] },
    ]}
    onPress={onPress}
  >
    <View style={[styles.iconWrapper, { backgroundColor: `${iconColor}15` }]}>
      <Icon size={22} color={iconColor} strokeWidth={2.5} />
    </View>
    <Text variant="body" weight="semibold" color={isDark ? '#E5E7EB' : '#374151'} style={{ flex: 1, marginStart: 16 }}>
      {label}
    </Text>
    {value && (
      <Text variant="caption" color="#9CA3AF" weight="bold" style={{ marginEnd: 8 }}>
        {value}
      </Text>
    )}
    <ChevronRight size={20} color={isDark ? '#4B5563' : '#D1D5DB'} />
  </Pressable>
  );
};

const Divider = () => null;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F9' },
  headerBg: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 300,
  },
  scrollContent: { paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  vipCard: {
    borderRadius: 24,
    padding: 24,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#9A1414',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 1,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  accountIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  vipChevronWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    shadowColor: '#9A1414',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 1,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    display: 'none',
  },
});
