/**
 * Onboarding / Welcome — تصميم العميل بهوية LinkUp الداكنة (سمة Discover)
 * بطاقة المكافأة اليومية + قلب التعارف المركزي (أصول العميل) + أزرار الدخول
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
import { Phone, ChevronRight, Gift, Sparkles, Facebook, Languages, HelpCircle, Heart } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedExpoImage = Animated.createAnimatedComponent(Image);

import { lu } from '@/theme/lu-brand';
import { GoogleLogo, TikTokLogo, XLogo, SnapchatLogo } from '@/components/brand/LuBrand';
import { LanguagePickerSheet } from '@/components/localization/LanguagePickerSheet';
import { useAppLanguage } from '@/localization/useAppLanguage';
import { LINKUP_ID_LOGO, COIN_CURRENCY_ICON } from '@/constants/brandAssets';
import { loadGoogleAuthConfig, useGoogleSignIn } from '@/services/social-auth';
import { markOnboardingSeen } from '@/services/onboardingStorage';
import { useAuth } from '@/hooks/useAuth';

const GIFT_IMG = require('../../assets/images/welcome_gift.png');
const HERO_IMG = require('../../assets/images/welcome_center.png');
const COIN_IMG = COIN_CURRENCY_ICON;

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
    () => Math.min(Math.max(usableH / 740, 0.72), 1),
    [usableH],
  );
  const isSmall = W < 360;
  const isCompact = usableH < 700;
  const PAD = isSmall ? 14 : isCompact ? 16 : 20;
  const contentW = Math.min(W, 460);

  // تنفّس لطيف لصورة الهدية
  const giftY = useSharedValue(0);
  useEffect(() => {
    giftY.value = withRepeat(
      withTiming(-4, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const giftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: giftY.value }],
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

  const circleWrapSize = Math.round((isCompact ? 54 : 62) * scaleFactor);
  const iconSize = Math.round((isCompact ? 20 : 23) * scaleFactor);

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
      <LinearGradient
        colors={lu.gradients.pageHomeNight}
        style={StyleSheet.absoluteFill}
      />

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

          {/* ===== بطاقة المكافأة اليومية ===== */}
          <View style={[styles.rewardCard, { marginHorizontal: PAD, marginTop: 6 * scaleFactor }]}>
            <View style={[styles.rewardInner, { paddingVertical: 14 * scaleFactor, paddingHorizontal: 14 * scaleFactor }]}>
              <View style={styles.rewardTextCol}>
                <View style={styles.giftChip}>
                  <Gift size={11 * scaleFactor} color="#FF4D5A" strokeWidth={2.4} />
                  <Text style={[styles.giftChipText, { fontSize: 10.5 * scaleFactor }]}>
                    {t('auth.dailyBonus') || 'Daily Gift'}
                  </Text>
                </View>

                <View style={styles.titleRow}>
                  <Text style={[styles.rewardTitle, { fontSize: 21 * scaleFactor }]}>
                    {t('auth.rewardTitle') || 'Daily Reward'}
                  </Text>
                  <Sparkles size={14 * scaleFactor} color="#FF4D5A" style={{ marginHorizontal: 6 }} />
                </View>

                <Text
                  style={[
                    styles.rewardSub,
                    { fontSize: 12 * scaleFactor, lineHeight: 16 * scaleFactor, marginBottom: 10 * scaleFactor },
                  ]}
                >
                  {t('auth.rewardSubtitle') || 'Claim your reward and win free coins!'}
                </Text>

                <Pressable
                  onPress={() => Alert.alert(t('auth.rewardTitle') || 'Daily Reward', t('auth.rewardSubtitle') || 'Log in to claim your daily rewards!')}
                  style={({ pressed }) => [pressed && { opacity: 0.9 }]}
                >
                  <LinearGradient
                    colors={['#FF4D66', '#C40E2E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.claimBtn, { paddingVertical: 9 * scaleFactor }]}
                  >
                    <Text style={[styles.claimBtnText, { fontSize: 13.5 * scaleFactor }]}>
                      {t('auth.claimNow') || 'Claim Now'}
                    </Text>
                    <Image source={COIN_IMG} style={{ width: 16 * scaleFactor, height: 16 * scaleFactor }} contentFit="contain" />
                  </LinearGradient>
                </Pressable>
              </View>

              <AnimatedExpoImage
                source={GIFT_IMG}
                style={[styles.rewardGift, giftStyle, { width: 225 * scaleFactor, height: 175 * scaleFactor, marginVertical: -14 * scaleFactor }]}
                contentFit="contain"
              />
            </View>
          </View>

          {/* ===== القلب المركزي — أصل العميل ===== */}
          <View style={styles.heroSlot}>
            <Image
              source={HERO_IMG}
              style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.18 }, { translateY: 14 }] }]}
              contentFit="contain"
            />
          </View>

          {/* ===== أزرار الدخول ===== */}
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
                colors={['#A31220', '#C40E2E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.loginBtn, { height: 54 * scaleFactor }]}
              >
                <View style={[styles.loginIconCircle, { width: 34 * scaleFactor, height: 34 * scaleFactor, borderRadius: 17 * scaleFactor }]}>
                  <GoogleLogo size={19 * scaleFactor} />
                </View>
                <Text style={[styles.loginBtnText, { fontSize: 15.5 * scaleFactor }]}>
                  {t('auth.continueWithGoogle')}
                </Text>
                <ChevronRight size={18 * scaleFactor} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => handleSocialLogin('snapchat')}
              style={({ pressed }) => [
                { marginTop: 12 * scaleFactor },
                pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
              ]}
            >
              <LinearGradient
                colors={['#FFFC00', '#FFD900']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.loginBtn, { height: 54 * scaleFactor, shadowColor: '#F7B500' }]}
              >
                <View style={[styles.loginIconCircle, { width: 34 * scaleFactor, height: 34 * scaleFactor, borderRadius: 17 * scaleFactor }]}>
                  <SnapchatLogo size={19 * scaleFactor} color="#FFFC00" />
                </View>
                <Text style={[styles.loginBtnText, { fontSize: 15.5 * scaleFactor, color: '#1A1A1A' }]}>
                  {t('auth.loginWithSnapchat')}
                </Text>
                <ChevronRight size={18 * scaleFactor} color="#1A1A1A" />
              </LinearGradient>
            </Pressable>

            {/* ♥ فاصل ♥ */}
            <View style={[styles.divider, { marginTop: 16 * scaleFactor, marginBottom: 14 * scaleFactor }]}>
              <View style={styles.dividerLine} />
              <Heart size={11} color="#FF4D5A" strokeWidth={2.2} />
              <Text style={[styles.dividerText, { fontSize: 12 * scaleFactor }]}>
                {t('auth.text68438') || 'Or log in with'}
              </Text>
              <Heart size={11} color="#FF4D5A" strokeWidth={2.2} />
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.providerRow}>
              {PROVIDERS.map((p) => (
                <Pressable
                  key={p.key}
                  onPress={() => handleSocialLogin(p.key)}
                  style={({ pressed }) => [
                    styles.providerItem,
                    { gap: 8 * scaleFactor },
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
                  <Text style={[styles.providerLabel, { fontSize: 12 * scaleFactor }]} numberOfLines={1}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.termsText, { marginTop: 16 * scaleFactor, fontSize: 11 * scaleFactor, lineHeight: 16 * scaleFactor }]}>
              {t('auth.agreeOn') || 'I agree to'}{' '}
              <Text style={styles.termsLink}>{t('auth.termsOfUse') || 'Terms of Use'}</Text>
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
  container: { flex: 1, backgroundColor: lu.colors.night0 },
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
    marginVertical: 4,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,45,60,0.35)',
  },
  topBarBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },

  // بطاقة المكافأة اليومية — سمة Discover
  rewardCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,45,60,0.24)',
    backgroundColor: lu.colors.nightCard,
    overflow: 'hidden',
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  rewardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rewardTextCol: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  giftChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,90,105,0.28)',
    backgroundColor: 'rgba(255,60,75,0.16)',
    marginBottom: 8,
  },
  giftChipText: {
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyBold,
    includeFontPadding: false,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rewardTitle: {
    color: '#FFFFFF',
    fontFamily: lu.fonts.displayHeavy,
    includeFontPadding: false,
  },
  rewardSub: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: lu.fonts.body,
    includeFontPadding: false,
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderRadius: 99,
    gap: 7,
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  claimBtnText: {
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
  },
  rewardGift: {
    marginStart: -18,
    marginEnd: -10,
  },

  // أزرار الدخول الكبيرة
  loginBtn: {
    borderRadius: 99,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 14,
    shadowColor: '#FF1E30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  loginIconCircle: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyHeavy,
    includeFontPadding: false,
  },

  // الفاصل
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

  // أزرار المزوّدين الدائرية
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
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
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontFamily: lu.fonts.bodySemi,
    includeFontPadding: false,
  },
  termsLink: {
    color: '#FF4D5A',
    fontFamily: lu.fonts.bodyBold,
    textDecorationLine: 'underline',
  },
});
