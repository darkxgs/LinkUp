/**
 * خلفية شريط التبويب — هوية LinkUp الحمراء/البيضاء
 * شريط أبيض نقي مع حدّ رمادي خفيف وظلّ ناعم (الظل من حاوية الشريط).
 */
import React from 'react';
import { TAB_DESIGN } from '@/theme/tab-design';
import Svg, { G, Path, Rect } from 'react-native-svg';

const WINGS_PATH =
  'M10 40.9993C10.0001 22.0083 25.9904 6.93677 44.9482 8.05883L158.44 14.7758C160.47 14.8959 161.243 17.9714 159.724 19.3235C153.758 24.6351 150 32.3739 150 40.9905C150 49.6135 153.764 57.3571 159.738 62.6688C161.259 64.0207 160.485 67.1016 158.454 67.2218L44.9482 73.9397C25.9904 75.0618 10 59.9903 10 40.9993ZM313.052 8.05883C332.01 6.93677 348 22.0083 348 40.9993C348 59.9903 332.01 75.0618 313.052 73.9397L199.545 67.2219C197.514 67.1017 196.741 64.0207 198.261 62.6687C204.236 57.3571 208 49.6137 208 40.9905C208 32.3738 204.242 24.6351 198.275 19.3236C196.756 17.9715 197.53 14.8959 199.56 14.7758L313.052 8.05883Z';

type Props = {
  width: number;
  height?: number;
  centerActive?: boolean;
  isMask?: boolean;
};

export const TAB_BAR_VIEW_W = 358;
export const TAB_BAR_VIEW_H = 86;

/** مواقع الأيقونات في viewBox (358×86) */
export const TAB_SLOT_X = {
  index: 72,
  feed: 124,
  home: 179,
  chat: 234,
  profile: 286,
} as const;

export const TAB_ICON_Y = 41;

export function TabBarNavigationSvg({
  width,
  height = TAB_BAR_VIEW_H,
  isMask = false,
}: Props) {
  if (isMask) {
    return (
      <Svg width={width} height={height} viewBox={`0 0 ${TAB_BAR_VIEW_W} ${TAB_BAR_VIEW_H}`}>
        <G>
          {/* دائرة المركز */}
          <Rect x="156" y="18" width="46" height="46" rx="23" fill="#FFFFFF" />
          {/* الجناحان */}
          <Path d={WINGS_PATH} fill="#FFFFFF" />
        </G>
      </Svg>
    );
  }

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${TAB_BAR_VIEW_W} ${TAB_BAR_VIEW_H}`}>
      <G>
        {/* الجناحان — أبيض نقي */}
        <Path d={WINGS_PATH} fill="#FFFFFF" />
        {/* حدّ رمادي خفيف جداً */}
        <Path
          d={WINGS_PATH}
          fill="none"
          stroke="rgba(26, 17, 17, 0.06)"
          strokeWidth={1}
        />

        {/* دائرة المركز — أبيض نقي (يجلس خلف زر الهوم الأحمر) */}
        <Rect x="156" y="18" width="46" height="46" rx="23" fill="#FFFFFF" />
        <Rect
          x="156"
          y="18"
          width="46"
          height="46"
          rx="23"
          fill="none"
          stroke="rgba(26, 17, 17, 0.06)"
          strokeWidth={1}
        />
      </G>
    </Svg>
  );}

export { TAB_DESIGN };
