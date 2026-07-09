/**
 * RoomRocketLaunchAnimation — إطلاق صاروخ بسيط وناعم:
 * صعود سلس، توهج ملوّن خفيف، مطر كوينز خفيف. بدون وميض أبيض.
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { RocketIcon } from '@/components/ui/GameIcons';
import { CoinIcon } from '@/components/ui/CoinIcon';
import {
  ROCKET_LEVEL_COINS,
  type RocketLevel,
  type RoomRocketLaunch,
} from '@/services/roomRocket';
import { playRoomSoundSource } from '@/utils/playRoomSound';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const ROCKET_DEST_Y = -SCREEN_H * 0.72;

const LEVEL_COLORS: Record<RocketLevel, { main: string; secondary: string; glow: string }> = {
  1: { main: '#ED4444', secondary: '#F06A6A', glow: 'rgba(237,68,68,0.35)' },
  2: { main: '#E11414', secondary: '#FF6670', glow: 'rgba(225,20,20,0.38)' },
  3: { main: '#F59E0B', secondary: '#FBBF24', glow: 'rgba(245,158,11,0.4)' },
};

const COIN_COUNTS: Record<RocketLevel, number> = {
  1: 12,
  2: 16,
  3: 20,
};

type Props = {
  launch: RoomRocketLaunch;
  onComplete: () => void;
};

interface CoinConfig {
  key: string;
  size: number;
  startX: number;
  driftX: number;
  delay: number;
  duration: number;
}

function makeCoins(level: RocketLevel): CoinConfig[] {
  const count = COIN_COUNTS[level];
  const rng = (min: number, max: number) => Math.random() * (max - min) + min;
  return Array.from({ length: count }, (_, i) => ({
    key: `coin-${i}`,
    size: Math.round(rng(14, 24)),
    startX: rng(8, SCREEN_W - 28),
    driftX: rng(-28, 28),
    delay: Math.round(rng(200, 900)),
    duration: Math.round(rng(1600, 2600)),
  }));
}

function FallingCoin({ config }: { config: CoinConfig }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: config.duration,
      delay: config.delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, config.duration, config.delay]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, SCREEN_H * 0.75],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, config.driftX],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.08, 0.75, 1],
    outputRange: [0, 0.85, 0.85, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.coin,
        {
          left: config.startX,
          width: config.size,
          height: config.size,
          transform: [{ translateX }, { translateY }],
          opacity,
        },
      ]}
    >
      <CoinIcon size={config.size} />
    </Animated.View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ROCKET_SOUND = require('../../../assets/sounds/rocket_launch.mp3');

export function RoomRocketLaunchAnimation({ launch, onComplete }: Props) {
  const { t } = useTranslation();
  const [showCoins, setShowCoins] = useState(false);
  const [done, setDone] = useState(false);

  const rocketTranslateY = useRef(new Animated.Value(0)).current;
  const rocketOpacity = useRef(new Animated.Value(0)).current;
  const rocketScale = useRef(new Animated.Value(0.88)).current;
  const trailOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.4)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTranslateY = useRef(new Animated.Value(-8)).current;
  const rootOpacity = useRef(new Animated.Value(0)).current;
  const finishedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const levelColors = LEVEL_COLORS[launch.level];
  const coins = useMemo(() => makeCoins(launch.level), [launch.level]);

  const finish = useCallback((animateOut = true) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (!animateOut) {
      setDone(true);
      onCompleteRef.current();
      return;
    }
    Animated.timing(rootOpacity, {
      toValue: 0,
      duration: 380,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setDone(true);
      onCompleteRef.current();
    });
  }, [rootOpacity]);

  useEffect(() => {
    try {
      void playRoomSoundSource(ROCKET_SOUND, 0.45);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    finishedRef.current = false;
    setShowCoins(false);
    setDone(false);

    rocketTranslateY.setValue(0);
    rocketOpacity.setValue(0);
    rocketScale.setValue(0.88);
    trailOpacity.setValue(0);
    glowScale.setValue(0.4);
    glowOpacity.setValue(0);
    bannerOpacity.setValue(0);
    bannerTranslateY.setValue(-8);
    rootOpacity.setValue(0);

    const intro = Animated.parallel([
      Animated.timing(rootOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(bannerTranslateY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rocketOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(rocketScale, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    intro.start(({ finished }) => {
      if (!finished || finishedRef.current) return;

      Animated.parallel([
        Animated.timing(rocketTranslateY, {
          toValue: ROCKET_DEST_Y,
          duration: 1100,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(trailOpacity, {
            toValue: 0.55,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(trailOpacity, {
            toValue: 0.2,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start(({ finished: riseDone }) => {
        if (!riseDone || finishedRef.current) return;

        Animated.parallel([
          Animated.timing(glowOpacity, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 1.6,
            duration: 520,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(rocketOpacity, {
            toValue: 0,
            duration: 280,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start(() => {
          Animated.timing(glowOpacity, {
            toValue: 0,
            duration: 420,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }).start();
        });

        setTimeout(() => {
          if (!finishedRef.current) setShowCoins(true);
        }, 180);
      });
    });

    const closeTimer = setTimeout(() => finish(true), 4200);
    const safetyTimer = setTimeout(() => finish(false), 5500);

    return () => {
      clearTimeout(closeTimer);
      clearTimeout(safetyTimer);
    };
  }, [launch.id, finish, rocketTranslateY, rocketOpacity, rocketScale, trailOpacity, glowScale, glowOpacity, bannerOpacity, bannerTranslateY, rootOpacity]);

  if (done) return null;

  return (
    <Animated.View pointerEvents="auto" style={[styles.root, { opacity: rootOpacity }]}>
      <Pressable style={styles.dimBackdrop} onPress={() => finish(true)} />

      <Pressable style={styles.skipHint} onPress={() => finish(true)}>
        <Text variant="caption" color="rgba(255,255,255,0.88)" weight="semibold">
          {t('roomRocket.tapToContinue', 'اضغط للمتابعة')}
        </Text>
      </Pressable>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.banner,
          {
            opacity: bannerOpacity,
            transform: [{ translateY: bannerTranslateY }],
          },
        ]}
      >
        <LinearGradient
          colors={[`${levelColors.main}EE`, `${levelColors.secondary}CC`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Sparkles size={14} color="#FCD34D" strokeWidth={2.2} />
        <Text
          variant="caption"
          weight="bold"
          color="#fff"
          numberOfLines={1}
          style={styles.bannerText}
        >
          {launch.senderName}
          {'  •  '}
          {ROCKET_LEVEL_COINS[launch.level].toLocaleString()}
        </Text>
      </Animated.View>

      {/* توهج ناعم عند الوصول — بدون وميض أبيض */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.arrivalGlow,
          {
            backgroundColor: levelColors.glow,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      <Pressable onPress={() => finish(true)}>
        <Animated.View
          style={[
            styles.rocketWrap,
            {
              opacity: rocketOpacity,
              transform: [
                { translateY: rocketTranslateY },
                { scale: rocketScale },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.trail,
              {
                backgroundColor: levelColors.glow,
                opacity: trailOpacity,
              },
            ]}
          />
          <RocketIcon
            size={72}
            color={levelColors.main}
            secondaryColor={levelColors.secondary}
          />
        </Animated.View>
      </Pressable>

      {showCoins ? (
        <View style={styles.coinsLayer} pointerEvents="none">
          {coins.map((c) => (
            <FallingCoin key={c.key} config={c} />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
  },
  dimBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  skipHint: {
    position: 'absolute',
    bottom: SCREEN_H * 0.12,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 20,
  },
  banner: {
    position: 'absolute',
    top: SCREEN_H * 0.09,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: 'hidden',
    maxWidth: SCREEN_W - 48,
    zIndex: 10,
  },
  bannerText: {
    flexShrink: 1,
  },
  arrivalGlow: {
    position: 'absolute',
    top: SCREEN_H * 0.06,
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    zIndex: 4,
  },
  rocketWrap: {
    position: 'absolute',
    bottom: SCREEN_H * 0.08,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: 96,
    height: 96,
    zIndex: 6,
  },
  trail: {
    position: 'absolute',
    bottom: -28,
    width: 14,
    height: 48,
    borderRadius: 7,
  },
  coinsLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
  },
  coin: {
    position: 'absolute',
    top: SCREEN_H * 0.1,
  },
});
