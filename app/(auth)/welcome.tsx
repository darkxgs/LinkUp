/**
 * Onboarding / Welcome — تصميم العميل: بطاقة المكافأة اليومية + قلب التعارف + أزرار الدخول
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
  I18nManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Phone,
  ChevronRight,
  ChevronDown,
  Facebook,
  Languages,
  HelpCircle,
  Heart,
  Gift,
  Sparkles,
} from 'lucide-react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { lu } from '@/theme/lu-brand';
import { GoogleLogo, TikTokLogo, XLogo, SnapchatLogo } from '@/components/brand/LuBrand';
import { LanguagePickerSheet } from '@/components/localization/LanguagePickerSheet';
import { useAppLanguage } from '@/localization/useAppLanguage';
import { LINKUP_ID_LOGO, COIN_CURRENCY_ICON } from '@/constants/brandAssets';
import { loadGoogleAuthConfig, useGoogleSignIn } from '@/services/social-auth';
import { markOnboardingSeen } from '@/services/onboardingStorage';
import { useAuth } from '@/hooks/useAuth';

const WELCOME_CENTER = require('../../assets/images/welcome_center.png');
const WELCOME_GIFT = require('../../assets/images/welcome_gift.png');
/** نسبة عرض/ارتفاع صورة القلب المركزية */
const CENTER_ASPECT = 1536 / 1024;
/** قلب السهم لليمين/اليسار حسب الاتجاه */
const rtlFlip = I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined;

/** حلقة نبض متوسّعة خلف القلب المركزي */
function PulseRing({
  size,
  color,
  delay,
  borderWidth = 2,
}: {
  size: number;
  color: string;
  delay: number;
  borderWidth?: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2800, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      ),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.9, 1.3]) }],
    opacity: interpolate(progress.value, [0, 0.15, 1], [0.5, 0.38, 0]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

/** قلب عائم يصعد ويتلاشى في حلقة — لمسة حيوية */
function FloatingHeart({
  x,
  size,
  delay,
  duration,
  screenH,
}: {
  x: number;
  size: number;
  delay: number;
  duration: number;
  screenH: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false),
    );
  }, [delay, duration, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [screenH * 0.62, screenH * 0.12]) },
      { translateX: interpolate(progress.value, [0, 0.5, 1], [0, 12, -8]) },
      { scale: interpolate(progress.value, [0, 0.2, 1], [0.6, 1, 0.9]) },
    ],
    opacity: interpolate(progress.value, [0, 0.15, 0.7, 1], [0, 0.5, 0.3, 0]),
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x }, style]}>
      <Heart size={size} color="#FF3B4E" fill="#FF3B4E" strokeWidth={0} />
    </Animated.View>
  );
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { lang } = useAppLanguage();
  const router = useRouter();
  const { isAuthenticated, user, authReady } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();

  const [showLangSheet, setShowLangSheet] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const { promptGoogleSignIn, isReady: googleReady } = useGoogleSignIn();

  // حركات: دخول العناصر + تنفّس القلب + نبض زر Google
  const topReveal = useSharedValue(0);
  const heroReveal = useSharedValue(0);
  const bottomRise = useSharedValue(0);
  const ctaPulse = useSharedValue(0);
  const giftWiggle = useSharedValue(0);

  useEffect(() => {
    topReveal.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
    heroReveal.value = withDelay(
      200,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
    bottomRise.value = withDelay(
      380,
      withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) }),
    );
    ctaPulse.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    giftWiggle.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 180, easing: Easing.inOut(Easing.ease) }),
          withTiming(-1, { duration: 180, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 180, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 180, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2600 }),
        ),
        -1,
        false,
      ),
    );
  }, [bottomRise, ctaPulse, giftWiggle, heroReveal, topReveal]);

  const topStyle = useAnimatedStyle(() => ({
    opacity: topReveal.value,
    transform: [{ translateY: interpolate(topReveal.value, [0, 1], [-20, 0]) }],
  }));
  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroReveal.value,
    transform: [{ scale: interpolate(heroReveal.value, [0, 1], [0.92, 1]) }],
  }));
  const bottomStyle = useAnimatedStyle(() => ({
    opacity: bottomRise.value,
    transform: [{ translateY: interpolate(bottomRise.value, [0, 1], [42, 0]) }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ctaPulse.value, [0, 1], [1, 1.015]) }],
  }));
  const giftStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${giftWiggle.value * 7}deg` },
      { scale: interpolate(Math.abs(giftWiggle.value), [0, 1], [1, 1.06]) },
    ],
  }));

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

  const usableH = H - insets.top - insets.bottom;
  const scaleFactor = useMemo(
    () => Math.min(Math.max(usableH / 780, 0.72), 1),
    [usableH],
  );
  const isSmall = W < 360;
  const PAD = isSmall ? 14 : 20;
  const contentW = Math.min(W, 460);

  const handleSocialLogin = (provider: 'google' | 'tiktok' | 'phone' | 'id' | 'facebook' | 'x' | 'snapchat' | 'email') => {
    if (provider === 'email') {
      router.push('/(auth)/login' as any);
      return;
    }
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
        router.push('/(auth)/login' as any);
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
            Alert.alert(t('auth.loginFailed'), msg, [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('auth.emailLabel', 'البريد الإلكتروني'),
                onPress: () => router.push('/(auth)/login' as any),
              },
            ]);
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

  const circleWrapSize = Math.round(54 * scaleFactor);
  const iconSize = Math.round(20 * scaleFactor);

  const PROVIDERS = [
    {
      key: 'phone' as const,
      label: t('auth.phone') || 'Phone',
      icon: <Phone size={iconSize} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />,
    },
    {
      key: 'facebook' as const,
      label: t('auth.facebook') || 'Facebook',
      icon: <Facebook size={iconSize} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />,
    },
    {
      key: 'x' as const,
      label: t('auth.x') || 'X',
      icon: <XLogo size={iconSize * 0.92} color="#FFFFFF" />,
    },
    {
      key: 'id' as const,
      label: t('auth.linkupId') || 'LinkUp ID',
      icon: (
        <Image
          source={LINKUP_ID_LOGO}
          style={{ width: iconSize * 1.5, height: iconSize * 1.5 }}
          contentFit="contain"
        />
      ),
    },
    {
      key: 'tiktok' as const,
      label: t('auth.tiktok') || 'TikTok',
      icon: <TikTokLogo size={iconSize} color="#FFFFFF" />,
    },
  ];

  const heroW = Math.round(contentW * 1.16);
  const heroH = Math.round(heroW / CENTER_ASPECT);

  return (
    <View style={styles.container}>
      <LinearGradient colors={lu.gradients.pageHomeNight} style={StyleSheet.absoluteFill} />

      {/* قلوب عائمة */}
      <FloatingHeart x={W * 0.1} size={15} delay={0} duration={5400} screenH={H} />
      <FloatingHeart x={W * 0.3} size={11} delay={1800} duration={6200} screenH={H} />
      <FloatingHeart x={W * 0.55} size={13} delay={3200} duration={5600} screenH={H} />
      <FloatingHeart x={W * 0.78} size={16} delay={900} duration={6600} screenH={H} />
      <FloatingHeart x={W * 0.9} size={11} delay={2400} duration={5200} screenH={H} />

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
          {/* ===== الشريط العلوي ===== */}
          <Animated.View style={[styles.topBar, { paddingHorizontal: PAD }, topStyle]}>
            <Pressable
              onPress={() => setShowLangSheet(true)}
              hitSlop={8}
              style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.88 }]}
            >
              <Languages size={15} color="#FF5C6C" strokeWidth={2.4} />
              <Text style={styles.topBarBtnText}>
                {lang === 'ar' ? 'العربية' : 'English'}
              </Text>
              <ChevronDown size={14} color="rgba(255,255,255,0.7)" strokeWidth={2.4} />
            </Pressable>

            <Pressable
              onPress={() => Alert.alert(t('auth.text97390'), t('auth.text20506'))}
              hitSlop={8}
              style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.88 }]}
            >
              <HelpCircle size={15} color="#FF5C6C" strokeWidth={2.4} />
              <Text style={styles.topBarBtnText}>{t('auth.text97390') || 'Help'}</Text>
            </Pressable>
          </Animated.View>

          {/* ===== بطاقة المكافأة اليومية ===== */}
          <Animated.View
            style={[
              styles.rewardCard,
              { marginHorizontal: PAD - 6, marginTop: 10 * scaleFactor, padding: 13 * scaleFactor },
              topStyle,
            ]}
          >
            <View style={styles.rewardBody}>
              <View style={styles.rewardChip}>
                <Gift size={14 * scaleFactor} color="#FF5C6C" strokeWidth={2.4} />
                <Text style={[styles.rewardChipText, { fontSize: 12 * scaleFactor }]}>
                  {t('auth.dailyGift')}
                </Text>
              </View>

              <View style={styles.rewardTitleRow}>
                <Text style={[styles.rewardTitle, { fontSize: 24 * scaleFactor }]}>
                  {t('chat.dailyReward')}
                </Text>
                <Sparkles size={17 * scaleFactor} color="#FF4D5A" strokeWidth={2.2} />
              </View>

              <Text style={[styles.rewardSub, { fontSize: 13 * scaleFactor }]}>
                {t('chat.dailyRewardSubtitle')}
              </Text>

              <Pressable
                onPress={() => handleSocialLogin('email')}
                style={({ pressed }) => [
                  { alignSelf: 'flex-start', marginTop: 10 * scaleFactor },
                  pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
                ]}
              >
                <LinearGradient
                  colors={['#FF4D5E', '#C40E2E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.claimBtn, { height: 40 * scaleFactor }]}
                >
                  <Text style={[styles.claimBtnText, { fontSize: 14.5 * scaleFactor }]}>
                    {t('auth.claimNow')}
                  </Text>
                  <Image
                    source={COIN_CURRENCY_ICON}
                    style={{ width: 20 * scaleFactor, height: 20 * scaleFactor }}
                    contentFit="contain"
                  />
                </LinearGradient>
              </Pressable>
            </View>

            {/* صندوق الهدية — أصل العميل كما هو + اهتزازة مرحة */}
            <Animated.View style={giftStyle}>
              <Image
                source={WELCOME_GIFT}
                style={{ width: 168 * scaleFactor, height: 152 * scaleFactor }}
                contentFit="contain"
              />
            </Animated.View>
          </Animated.View>

          {/* ===== القلب المركزي — أصل العميل كما هو ===== */}
          <View style={styles.heroWrap}>
            <PulseRing size={heroH * 0.96} color="rgba(255,92,92,0.35)" delay={0} />
            <PulseRing size={heroH * 0.96} color="rgba(225,20,20,0.28)" delay={1100} />
            <PulseRing size={heroH * 0.96} color="rgba(176,14,14,0.2)" delay={2200} borderWidth={1.5} />
            <Animated.View style={heroStyle}>
              <Image
                source={WELCOME_CENTER}
                style={{ width: heroW, height: heroH }}
                contentFit="contain"
              />
            </Animated.View>
          </View>

          {/* ===== أزرار الدخول ===== */}
          <Animated.View style={[{ paddingHorizontal: PAD - 6 }, bottomStyle]}>
            {/* Google — شريط أحمر */}
            <Animated.View style={ctaStyle}>
              <Pressable
                onPress={() => handleSocialLogin('google')}
                disabled={googleBusy}
                style={({ pressed }) => [
                  pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
                  googleBusy && { opacity: 0.7 },
                ]}
              >
                <LinearGradient
                  colors={['#FF4D5E', '#C40E2E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.loginBar, { height: 56 * scaleFactor }]}
                >
                  <View style={styles.loginBarIconCircle}>
                    <GoogleLogo size={19 * scaleFactor} />
                  </View>
                  <Text style={[styles.loginBarText, { fontSize: 15.5 * scaleFactor }]}>
                    {t('auth.loginWithGoogle')}
                  </Text>
                  <ChevronRight size={19 * scaleFactor} color="#FFFFFF" style={rtlFlip} />
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* Snapchat — شريط أصفر */}
            <Pressable
              onPress={() => handleSocialLogin('snapchat')}
              style={({ pressed }) => [
                styles.snapBar,
                { height: 56 * scaleFactor, marginTop: 12 * scaleFactor },
                pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={styles.snapIconCircle}>
                <SnapchatLogo size={19 * scaleFactor} color="#FFFFFF" />
              </View>
              <Text style={[styles.snapBarText, { fontSize: 15.5 * scaleFactor }]}>
                {t('auth.loginWithSnapchat')}
              </Text>
              <ChevronRight size={19 * scaleFactor} color="#15151A" style={rtlFlip} />
            </Pressable>

            {/* فاصل بقلوب */}
            <View style={[styles.divider, { marginVertical: 14 * scaleFactor }]}>
              <View style={styles.dividerLine} />
              <Heart size={13} color="#FF4D5A" strokeWidth={2.4} />
              <Text style={[styles.dividerText, { fontSize: 12.5 * scaleFactor }]}>
                {t('auth.text68438') || 'Or log in with'}
              </Text>
              <Heart size={13} color="#FF4D5A" strokeWidth={2.4} />
              <View style={styles.dividerLine} />
            </View>

            {/* المزوّدون */}
            <View style={styles.providerRow}>
              {PROVIDERS.map((p) => (
                <Pressable
                  key={p.key}
                  onPress={() => handleSocialLogin(p.key)}
                  style={({ pressed }) => [
                    styles.providerItem,
                    { gap: 7 * scaleFactor },
                    pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] },
                  ]}
                >
                  <View
                    style={[
                      styles.providerCircle,
                      {
                        width: circleWrapSize,
                        height: circleWrapSize,
                        borderRadius: circleWrapSize / 2,
                      },
                      p.key === 'id' && { backgroundColor: '#FFFFFF' },
                    ]}
                  >
                    {p.icon}
                  </View>
                  <Text style={[styles.providerLabel, { fontSize: 11.5 * scaleFactor }]} numberOfLines={1}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.termsText, { marginTop: 12 * scaleFactor, fontSize: 11 * scaleFactor, lineHeight: 16 * scaleFactor }]}>
              {t('auth.agreeOn') || 'I agree to'}{' '}
              <Text style={styles.termsLink}>{t('auth.termsOfUse') || 'Terms of Use'}</Text>
              {' '}{t('auth.and') || 'and'}{' '}
              <Text style={styles.termsLink}>{t('auth.privacyPolicy') || 'Privacy Policy'}</Text>
            </Text>
          </Animated.View>
        </View>
      </View>

      <LanguagePickerSheet visible={showLangSheet} onClose={() => setShowLangSheet(false)} />
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#161114' },
  page: {
    flex: 1,
    alignItems: 'center',
  },
  pageInner: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 4,
  },
  topBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,94,0.35)',
  },
  topBarBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },

  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: 'rgba(255,45,60,0.35)',
    backgroundColor: 'rgba(20,10,13,0.55)',
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  rewardBody: {
    flex: 1,
    alignItems: 'flex-start',
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255,45,60,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,94,0.4)',
  },
  rewardChipText: {
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
  rewardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
  },
  rewardTitle: {
    color: '#FFFFFF',
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
  },
  rewardSub: {
    color: 'rgba(255,255,255,0.66)',
    fontFamily: lu.fonts.body,
    includeFontPadding: false,
    marginTop: 4,
    lineHeight: 18,
  },
  claimBtn: {
    borderRadius: 99,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  claimBtnText: {
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
  },

  heroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },

  loginBar: {
    borderRadius: 99,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  loginBarIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBarText: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
  },
  snapBar: {
    borderRadius: 99,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFF400',
  },
  snapIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  snapBarText: {
    flex: 1,
    color: '#15151A',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,70,80,0.3)' },
  dividerText: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
    marginHorizontal: 2,
  },

  providerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  providerItem: { alignItems: 'center' },
  providerCircle: {
    backgroundColor: 'rgba(255,45,60,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,77,94,0.55)',
  },
  providerLabel: {
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
    textAlign: 'center',
  },

  termsText: {
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    fontFamily: lu.fonts.bodySemi,
    includeFontPadding: false,
  },
  termsLink: {
    color: '#FF4D5A',
    textDecorationLine: 'underline',
    fontFamily: lu.fonts.bodyBold,
  },
});
