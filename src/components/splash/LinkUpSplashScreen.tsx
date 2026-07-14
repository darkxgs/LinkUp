/**
 * LinkUp — شاشة البداية (Splash)
 * تصميم العميل: شعار + وسم + أيقونة الثنائي + مؤشر موسيقي + شريط المزايا
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Users, Zap } from 'lucide-react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  type SharedValue,
} from 'react-native-reanimated';

import {
  LINKUP_MAIN_LOGO,
  LINKUP_SPLASH_BG,
  LINKUP_SPLASH_ICON,
} from '@/constants/brandAssets';
import { lu } from '@/theme/lu-brand';

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
        withTiming(1, { duration: 2600, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      ),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.9, 1.28]) }],
    opacity: interpolate(progress.value, [0, 0.15, 1], [0.55, 0.4, 0]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseRing,
        {
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

function EqBar({
  value,
  width,
  maxHeight,
  color,
}: {
  value: SharedValue<number>;
  width: number;
  maxHeight: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => ({
    height: Math.max(5, value.value * maxHeight),
    opacity: interpolate(value.value, [0.3, 1], [0.55, 1]),
  }));

  return (
    <Animated.View
      style={[{ width, borderRadius: width, backgroundColor: color }, style]}
    />
  );
}

function MusicEqualizer() {
  const bars = [
    useSharedValue(0.4),
    useSharedValue(0.7),
    useSharedValue(0.5),
    useSharedValue(0.95),
    useSharedValue(1),
    useSharedValue(0.8),
    useSharedValue(0.55),
    useSharedValue(0.72),
    useSharedValue(0.45),
  ];
  const durations = [480, 560, 420, 520, 460, 500, 440, 540, 470];

  useEffect(() => {
    bars.forEach((bar, index) => {
      bar.value = withRepeat(
        withSequence(
          withTiming(1, { duration: durations[index], easing: Easing.inOut(Easing.ease) }),
          withTiming(0.25, { duration: durations[index], easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.eqRow}>
      {bars.map((bar, index) => (
        <EqBar
          key={index}
          value={bar}
          width={5}
          maxHeight={26}
          color={index % 2 === 0 ? '#E11414' : '#FF4D5A'}
        />
      ))}
    </View>
  );
}

export function LinkUpSplashScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const logoSize = Math.min(width * 0.28, 124);
  const heroSize = Math.min(width * 0.78, 340);

  const reveal = useSharedValue(0);
  const heroReveal = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    reveal.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
    heroReveal.value = withDelay(
      200,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [breathe, heroReveal, reveal]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: interpolate(reveal.value, [0, 1], [14, 0]) }],
  }));

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroReveal.value,
    transform: [
      { scale: interpolate(heroReveal.value, [0, 1], [0.9, 1]) },
      { scale: interpolate(breathe.value, [0, 1], [1, 1.035]) },
    ],
  }));

  return (
    <View style={styles.root}>
      <Image
        source={LINKUP_SPLASH_BG}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />

      <View style={styles.content}>
        <Animated.View style={[styles.brandBlock, revealStyle]}>
          <Image
            source={LINKUP_MAIN_LOGO}
            style={{
              width: logoSize,
              height: logoSize,
              borderRadius: logoSize * 0.24,
            }}
            contentFit="cover"
          />
          <View style={styles.wordmarkRow}>
            <Text style={styles.wordmarkLink}>Link</Text>
            <Text style={styles.wordmarkUp}>Up</Text>
          </View>
          <Text style={styles.tagline}>{t('splash.tagline')}</Text>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDiamond} />
            <View style={styles.dividerLine} />
          </View>
        </Animated.View>

        <Animated.View
          style={[styles.heroStage, { width: heroSize, height: heroSize }, heroStyle]}
        >
          <PulseRing size={heroSize * 0.92} color="rgba(255,92,92,0.4)" delay={0} />
          <PulseRing size={heroSize * 0.92} color="rgba(225,20,20,0.32)" delay={900} />
          <PulseRing size={heroSize * 0.92} color="rgba(176,14,14,0.24)" delay={1800} borderWidth={1.5} />
          <Image
            source={LINKUP_SPLASH_ICON}
            style={{ width: heroSize, height: heroSize }}
            contentFit="contain"
          />
        </Animated.View>

        <MusicEqualizer />

        <Text style={styles.loadingText}>{t('splash.loading')}</Text>
      </View>

      <View style={styles.featuresBar}>
        <View style={styles.featureCell}>
          <ShieldCheck size={22} color="#FF3B4E" strokeWidth={2} />
          <View style={styles.featureTextCol}>
            <Text style={styles.featureTitle}>{t('splash.secure')}</Text>
            <Text style={styles.featureSub}>{t('splash.secureSub')}</Text>
          </View>
        </View>
        <View style={styles.featureDivider} />
        <View style={styles.featureCell}>
          <Users size={22} color="#FF3B4E" strokeWidth={2} />
          <View style={styles.featureTextCol}>
            <Text style={styles.featureTitle}>{t('splash.connect')}</Text>
            <Text style={styles.featureSub}>{t('splash.connectSub')}</Text>
          </View>
        </View>
        <View style={styles.featureDivider} />
        <View style={styles.featureCell}>
          <Zap size={22} color="#FF3B4E" strokeWidth={2} />
          <View style={styles.featureTextCol}>
            <Text style={styles.featureTitle}>{t('splash.instant')}</Text>
            <Text style={styles.featureSub}>{t('splash.instantSub')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0506',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 96,
  },
  brandBlock: {
    alignItems: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
  },
  wordmarkLink: {
    fontSize: 58,
    color: '#FFFFFF',
    fontFamily: lu.fonts.displayHeavy,
    fontWeight: '900',
    includeFontPadding: false,
    writingDirection: 'ltr',
  },
  wordmarkUp: {
    fontSize: 58,
    color: '#E11414',
    fontFamily: lu.fonts.displayHeavy,
    fontWeight: '900',
    includeFontPadding: false,
    writingDirection: 'ltr',
  },
  tagline: {
    marginTop: 10,
    fontSize: 16.5,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: lu.fonts.bodySemi,
    includeFontPadding: false,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 6,
  },
  dividerLine: {
    width: 74,
    height: 1,
    backgroundColor: 'rgba(255,70,80,0.4)',
  },
  dividerDiamond: {
    width: 7,
    height: 7,
    backgroundColor: '#E11414',
    transform: [{ rotate: '45deg' }],
  },
  heroStage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  pulseRing: {
    position: 'absolute',
  },
  eqRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 5,
    height: 28,
    marginTop: 14,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14.5,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: lu.fonts.body,
    includeFontPadding: false,
  },
  featuresBar: {
    position: 'absolute',
    bottom: 34,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,70,80,0.28)',
    backgroundColor: 'rgba(20,8,10,0.55)',
    paddingVertical: 13,
    paddingHorizontal: 10,
  },
  featureCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  featureDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  featureTextCol: {
    minWidth: 0,
  },
  featureTitle: {
    fontSize: 13.5,
    color: '#FFFFFF',
    fontFamily: lu.fonts.bodyHeavy,
    fontWeight: '800',
    includeFontPadding: false,
  },
  featureSub: {
    marginTop: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: lu.fonts.body,
    includeFontPadding: false,
  },
});
