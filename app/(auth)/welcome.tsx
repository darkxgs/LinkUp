/**
 * Onboarding / Welcome — Premium Dark Neon Redesign (2026 Edition)
 *
 * Implements a premium dark-purple theme with a glassmorphic Daily Reward card,
 * dynamic floating coins, and a programmatic global social map overlay.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Phone, Hash, ChevronRight, Sparkles, Facebook, Languages, HelpCircle } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const AnimatedExpoImage = Animated.createAnimatedComponent(Image);

import { lu } from '@/theme/lu-brand';
import { GoogleLogo, TikTokLogo, XLogo, SnapchatLogo } from '@/components/brand/LuBrand';
import { MatchNetworkOverlay } from '@/components/auth/MatchNetworkOverlay';
import { LanguagePickerSheet } from '@/components/localization/LanguagePickerSheet';
import { useAppLanguage } from '@/localization/useAppLanguage';
import { LINKUP_ID_LOGO, COIN_CURRENCY_ICON } from '@/constants/brandAssets';
import { loadGoogleAuthConfig, useGoogleSignIn } from '@/services/social-auth';
import { markOnboardingSeen } from '@/services/onboardingStorage';
import { useAuth } from '@/hooks/useAuth';

const GIFT_BOX = require('../../assets/design/onboarding/reward-gift.png');
const COIN_IMG = COIN_CURRENCY_ICON;
const BG_IMG = require('../../assets/design/onboarding/background.jpeg');

/** Custom ID login icon with neon gradient */
function AccountIdIcon({ size = 24 }: { size?: number }) {
  return (
    <LinearGradient
      colors={['#FF5C5C', '#B00E0E']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size + 4,
        height: size + 4,
        borderRadius: (size + 4) * 0.32,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#E11414',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      }}
    >
      <Hash size={size * 0.72} color="#fff" strokeWidth={2.5} />
    </LinearGradient>
  );
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { lang } = useAppLanguage();
  const router = useRouter();
  const { isAuthenticated, user, authReady } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showLangSheet, setShowLangSheet] = useState(false);
  const [heroH, setHeroH] = useState(0);
  const [googleBusy, setGoogleBusy] = useState(false);
  const { promptGoogleSignIn, isReady: googleReady } = useGoogleSignIn();

  useEffect(() => {
    void markOnboardingSeen();
  }, []);

  useEffect(() => {
    if (authReady && isAuthenticated && user) {
      router.replace('/(tabs)' as any);
    }
  }, [authReady, isAuthenticated, router, user]);

  useEffect(() => {
    void loadGoogleAuthConfig().catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('@linkup:dark-mode')
      .then((val) => {
        if (val !== null) {
          setIsDarkMode(val === 'true');
        }
      })
      .catch((e) => console.warn('Failed to load dark mode', e));
  }, []);

  const currentBg = isDarkMode ? require('../../assets/design/onboarding/background1.png') : BG_IMG;

  const usableH = H - insets.top - insets.bottom;
  const scaleFactor = useMemo(
    () => Math.min(Math.max(usableH / 740, 0.72), 1),
    [usableH],
  );
  const isSmall = W < 360;
  const isCompact = usableH < 700;
  const PAD = isSmall ? 14 : isCompact ? 16 : 24;
  const contentW = Math.min(W, 460);

  // Reanimated values for gold coins floating (very gentle, slow animation to prevent dizziness)
  const coin1Y = useSharedValue(0);
  const coin2Y = useSharedValue(0);
  const coin3Y = useSharedValue(0);

  useEffect(() => {
    // Coins float: extremely gentle and slow ranges to keep UI solid but premium
    coin1Y.value = withRepeat(
      withTiming(-3, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    coin2Y.value = withRepeat(
      withTiming(-4, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    coin3Y.value = withRepeat(
      withTiming(-2, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const coin1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: coin1Y.value }, { rotate: '12deg' }],
  }));

  const coin2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: coin2Y.value }, { rotate: '-15deg' }],
  }));

  const coin3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: coin3Y.value }, { rotate: '5deg' }],
  }));

  const handleSocialLogin = (provider: 'google' | 'tiktok' | 'phone' | 'id' | 'facebook' | 'x' | 'snapchat') => {
    if (provider === 'phone') {
      Alert.alert(t('match.comingSoonTitle'), t('auth.text68191'));
      return;
    }
    if (provider === 'id') {
      router.push('/(auth)/login-id' as any);
      return;
    }
    if (provider === 'google') {
      if (!googleReady) {
        Alert.alert(t('common.error'), t('auth.text613'));
        return;
      }
      setGoogleBusy(true);
      void (async () => {
        try {
          await promptGoogleSignIn();
          router.replace('/(tabs)' as any);
        } catch (e: any) {
          const msg = e?.message ?? t('auth.loginFailed');
          if (msg !== 'ألغى المستخدم تسجيل الدخول') {
            Alert.alert(t('auth.loginFailed'), msg);
          }
        } finally {
          setGoogleBusy(false);
        }
      })();
      return;
    }
    if (provider === 'facebook') {
      Alert.alert('Facebook', t('auth.text613') || 'Facebook login coming soon!', [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('auth.text3972'), onPress: () => router.push('/(auth)/login' as any) },
      ]);
      return;
    }
    if (provider === 'x' || provider === 'snapchat') {
      const name = provider === 'x' ? 'X' : 'Snapchat';
      Alert.alert(name, t('auth.text613') || `${name} login coming soon!`, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('auth.text3972'), onPress: () => router.push('/(auth)/login' as any) },
      ]);
      return;
    }
    router.push('/(auth)/login' as any);
  };

  // Dimensions scaled dynamically
  const circleWrapSize = Math.round((isCompact ? 52 : 58) * scaleFactor);
  const circleSize = Math.round((isCompact ? 34 : 38) * scaleFactor);
  const iconSize = Math.round((isCompact ? 16 : 18) * scaleFactor);

  const PROVIDERS = [
    {
      key: 'phone' as const,
      label: t('auth.phone') || 'Phone',
      icon: (
        <LinearGradient
          colors={['#F06A6A', '#ED4444']}
          style={[styles.iconCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }]}
        >
          <Phone size={iconSize} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
        </LinearGradient>
      ),
    },
    {
      key: 'facebook' as const,
      label: t('auth.facebook') || 'Facebook',
      icon: (
        <LinearGradient
          colors={['#E92121', '#BF1313']}
          style={[styles.iconCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }]}
        >
          <Facebook size={iconSize} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
        </LinearGradient>
      ),
    },
    {
      key: 'x' as const,
      label: t('auth.x') || 'X',
      icon: (
        <LinearGradient
          colors={['#000000', '#1A1A1A']}
          style={[styles.iconCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }]}
        >
          <XLogo size={iconSize * 0.92} color="#FFFFFF" />
        </LinearGradient>
      ),
    },
    {
      key: 'id' as const,
      label: t('auth.linkupId') || 'Linkup ID',
      icon: (
        <LinearGradient
          colors={['white', 'white']}
          style={[styles.iconCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }]}
        >
          <Image
            source={LINKUP_ID_LOGO}
            style={{ width: iconSize * 1.55, height: iconSize * 1.55 }}
            contentFit="contain"
          />
        </LinearGradient>
      ),
    },
    {
      key: 'tiktok' as const,
      label: t('auth.tiktok') || 'TikTok',
      icon: (
        <LinearGradient
          colors={['#2E2E3A', '#111115']}
          style={[styles.iconCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }]}
        >
          <TikTokLogo size={iconSize} color="#FFFFFF" />
        </LinearGradient>
      ),
    },
  ];

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <Image source={currentBg} style={[StyleSheet.absoluteFill, { opacity: isDarkMode ? 0.9 : 0.75 }]} contentFit="cover" />
      <View
        style={[
          styles.page,
          {
            paddingTop: insets.top + 8 * scaleFactor,
            paddingBottom: insets.bottom + 10 * scaleFactor,
          },
        ]}
      >
        <View style={[styles.pageInner, { width: contentW }]}>
          {/* ===== TOP BAR ===== */}
          <View style={[styles.topBar, { paddingHorizontal: PAD }]}>
            <Pressable
              onPress={() => setShowLangSheet(true)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.topBarBtn,
                isDarkMode && styles.topBarBtnDark,
                pressed && { opacity: 0.88 },
              ]}
            >
              <Languages size={15} color={isDarkMode ? '#F0A0A0' : '#E11414'} strokeWidth={2.4} />
              <Text style={[styles.topBarBtnText, isDarkMode && styles.topBarBtnTextDark]}>
                {lang === 'ar' ? 'العربية' : 'English'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => Alert.alert(t('auth.text97390'), t('auth.text20506'))}
              hitSlop={8}
              style={({ pressed }) => [
                styles.topBarBtn,
                isDarkMode && styles.topBarBtnDark,
                pressed && { opacity: 0.88 },
              ]}
            >
              <HelpCircle size={15} color={isDarkMode ? '#F0A0A0' : '#E11414'} strokeWidth={2.4} />
              <Text style={[styles.topBarBtnText, isDarkMode && styles.topBarBtnTextDark]}>
                {t('auth.text97390') || 'Help'}
              </Text>
            </Pressable>
          </View>

          {/* ===== GLASSMORPHIC DAILY REWARD CARD ===== */}
          <View
            style={[
              styles.rewardCardContainer,
              isDarkMode && styles.rewardCardContainerDark,
              { marginHorizontal: PAD, marginTop: 6 * scaleFactor },
            ]}
          >
            <BlurView intensity={65} tint={isDarkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={isDarkMode ? ['rgba(58, 18, 18, 0.75)', 'rgba(26, 10, 12, 0.55)'] : ['rgba(255, 236, 236, 0.75)', 'rgba(255, 255, 255, 0.55)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.rewardCardGrad, { padding: 12 * scaleFactor }]}
            >
              <View style={styles.rewardTextCol}>
                <View style={styles.badgeRow}>
                  <LinearGradient
                    colors={['#FF4D5A', '#B00E0E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.badgeContainer}
                  >
                    <Sparkles size={8 * scaleFactor} color="#FFFFFF" />
                    <Text style={[styles.badgeText, { fontSize: 9 * scaleFactor }]}>{t('auth.dailyBonus') || 'DAILY BONUS'}</Text>
                  </LinearGradient>
                </View>

                <View style={styles.titleRow}>
                  <Text style={[styles.rewardTitle, isDarkMode && styles.rewardTitleDark, { fontSize: 17 * scaleFactor }]}>{t('auth.rewardTitle') || 'Daily Reward'}</Text>
                  <Sparkles size={13 * scaleFactor} color="#E11414" style={{ marginLeft: 6 }} />
                </View>

                <Text style={[styles.rewardSub, isDarkMode && styles.rewardSubDark, { fontSize: 11.5 * scaleFactor, lineHeight: 15 * scaleFactor, marginBottom: 8 * scaleFactor }]}>
                  {t('auth.rewardSubtitle') || 'Claim your reward and win free coins!'}
                </Text>
                <Pressable
                  onPress={() => Alert.alert('Daily Reward', 'Log in to claim your daily rewards!')}
                  style={({ pressed }) => [styles.claimBtn, { paddingVertical: 6 * scaleFactor }, pressed && { opacity: 0.9 }]}
                >
                  <Text style={[styles.claimBtnText, { fontSize: 12 * scaleFactor }]}>{t('auth.claimNow') || 'Claim Now'}</Text>
                  <Image source={COIN_IMG} style={{ width: 13 * scaleFactor, height: 13 * scaleFactor }} contentFit="contain" />
                </Pressable>
              </View>

              <View style={[styles.rewardGraphicCol, { height: 72 * scaleFactor }]}>
                <Image source={GIFT_BOX} style={[styles.giftBoxImg, { width: 68 * scaleFactor, height: 68 * scaleFactor }]} contentFit="contain" />
                <AnimatedExpoImage source={COIN_IMG} style={[styles.coin1, coin1Style, { width: 20 * scaleFactor, height: 20 * scaleFactor }]} contentFit="contain" />
                <AnimatedExpoImage source={COIN_IMG} style={[styles.coin2, coin2Style, { width: 17 * scaleFactor, height: 17 * scaleFactor }]} contentFit="contain" />
                <AnimatedExpoImage source={COIN_IMG} style={[styles.coin3, coin3Style, { width: 15 * scaleFactor, height: 15 * scaleFactor }]} contentFit="contain" />
              </View>
            </LinearGradient>
          </View>

          {/* ===== INTERACTIVE GLOBAL NETWORK — fills remaining space ===== */}
          <View
            style={styles.heroSlot}
            onLayout={(e) => setHeroH(e.nativeEvent.layout.height)}
          >
            {heroH > 0 ? (
              <MatchNetworkOverlay width={contentW} height={heroH} scaleFactor={scaleFactor} />
            ) : null}
          </View>

          {/* ===== LOGIN BUTTONS SECTION ===== */}
          <View style={{ paddingHorizontal: PAD, paddingTop: 4 * scaleFactor }}>
            <Pressable
              onPress={() => handleSocialLogin('google')}
              disabled={googleBusy}
              style={({ pressed }) => [
                pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
                googleBusy && { opacity: 0.7 },
              ]}
            >
              <LinearGradient
                colors={['#911E1E', '#EA2F2F', '#EC3E3E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.googleBtn, { height: 50 * scaleFactor, borderRadius: 16 * scaleFactor }]}
              >
                <View style={[styles.googleIconCircle, { width: 30 * scaleFactor, height: 30 * scaleFactor, borderRadius: 15 * scaleFactor }]}>
                  <GoogleLogo size={17 * scaleFactor} />
                </View>
                <Text style={[styles.googleBtnText, { fontSize: 14.5 * scaleFactor }]}>{t('auth.continueWithGoogle')}</Text>
                <ChevronRight size={17 * scaleFactor} color="#FFFFFF" style={styles.arrowIcon} />
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => handleSocialLogin('snapchat')}
              style={({ pressed }) => [
                { marginTop: 10 * scaleFactor },
                pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
              ]}
            >
              <LinearGradient
                colors={['#FFFC00', '#FFE000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.googleBtn, { height: 50 * scaleFactor, borderRadius: 16 * scaleFactor, shadowColor: '#F7B500' }]}
              >
                <View style={[styles.googleIconCircle, { width: 30 * scaleFactor, height: 30 * scaleFactor, borderRadius: 15 * scaleFactor }]}>
                  <SnapchatLogo size={18 * scaleFactor} color="#FFFC00" />
                </View>
                <Text style={[styles.googleBtnText, { fontSize: 14.5 * scaleFactor, color: '#1A1A1A' }]}>{t('auth.loginWithSnapchat')}</Text>
                <ChevronRight size={17 * scaleFactor} color="#1A1A1A" style={styles.arrowIcon} />
              </LinearGradient>
            </Pressable>

            <View style={[styles.divider, { marginTop: 14 * scaleFactor, marginBottom: 12 * scaleFactor }]}>
              <View style={[styles.dividerLine, isDarkMode && styles.dividerLineDark]} />
              <Text style={[styles.dividerText, { fontSize: 11 * scaleFactor }]}>{t('auth.text68438') || 'Or continue with'}</Text>
              <View style={[styles.dividerLine, isDarkMode && styles.dividerLineDark]} />
            </View>

            <View style={styles.providerRow}>
              {PROVIDERS.map((p) => (
                <Pressable
                  key={p.key}
                  onPress={() => handleSocialLogin(p.key)}
                  style={({ pressed }) => [
                    styles.providerItem,
                    { gap: 6 * scaleFactor },
                    pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] },
                  ]}
                >
                  <View
                    style={[
                      styles.providerCircle,
                      isDarkMode && styles.providerCircleDark,
                      {
                        width: circleWrapSize,
                        height: circleWrapSize,
                        borderRadius: circleWrapSize / 2,
                      },
                    ]}
                  >
                    {p.icon}
                  </View>
                  <Text style={[styles.providerLabel, { fontSize: 11 * scaleFactor }]} numberOfLines={1}>{p.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.termsText, { marginTop: 14 * scaleFactor, fontSize: 10 * scaleFactor, lineHeight: 15 * scaleFactor }]}>
              {t('auth.agreeOn') || 'By continuing you agree to our'}{' '}
              <Text style={styles.termsLink}>{t('auth.termsOfUse') || 'Terms of Service'}</Text>
              {' '}{t('auth.and') || 'and'}{' '}
              <Text style={styles.termsLink}>{t('auth.privacyPolicy') || 'Privacy Policy'}</Text>
            </Text>
          </View>
        </View>
      </View>

      <LanguagePickerSheet visible={showLangSheet} onClose={() => setShowLangSheet(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  page: {
    flex: 1,
    alignItems: 'center',
  },
  pageInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  heroSlot: {
    flex: 1,
    width: '100%',
    minHeight: 80,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 8,
  },
  topBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.18)',
  },
  topBarBtnDark: {
    backgroundColor: 'rgba(26, 10, 12, 0.72)',
    borderColor: 'rgba(255, 120, 120, 0.28)',
  },
  topBarBtnText: {
    color: '#E11414',
    fontSize: 12.5,
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
  topBarBtnTextDark: {
    color: '#F0A0A0',
  },

  // Daily Reward Card (Glassmorphic)
  rewardCardContainer: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.16)',
    overflow: 'hidden',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  rewardCardGrad: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rewardTextCol: {
    flex: 1.25,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  badgeRow: {
    marginBottom: 6,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyBold,
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rewardTitle: {
    color: '#15151A',
    fontSize: 18,
    fontFamily: lu.fonts.displayHeavy,
  },
  rewardSub: {
    color: '#4B5563',
    fontSize: 12,
    fontFamily: lu.fonts.body,
    lineHeight: 16,
    marginBottom: 12,
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E11414',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    gap: 6,
  },
  claimBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontFamily: lu.fonts.bodyHeavy,
  },
  rewardGraphicCol: {
    flex: 0.75,
    height: 90,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftBoxImg: {
    width: 80,
    height: 80,
    zIndex: 2,
  },
  coin1: {
    position: 'absolute',
    width: 24,
    height: 24,
    top: 5,
    left: 10,
    zIndex: 3,
  },
  coin2: {
    position: 'absolute',
    width: 20,
    height: 20,
    top: 15,
    right: 15,
    zIndex: 3,
  },
  coin3: {
    position: 'absolute',
    width: 18,
    height: 18,
    bottom: 45,
    right: 35,
    zIndex: 1,
  },

  // Google button
  googleBtn: {
    height: 54,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
    shadowColor: '#EC3E3E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  googleIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15.5,
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
  },
  arrowIcon: {
    marginRight: 4,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.22)' },
  dividerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.88)',
    fontFamily: lu.fonts.bodyBold,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Circular Provider Buttons
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  providerItem: { alignItems: 'center', gap: 8 },
  providerCircle: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(225, 20, 20, 0.12)',
    shadowColor: '#E11414',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  providerLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    letterSpacing: 0.2,
  },

  termsText: {
    fontSize: 11,
    color: '#FFFFFF',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 24,
    fontFamily: lu.fonts.bodySemi,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  termsLink: {
    color: '#FFD0D0',
    fontFamily: lu.fonts.bodyBold,
    textDecorationLine: 'underline',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Dark mode overrides
  containerDark: { backgroundColor: '#0A0506' },
  rewardCardContainerDark: {
    borderColor: 'rgba(255, 120, 120, 0.24)',
    backgroundColor: 'rgba(38, 16, 19, 0.65)',
    shadowColor: '#FF5C5C',
    shadowOpacity: 0.2,
  },
  rewardTitleDark: { color: '#FFFFFF' },
  rewardSubDark: { color: '#E5E7EB' },
  dividerLineDark: { backgroundColor: 'rgba(255, 255, 255, 0.22)' },
  providerCircleDark: {
    backgroundColor: '#2A1012',
    borderColor: 'rgba(255, 120, 120, 0.25)',
    shadowColor: '#FF5C5C',
  },
});
