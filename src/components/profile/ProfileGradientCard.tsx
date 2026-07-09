/**
 * كاردات البروفايل — شكل Friend Profile Shape + تدرّج Header Background
 */
import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import {
  WAISTED_SHAPE_PATH,
  WAISTED_SHAPE_VIEW_H,
  WAISTED_SHAPE_VIEW_W,
  buildSunburstLines,
} from './profileWaistedShape';

export type ProfileCardVariant = 'coins' | 'pearls' | 'aristocracy' | 'vip';

const CARD_GRADIENTS: Record<
  ProfileCardVariant,
  { stops: { offset: string; color: string }[]; x1: string; y1: string; x2: string; y2: string }
> = {
  coins: {
    stops: [
      { offset: '0', color: '#E11414' },
      { offset: '0.55', color: '#E02B2B' },
      { offset: '1', color: '#FECACA' },
    ],
    x1: '0', y1: '0.5', x2: '1', y2: '0.5',
  },
  pearls: {
    stops: [
      { offset: '0', color: '#E11414' },
      { offset: '0.45', color: '#EC3E3E' },
      { offset: '1', color: '#EF5F5F' },
    ],
    x1: '0', y1: '0.5', x2: '1', y2: '0.5',
  },
  aristocracy: {
    stops: [
      { offset: '0', color: '#E11414' },
      { offset: '0.5', color: '#E02B2B' },
      { offset: '1', color: '#FECACA' },
    ],
    x1: '0', y1: '0', x2: '1', y2: '1',
  },
  vip: {
    stops: [
      { offset: '0', color: '#EF5F5F' },
      { offset: '0.5', color: '#E11414' },
      { offset: '1', color: '#E11414' },
    ],
    x1: '0', y1: '0', x2: '1', y2: '1',
  },
};

type Props = {
  width: number;
  height?: number;
  variant: ProfileCardVariant;
  style?: ViewStyle;
  children?: React.ReactNode;
  showSunburst?: boolean;
};

export function ProfileGradientCard({
  width,
  height,
  variant,
  style,
  children,
  showSunburst = true,
}: Props) {
  const cardH = height ?? Math.round(width * 0.46);
  const gradId = `pg_${variant}`;
  const g = CARD_GRADIENTS[variant];
  const sunburst = useMemo(() => buildSunburstLines(), []);

  return (
    <View style={[{ width, height: cardH }, style]}>
      <Svg
        width={width}
        height={cardH}
        viewBox={`0 0 ${WAISTED_SHAPE_VIEW_W} ${WAISTED_SHAPE_VIEW_H}`}
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <LinearGradient id={gradId} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
            {g.stops.map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </LinearGradient>
        </Defs>

        <G>
          <Path d={WAISTED_SHAPE_PATH} fill={`url(#${gradId})`} />
          {showSunburst &&
            sunburst.map((d, i) => (
              <Path
                key={`sb${i}`}
                d={d}
                stroke="#FFFFFF"
                strokeWidth={0.35}
                strokeOpacity={0.18}
              />
            ))}
          <Path
            d={WAISTED_SHAPE_PATH}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={0.6}
            strokeOpacity={0.35}
          />
        </G>
      </Svg>
      {children ? (
        <View style={[StyleSheet.absoluteFill, styles.content]}>{children}</View>
      ) : null}
    </View>
  );
}

/** دائرة زجاجية للأيقونة داخل كارد المحفظة */
export function ProfileWalletIconGlass({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.glassWrap}>
      <Svg
        width={46}
        height={46}
        viewBox="0 0 46 46"
        style={StyleSheet.absoluteFill}
      >
        <Circle cx={23} cy={23} r={22} fill="#FFFFFF" fillOpacity={0.22} />
        <Circle cx={23} cy={23} r={22} fill="none" stroke="#FFFFFF" strokeWidth={1} strokeOpacity={0.45} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  glassWrap: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
