/**
 * أيقونات شاشة العلاقة — من Line up App Full File / Icons
 */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import type { LuDesignIconProps } from '@/components/icons/LuDesignIcons';

const sw = (strokeWidth?: number) => strokeWidth ?? 1.5;

export function RelLockIcon({ size = 12, color = '#9A9AA5', strokeWidth }: LuDesignIconProps) {
  const s = sw(strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 10V8C7 5.23858 9.23858 3 12 3C14.7614 3 17 5.23858 17 8V10"
        stroke={color}
        strokeWidth={s}
        strokeLinecap="round"
      />
      <Path
        d="M5 10H19C20.1046 10 21 10.8954 21 12V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V12C3 10.8954 3.89543 10 5 10Z"
        stroke={color}
        strokeWidth={s}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function RelQuestionIcon({ size = 20, color = '#1B1B22', strokeWidth }: LuDesignIconProps) {
  const s = sw(strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={s} />
      <Path
        d="M9.5 9.5C9.5 8.11929 10.6193 7 12 7C13.3807 7 14.5 8.11929 14.5 9.5C14.5 10.5 13.8 11.2 12.9 11.7C12.4 12 12 12.5 12 13.2V14"
        stroke={color}
        strokeWidth={s}
        strokeLinecap="round"
      />
      <Circle cx="12" cy="17.5" r="0.75" fill={color} />
    </Svg>
  );
}
