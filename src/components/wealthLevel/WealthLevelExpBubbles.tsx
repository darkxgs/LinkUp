/**
 * فقاعات EXP العائمة — قابلة للضغط، تختفي وتُحسب عند الجمع
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  I18nManager,
  Pressable,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import {
  WEALTH_EXP_BUBBLE_DEFS,
  WEALTH_TODAY_BONUS,
  type WealthExpBubbleId,
} from '@/services/firebase/wealthLevel';

type BubbleSpec = {
  id: WealthExpBubbleId;
  amount: number;
  size: number;
  top: number;
  offset: number;
  delay: number;
};

const BUBBLE_LAYOUT: Omit<BubbleSpec, 'id' | 'amount'>[] = [
  { size: 52, top: -6, offset: -28, delay: 0 },
  { size: 44, top: 18, offset: -42, delay: 400 },
  { size: 48, top: 4, offset: 8, delay: 800 },
];

type Props = {
  style?: StyleProp<ViewStyle>;
  claimedIds?: string[];
  claimingId?: string | null;
  onClaim?: (id: WealthExpBubbleId, amount: number) => void;
};

function ExpBubble({
  id,
  amount,
  size,
  top,
  offset,
  delay,
  claiming,
  onClaim,
}: BubbleSpec & { claiming: boolean; onClaim?: (id: WealthExpBubbleId, amount: number) => void }) {
  const { t } = useTranslation();
  const floatY = useRef(new Animated.Value(0)).current;
  const floatX = useRef(new Animated.Value(0)).current;
  const popScale = useRef(new Animated.Value(1)).current;
  const popOpacity = useRef(new Animated.Value(1)).current;
  const [popping, setPopping] = useState(false);

  useEffect(() => {
    if (popping) return;
    const animY = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -5,
          duration: 2200,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const animX = Animated.loop(
      Animated.sequence([
        Animated.timing(floatX, {
          toValue: I18nManager.isRTL ? -3 : 3,
          duration: 2800,
          delay: delay + 200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatX, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    animY.start();
    animX.start();
    return () => {
      animY.stop();
      animX.stop();
    };
  }, [delay, floatX, floatY, popping]);

  const handlePress = () => {
    if (popping || claiming || !onClaim) return;
    setPopping(true);
    Animated.parallel([
      Animated.timing(popScale, {
        toValue: 1.35,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(popOpacity, {
        toValue: 0,
        duration: 220,
        delay: 80,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClaim(id, amount);
    });
  };

  const side = I18nManager.isRTL
    ? { right: offset }
    : { left: offset };

  return (
    <Animated.View
      style={[
        styles.bubbleWrap,
        {
          width: size,
          height: size,
          top,
          ...side,
          opacity: popOpacity,
          transform: [
            { translateY: floatY },
            { translateX: floatX },
            { scale: popScale },
          ],
        },
      ]}
    >
      <Pressable
        onPress={handlePress}
        disabled={popping || claiming}
        style={({ pressed }) => [
          { width: size, height: size },
          pressed && !popping && { opacity: 0.88 },
        ]}
        hitSlop={8}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.92)', 'rgba(249, 190, 190, 0.75)', 'rgba(245, 155, 155, 0.55)']}
          style={[styles.bubble, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <View style={styles.bubbleHighlight} />
          <View style={styles.bubbleShine} />
          {claiming ? (
            <ActivityIndicator size="small" color="#AF1E1E" />
          ) : (
            <Text weight="bold" style={[styles.bubbleText, { fontSize: size < 46 ? 10 : 11 }]}>
              {t('wealthLevel.expReward', { count: amount })}
            </Text>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

export function WealthLevelExpBubbles({
  style,
  claimedIds = [],
  claimingId = null,
  onClaim,
}: Props) {
  const bubbles: BubbleSpec[] = WEALTH_EXP_BUBBLE_DEFS.map((def, i) => ({
    id: def.id,
    amount: def.id === '2' ? WEALTH_TODAY_BONUS : def.amount,
    ...BUBBLE_LAYOUT[i]!,
  }));

  const visible = bubbles.filter((b) => !claimedIds.includes(b.id));
  if (visible.length === 0) return null;

  return (
    <View style={[styles.host, style]}>
      {visible.map((b) => (
        <ExpBubble
          key={b.id}
          {...b}
          claiming={claimingId === b.id}
          onClaim={onClaim}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    overflow: 'visible',
  },
  bubbleWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#F06A6A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  bubbleHighlight: {
    position: 'absolute',
    top: 8,
    left: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  bubbleShine: {
    position: 'absolute',
    top: -6,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  bubbleText: {
    color: '#AF1E1E',
    fontFamily: lu.fonts.displayHeavy,
    textAlign: 'center',
    lineHeight: 14,
    includeFontPadding: false,
    zIndex: 1,
  },
});
