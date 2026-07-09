/**
 * خلفية لوحة المستوى — Level Details card Shape.svg
 */
import React from 'react';
import Svg, { Defs, Ellipse, G, LinearGradient, Mask, Path, Stop } from 'react-native-svg';

const VIEW_W = 353;
const VIEW_H = 143;

const PANEL_PATH =
  'M235.449 0C239.717 0 243 3.73131 243 8C243 45.5554 273.445 76 311 76C313.075 76 315.127 75.9071 317.155 75.7252C332.949 74.308 353 84.7367 353 100.595V123C353 134.046 344.046 143 333 143H20C8.95431 143 0 134.046 0 123V20C0 8.95431 8.95431 0 20 0H235.449Z';

const MASK_PATH =
  'M234.449 1C238.717 1 242 4.73131 242 9C242 46.5554 272.445 77 310 77C312.075 77 314.127 76.9071 316.155 76.7252C331.949 75.308 352 85.7367 352 101.595V122C352 133.046 343.046 142 332 142H21C9.95431 142 1 133.046 1 122V21C1 9.95431 9.95431 1 21 1H234.449Z';

type Props = {
  width: number;
  height?: number;
};

export function RelationshipLevelPanelShape({ width, height }: Props) {
  const h = height ?? (width / VIEW_W) * VIEW_H;
  return (
    <Svg width={width} height={h} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <LinearGradient id="relPanelGlowL" x1="44" y1="0" x2="44" y2="68" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#EB3434" />
          <Stop offset="1" stopColor="#EB3333" />
        </LinearGradient>
        <LinearGradient id="relPanelGlowR" x1="28" y1="0" x2="28" y2="43" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#EB3434" />
          <Stop offset="1" stopColor="#EB3333" />
        </LinearGradient>
        <Mask id="relPanelMask" maskUnits="userSpaceOnUse" x="0" y="0" width="353" height="143">
          <Path d={MASK_PATH} fill="#E11414" />
        </Mask>
      </Defs>
      <G>
        <Path d={PANEL_PATH} fill="#FFFFFF" />
        <Path d={PANEL_PATH} fill="#E11414" fillOpacity={0.08} />
        <G mask="url(#relPanelMask)">
          <Ellipse cx="44" cy="44" rx="44" ry="44" fill="url(#relPanelGlowL)" opacity={0.22} />
          <Ellipse cx="291" cy="108" rx="28" ry="28" fill="url(#relPanelGlowR)" opacity={0.18} />
        </G>
      </G>
    </Svg>
  );
}

export const REL_PANEL_ASPECT = VIEW_H / VIEW_W;
