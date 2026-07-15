/**
 * Onboarding / Welcome — تصميم العميل: خلفية القلب + بطاقة دخول سفلية
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Phone, ChevronRight, ChevronDown, Mail, Facebook, Languages, HelpCircle, Heart } from 'lucide-react-native';
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
import { LINKUP_ID_LOGO, LINKUP_MAIN_LOGO } from '@/constants/brandAssets';
import { loadGoogleAuthConfig, useGoogleSignIn } from '@/services/social-auth';
import { markOnboardingSeen } from '@/services/onboardingStorage';
import { useAuth } from '@/hooks/useAuth';

const WELCOME_BG = require('../../assets/images/welcome_bg.png');

/** قلب عائم يصعد ويتلاشى في حلقة — لمسة حيوية فوق الخلفية */
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
      { translateY: interpolate(progress.value, [0, 1], [screenH * 0.62, screenH * 0.1]) },
      { translateX: interpolate(progress.value, [0, 0.5, 1], [0, 12, -8]) },
      { scale: interpolate(progress.value, [0, 0.2, 1], [0.6, 1, 0.9]) },
    ],
    opacity: interpolate(progress.value, [0, 0.15, 0.7, 1], [0, 0.55, 0.35, 0]),
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

  // حركات: نبض الخلفية + دخول العناصر + نبض زر البريد
  const bgBreathe = useSharedValue(0);
  const brandReveal = useSharedValue(0);
  const cardRise = useSharedValue(0);
  const ctaPulse = useSharedValue(0);

  useEffect(() => {
    bgBreathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    brandReveal.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    cardRise.value = withDelay(
      250,
      withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) }),
    );
    ctaPulse.value = withDelay(
      1100,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [bgBreathe, brandReveal, cardRise, ctaPulse]);

  const bgStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(bgBreathe.value, [0, 1], [1, 1.035]) }],
  }));
  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandReveal.value,
    transform: [{ translateY: interpolate(brandReveal.value, [0, 1], [-18, 0]) }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardRise.value,
    transform: [{ translateY: interpolate(cardRise.value, [0, 1], [46, 0]) }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ctaPulse.value, [0, 1], [1, 1.02]) }],
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

  const circleWrapSize = Math.round(56 * scaleFactor);
  const iconSize = Math.round(21 * scaleFactor);

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

  return (
    <View style={styles.container}>
      {/* خلفية العميل — مكبّرة من الأعلى (بلا فجوة سوداء) لينزل القلب تحت النص + نبض بطيء */}
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, height: Math.round(H * 1.25) },
          bgStyle,
        ]}
      >
        <Image source={WELCOME_BG} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>

      {/* قلوب عائمة */}
      <FloatingHeart x={W * 0.12} size={16} delay={0} duration={5200} screenH={H} />
      <FloatingHeart x={W * 0.26} size={11} delay={1600} duration={6200} screenH={H} />
      <FloatingHeart x={W * 0.52} size={13} delay={3000} duration={5600} screenH={H} />
      <FloatingHeart x={W * 0.74} size={17} delay={800} duration={6600} screenH={H} />
      <FloatingHeart x={W * 0.88} size={12} delay={2300} duration={5000} screenH={H} />

      <View
        style={[
          styles.page,
          {
            paddingTop: insets.top + 8 * scaleFactor,
            paddingBottom: insets.bottom + 8 * scaleFactor,
          },
        ]}
      >
        <View style={[styles.pageInner, { width: contentW }]}>
          {/* ===== الشريط العلوي ===== */}
          <View style={[styles.topBar, { paddingHorizontal: PAD }]}>
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
          </View>

          {/* ===== الهوية ===== */}
          <Animated.View style={[styles.brandBlock, brandStyle]}>
            <Image
              source={LINKUP_MAIN_LOGO}
              style={{ width: 52 * scaleFactor, height: 52 * scaleFactor, borderRadius: 14 * scaleFactor }}
              contentFit="cover"
            />
            <Text style={[styles.wordmark, { fontSize: 36 * scaleFactor }]}>
              Link<Text style={styles.wordmarkUp}>Up</Text>
            </Text>
            <Text style={[styles.tagline, { fontSize: 14.5 * scaleFactor }]}>
              <Text>{t('auth.welcomeTaglinePrefix')} </Text>
              <Text style={styles.taglineAccent}>LinkUp.</Text>
            </Text>
          </Animated.View>

          {/* مساحة لمجسّم القلب في الخلفية */}
          <View style={styles.heroSpace} />

          {/* ===== بطاقة الدخول السفلية ===== */}
          <Animated.View style={[styles.loginCard, { marginHorizontal: PAD - 6, padding: 16 * scaleFactor }, cardStyle]}>
            <Text style={[styles.cardTitle, { fontSize: 26 * scaleFactor }]}>
              <Text>{t('auth.welcomeBackPrefix')} </Text>
              <Text style={styles.cardTitleAccent}>{t('auth.welcomeBackAccent')}</Text>
            </Text>
            <Text style={[styles.cardSub, { fontSize: 13.5 * scaleFactor }]}>
              {t('auth.loginJourney')}
            </Text>

            {/* Continue with Email — نبض خفيف */}
            <Animated.View style={[{ marginTop: 14 * scaleFactor }, ctaStyle]}>
            <Pressable
              onPress={() => handleSocialLogin('email')}
              style={({ pressed }) => [
                pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
              ]}
            >
              <LinearGradient
                colors={['#FF4D5E', '#C40E2E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.emailBtn, { height: 52 * scaleFactor }]}
              >
                <Mail size={19 * scaleFactor} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={[styles.emailBtnText, { fontSize: 15.5 * scaleFactor }]}>
                  {t('auth.continueWithEmail')}
                </Text>
                <ChevronRight size={18 * scaleFactor} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
            </Animated.View>

            {/* فاصل */}
            <View style={[styles.divider, { marginVertical: 12 * scaleFactor }]}>
              <View style={styles.dividerLine} />
              <View style={styles.dividerDot} />
              <Text style={[styles.dividerText, { fontSize: 12 * scaleFactor }]}>
                {t('auth.text68438') || 'Or log in with'}
              </Text>
              <View style={styles.dividerDot} />
              <View style={styles.dividerLine} />
            </View>

            {/* Google أبيض */}
            <Pressable
              onPress={() => handleSocialLogin('google')}
              disabled={googleBusy}
              style={({ pressed }) => [
                styles.whiteBtn,
                { height: 50 * scaleFactor },
                pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
                googleBusy && { opacity: 0.7 },
              ]}
            >
              <GoogleLogo size={19 * scaleFactor} />
              <Text style={[styles.whiteBtnText, { fontSize: 15 * scaleFactor }]}>
                {t('auth.continueWithGoogle')}
              </Text>
            </Pressable>

            {/* Snapchat أصفر */}
            <Pressable
              onPress={() => handleSocialLogin('snapchat')}
              style={({ pressed }) => [
                styles.snapBtn,
                { height: 50 * scaleFactor, marginTop: 10 * scaleFactor },
                pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
              ]}
            >
              <SnapchatLogo size={19 * scaleFactor} color="#FFFFFF" />
              <Text style={[styles.snapBtnText, { fontSize: 15 * scaleFactor }]}>
                {t('auth.continueWithSnapchat')}
              </Text>
            </Pressable>

            {/* المزوّدون */}
            <View style={[styles.providerRow, { marginTop: 14 * scaleFactor }]}>
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
                      p.key === 'x' && { backgroundColor: '#000000' },
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

            {/* إنشاء حساب */}
            <Pressable
              onPress={() => router.push('/(auth)/register' as any)}
              style={({ pressed }) => [styles.registerRow, { marginTop: 14 * scaleFactor }, pressed && { opacity: 0.88 }]}
            >
              <Text style={[styles.registerAccent, { fontSize: 13.5 * scaleFactor }]}>
                {t('auth.text46120')}
              </Text>
              <ChevronRight size={16 * scaleFactor} color="#FF4D5A" />
            </Pressable>

            <Text style={[styles.termsText, { marginTop: 8 * scaleFactor, fontSize: 11 * scaleFactor, lineHeight: 16 * scaleFactor }]}>
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
  container: { flex: 1, backgroundColor: '#0B0507' },
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
    backgroundColor: 'rgba(20,8,10,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,94,0.4)',
  },
  topBarBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },

  brandBlock: {
    alignItems: 'center',
    marginTop: -17,
  },
  wordmark: {
    color: '#FFFFFF',
    fontFamily: lu.fonts.displayHeavy,
    fontWeight: '900',
    includeFontPadding: false,
    writingDirection: 'ltr',
    marginTop: 4,
  },
  wordmarkUp: {
    color: '#E11414',
  },
  tagline: {
    color: 'rgba(255,255,255,0.78)',
    fontFamily: lu.fonts.bodySemi,
    includeFontPadding: false,
    marginTop: 0,
    textAlign: 'center',
  },
  taglineAccent: {
    color: '#FF4D5A',
  },

  heroSpace: {
    flex: 1,
    minHeight: 60,
  },

  loginCard: {
    borderRadius: 26,
    borderWidth: 1.2,
    borderColor: 'rgba(255,45,60,0.35)',
    backgroundColor: 'rgba(18,8,10,0.82)',
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
    textAlign: 'center',
  },
  cardTitleAccent: {
    color: '#FF3B4E',
  },
  cardSub: {
    color: 'rgba(255,255,255,0.65)',
    fontFamily: lu.fonts.body,
    includeFontPadding: false,
    textAlign: 'center',
    marginTop: 4,
  },

  emailBtn: {
    borderRadius: 99,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 5,
  },
  emailBtnText: {
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,70,80,0.35)' },
  dividerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E11414',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
    marginHorizontal: 2,
  },

  whiteBtn: {
    borderRadius: 99,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  whiteBtnText: {
    color: '#15151A',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
  },
  snapBtn: {
    borderRadius: 99,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFF400',
  },
  snapBtnText: {
    color: '#15151A',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
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

  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  registerAccent: {
    color: '#FF4D5A',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
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
